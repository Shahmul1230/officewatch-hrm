const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth.routes");
const employeeRoutes = require("./routes/employee.routes");
const attendanceRoutes = require("./routes/attendance.routes");
const screenshotRoutes = require("./routes/screenshot.routes");
const leaveRoutes = require("./routes/leave.routes");
const settingsRoutes = require("./routes/settings.routes");
const manualAttendanceRoutes = require("./routes/manualAttendance.routes");

const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  process.env.ADMIN_ORIGIN,
  process.env.PORTAL_ORIGIN,
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "OfficeWatch HRM Backend is running.",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/screenshots", screenshotRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/manual-attendance", manualAttendanceRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API route not found.",
  });
});

module.exports = app;