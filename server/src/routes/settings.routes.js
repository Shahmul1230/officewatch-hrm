const express = require("express");

const {
  getWorkPolicy,
  updateWorkPolicy,
} = require("../controllers/settings.controller");

const { protect, allowRoles } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/work-policy", protect, getWorkPolicy);

router.patch(
  "/work-policy",
  protect,
  allowRoles("ADMIN"),
  updateWorkPolicy
);

module.exports = router;