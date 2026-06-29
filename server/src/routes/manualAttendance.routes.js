const express = require("express");

const {
  getMyManualAttendance,
  getAllManualAttendance,
  upsertManualAttendance,
  deleteManualAttendance,
} = require("../controllers/manualAttendance.controller");

const { protect, allowRoles } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/me", protect, getMyManualAttendance);

router.get("/all", protect, allowRoles("ADMIN"), getAllManualAttendance);

router.post("/upsert", protect, allowRoles("ADMIN"), upsertManualAttendance);

router.delete("/:id", protect, allowRoles("ADMIN"), deleteManualAttendance);

module.exports = router;