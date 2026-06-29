const prisma = require("../config/prisma");

const checkIn = async (req, res) => {
  try {
    if (req.user.role !== "EMPLOYEE" || !req.user.employee) {
      return res.status(403).json({
        success: false,
        message: "Only employees can check in.",
      });
    }

    const employeeId = req.user.employee.id;
    const { pcName } = req.body;

    const activeAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId,
        status: "CHECKED_IN",
      },
    });

    if (activeAttendance) {
      return res.status(400).json({
        success: false,
        message: "You are already checked in.",
      });
    }

    const attendance = await prisma.attendance.create({
      data: {
        employeeId,
        checkInTime: new Date(),
        status: "CHECKED_IN",
      },
    });

    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        pcName: pcName || req.user.employee.pcName,
        isOnline: true,
        lastSeenAt: new Date(),
      },
    });

    return res.status(201).json({
      success: true,
      message: "Check-in successful.",
      attendance,
    });
  } catch (error) {
    console.error("Check-in error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error during check-in.",
    });
  }
};

const checkOut = async (req, res) => {
  try {
    if (req.user.role !== "EMPLOYEE" || !req.user.employee) {
      return res.status(403).json({
        success: false,
        message: "Only employees can check out.",
      });
    }

    const employeeId = req.user.employee.id;

    const activeAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId,
        status: "CHECKED_IN",
      },
      orderBy: {
        checkInTime: "desc",
      },
    });

    if (!activeAttendance) {
      return res.status(400).json({
        success: false,
        message: "No active check-in found.",
      });
    }

    const checkOutTime = new Date();
    const checkInTime = new Date(activeAttendance.checkInTime);

    const totalMinutes = Math.round((checkOutTime - checkInTime) / 1000 / 60);

    const attendance = await prisma.attendance.update({
      where: { id: activeAttendance.id },
      data: {
        checkOutTime,
        status: "CHECKED_OUT",
        totalMinutes,
      },
    });

    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        isOnline: false,
        lastSeenAt: new Date(),
      },
    });

    return res.json({
      success: true,
      message: "Check-out successful.",
      attendance,
    });
  } catch (error) {
    console.error("Check-out error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error during check-out.",
    });
  }
};

const myAttendance = async (req, res) => {
  try {
    if (req.user.role !== "EMPLOYEE" || !req.user.employee) {
      return res.status(403).json({
        success: false,
        message: "Only employees can view their attendance.",
      });
    }

    const attendances = await prisma.attendance.findMany({
      where: {
        employeeId: req.user.employee.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      success: true,
      attendances,
    });
  } catch (error) {
    console.error("My attendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching attendance.",
    });
  }
};

const allAttendance = async (req, res) => {
  try {
    const attendances = await prisma.attendance.findMany({
      include: {
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
      attendances,
    });
  } catch (error) {
    console.error("All attendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching attendance.",
    });
  }
};

module.exports = {
  checkIn,
  checkOut,
  myAttendance,
  allAttendance,
};