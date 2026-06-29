const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const axios = require("axios");
const screenshot = require("screenshot-desktop");
const { io } = require("socket.io-client");
const FormData = require("form-data");

const API_BASE = "http://localhost:5000";

/*
  TEST mode: screenshot every 30-60 seconds.
  PRODUCTION mode: screenshot every 15-25 minutes.

  Local testing er jonno TEST rakho.
  Final production er jonno MODE = "PRODUCTION" kore diba.
*/
const MODE = "PRODUCTION";

const SCREENSHOT_INTERVAL =
  MODE === "TEST"
    ? { min: 30 * 1000, max: 60 * 1000 }
    : { min: 15 * 60 * 1000, max: 25 * 60 * 1000 };

const LIVE_FRAME_INTERVAL_MS = 1500;
const ATTENDANCE_POLL_MS = 8000;

let mainWindow = null;
let tray = null;
let socket = null;

let screenshotTimer = null;
let liveTimer = null;
let attendancePollTimer = null;

const configPath = () => path.join(app.getPath("userData"), "agent-session.json");

let state = {
  mode: MODE,
  apiBase: API_BASE,

  token: "",
  user: null,
  employee: null,

  pcName: os.hostname(),

  agentOnline: false,
  checkedIn: false,
  monitoring: false,
  liveStreaming: false,

  activeAttendance: null,

  lastScreenshotAt: "",
  nextScreenshotAt: "",
  lastLiveFrameAt: "",
  lastSyncAt: "",
  lastError: "",
};

function publicState() {
  return {
    mode: state.mode,
    apiBase: state.apiBase,
    user: state.user,
    employee: state.employee,
    pcName: state.pcName,
    agentOnline: state.agentOnline,
    checkedIn: state.checkedIn,
    monitoring: state.monitoring,
    liveStreaming: state.liveStreaming,
    activeAttendance: state.activeAttendance,
    lastScreenshotAt: state.lastScreenshotAt,
    nextScreenshotAt: state.nextScreenshotAt,
    lastLiveFrameAt: state.lastLiveFrameAt,
    lastSyncAt: state.lastSyncAt,
    lastError: state.lastError,
    isLoggedIn: Boolean(state.token),
  };
}

function sendState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("agent:state-changed", publicState());
  }
}

function setError(message) {
  state.lastError = message || "";
  sendState();
}

