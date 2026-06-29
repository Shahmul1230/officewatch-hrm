const prisma = require("../config/prisma");

const DEFAULT_LEAVE_TYPES = [
  {
    name: "Casual Leave",
    code: "CASUAL",
    yearlyAllowance: 7,
    isPaid: true,
  },
  {
    name: "Sick Leave",
    code: "SICK",
    yearlyAllowance: 10,
    isPaid: true,
  },
  {
    name: "Annual Leave",
    code: "ANNUAL",
    yearlyAllowance: 14,
    isPaid: true,
  },
  {
    name: "Emergency Leave",
    code: "EMERGENCY",
    yearlyAllowance: 3,
    isPaid: true,
  },
  {
    name: "Unpaid Leave",
    code: "UNPAID",
    yearlyAllowance: 0,
    isPaid: false,
  },
];

const ensureDefaultLeaveTypes = async () => {
  for (const item of DEFAULT_LEAVE_TYPES) {
    const exists = await prisma.leaveType.findUnique({
      where: { code: item.code },
    });

    if (!exists) {
      await prisma.leaveType.create({
        data: item,
      });
    }
  }
};

const calculateLeaveDays = (startDate, endDate, isHalfDay = false) => {
  if (isHalfDay) return 0.5;

  const start = new Date(startDate);
  const end = new Date(endDate);

  const startOnly = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );

  const endOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  const diffMs = endOnly.getTime() - startOnly.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;

  return days > 0 ? days : 1;
};

const getLeaveTypes = async (req, res) => {
  try {
    await ensureDefaultLeaveTypes();

    const leaveTypes = await prisma.leaveType.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });

    return res.json({
      success: true,
      leaveTypes,
    });
  } catch (error) {
    console.error("Get leave types error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching leave types.",
      error: error.message,
    });
  }
};

const getMyLeaveRequests = async (req, res) => {
  try {
    if (req.user.role !== "EMPLOYEE" || !req.user.employee) {
      return res.status(403).json({
        success: false,
        message: "Only employees can view their leave requests.",
      });
    }

    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId: req.user.employee.id,
      },
      include: {
        leaveType: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      success: true,
      leaveRequests,
    });
  } catch (error) {
    console.error("Get my leave requests error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching leave requests.",
      error: error.message,
    });
  }
};

const getMyLeaveSummary = async (req, res) => {
  try {
    if (req.user.role !== "EMPLOYEE" || !req.user.employee) {
      return res.status(403).json({
        success: false,
        message: "Only employees can view their leave summary.",
      });
    }

    await ensureDefaultLeaveTypes();

    const leaveTypes = await prisma.leaveType.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });

    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);

    const summary = [];

    for (const leaveType of leaveTypes) {
      const approved = await prisma.leaveRequest.aggregate({
        where: {
          employeeId: req.user.employee.id,
          leaveTypeId: leaveType.id,
          status: "APPROVED",
          startDate: {
            gte: yearStart,
            lte: yearEnd,
          },
        },
        _sum: {
          days: true,
        },
      });

      const pending = await prisma.leaveRequest.aggregate({
        where: {
          employeeId: req.user.employee.id,
          leaveTypeId: leaveType.id,
          status: "PENDING",
          startDate: {
            gte: yearStart,
            lte: yearEnd,
          },
        },
        _sum: {
          days: true,
        },
      });

      const taken = approved._sum.days || 0;
      const pendingDays = pending._sum.days || 0;

      const remaining =
        leaveType.yearlyAllowance > 0
          ? Math.max(leaveType.yearlyAllowance - taken, 0)
          : 0;

      summary.push({
        leaveTypeId: leaveType.id,
        name: leaveType.name,
        code: leaveType.code,
        yearlyAllowance: leaveType.yearlyAllowance,
        taken,
        pending: pendingDays,
        remaining,
        isPaid: leaveType.isPaid,
      });
    }

    return res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("Get leave summary error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching leave summary.",
      error: error.message,
    });
  }
};

const applyLeave = async (req, res) => {
  try {
    if (req.user.role !== "EMPLOYEE" || !req.user.employee) {
      return res.status(403).json({
        success: false,
        message: "Only employees can apply for leave.",
      });
    }

    const { leaveTypeId, startDate, endDate, reason, isHalfDay } = req.body;

    if (!leaveTypeId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Leave type, start date and end date are required.",
      });
    }

    const leaveType = await prisma.leaveType.findUnique({
      where: { id: leaveTypeId },
    });

    if (!leaveType || !leaveType.isActive) {
      return res.status(404).json({
        success: false,
        message: "Invalid leave type.",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid leave date.",
      });
    }

    if (end < start) {
      return res.status(400).json({
        success: false,
        message: "End date cannot be before start date.",
      });
    }

    const days = calculateLeaveDays(start, end, Boolean(isHalfDay));

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: req.user.employee.id,
        leaveTypeId,
        startDate: start,
        endDate: end,
        days,
        reason: reason || "",
        status: "PENDING",
      },
      include: {
        leaveType: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Leave request submitted successfully.",
      leaveRequest,
    });
  } catch (error) {
    console.error("Apply leave error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while applying for leave.",
      error: error.message,
    });
  }
};

const getAllLeaveRequests = async (req, res) => {
  try {
    const leaveRequests = await prisma.leaveRequest.findMany({
      include: {
        leaveType: true,
        employee: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      success: true,
      leaveRequests,
    });
  } catch (error) {
    console.error("Get all leave requests error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching leave requests.",
      error: error.message,
    });
  }
};

const approveLeave = async (req, res) => {
  try {
    const { leaveId } = req.params;
    const { adminNote } = req.body;

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: leaveId },
    });

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found.",
      });
    }

    if (leaveRequest.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Only pending leave requests can be approved.",
      });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: "APPROVED",
        adminNote: adminNote || "",
        reviewedAt: new Date(),
      },
      include: {
        leaveType: true,
        employee: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId: req.user.id,
        action: "APPROVE_LEAVE",
        targetId: leaveId,
      },
    });

    return res.json({
      success: true,
      message: "Leave approved successfully.",
      leaveRequest: updated,
    });
  } catch (error) {
    console.error("Approve leave error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while approving leave.",
      error: error.message,
    });
  }
};

const rejectLeave = async (req, res) => {
  try {
    const { leaveId } = req.params;
    const { adminNote } = req.body;

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: leaveId },
    });

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found.",
      });
    }

    if (leaveRequest.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "Only pending leave requests can be rejected.",
      });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: "REJECTED",
        adminNote: adminNote || "",
        reviewedAt: new Date(),
      },
      include: {
        leaveType: true,
        employee: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId: req.user.id,
        action: "REJECT_LEAVE",
        targetId: leaveId,
      },
    });

    return res.json({
      success: true,
      message: "Leave rejected successfully.",
      leaveRequest: updated,
    });
  } catch (error) {
    console.error("Reject leave error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while rejecting leave.",
      error: error.message,
    });
  }
};

module.exports = {
  getLeaveTypes,
  getMyLeaveRequests,
  getMyLeaveSummary,
  applyLeave,
  getAllLeaveRequests,
  approveLeave,
  rejectLeave,
};