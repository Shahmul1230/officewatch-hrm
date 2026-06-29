const express = require("express");
const {
  checkIn,
  checkOut,
  myAttendance,
  allAttendance,
} = require("../controllers/attendance.controller");

const { protect, allowRoles } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/check-in", protect, allowRoles("EMPLOYEE"), checkIn);
router.post("/check-out", protect, allowRoles("EMPLOYEE"), checkOut);
router.get("/me", protect, allowRoles("EMPLOYEE"), myAttendance);

router.get("/all", protect, allowRoles("ADMIN"), allAttendance);

module.exports = router;