const $ = (id) => document.getElementById(id);

let currentState = null;

function formatDateTime(value) {
  if (!value) return "-";

  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function setText(id, value) {
  const el = $(id);

  if (el) {
    el.textContent = value || "-";
  }
}

function setBadge(id, active, activeText, inactiveText) {
  const el = $(id);

  if (!el) return;

  el.textContent = active ? activeText : inactiveText;
  el.className = active ? "badge active" : "badge inactive";
}

function render(state) {
  currentState = state;

  const isLoggedIn = Boolean(state.isLoggedIn);

  $("loginView").classList.toggle("hidden", isLoggedIn);
  $("dashboardView").classList.toggle("hidden", !isLoggedIn);

  $("errorBox").classList.toggle("hidden", !state.lastError);
  $("errorBox").textContent = state.lastError || "";

  if (!isLoggedIn) return;

  const employeeCode = state.employee?.employeeCode || "----";
  const name = state.employee?.user?.name || state.user?.name || "Employee";
  const email = state.employee?.user?.email || state.user?.email || "-";

  setText("employeeName", name);
  setText("employeeEmail", email);
  setText("employeeCode", employeeCode);
  setText("pcName", state.pcName);
  setText("mode", state.mode);

  setBadge("agentStatus", state.agentOnline, "Agent Online", "Agent Offline");
  setBadge("attendanceStatus", state.checkedIn, "Checked In", "Checked Out");
  setBadge("monitoringStatus", state.monitoring, "Screenshot Active", "Screenshot Stopped");
  setBadge("liveStatus", state.liveStreaming, "Live Screen Active", "Live Screen Stopped");

  setText("lastScreenshotAt", formatDateTime(state.lastScreenshotAt));
  setText("nextScreenshotAt", formatDateTime(state.nextScreenshotAt));
  setText("lastLiveFrameAt", formatDateTime(state.lastLiveFrameAt));
  setText("lastSyncAt", formatDateTime(state.lastSyncAt));

  $("workStateText").textContent = state.checkedIn
    ? "You are checked in. OfficeWatch Agent is allowed to capture screenshots and respond to admin live screen request."
    : "You are checked out. Screenshot and live screen monitoring are stopped.";

  $("logoutBtn").disabled = state.checkedIn;
}

async function init() {
  const state = await window.officeWatchAgent.getState();
  render(state);

  window.officeWatchAgent.onStateChanged((nextState) => {
    render(nextState);
  });
}

$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("email").value.trim();
  const password = $("password").value.trim();

  $("loginBtn").disabled = true;
  $("loginBtn").textContent = "Connecting...";

  const result = await window.officeWatchAgent.login(email, password);

  $("loginBtn").disabled = false;
  $("loginBtn").textContent = "Connect Agent";

  if (result?.state) {
    render(result.state);
  }

  if (!result.success) {
    $("errorBox").classList.remove("hidden");
    $("errorBox").textContent = result.message || "Login failed.";
  }
});

$("logoutBtn").addEventListener("click", async () => {
  const result = await window.officeWatchAgent.logout();

  if (result?.state) {
    render(result.state);
  }

  if (!result.success) {
    $("errorBox").classList.remove("hidden");
    $("errorBox").textContent = result.message || "Logout failed.";
  }
});

$("refreshBtn").addEventListener("click", async () => {
  const result = await window.officeWatchAgent.refresh();

  if (result?.state) {
    render(result.state);
  }
});

$("minimizeBtn").addEventListener("click", async () => {
  await window.officeWatchAgent.minimize();
});

init();