const express = require("express");

const {
  getLeaveTypes,
  getMyLeaveRequests,
  getMyLeaveSummary,
  applyLeave,
  getAllLeaveRequests,
  approveLeave,
  rejectLeave,
} = require("../controllers/leave.controller");

const { protect, allowRoles } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/types", protect, getLeaveTypes);

router.get("/me", protect, allowRoles("EMPLOYEE"), getMyLeaveRequests);

router.get("/summary/me", protect, allowRoles("EMPLOYEE"), getMyLeaveSummary);

router.post("/apply", protect, allowRoles("EMPLOYEE"), applyLeave);

router.get("/all", protect, allowRoles("ADMIN"), getAllLeaveRequests);

router.patch("/:leaveId/approve", protect, allowRoles("ADMIN"), approveLeave);

router.patch("/:leaveId/reject", protect, allowRoles("ADMIN"), rejectLeave);

module.exports = router;