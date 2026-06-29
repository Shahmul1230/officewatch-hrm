const prisma = require("../config/prisma");

const ALLOWED_STATUSES = ["PRESENT", "ABSENT", "LATE", "MOVEMENT", "LEAVE"];

const getMonthRange = (monthValue) => {
  const now = new Date();

  if (!monthValue || !/^\d{4}-\d{2}$/.test(monthValue)) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start, end };
  }

  const [year, month] = monthValue.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  return { start, end };
};

const parseDateOnly = (dateValue) => {
  const date = new Date(`${dateValue}T00:00:00`);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const buildDateTime = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) return null;
  return new Date(`${dateValue}T${timeValue}:00`);
};

const calculateMinutes = (checkInTime, checkOutTime) => {
  if (!checkInTime || !checkOutTime) return null;

  const diffMs = new Date(checkOutTime) - new Date(checkInTime);
  if (diffMs <= 0) return null;

  return Math.round(diffMs / 60000);
};

const getMyManualAttendance = async (req, res) => {
  try {
    const { month } = req.query;
    const { start, end } = getMonthRange(month);

    const employee = await prisma.employee.findUnique({
      where: { userId: req.user.id },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee profile not found.",
      });
    }

    const records = await prisma.attendanceAdjustment.findMany({
      where: {
        employeeId: employee.id,
        date: {
          gte: start,
          lt: end,
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    return res.json({
      success: true,
      records,
    });
  } catch (error) {
    console.error("Get my manual attendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while loading manual attendance.",
      error: error.message,
    });
  }
};

const getAllManualAttendance = async (req, res) => {
  try {
    const { month, employeeId } = req.query;
    const { start, end } = getMonthRange(month);

    const where = {
      date: {
        gte: start,
        lt: end,
      },
    };

    if (employeeId) {
      where.employeeId = employeeId;
    }

    const records = await prisma.attendanceAdjustment.findMany({
      where,
      include: {
        employee: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    return res.json({
      success: true,
      records,
    });
  } catch (error) {
    console.error("Get all manual attendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while loading manual attendance records.",
      error: error.message,
    });
  }
};

const upsertManualAttendance = async (req, res) => {
  try {
    const {
      employeeId,
      date,
      status,
      checkInTime,
      checkOutTime,
      isPayable,
      reason,
    } = req.body;

    if (!employeeId || !date || !status) {
      return res.status(400).json({
        success: false,
        message: "Employee, date and status are required.",
      });
    }

    const statusValue = String(status).toUpperCase();

    if (!ALLOWED_STATUSES.includes(statusValue)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance status.",
      });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    const dateOnly = parseDateOnly(date);
    const checkInDateTime = buildDateTime(date, checkInTime);
    const checkOutDateTime = buildDateTime(date, checkOutTime);
    const totalMinutes = calculateMinutes(checkInDateTime, checkOutDateTime);

    const record = await prisma.attendanceAdjustment.upsert({
      where: {
        employeeId_date: {
          employeeId,
          date: dateOnly,
        },
      },
      create: {
        employeeId,
        date: dateOnly,
        status: statusValue,
        checkInTime: checkInDateTime,
        checkOutTime: checkOutDateTime,
        totalMinutes,
        isPayable: Boolean(isPayable),
        reason: reason || null,
        createdByAdminId: req.user.id,
      },
      update: {
        status: statusValue,
        checkInTime: checkInDateTime,
        checkOutTime: checkOutDateTime,
        totalMinutes,
        isPayable: Boolean(isPayable),
        reason: reason || null,
        createdByAdminId: req.user.id,
      },
    });

    return res.json({
      success: true,
      message: "Manual attendance updated successfully.",
      record,
    });
  } catch (error) {
    console.error("Manual attendance upsert error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while updating manual attendance.",
      error: error.message,
    });
  }
};

const deleteManualAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.attendanceAdjustment.delete({
      where: { id },
    });

    return res.json({
      success: true,
      message: "Manual attendance deleted successfully.",
    });
  } catch (error) {
    console.error("Delete manual attendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while deleting manual attendance.",
      error: error.message,
    });
  }
};

module.exports = {
  getMyManualAttendance,
  getAllManualAttendance,
  upsertManualAttendance,
  deleteManualAttendance,
};