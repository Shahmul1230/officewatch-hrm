require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const prisma = require("./config/prisma");
const {
  cleanupExpiredScreenshots,
} = require("./controllers/screenshot.controller");

const PORT = process.env.PORT || 5000;

const allowedSocketOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  process.env.ADMIN_ORIGIN,
  process.env.PORTAL_ORIGIN,
].filter(Boolean);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      if (!origin || allowedSocketOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Socket not allowed by CORS: ${origin}`));
    },
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true,
  },

  maxHttpBufferSize: 100 * 1024 * 1024,
});

const employeeSockets = new Map();

const markEmployeeOnline = async (employeeId, pcName) => {
  try {
    await prisma.employee.update({
      where: {
        id: employeeId,
      },
      data: {
        isOnline: true,
        lastSeenAt: new Date(),
        ...(pcName ? { pcName } : {}),
      },
    });
  } catch (error) {
    console.log("Could not mark employee online:", error.message);
  }
};

const markEmployeeOffline = async (employeeId) => {
  try {
    await prisma.employee.update({
      where: {
        id: employeeId,
      },
      data: {
        isOnline: false,
        lastSeenAt: new Date(),
      },
    });
  } catch (error) {
    console.log("Could not mark employee offline:", error.message);
  }
};

const registerEmployeeSocket = async (socket, data = {}) => {
  const { employeeId, pcName, name } = data;

  if (!employeeId) return;

  employeeSockets.set(employeeId, socket.id);

  socket.data.employeeId = employeeId;
  socket.data.pcName = pcName || "";

  socket.join(`employee:${employeeId}`);

  await markEmployeeOnline(employeeId, pcName);

  console.log("Employee socket registered:", employeeId, pcName, name);

  io.to("admins").emit("employee-status-updated", {
    employeeId,
    pcName,
    name,
    isOnline: true,
  });
};

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("admin-register", () => {
    socket.join("admins");
    console.log("Admin socket registered:", socket.id);
  });

  socket.on("employee-register", async (data) => {
    await registerEmployeeSocket(socket, data);
  });

  socket.on("employee-agent-register", async (data) => {
    await registerEmployeeSocket(socket, data);
  });

  socket.on("agent-online", async (data) => {
    await registerEmployeeSocket(socket, data);
  });

  socket.on("admin-join-live-screen", (data = {}) => {
    const { employeeId } = data;

    if (!employeeId) return;

    socket.join(`live:${employeeId}`);

    io.to(`employee:${employeeId}`).emit("start-live-screen", {
      employeeId,
    });

    console.log("Admin requested live screen:", employeeId);
  });

  socket.on("admin-stop-live-screen", (data = {}) => {
    const { employeeId } = data;

    if (!employeeId) return;

    socket.leave(`live:${employeeId}`);

    io.to(`employee:${employeeId}`).emit("stop-live-screen", {
      employeeId,
    });

    console.log("Admin stopped live screen:", employeeId);
  });

  const forwardLiveFrame = (data = {}) => {
    const { employeeId, imageBase64, capturedAt, pcName } = data;

    if (!employeeId || !imageBase64) return;

    io.to(`live:${employeeId}`).emit("live-screen-frame", {
      employeeId,
      imageBase64,
      capturedAt,
      pcName,
    });
  };

  socket.on("live-screen-frame", forwardLiveFrame);
  socket.on("employee-live-screen-frame", forwardLiveFrame);

  socket.on("employee-screenshot-captured", (data = {}) => {
    io.to("admins").emit("employee-screenshot-captured", data);
  });

  socket.on("attendance-updated", (data = {}) => {
    io.to("admins").emit("attendance-updated", data);

    if (data.employeeId) {
      io.to(`employee:${data.employeeId}`).emit("attendance-updated", data);
      io.to(`employee:${data.employeeId}`).emit(
        "force-attendance-refresh",
        data
      );
    }
  });

  socket.on("disconnect", async () => {
    console.log("Socket disconnected:", socket.id);

    const employeeId = socket.data.employeeId;

    if (employeeId) {
      employeeSockets.delete(employeeId);

      await markEmployeeOffline(employeeId);

      io.to("admins").emit("employee-status-updated", {
        employeeId,
        isOnline: false,
      });
    }
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`OfficeWatch API running on http://127.0.0.1:${PORT}`);

  cleanupExpiredScreenshots();

  setInterval(() => {
    cleanupExpiredScreenshots();
  }, 60 * 60 * 1000);
});