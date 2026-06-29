const express = require("express");

const {
  getEmployees,
  getMyEmployeeProfile,
  createEmployee,
  updateEmployee,
} = require("../controllers/employee.controller");

const { protect, allowRoles } = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/me", protect, allowRoles("EMPLOYEE"), getMyEmployeeProfile);

router.get("/", protect, allowRoles("ADMIN"), getEmployees);

router.post("/", protect, allowRoles("ADMIN"), createEmployee);

router.patch("/:id", protect, allowRoles("ADMIN"), updateEmployee);

module.exports = router;