const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");

const normalizeEmployeeCode = (value) => {
  const raw = String(value || "").trim();

  if (!raw) return "";

  if (/^\d+$/.test(raw)) {
    return raw.padStart(4, "0");
  }

  return raw.toUpperCase();
};

const getEmployees = async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      employees,
    });
  } catch (error) {
    console.error("Get employees error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while loading employees.",
      error: error.message,
    });
  }
};

const getMyEmployeeProfile = async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: {
        userId: req.user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
          },
        },
      },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee profile not found.",
      });
    }

    return res.json({
      success: true,
      employee,
    });
  } catch (error) {
    console.error("Get my employee profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while loading employee profile.",
      error: error.message,
    });
  }
};

const createEmployee = async (req, res) => {
  try {
    const {
      employeeCode,
      name,
      email,
      password,
      department,
      position,
      pcName,
    } = req.body;

    const cleanEmployeeCode = normalizeEmployeeCode(employeeCode);
    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPassword = String(password || "").trim();

    if (!cleanEmployeeCode || !cleanName || !cleanEmail || !cleanPassword) {
      return res.status(400).json({
        success: false,
        message: "Employee ID, name, email and password are required.",
      });
    }

    const existingEmployeeCode = await prisma.employee.findUnique({
      where: {
        employeeCode: cleanEmployeeCode,
      },
    });

    if (existingEmployeeCode) {
      return res.status(409).json({
        success: false,
        message: "Employee ID already exists.",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email: cleanEmail,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 10);

    const employee = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: cleanName,
          email: cleanEmail,
          password: hashedPassword,
          role: "EMPLOYEE",
        },
      });

      const newEmployee = await tx.employee.create({
        data: {
          employeeCode: cleanEmployeeCode,
          userId: user.id,
          department: department || null,
          position: position || null,
          pcName: pcName || null,
          isOnline: false,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              createdAt: true,
            },
          },
        },
      });

      return newEmployee;
    });

    return res.status(201).json({
      success: true,
      message: "Employee created successfully.",
      employee,
    });
  } catch (error) {
    console.error("Create employee error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while creating employee.",
      error: error.message,
    });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      employeeCode,
      name,
      email,
      department,
      position,
      pcName,
      password,
    } = req.body;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    const cleanEmployeeCode = normalizeEmployeeCode(employeeCode);

    if (cleanEmployeeCode && cleanEmployeeCode !== employee.employeeCode) {
      const duplicateCode = await prisma.employee.findUnique({
        where: {
          employeeCode: cleanEmployeeCode,
        },
      });

      if (duplicateCode) {
        return res.status(409).json({
          success: false,
          message: "Employee ID already exists.",
        });
      }
    }

    const cleanEmail = email ? String(email).trim().toLowerCase() : employee.user.email;

    if (cleanEmail !== employee.user.email) {
      const duplicateEmail = await prisma.user.findUnique({
        where: {
          email: cleanEmail,
        },
      });

      if (duplicateEmail) {
        return res.status(409).json({
          success: false,
          message: "Email already exists.",
        });
      }
    }

    const userUpdateData = {
      name: name || employee.user.name,
      email: cleanEmail,
    };

    if (password && String(password).trim()) {
      userUpdateData.password = await bcrypt.hash(String(password).trim(), 10);
    }

    const updatedEmployee = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: employee.userId,
        },
        data: userUpdateData,
      });

      return tx.employee.update({
        where: {
          id,
        },
        data: {
          employeeCode: cleanEmployeeCode || employee.employeeCode,
          department: department || null,
          position: position || null,
          pcName: pcName || null,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              createdAt: true,
            },
          },
        },
      });
    });

    return res.json({
      success: true,
      message: "Employee updated successfully.",
      employee: updatedEmployee,
    });
  } catch (error) {
    console.error("Update employee error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while updating employee.",
      error: error.message,
    });
  }
};

module.exports = {
  getEmployees,
  getMyEmployeeProfile,
  createEmployee,
  updateEmployee,
};