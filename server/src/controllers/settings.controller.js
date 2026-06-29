const prisma = require("../config/prisma");

const DEFAULT_POLICY_ID = "default-work-policy";

const normalizeWeekendDays = (weekendDays) => {
  if (Array.isArray(weekendDays)) {
    return weekendDays
      .map((day) => Number(day))
      .filter((day) => day >= 0 && day <= 6)
      .join(",");
  }

  if (typeof weekendDays === "string") {
    return weekendDays;
  }

  return "5,6";
};

const parseWeekendDays = (weekendDays) => {
  if (!weekendDays) return [5, 6];

  return weekendDays
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => item >= 0 && item <= 6);
};

const ensureDefaultWorkPolicy = async () => {
  let policy = await prisma.workPolicy.findUnique({
    where: { id: DEFAULT_POLICY_ID },
  });

  if (!policy) {
    policy = await prisma.workPolicy.create({
      data: {
        id: DEFAULT_POLICY_ID,
        name: "Default Work Policy",
        weekendDays: "5,6",
        shiftStartTime: "08:00",
        shiftEndTime: "17:00",
        isActive: true,
      },
    });
  }

  return policy;
};

const getWorkPolicy = async (req, res) => {
  try {
    const policy = await ensureDefaultWorkPolicy();

    return res.json({
      success: true,
      policy: {
        ...policy,
        weekendDays: parseWeekendDays(policy.weekendDays),
      },
    });
  } catch (error) {
    console.error("Get work policy error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching work policy.",
      error: error.message,
    });
  }
};

const updateWorkPolicy = async (req, res) => {
  try {
    const { weekendDays, shiftStartTime, shiftEndTime } = req.body;

    await ensureDefaultWorkPolicy();

    const updated = await prisma.workPolicy.update({
      where: { id: DEFAULT_POLICY_ID },
      data: {
        weekendDays: normalizeWeekendDays(weekendDays),
        shiftStartTime: shiftStartTime || undefined,
        shiftEndTime: shiftEndTime || undefined,
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId: req.user.id,
        action: "UPDATE_WORK_POLICY",
        targetId: DEFAULT_POLICY_ID,
      },
    });

    return res.json({
      success: true,
      message: "Work policy updated successfully.",
      policy: {
        ...updated,
        weekendDays: parseWeekendDays(updated.weekendDays),
      },
    });
  } catch (error) {
    console.error("Update work policy error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while updating work policy.",
      error: error.message,
    });
  }
};

module.exports = {
  getWorkPolicy,
  updateWorkPolicy,
};