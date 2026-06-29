require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const { cleanupExpiredScreenshots } = require("./controllers/screenshot.controller");

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const employeeSockets = new Map();

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("employee-register", (data) => {
    const { employeeId, pcName, name } = data || {};

    if (!employeeId) return;

    employeeSockets.set(employeeId, socket.id);
    socket.join(`employee:${employeeId}`);

    console.log("Employee socket registered:", employeeId, pcName, name);

    io.emit("employee-status-updated", {
      employeeId,
      pcName,
      name,
      isOnline: true,
    });
  });

  socket.on("admin-register", () => {
    socket.join("admins");
    console.log("Admin socket registered:", socket.id);
  });

  socket.on("admin-join-live-screen", (data) => {
    const { employeeId } = data || {};

    if (!employeeId) return;

    socket.join(`live:${employeeId}`);

    io.to(`employee:${employeeId}`).emit("start-live-screen", {
      employeeId,
    });

    console.log("Admin requested live screen:", employeeId);
  });

  socket.on("admin-stop-live-screen", (data) => {
    const { employeeId } = data || {};

    if (!employeeId) return;

    socket.leave(`live:${employeeId}`);

    io.to(`employee:${employeeId}`).emit("stop-live-screen", {
      employeeId,
    });

    console.log("Admin stopped live screen:", employeeId);
  });

  socket.on("live-screen-frame", (data) => {
    const { employeeId, imageBase64, capturedAt, pcName } = data || {};

    if (!employeeId || !imageBase64) return;

    io.to(`live:${employeeId}`).emit("live-screen-frame", {
      employeeId,
      imageBase64,
      capturedAt,
      pcName,
    });
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);

    for (const [employeeId, socketId] of employeeSockets.entries()) {
      if (socketId === socket.id) {
        employeeSockets.delete(employeeId);

        io.emit("employee-status-updated", {
          employeeId,
          isOnline: false,
        });

        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`OfficeWatch HRM Backend running on http://localhost:${PORT}`);

  cleanupExpiredScreenshots();

  setInterval(() => {
    cleanupExpiredScreenshots();
  }, 60 * 60 * 1000);
});