function saveSession() {
  try {
    const data = {
      token: state.token,
      user: state.user,
      employee: state.employee,
    };

    fs.writeFileSync(configPath(), JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Failed to save session:", error.message);
  }
}

function loadSession() {
  try {
    const file = configPath();

    if (!fs.existsSync(file)) return;

    const saved = JSON.parse(fs.readFileSync(file, "utf8"));

    state.token = saved.token || "";
    state.user = saved.user || null;
    state.employee = saved.employee || null;
  } catch (error) {
    console.error("Failed to load session:", error.message);
  }
}

function clearSession() {
  try {
    const file = configPath();

    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch (error) {
    console.error("Failed to clear session:", error.message);
  }
}

function authHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${state.token}`,
    ...extra,
  };
}

function apiClient() {
  return axios.create({
    baseURL: API_BASE,
    timeout: 20000,
    headers: {
      Authorization: `Bearer ${state.token}`,
    },
  });
}

function randomDelay() {
  const min = SCREENSHOT_INTERVAL.min;
  const max = SCREENSHOT_INTERVAL.max;

  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isSameEmployee(employeeId) {
  if (!employeeId) return true;
  return employeeId === state.employee?.id;
}

async function fetchEmployeeProfile() {
  if (!state.token) return null;

  const res = await apiClient().get("/api/employees/me");

  const employee = res.data.employee || null;

  if (employee) {
    state.employee = employee;
    state.user = employee.user || state.user;
  }

  return employee;
}

async function fetchAttendanceStatus() {
  if (!state.token) return;

  try {
    let activeAttendance = null;

    try {
      const activeRes = await apiClient().get("/api/attendance/active");
      activeAttendance =
        activeRes.data.attendance ||
        activeRes.data.activeAttendance ||
        activeRes.data.record ||
        null;
    } catch {
      const res = await apiClient().get("/api/attendance/me");

      const list =
        res.data.attendances ||
        res.data.records ||
        res.data.data ||
        [];

      activeAttendance =
        list.find(
          (item) =>
            item.status === "CHECKED_IN" &&
            !item.checkOutTime
        ) || null;
    }

    const checkedIn = Boolean(activeAttendance);

    state.checkedIn = checkedIn;
    state.activeAttendance = activeAttendance;
    state.lastSyncAt = new Date().toISOString();

    if (checkedIn) {
      startScreenshotLoop();
    } else {
      stopScreenshotLoop();
      stopLiveStream();
    }

    setError("");
    sendState();
  } catch (error) {
    setError(
      error.response?.data?.message ||
        "Could not check attendance status. Backend may be offline."
    );
  }
}

function startAttendancePolling() {
  if (attendancePollTimer) {
    clearInterval(attendancePollTimer);
  }

  fetchAttendanceStatus();

  attendancePollTimer = setInterval(() => {
    fetchAttendanceStatus();
  }, ATTENDANCE_POLL_MS);
}

function stopAttendancePolling() {
  if (attendancePollTimer) {
    clearInterval(attendancePollTimer);
    attendancePollTimer = null;
  }
}

function connectSocket() {
  if (!state.token || !state.employee?.id) return;

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(API_BASE, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
    auth: {
      token: state.token,
    },
  });

  socket.on("connect", () => {
    state.agentOnline = true;
    setError("");

    const payload = {
      employeeId: state.employee?.id,
      userId: state.user?.id,
      pcName: state.pcName,
      connectedAt: new Date().toISOString(),
    };

    socket.emit("employee-agent-register", payload);
    socket.emit("employee-register", payload);
    socket.emit("agent-online", payload);

    sendState();
  });

  socket.on("disconnect", () => {
    state.agentOnline = false;
    sendState();
  });

  socket.on("connect_error", (error) => {
    state.agentOnline = false;
    setError(`Socket connection failed: ${error.message}`);
  });

  socket.on("attendance-updated", (data = {}) => {
    if (isSameEmployee(data.employeeId)) {
      fetchAttendanceStatus();
    }
  });

  socket.on("employee-attendance-updated", (data = {}) => {
    if (isSameEmployee(data.employeeId)) {
      fetchAttendanceStatus();
    }
  });

  socket.on("force-attendance-refresh", (data = {}) => {
    if (isSameEmployee(data.employeeId)) {
      fetchAttendanceStatus();
    }
  });

  socket.on("request-live-screen", (data = {}) => {
    if (isSameEmployee(data.employeeId)) {
      startLiveStream();
    }
  });

  socket.on("start-live-screen", (data = {}) => {
    if (isSameEmployee(data.employeeId)) {
      startLiveStream();
    }
  });

  socket.on("admin-live-screen-start", (data = {}) => {
    if (isSameEmployee(data.employeeId)) {
      startLiveStream();
    }
  });

  socket.on("stop-live-screen", (data = {}) => {
    if (isSameEmployee(data.employeeId)) {
      stopLiveStream();
    }
  });

  socket.on("admin-live-screen-stop", (data = {}) => {
    if (isSameEmployee(data.employeeId)) {
      stopLiveStream();
    }
  });
}

function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  state.agentOnline = false;
  sendState();
}

async function captureScreenBuffer() {
  return screenshot({
    format: "png",
  });
}

async function uploadScreenshot(reason = "scheduled") {
  if (!state.token || !state.employee?.id) return;
  if (!state.checkedIn) return;

  try {
    const imageBuffer = await captureScreenBuffer();

    const form = new FormData();

    form.append("screenshot", imageBuffer, {
      filename: `officewatch-${state.employee.id}-${Date.now()}.png`,
      contentType: "image/png",
    });

    form.append("employeeId", state.employee.id);
    form.append("pcName", state.pcName);
    form.append("capturedAt", new Date().toISOString());
    form.append("reason", reason);

    const headers = {
      ...form.getHeaders(),
      ...authHeaders(),
    };

    try {
      await axios.post(`${API_BASE}/api/screenshots/upload`, form, {
        headers,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
    } catch (firstError) {
      await axios.post(`${API_BASE}/api/screenshots`, form, {
        headers,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
    }

    state.lastScreenshotAt = new Date().toISOString();
    state.lastError = "";

    if (socket?.connected) {
      socket.emit("employee-screenshot-captured", {
        employeeId: state.employee.id,
        pcName: state.pcName,
        capturedAt: state.lastScreenshotAt,
      });
    }

    sendState();
  } catch (error) {
    setError(
      error.response?.data?.message ||
        error.message ||
        "Screenshot upload failed."
    );
  }
}

function startScreenshotLoop() {
  if (!state.token || !state.employee?.id) return;
  if (!state.checkedIn) return;
  if (screenshotTimer) return;

  state.monitoring = true;

  const firstDelay = MODE === "TEST" ? 5000 : randomDelay();

  scheduleNextScreenshot(firstDelay);
}

function scheduleNextScreenshot(delayMs = randomDelay()) {
  if (!state.checkedIn) {
    stopScreenshotLoop();
    return;
  }

  if (screenshotTimer) {
    clearTimeout(screenshotTimer);
  }

  state.monitoring = true;
  state.nextScreenshotAt = new Date(Date.now() + delayMs).toISOString();
  sendState();

  screenshotTimer = setTimeout(async () => {
    screenshotTimer = null;

    await uploadScreenshot("scheduled");

    if (state.checkedIn) {
      scheduleNextScreenshot(randomDelay());
    }
  }, delayMs);
}

function stopScreenshotLoop() {
  if (screenshotTimer) {
    clearTimeout(screenshotTimer);
    screenshotTimer = null;
  }

  state.monitoring = false;
  state.nextScreenshotAt = "";
  sendState();
}

async function sendLiveFrame() {
  if (!state.token || !state.employee?.id) return;
  if (!state.checkedIn) {
    stopLiveStream();
    return;
  }

  try {
    const imageBuffer = await captureScreenBuffer();

    const imageBase64 = `data:image/png;base64,${imageBuffer.toString("base64")}`;

    const payload = {
      employeeId: state.employee.id,
      userId: state.user?.id,
      pcName: state.pcName,
      imageBase64,
      capturedAt: new Date().toISOString(),
    };

    if (socket?.connected) {
      socket.emit("employee-live-screen-frame", payload);
      socket.emit("live-screen-frame", payload);
    }

    state.lastLiveFrameAt = payload.capturedAt;
    state.lastError = "";
    sendState();
  } catch (error) {
    setError(error.message || "Live screen frame failed.");
  }
}

function startLiveStream() {
  if (!state.checkedIn) {
    setError("Live screen is disabled because employee is not checked in.");
    return;
  }

  if (liveTimer) return;

  state.liveStreaming = true;
  sendState();

  sendLiveFrame();

  liveTimer = setInterval(() => {
    sendLiveFrame();
  }, LIVE_FRAME_INTERVAL_MS);
}

function stopLiveStream() {
  if (liveTimer) {
    clearInterval(liveTimer);
    liveTimer = null;
  }

  state.liveStreaming = false;
  sendState();
}

async function loginEmployee(email, password) {
  try {
    setError("");

    const res = await axios.post(`${API_BASE}/api/auth/login`, {
      email,
      password,
    });

    const loggedUser = res.data.user;

    if (!loggedUser || loggedUser.role !== "EMPLOYEE") {
      throw new Error("Only employee account can login to Employee Agent.");
    }

    state.token = res.data.token;
    state.user = loggedUser;

    await fetchEmployeeProfile();

    if (!state.employee?.id) {
      throw new Error("Employee profile not found. Admin must create employee first.");
    }

    saveSession();
    connectSocket();
    startAttendancePolling();

    sendState();

    return {
      success: true,
      message: "Employee agent connected successfully.",
      state: publicState(),
    };
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.message ||
      "Employee agent login failed.";

    setError(message);

    return {
      success: false,
      message,
      state: publicState(),
    };
  }
}

function logoutEmployee() {
  if (state.checkedIn) {
    return {
      success: false,
      message:
        "You are checked in. Please check out from Employee Portal before logging out from Agent.",
      state: publicState(),
    };
  }

  stopScreenshotLoop();
  stopLiveStream();
  stopAttendancePolling();
  disconnectSocket();

  state.token = "";
  state.user = null;
  state.employee = null;
  state.activeAttendance = null;
  state.checkedIn = false;
  state.monitoring = false;
  state.liveStreaming = false;
  state.lastScreenshotAt = "";
  state.nextScreenshotAt = "";
  state.lastLiveFrameAt = "";
  state.lastError = "";

  clearSession();
  sendState();

  return {
    success: true,
    message: "Logged out from employee agent.",
    state: publicState(),
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 860,
    minHeight: 620,
    title: "OfficeWatch Employee Agent",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  mainWindow.on("close", (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, "icon.png");

  let image = nativeImage.createEmpty();

  if (fs.existsSync(iconPath)) {
    image = nativeImage.createFromPath(iconPath);
  }

  tray = new Tray(image);

  tray.setToolTip("OfficeWatch Employee Agent");

  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Open OfficeWatch Agent",
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: "Refresh Status",
        click: () => {
          fetchAttendanceStatus();
        },
      },
      {
        type: "separator",
      },
      {
        label: "Quit",
        click: () => {
          if (state.checkedIn) {
            if (mainWindow) {
              mainWindow.show();
              mainWindow.focus();
            }

            setError("You are checked in. Please check out before quitting the agent.");
            return;
          }

          app.isQuiting = true;
          app.quit();
        },
      },
    ])
  );

  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

ipcMain.handle("agent:get-state", async () => {
  return publicState();
});

ipcMain.handle("agent:login", async (event, payload) => {
  return loginEmployee(payload.email, payload.password);
});

ipcMain.handle("agent:logout", async () => {
  return logoutEmployee();
});

ipcMain.handle("agent:refresh", async () => {
  await fetchAttendanceStatus();

  return {
    success: true,
    state: publicState(),
  };
});

ipcMain.handle("agent:minimize", async () => {
  if (mainWindow) {
    mainWindow.hide();
  }

  return {
    success: true,
  };
});

app.whenReady().then(async () => {
  loadSession();
  createWindow();
  createTray();

  if (state.token) {
    try {
      await fetchEmployeeProfile();
      connectSocket();
      startAttendancePolling();
    } catch (error) {
      setError(
        error.response?.data?.message ||
          error.message ||
          "Saved session expired. Please login again."
      );
    }
  }

  sendState();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on("before-quit", () => {
  app.isQuiting = true;

  stopScreenshotLoop();
  stopLiveStream();
  stopAttendancePolling();
  disconnectSocket();
});