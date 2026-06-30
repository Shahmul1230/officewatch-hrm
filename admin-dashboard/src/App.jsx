import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import "./App.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const WEEK_DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const MODULES = [
  { key: "employees", title: "Employee Management" },
  { key: "manualAttendance", title: "Manual Attendance Control" },
  { key: "manualRecords", title: "Manual Attendance Records" },
  { key: "leaveRequests", title: "Leave Requests" },
  { key: "attendanceRecords", title: "Attendance Records" },
  { key: "workPolicy", title: "Work Policy Settings" },
];

function App() {
  const socketRef = useRef(null);

  const [token, setToken] = useState(localStorage.getItem("adminToken") || "");

  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("adminUser");
    return saved ? JSON.parse(saved) : null;
  });

  const [loginForm, setLoginForm] = useState({
    email: "admin@officewatch.com",
    password: "123456",
  });

  const [employees, setEmployees] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [manualRecords, setManualRecords] = useState([]);

  const [globalSearch, setGlobalSearch] = useState("");
  const [selectedEmployeeForAction, setSelectedEmployeeForAction] =
    useState(null);

  const [openModules, setOpenModules] = useState({});

  const [employeeForm, setEmployeeForm] = useState({
    employeeCode: "",
    name: "",
    email: "",
    password: "123456",
    department: "",
    position: "",
    pcName: "",
  });

  const [editEmployee, setEditEmployee] = useState(null);
  const [editEmployeeForm, setEditEmployeeForm] = useState({
    employeeCode: "",
    name: "",
    email: "",
    password: "",
    department: "",
    position: "",
    pcName: "",
  });

  const [workPolicyForm, setWorkPolicyForm] = useState({
    weekendDays: [5, 6],
    shiftStartTime: "08:00",
    shiftEndTime: "17:00",
  });

  const [manualForm, setManualForm] = useState({
    employeeId: "",
    date: new Date().toISOString().slice(0, 10),
    status: "PRESENT",
    checkInTime: "09:00",
    checkOutTime: "17:00",
    isPayable: true,
    reason: "",
  });

  const [screenshots, setScreenshots] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [liveEmployee, setLiveEmployee] = useState(null);
  const [liveFrame, setLiveFrame] = useState("");
  const [liveStatus, setLiveStatus] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const getAuthHeader = () => ({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const normalizeEmployee = (emp) => ({
    ...emp,
    employeeCode: emp.employeeCode || "",
    name: emp.user?.name || emp.name || "-",
    email: emp.user?.email || emp.email || "-",
  });

  const employeeMatchesSearch = (employee, query) => {
    const item = normalizeEmployee(employee);
    const q = String(query || "").trim().toLowerCase();

    if (!q) return true;

    return (
      item.employeeCode?.toLowerCase().includes(q) ||
      item.name?.toLowerCase().includes(q) ||
      item.email?.toLowerCase().includes(q) ||
      item.department?.toLowerCase().includes(q) ||
      item.position?.toLowerCase().includes(q) ||
      item.pcName?.toLowerCase().includes(q)
    );
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => employeeMatchesSearch(emp, globalSearch));
  }, [employees, globalSearch]);

  const selectedEmployeeIds = useMemo(() => {
    if (!globalSearch.trim()) return null;
    return new Set(filteredEmployees.map((emp) => emp.id));
  }, [filteredEmployees, globalSearch]);

  const filteredAttendances = useMemo(() => {
    if (!selectedEmployeeIds) return attendances;
    return attendances.filter((att) => selectedEmployeeIds.has(att.employeeId));
  }, [attendances, selectedEmployeeIds]);

  const filteredLeaveRequests = useMemo(() => {
    if (!selectedEmployeeIds) return leaveRequests;
    return leaveRequests.filter((leave) =>
      selectedEmployeeIds.has(leave.employeeId)
    );
  }, [leaveRequests, selectedEmployeeIds]);

  const filteredManualRecords = useMemo(() => {
    if (!selectedEmployeeIds) return manualRecords;
    return manualRecords.filter((item) =>
      selectedEmployeeIds.has(item.employeeId)
    );
  }, [manualRecords, selectedEmployeeIds]);

  const formatEmployeeLabel = (emp) => {
    const item = normalizeEmployee(emp);
    return `${item.employeeCode || "----"} — ${item.name} — ${item.email}`;
  };

  const formatDate = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString();
  };

  const formatTime = (value) => {
    if (!value) return "-";

    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateTime = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleString();
  };

  const formatDuration = (minutes) => {
    if (minutes === null || minutes === undefined) return "-";

    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;

    return `${hrs}h ${mins}m`;
  };

  const getTodayAttendanceForEmployee = (employeeId) => {
    if (!employeeId) return null;

    const today = new Date().toDateString();

    const todayRecords = attendances
      .filter((att) => {
        if (att.employeeId !== employeeId || !att.checkInTime) return false;

        return new Date(att.checkInTime).toDateString() === today;
      })
      .sort((a, b) => new Date(b.checkInTime) - new Date(a.checkInTime));

    return todayRecords[0] || null;
  };

  const toggleModule = (key) => {
    setOpenModules((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const openOnlyModule = (key) => {
    setOpenModules({
      [key]: true,
    });
  };

  const selectEmployeeForAction = (employee) => {
    const item = normalizeEmployee(employee);

    setSelectedEmployeeForAction(item);

    setManualForm((prev) => ({
      ...prev,
      employeeId: item.id,
    }));

    setMessage(`Selected employee: ${formatEmployeeLabel(item)}`);
  };

  const clearEmployeeSearch = () => {
    setGlobalSearch("");
    setSelectedEmployeeForAction(null);
    setManualForm((prev) => ({
      ...prev,
      employeeId: "",
    }));
  };

  const openEditEmployee = (employee) => {
    const item = normalizeEmployee(employee);

    setEditEmployee(item);
    setEditEmployeeForm({
      employeeCode: item.employeeCode || "",
      name: item.name || "",
      email: item.email || "",
      password: "",
      department: item.department || "",
      position: item.position || "",
      pcName: item.pcName || "",
    });
  };

  const closeEditEmployee = () => {
    setEditEmployee(null);
    setEditEmployeeForm({
      employeeCode: "",
      name: "",
      email: "",
      password: "",
      department: "",
      position: "",
      pcName: "",
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setMessage("");

      const res = await axios.post(`${API_BASE}/api/auth/login`, loginForm);

      if (res.data.user.role !== "ADMIN") {
        setMessage("Only admin can access this dashboard.");
        return;
      }

      localStorage.setItem("adminToken", res.data.token);
      localStorage.setItem("adminUser", JSON.stringify(res.data.user));

      setToken(res.data.token);
      setUser(res.data.user);
      setMessage("Admin login successful.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkPolicy = async () => {
    try {
      const res = await axios.get(
        `${API_BASE}/api/settings/work-policy`,
        getAuthHeader()
      );

      if (res.data.policy) {
        setWorkPolicyForm({
          weekendDays: res.data.policy.weekendDays || [5, 6],
          shiftStartTime: res.data.policy.shiftStartTime || "08:00",
          shiftEndTime: res.data.policy.shiftEndTime || "17:00",
        });
      }
    } catch (error) {
      console.log("Work policy load failed:", error.response?.data || error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const [employeeRes, attendanceRes, leaveRes, manualRes] =
        await Promise.all([
          axios.get(`${API_BASE}/api/employees`, getAuthHeader()),
          axios.get(`${API_BASE}/api/attendance/all`, getAuthHeader()),
          axios.get(`${API_BASE}/api/leaves/all`, getAuthHeader()),
          axios.get(`${API_BASE}/api/manual-attendance/all`, getAuthHeader()),
        ]);

      setEmployees(employeeRes.data.employees || []);
      setAttendances(attendanceRes.data.attendances || []);
      setLeaveRequests(leaveRes.data.leaveRequests || []);
      setManualRecords(manualRes.data.records || []);
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const refreshEverything = async () => {
    await Promise.all([fetchDashboardData(), fetchWorkPolicy()]);
  };

  const toggleWeekendDay = (dayValue) => {
    const day = Number(dayValue);

    setWorkPolicyForm((prev) => {
      const exists = prev.weekendDays.includes(day);

      const nextDays = exists
        ? prev.weekendDays.filter((item) => item !== day)
        : [...prev.weekendDays, day];

      return {
        ...prev,
        weekendDays: nextDays.sort((a, b) => a - b),
      };
    });
  };

  const updateWorkPolicy = async (e) => {
    e.preventDefault();

    if (workPolicyForm.weekendDays.length === 0) {
      setMessage("Please select at least one weekend day.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      await axios.patch(
        `${API_BASE}/api/settings/work-policy`,
        workPolicyForm,
        getAuthHeader()
      );

      setMessage("Work policy updated successfully.");
      await fetchWorkPolicy();
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Failed to update work policy."
      );
    } finally {
      setLoading(false);
    }
  };

  const createEmployee = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setMessage("");

      await axios.post(
        `${API_BASE}/api/employees`,
        employeeForm,
        getAuthHeader()
      );

      setEmployeeForm({
        employeeCode: "",
        name: "",
        email: "",
        password: "123456",
        department: "",
        position: "",
        pcName: "",
      });

      setMessage(
        "Employee created successfully. Now employee can login from employee portal."
      );
      await fetchDashboardData();
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to create employee.");
    } finally {
      setLoading(false);
    }
  };

  const updateEmployee = async (e) => {
    e.preventDefault();

    if (!editEmployee?.id) {
      setMessage("No employee selected for update.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const payload = {
        employeeCode: editEmployeeForm.employeeCode,
        name: editEmployeeForm.name,
        email: editEmployeeForm.email,
        department: editEmployeeForm.department,
        position: editEmployeeForm.position,
        pcName: editEmployeeForm.pcName,
      };

      if (editEmployeeForm.password.trim()) {
        payload.password = editEmployeeForm.password.trim();
      }

      await axios.patch(
        `${API_BASE}/api/employees/${editEmployee.id}`,
        payload,
        getAuthHeader()
      );

      setMessage("Employee updated successfully.");
      closeEditEmployee();
      await fetchDashboardData();
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to update employee.");
    } finally {
      setLoading(false);
    }
  };

  const submitManualAttendance = async (e) => {
    e.preventDefault();

    if (!manualForm.employeeId) {
      setMessage("Please search and select an employee first.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      await axios.post(
        `${API_BASE}/api/manual-attendance/upsert`,
        manualForm,
        getAuthHeader()
      );

      setMessage("Manual attendance updated successfully.");
      await fetchDashboardData();
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Failed to update manual attendance."
      );
    } finally {
      setLoading(false);
    }
  };

  const deleteManualAttendanceRecord = async (id) => {
    try {
      setLoading(true);
      setMessage("");

      await axios.delete(
        `${API_BASE}/api/manual-attendance/${id}`,
        getAuthHeader()
      );

      setMessage("Manual attendance record deleted.");
      await fetchDashboardData();
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Failed to delete manual attendance."
      );
    } finally {
      setLoading(false);
    }
  };

  const viewScreenshots = async (employee) => {
    try {
      setSelectedEmployee(employee);
      setScreenshots([]);
      setLoading(true);

      const res = await axios.get(
        `${API_BASE}/api/screenshots/employee/${employee.id}`,
        getAuthHeader()
      );

      setScreenshots(res.data.screenshots || []);
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to load screenshots.");
    } finally {
      setLoading(false);
    }
  };

  const saveScreenshot = async (screenshotId) => {
    try {
      setLoading(true);
      setMessage("");

      await axios.patch(
        `${API_BASE}/api/screenshots/${screenshotId}/save`,
        {},
        getAuthHeader()
      );

      setMessage("Screenshot saved permanently.");

      if (selectedEmployee) {
        await viewScreenshots(selectedEmployee);
      }
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to save screenshot.");
    } finally {
      setLoading(false);
    }
  };

  const deleteScreenshot = async (screenshotId) => {
    try {
      setLoading(true);
      setMessage("");

      await axios.delete(
        `${API_BASE}/api/screenshots/${screenshotId}`,
        getAuthHeader()
      );

      setMessage("Screenshot deleted successfully.");

      if (selectedEmployee) {
        await viewScreenshots(selectedEmployee);
      }
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Failed to delete screenshot."
      );
    } finally {
      setLoading(false);
    }
  };

  const approveLeave = async (leaveId) => {
    try {
      setLoading(true);
      setMessage("");

      await axios.patch(
        `${API_BASE}/api/leaves/${leaveId}/approve`,
        {},
        getAuthHeader()
      );

      setMessage("Leave approved successfully.");
      await fetchDashboardData();
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to approve leave.");
    } finally {
      setLoading(false);
    }
  };

  const rejectLeave = async (leaveId) => {
    try {
      setLoading(true);
      setMessage("");

      await axios.patch(
        `${API_BASE}/api/leaves/${leaveId}/reject`,
        {},
        getAuthHeader()
      );

      setMessage("Leave rejected successfully.");
      await fetchDashboardData();
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to reject leave.");
    } finally {
      setLoading(false);
    }
  };

  const startLiveScreen = (employee) => {
    setLiveEmployee(employee);
    setLiveFrame("");
    setLiveStatus(
      "Waiting for live screen. Employee must be logged in and checked in."
    );

    socketRef.current?.emit("admin-join-live-screen", {
      employeeId: employee.id,
    });
  };

  const stopLiveScreen = () => {
    if (liveEmployee) {
      socketRef.current?.emit("admin-stop-live-screen", {
        employeeId: liveEmployee.id,
      });
    }

    setLiveEmployee(null);
    setLiveFrame("");
    setLiveStatus("");
  };

  const logout = () => {
    stopLiveScreen();

    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");

    setToken("");
    setUser(null);
    setEmployees([]);
    setAttendances([]);
    setLeaveRequests([]);
    setManualRecords([]);
    setScreenshots([]);
    setSelectedEmployee(null);
    setSelectedEmployeeForAction(null);
    closeEditEmployee();
    setMessage("");
  };

  useEffect(() => {
    if (!token) return;

    refreshEverything();

    const interval = setInterval(() => {
      fetchDashboardData();
    }, 15000);

    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const socket = io(API_BASE, {
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("admin-register");
    });

    socket.on("live-screen-frame", (data) => {
      setLiveFrame(data.imageBase64);
      setLiveStatus(
        `Live: ${data.pcName || "Unknown PC"} - ${new Date(
          data.capturedAt
        ).toLocaleTimeString()}`
      );
    });

    socket.on("employee-status-updated", () => {
      fetchDashboardData();
    });

    socket.on("employee-screenshot-captured", () => {
      fetchDashboardData();
    });

    socket.on("attendance-updated", () => {
      fetchDashboardData();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const totalEmployees = employees.length;
  const onlineEmployees = employees.filter((emp) => emp.isOnline).length;
  const checkedInNow = attendances.filter(
    (att) => att.status === "CHECKED_IN"
  ).length;
  const checkedOutRecords = attendances.filter(
    (att) => att.status === "CHECKED_OUT"
  ).length;
  const pendingLeaves = leaveRequests.filter(
    (item) => item.status === "PENDING"
  ).length;

  if (!token) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="brand-logo">OW</div>
          <h1>OfficeWatch HRM</h1>
          <p>Admin Dashboard Login</p>

          <form onSubmit={handleLogin}>
            <label>Email</label>
            <input
              type="email"
              value={loginForm.email}
              onChange={(e) =>
                setLoginForm({ ...loginForm, email: e.target.value })
              }
              required
            />

            <label>Password</label>
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) =>
                setLoginForm({ ...loginForm, password: e.target.value })
              }
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          {message && <div className="message login-message">{message}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">OW</div>
          <div>
            <h2>OfficeWatch</h2>
            <p>HRM Admin Panel</p>
          </div>
        </div>

        <div className="admin-profile">
          <strong>{user?.name || "Admin"}</strong>
          <span>{user?.email || "admin@officewatch.com"}</span>
        </div>

        <button onClick={refreshEverything} disabled={loading}>
          Refresh
        </button>

        <button className="logout-btn" onClick={logout}>
          Logout
        </button>
      </aside>

      <main className="main">
        <section className="hero">
          <div>
            <span>Admin Control Center</span>
            <h1>Dashboard</h1>
            <p>
              Admin adds employees first. Employees can login only after admin
              creates their account.
            </p>
          </div>

          <button onClick={refreshEverything} disabled={loading}>
            Refresh Data
          </button>
        </section>

        {message && <div className="message">{message}</div>}

        <section className="stats-grid">
          <div className="stat-card">
            <span>Total Employees</span>
            <strong>{totalEmployees}</strong>
          </div>

          <div className="stat-card">
            <span>Online Employees</span>
            <strong>{onlineEmployees}</strong>
          </div>

          <div className="stat-card">
            <span>Currently Checked In</span>
            <strong>{checkedInNow}</strong>
          </div>

          <div className="stat-card">
            <span>Pending Leaves</span>
            <strong>{pendingLeaves}</strong>
          </div>

          <div className="stat-card">
            <span>Checked Out Records</span>
            <strong>{checkedOutRecords}</strong>
          </div>
        </section>

        <section className="global-search-card">
          <div>
            <h2>Employee Search</h2>
            <p>
              Search by Employee ID, name, email, department, position or PC
              name. All employee-related modules will filter automatically.
            </p>
          </div>

          <div className="global-search-row">
            <input
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search employee ID like 0001, name or email..."
            />

            <button type="button" onClick={clearEmployeeSearch}>
              Clear
            </button>
          </div>

          {globalSearch.trim() && (
            <div className="search-results">
              {filteredEmployees.length === 0 ? (
                <div className="empty-mini">No employee found.</div>
              ) : (
                filteredEmployees.slice(0, 8).map((emp) => {
                  const item = normalizeEmployee(emp);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={
                        selectedEmployeeForAction?.id === item.id
                          ? "employee-search-result selected"
                          : "employee-search-result"
                      }
                      onClick={() => selectEmployeeForAction(item)}
                    >
                      <strong>{item.employeeCode || "----"}</strong>
                      <span>{item.name}</span>
                      <small>{item.email}</small>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {selectedEmployeeForAction && (
            <div className="selected-employee-box">
              Selected: {formatEmployeeLabel(selectedEmployeeForAction)}
            </div>
          )}
        </section>

        <section className="module-list">
          {MODULES.map((module) => (
            <div className="module-card" key={module.key}>
              <button
                type="button"
                className="module-header"
                onClick={() => toggleModule(module.key)}
              >
                <span>{openModules[module.key] ? "▼" : "▶"}</span>
                <strong>{module.title}</strong>
              </button>

              {openModules[module.key] && (
                <div className="module-body">
                  {module.key === "employees" && (
                    <>
                      <div className="sub-panel">
                        <div className="panel-header">
                          <div>
                            <h2>Create Employee</h2>
                            <p>
                              Admin must create employee first. Then employee
                              can login from employee portal.
                            </p>
                          </div>
                        </div>

                        <form
                          className="employee-form"
                          onSubmit={createEmployee}
                        >
                          <input
                            placeholder="Employee ID e.g. 0001"
                            value={employeeForm.employeeCode}
                            onChange={(e) =>
                              setEmployeeForm({
                                ...employeeForm,
                                employeeCode: e.target.value,
                              })
                            }
                            required
                          />

                          <input
                            placeholder="Employee Name"
                            value={employeeForm.name}
                            onChange={(e) =>
                              setEmployeeForm({
                                ...employeeForm,
                                name: e.target.value,
                              })
                            }
                            required
                          />

                          <input
                            placeholder="Email"
                            type="email"
                            value={employeeForm.email}
                            onChange={(e) =>
                              setEmployeeForm({
                                ...employeeForm,
                                email: e.target.value,
                              })
                            }
                            required
                          />

                          <input
                            placeholder="Password"
                            value={employeeForm.password}
                            onChange={(e) =>
                              setEmployeeForm({
                                ...employeeForm,
                                password: e.target.value,
                              })
                            }
                            required
                          />

                          <input
                            placeholder="Department"
                            value={employeeForm.department}
                            onChange={(e) =>
                              setEmployeeForm({
                                ...employeeForm,
                                department: e.target.value,
                              })
                            }
                          />

                          <input
                            placeholder="Position"
                            value={employeeForm.position}
                            onChange={(e) =>
                              setEmployeeForm({
                                ...employeeForm,
                                position: e.target.value,
                              })
                            }
                          />

                          <input
                            placeholder="PC Name"
                            value={employeeForm.pcName}
                            onChange={(e) =>
                              setEmployeeForm({
                                ...employeeForm,
                                pcName: e.target.value,
                              })
                            }
                          />

                          <button type="submit" disabled={loading}>
                            Add Employee
                          </button>
                        </form>
                      </div>

                      <div className="table-wrapper">
                        <table>
                          <thead>
                            <tr>
                              <th>Employee ID</th>
                              <th>Name</th>
                              <th>Email</th>
                              <th>PC Name</th>
                              <th>Department</th>
                              <th>Position</th>
                              <th>Status</th>
                              <th>Today Check In</th>
                              <th>Today Check Out</th>
                              <th>Action</th>
                            </tr>
                          </thead>

                          <tbody>
                            {filteredEmployees.map((emp) => {
                              const item = normalizeEmployee(emp);
                              const todayAttendance =
                                getTodayAttendanceForEmployee(item.id);

                              return (
                                <tr key={item.id}>
                                  <td>{item.employeeCode || "----"}</td>
                                  <td>{item.name}</td>
                                  <td>{item.email}</td>
                                  <td>{item.pcName || "Not set"}</td>
                                  <td>{item.department || "-"}</td>
                                  <td>{item.position || "-"}</td>
                                  <td>
                                    <span
                                      className={
                                        item.isOnline ? "online" : "offline"
                                      }
                                    >
                                      {item.isOnline ? "Online" : "Offline"}
                                    </span>
                                  </td>
                                  <td>
                                    {formatTime(todayAttendance?.checkInTime)}
                                  </td>
                                  <td>
                                    {formatTime(todayAttendance?.checkOutTime)}
                                  </td>
                                  <td>
                                    <div className="action-buttons">
                                      <button
                                        className="small-btn edit-btn"
                                        onClick={() => openEditEmployee(item)}
                                      >
                                        Edit
                                      </button>

                                      <button
                                        className="small-btn"
                                        onClick={() => {
                                          selectEmployeeForAction(item);
                                          openOnlyModule("manualAttendance");
                                        }}
                                      >
                                        Attendance
                                      </button>

                                      <button
                                        className="small-btn"
                                        onClick={() => viewScreenshots(item)}
                                      >
                                        Screenshots
                                      </button>

                                      <button
                                        className="small-btn live-btn"
                                        onClick={() => startLiveScreen(item)}
                                        disabled={!item.isOnline}
                                      >
                                        Live Screen
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}

                            {filteredEmployees.length === 0 && (
                              <tr>
                                <td colSpan="10">No employees found.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {module.key === "manualAttendance" && (
                    <form
                      className="manual-attendance-form"
                      onSubmit={submitManualAttendance}
                    >
                      <div className="selected-manual-employee">
                        <label>Selected Employee</label>
                        <strong>
                          {selectedEmployeeForAction
                            ? formatEmployeeLabel(selectedEmployeeForAction)
                            : "Search and select employee first"}
                        </strong>
                      </div>

                      <input
                        type="date"
                        value={manualForm.date}
                        onChange={(e) =>
                          setManualForm({
                            ...manualForm,
                            date: e.target.value,
                          })
                        }
                        required
                      />

                      <select
                        value={manualForm.status}
                        onChange={(e) =>
                          setManualForm({
                            ...manualForm,
                            status: e.target.value,
                          })
                        }
                      >
                        <option value="PRESENT">Present</option>
                        <option value="ABSENT">Absent</option>
                        <option value="LATE">Late</option>
                        <option value="MOVEMENT">Movement</option>
                        <option value="LEAVE">Leave</option>
                      </select>

                      <input
                        type="time"
                        value={manualForm.checkInTime}
                        onChange={(e) =>
                          setManualForm({
                            ...manualForm,
                            checkInTime: e.target.value,
                          })
                        }
                      />

                      <input
                        type="time"
                        value={manualForm.checkOutTime}
                        onChange={(e) =>
                          setManualForm({
                            ...manualForm,
                            checkOutTime: e.target.value,
                          })
                        }
                      />

                      <label className="payable-check">
                        <input
                          type="checkbox"
                          checked={manualForm.isPayable}
                          onChange={(e) =>
                            setManualForm({
                              ...manualForm,
                              isPayable: e.target.checked,
                            })
                          }
                        />
                        Payable Day
                      </label>

                      <textarea
                        placeholder="Reason / note"
                        value={manualForm.reason}
                        onChange={(e) =>
                          setManualForm({
                            ...manualForm,
                            reason: e.target.value,
                          })
                        }
                      />

                      <button type="submit" disabled={loading}>
                        Save Manual Attendance
                      </button>
                    </form>
                  )}

                  {module.key === "manualRecords" && (
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Employee ID</th>
                            <th>Employee</th>
                            <th>Email</th>
                            <th>Date</th>
                            <th>Status</th>
                            <th>Check In</th>
                            <th>Check Out</th>
                            <th>Payable</th>
                            <th>Reason</th>
                            <th>Action</th>
                          </tr>
                        </thead>

                        <tbody>
                          {filteredManualRecords.map((item) => (
                            <tr key={item.id}>
                              <td>{item.employee?.employeeCode || "----"}</td>
                              <td>{item.employee?.user?.name || "-"}</td>
                              <td>{item.employee?.user?.email || "-"}</td>
                              <td>{formatDate(item.date)}</td>
                              <td>
                                <span
                                  className={`manual-status ${String(
                                    item.status
                                  ).toLowerCase()}`}
                                >
                                  {item.status}
                                </span>
                              </td>
                              <td>{formatTime(item.checkInTime)}</td>
                              <td>{formatTime(item.checkOutTime)}</td>
                              <td>{item.isPayable ? "Yes" : "No"}</td>
                              <td>{item.reason || "-"}</td>
                              <td>
                                <button
                                  className="reject-btn"
                                  onClick={() =>
                                    deleteManualAttendanceRecord(item.id)
                                  }
                                  disabled={loading}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}

                          {filteredManualRecords.length === 0 && (
                            <tr>
                              <td colSpan="10">
                                No manual attendance records found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {module.key === "leaveRequests" && (
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Employee ID</th>
                            <th>Employee</th>
                            <th>Email</th>
                            <th>Leave Type</th>
                            <th>Start</th>
                            <th>End</th>
                            <th>Days</th>
                            <th>Status</th>
                            <th>Reason</th>
                            <th>Action</th>
                          </tr>
                        </thead>

                        <tbody>
                          {filteredLeaveRequests.map((item) => (
                            <tr key={item.id}>
                              <td>{item.employee?.employeeCode || "----"}</td>
                              <td>{item.employee?.user?.name || "-"}</td>
                              <td>{item.employee?.user?.email || "-"}</td>
                              <td>{item.leaveType?.name || "-"}</td>
                              <td>{formatDate(item.startDate)}</td>
                              <td>{formatDate(item.endDate)}</td>
                              <td>{item.days}</td>
                              <td>
                                <span
                                  className={`leave-status ${String(
                                    item.status
                                  ).toLowerCase()}`}
                                >
                                  {item.status}
                                </span>
                              </td>
                              <td>{item.reason || "-"}</td>
                              <td>
                                {item.status === "PENDING" ? (
                                  <div className="action-buttons">
                                    <button
                                      className="approve-btn"
                                      onClick={() => approveLeave(item.id)}
                                      disabled={loading}
                                    >
                                      Approve
                                    </button>

                                    <button
                                      className="reject-btn"
                                      onClick={() => rejectLeave(item.id)}
                                      disabled={loading}
                                    >
                                      Reject
                                    </button>
                                  </div>
                                ) : (
                                  "-"
                                )}
                              </td>
                            </tr>
                          ))}

                          {filteredLeaveRequests.length === 0 && (
                            <tr>
                              <td colSpan="10">No leave requests found.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {module.key === "attendanceRecords" && (
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Employee ID</th>
                            <th>Employee</th>
                            <th>Email</th>
                            <th>PC Name</th>
                            <th>Check In</th>
                            <th>Check Out</th>
                            <th>Status</th>
                            <th>Total Time</th>
                          </tr>
                        </thead>

                        <tbody>
                          {filteredAttendances.map((att) => (
                            <tr key={att.id}>
                              <td>{att.employee?.employeeCode || "----"}</td>
                              <td>{att.employee?.user?.name || "-"}</td>
                              <td>{att.employee?.user?.email || "-"}</td>
                              <td>{att.employee?.pcName || "-"}</td>
                              <td>{formatDateTime(att.checkInTime)}</td>
                              <td>{formatDateTime(att.checkOutTime)}</td>
                              <td>{att.status}</td>
                              <td>{formatDuration(att.totalMinutes)}</td>
                            </tr>
                          ))}

                          {filteredAttendances.length === 0 && (
                            <tr>
                              <td colSpan="8">No attendance records found.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {module.key === "workPolicy" && (
                    <form className="policy-form" onSubmit={updateWorkPolicy}>
                      <div className="policy-block">
                        <label>Shift Start Time</label>
                        <input
                          type="time"
                          value={workPolicyForm.shiftStartTime}
                          onChange={(e) =>
                            setWorkPolicyForm({
                              ...workPolicyForm,
                              shiftStartTime: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="policy-block">
                        <label>Shift End Time</label>
                        <input
                          type="time"
                          value={workPolicyForm.shiftEndTime}
                          onChange={(e) =>
                            setWorkPolicyForm({
                              ...workPolicyForm,
                              shiftEndTime: e.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="weekend-box">
                        <label>Weekend Days</label>

                        <div className="weekend-grid">
                          {WEEK_DAYS.map((day) => (
                            <button
                              key={day.value}
                              type="button"
                              className={
                                workPolicyForm.weekendDays.includes(day.value)
                                  ? "weekend-day selected"
                                  : "weekend-day"
                              }
                              onClick={() => toggleWeekendDay(day.value)}
                            >
                              {day.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <button
                        className="save-policy-btn"
                        type="submit"
                        disabled={loading}
                      >
                        Save Work Policy
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>

        {editEmployee && (
          <div className="modal-backdrop">
            <div className="modal edit-employee-modal">
              <div className="modal-header">
                <div>
                  <h2>Edit Employee</h2>
                  <p>{formatEmployeeLabel(editEmployee)}</p>
                </div>

                <button onClick={closeEditEmployee}>Close</button>
              </div>

              <form className="edit-employee-form" onSubmit={updateEmployee}>
                <div>
                  <label>Employee ID</label>
                  <input
                    value={editEmployeeForm.employeeCode}
                    onChange={(e) =>
                      setEditEmployeeForm({
                        ...editEmployeeForm,
                        employeeCode: e.target.value,
                      })
                    }
                    placeholder="0001"
                    required
                  />
                </div>

                <div>
                  <label>Name</label>
                  <input
                    value={editEmployeeForm.name}
                    onChange={(e) =>
                      setEditEmployeeForm({
                        ...editEmployeeForm,
                        name: e.target.value,
                      })
                    }
                    required
                  />
                </div>

                <div>
                  <label>Email</label>
                  <input
                    type="email"
                    value={editEmployeeForm.email}
                    onChange={(e) =>
                      setEditEmployeeForm({
                        ...editEmployeeForm,
                        email: e.target.value,
                      })
                    }
                    required
                  />
                </div>

                <div>
                  <label>New Password</label>
                  <input
                    type="password"
                    value={editEmployeeForm.password}
                    onChange={(e) =>
                      setEditEmployeeForm({
                        ...editEmployeeForm,
                        password: e.target.value,
                      })
                    }
                    placeholder="Leave blank to keep old password"
                  />
                </div>

                <div>
                  <label>Department</label>
                  <input
                    value={editEmployeeForm.department}
                    onChange={(e) =>
                      setEditEmployeeForm({
                        ...editEmployeeForm,
                        department: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label>Position</label>
                  <input
                    value={editEmployeeForm.position}
                    onChange={(e) =>
                      setEditEmployeeForm({
                        ...editEmployeeForm,
                        position: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label>PC Name</label>
                  <input
                    value={editEmployeeForm.pcName}
                    onChange={(e) =>
                      setEditEmployeeForm({
                        ...editEmployeeForm,
                        pcName: e.target.value,
                      })
                    }
                  />
                </div>

                <button type="submit" disabled={loading}>
                  Save Employee Changes
                </button>
              </form>
            </div>
          </div>
        )}

        {selectedEmployee && (
          <div className="modal-backdrop">
            <div className="modal">
              <div className="modal-header">
                <div>
                  <h2>Screenshot History</h2>
                  <p>
                    {selectedEmployee.employeeCode || "----"} —{" "}
                    {selectedEmployee.name || selectedEmployee.user?.name} —{" "}
                    {selectedEmployee.pcName || "Unknown PC"}
                  </p>
                </div>

                <button onClick={() => setSelectedEmployee(null)}>Close</button>
              </div>

              {screenshots.length === 0 ? (
                <div className="empty-box">
                  No screenshots found yet. Screenshots are captured
                  automatically during checked-in work sessions.
                </div>
              ) : (
                <div className="screenshot-grid">
                  {screenshots.map((shot) => (
                    <div className="screenshot-card" key={shot.id}>
                      <img
                        src={`${API_BASE}${shot.imageUrl}`}
                        alt="Employee screenshot"
                      />

                      <div className="screenshot-meta">
                        <p>{formatDateTime(shot.capturedAt)}</p>
                        <span>{shot.pcName}</span>

                        {shot.isSaved ? (
                          <strong className="saved-badge">
                            Saved Permanently
                          </strong>
                        ) : (
                          <strong className="temporary-badge">
                            Auto delete after 24 hours
                          </strong>
                        )}
                      </div>

                      <div className="screenshot-actions">
                        {!shot.isSaved && (
                          <button onClick={() => saveScreenshot(shot.id)}>
                            Save / Keep
                          </button>
                        )}

                        <a
                          href={`${API_BASE}${shot.imageUrl}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open
                        </a>

                        <button
                          className="delete-shot-btn"
                          onClick={() => deleteScreenshot(shot.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {liveEmployee && (
          <div className="modal-backdrop">
            <div className="modal live-modal">
              <div className="modal-header">
                <div>
                  <h2>Live Screen View</h2>
                  <p>
                    {liveEmployee.employeeCode || "----"} —{" "}
                    {liveEmployee.name || liveEmployee.user?.name} —{" "}
                    {liveEmployee.pcName || "Unknown PC"}
                  </p>
                </div>

                <button onClick={stopLiveScreen}>Close Live View</button>
              </div>

              <div className="live-status">{liveStatus}</div>

              <div className="live-screen-box">
                {liveFrame ? (
                  <img src={liveFrame} alt="Live employee screen" />
                ) : (
                  <div className="empty-box">
                    Waiting for employee screen. Employee must be logged in and
                    checked in.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;