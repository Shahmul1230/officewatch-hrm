import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./App.css";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function App() {
  const [token, setToken] = useState(
    localStorage.getItem("employeePortalToken") || ""
  );

  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("employeePortalUser");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [loginForm, setLoginForm] = useState({
    email: "rahim@officewatch.com",
    password: "123456",
  });

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [employeeProfile, setEmployeeProfile] = useState(null);
  const [manualRecords, setManualRecords] = useState([]);
  const [activeAttendance, setActiveAttendance] = useState(null);

  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveSummary, setLeaveSummary] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  
  const [workPolicy, setWorkPolicy] = useState({
    weekendDays: [5, 6],
    shiftStartTime: "08:00",
    shiftEndTime: "17:00",
  });

  const [leaveForm, setLeaveForm] = useState({
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    reason: "",
    isHalfDay: false,
  });

  const [calendarDate, setCalendarDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

  const getAuthHeader = () => ({
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const formatDate = (value) => {
    if (!value) return "---";
    return new Date(value).toLocaleDateString();
  };

  const formatTime = (value) => {
    if (!value) return "---";

    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (minutes) => {
    if (minutes === null || minutes === undefined) return "00:00";

    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;

    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  };

  const getDateKey = (value) => {
    const date = new Date(value);
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  };

  const isSameMonth = (value, monthDate) => {
    const date = new Date(value);

    return (
      date.getFullYear() === monthDate.getFullYear() &&
      date.getMonth() === monthDate.getMonth()
    );
  };

  const isPastOrToday = (dateValue) => {
    const date = new Date(dateValue);
    const today = new Date();

    const onlyDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    const onlyToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    return onlyDate <= onlyToday;
  };

  const hasApprovedLeaveOnDate = (dateValue) => {
    const current = new Date(dateValue);

    const currentOnly = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate()
    );

    return leaveRequests.some((leave) => {
      if (leave.status !== "APPROVED") return false;

      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);

      const startOnly = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate()
      );

      const endOnly = new Date(
        end.getFullYear(),
        end.getMonth(),
        end.getDate()
      );

      return currentOnly >= startOnly && currentOnly <= endOnly;
    });
  };

  const fetchWorkPolicy = async () => {
    try {
      const res = await axios.get(
        `${API_BASE}/api/settings/work-policy`,
        getAuthHeader()
      );

      setWorkPolicy(
        res.data.policy || {
          weekendDays: [5, 6],
          shiftStartTime: "08:00",
          shiftEndTime: "17:00",
        }
      );
    } catch {
      setWorkPolicy({
        weekendDays: [5, 6],
        shiftStartTime: "08:00",
        shiftEndTime: "17:00",
      });
    }
  };
  const fetchMyProfile = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/employees/me`, getAuthHeader());
      setEmployeeProfile(res.data.employee || null);
    } catch {
      setEmployeeProfile(null);
    }
  };

  const fetchMyAttendance = async () => {
    const res = await axios.get(`${API_BASE}/api/attendance/me`, getAuthHeader());

    const records = res.data.attendances || [];
    setAttendanceRecords(records);

    const active = records.find((item) => item.status === "CHECKED_IN");
    setActiveAttendance(active || null);
  };

  const fetchManualAttendance = async () => {
    try {
      const month = `${calendarDate.getFullYear()}-${String(
        calendarDate.getMonth() + 1
      ).padStart(2, "0")}`;

      const res = await axios.get(
        `${API_BASE}/api/manual-attendance/me?month=${month}`,
        getAuthHeader()
      );

      setManualRecords(res.data.records || []);
    } catch {
      setManualRecords([]);
    }
  };

  const fetchLeaveData = async () => {
    const [typesRes, summaryRes, requestsRes] = await Promise.all([
      axios.get(`${API_BASE}/api/leaves/types`, getAuthHeader()),
      axios.get(`${API_BASE}/api/leaves/summary/me`, getAuthHeader()),
      axios.get(`${API_BASE}/api/leaves/me`, getAuthHeader()),
    ]);

    const types = typesRes.data.leaveTypes || [];

    setLeaveTypes(types);
    setLeaveSummary(summaryRes.data.summary || []);
    setLeaveRequests(requestsRes.data.leaveRequests || []);

    if (!leaveForm.leaveTypeId && types.length > 0) {
      setLeaveForm((prev) => ({
        ...prev,
        leaveTypeId: types[0].id,
      }));
    }
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);

      await Promise.all([
        fetchMyProfile(),
        fetchWorkPolicy(),
        fetchMyAttendance(),
        fetchLeaveData(),
        fetchManualAttendance(),
      ]);
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setMessage("");

      const res = await axios.post(`${API_BASE}/api/auth/login`, loginForm);

      if (res.data.user.role !== "EMPLOYEE") {
        setMessage("Only employee accounts can use this portal.");
        return;
      }

      localStorage.setItem("employeePortalToken", res.data.token);
      localStorage.setItem("employeePortalUser", JSON.stringify(res.data.user));

      setToken(res.data.token);
      setUser(res.data.user);
      setMessage("Login successful.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const checkIn = async () => {
    try {
      setLoading(true);
      setMessage("");

      await axios.post(
        `${API_BASE}/api/attendance/check-in`,
        { source: "EMPLOYEE_PORTAL" },
        getAuthHeader()
      );

      setMessage("Check-in successful.");
      await fetchMyAttendance();
      await fetchManualAttendance();
    } catch (error) {
      setMessage(error.response?.data?.message || "Check-in failed.");
    } finally {
      setLoading(false);
    }
  };

  const checkOut = async () => {
    try {
      setLoading(true);
      setMessage("");

      await axios.post(
        `${API_BASE}/api/attendance/check-out`,
        {},
        getAuthHeader()
      );

      setMessage("Check-out successful.");
      await fetchMyAttendance();
      await fetchManualAttendance();
    } catch (error) {
      setMessage(error.response?.data?.message || "Check-out failed.");
    } finally {
      setLoading(false);
    }
  };

  const applyLeave = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setMessage("");

      await axios.post(`${API_BASE}/api/leaves/apply`, leaveForm, getAuthHeader());

      setLeaveForm({
        leaveTypeId: leaveTypes[0]?.id || "",
        startDate: "",
        endDate: "",
        reason: "",
        isHalfDay: false,
      });

      setMessage("Leave request submitted successfully.");
      await fetchLeaveData();
      await fetchManualAttendance();
    } catch (error) {
      setMessage(error.response?.data?.message || "Failed to apply leave.");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("employeePortalToken");
    localStorage.removeItem("employeePortalUser");

    setToken("");
    setUser(null);
    setAttendanceRecords([]);
    setManualRecords([]);
    setActiveAttendance(null);
    setLeaveTypes([]);
    setLeaveSummary([]);
    setLeaveRequests([]);
    setMessage("");
  };

  useEffect(() => {
    if (token) {
      fetchAllData();
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchManualAttendance();
    }
  }, [token, calendarDate]);

  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startPadding = firstDay.getDay();

    const recordMap = {};
    const manualMap = {};

    attendanceRecords.forEach((record) => {
      if (record.checkInTime && isSameMonth(record.checkInTime, calendarDate)) {
        recordMap[getDateKey(record.checkInTime)] = record;
      }
    });

    manualRecords.forEach((manual) => {
      if (manual.date && isSameMonth(manual.date, calendarDate)) {
        manualMap[getDateKey(manual.date)] = manual;
      }
    });

    const result = [];

    for (let i = 0; i < startPadding; i++) {
      result.push({
        type: "empty",
        key: `empty-${i}`,
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const current = new Date(year, month, day);
      const key = `${year}-${month + 1}-${day}`;

      const record = recordMap[key];
      const manual = manualMap[key];

      const isWeekend = workPolicy.weekendDays.includes(current.getDay());
      const isLeave = hasApprovedLeaveOnDate(current);

      let label = "";
      let status = "blank";
      let isPayableDay = false;

      if (manual) {
        if (manual.status === "PRESENT") {
          label = "Present";
          status = "present";
        } else if (manual.status === "ABSENT") {
          label = "Absent";
          status = "absent";
        } else if (manual.status === "LATE") {
          label = "Late";
          status = "late";
        } else if (manual.status === "MOVEMENT") {
          label = "Movement";
          status = "movement";
        } else if (manual.status === "LEAVE") {
          label = "Leave";
          status = "leave";
        }

        isPayableDay = Boolean(manual.isPayable);
      } else if (record?.checkInTime) {
        label = "Present";
        status = "present";
        isPayableDay = Boolean(record.checkInTime && record.checkOutTime);
      } else if (isLeave) {
        label = "Leave";
        status = "leave";
      } else if (isWeekend) {
        label = "Weekend";
        status = "weekend";
      } else if (isPastOrToday(current)) {
        label = "Absent";
        status = "absent";
      }

      result.push({
        type: "day",
        key,
        day,
        label,
        status,
        isPayableDay,
      });
    }

    return result;
  }, [
    calendarDate,
    attendanceRecords,
    manualRecords,
    workPolicy,
    leaveRequests,
  ]);

  const checkedIn = Boolean(activeAttendance);

  const payableDays = calendarDays.filter((item) => item.isPayableDay).length;
  const presentDays = calendarDays.filter((item) => item.status === "present").length;
  const lateDays = calendarDays.filter((item) => item.status === "late").length;
  const movementDays = calendarDays.filter((item) => item.status === "movement").length;
  const leaveDays = calendarDays.filter((item) => item.status === "leave").length;
  const absentDays = calendarDays.filter((item) => item.status === "absent").length;

  const recentRecords = [...attendanceRecords]
    .sort(
      (a, b) =>
        new Date(b.checkInTime || b.createdAt) -
        new Date(a.checkInTime || a.createdAt)
    )
    .slice(0, 6);

  const goPrevMonth = () => {
    setCalendarDate(
      new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1)
    );
  };

  const goNextMonth = () => {
    setCalendarDate(
      new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1)
    );
  };

  const changeMonth = (monthIndex) => {
    setCalendarDate(new Date(calendarDate.getFullYear(), Number(monthIndex), 1));
  };

  const changeYear = (year) => {
    setCalendarDate(new Date(Number(year), calendarDate.getMonth(), 1));
  };

  if (!token) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="brand-mark">OW</div>
          <h1>Employee Portal</h1>
          <p>Login to manage attendance and leave.</p>

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
    <div className="erp-shell">
      <header className="top-nav">
        <div className="nav-left">
          <span className="nav-icon">▦</span>
          <strong>Dashboard</strong>
        </div>

        <div className="nav-right">
          <span className="notif">13</span>
          <strong>OfficeWatch HRM</strong>
          <span className="nav-avatar">{user?.name?.charAt(0) || "E"}</span>
        </div>
      </header>

      <aside className="profile-sidebar">
        <div className="profile-ring">
          <div className="profile-avatar">{user?.name?.charAt(0) || "E"}</div>
          <button className="profile-edit">✎</button>
        </div>

        <h2>{employeeProfile?.user?.name || user?.name || "Employee"}</h2>
        <p>Employee</p>
        <p>Operations</p>

        <div className="profile-info">
          <span>EMPLOYEE ID</span>
          <strong>
            {employeeProfile?.employeeCode || user?.employeeCode || "----"}
          </strong>
        </div>

        <div className="profile-info">
          <span>COMPANY</span>
          <strong>OfficeWatch HRM</strong>
        </div>

        <div className="profile-info">
          <span>EMAIL</span>
          <strong>{employeeProfile?.user?.email || user?.email}</strong>
        </div>

        <div className="profile-info">
          <span>SHIFT</span>
          <strong>
            {workPolicy.shiftStartTime} to {workPolicy.shiftEndTime}
          </strong>
        </div>

        <div className="profile-info">
          <span>WEEKEND</span>
          <strong>
            {workPolicy.weekendDays.map((d) => dayNames[d]).join(", ")}
          </strong>
        </div>

        <button className="sidebar-btn" onClick={fetchAllData} disabled={loading}>
          Refresh
        </button>

        <button className="sidebar-btn logout" onClick={logout}>
          Logout
        </button>
      </aside>

      <main className="page-content">
        {message && <div className="message">{message}</div>}

        <div className="content-grid">
          <section className="card attendance-calendar">
            <div className="attendance-head">
              <h2>🗓 Attendance Calendar</h2>

              <div className="attendance-stats">
                <div>
                  <b>{payableDays}</b>
                  <span>Payable Days</span>
                </div>

                <div>
                  <b>{presentDays}</b>
                  <span>Present</span>
                </div>

                <div>
                  <b>{lateDays}</b>
                  <span>Late</span>
                </div>

                <div>
                  <b>{movementDays}</b>
                  <span>Movement</span>
                </div>

                <div>
                  <b>{leaveDays}</b>
                  <span>Leave</span>
                </div>

                <div>
                  <b>{absentDays}</b>
                  <span>Absent</span>
                </div>
              </div>
            </div>

            <div className="attendance-actions">
              <button
                className="check-in"
                onClick={checkIn}
                disabled={loading || checkedIn}
              >
                Check In
              </button>

              <button
                className="check-out"
                onClick={checkOut}
                disabled={loading || !checkedIn}
              >
                Check Out
              </button>

              <span className={checkedIn ? "status-pill active" : "status-pill inactive"}>
                {checkedIn ? "Checked In" : "Checked Out"}
              </span>
            </div>

            <div className="calendar-nav">
              <button onClick={goPrevMonth}>‹</button>

              <div className="month-pickers">
                <select
                  value={calendarDate.getMonth()}
                  onChange={(e) => changeMonth(e.target.value)}
                >
                  {monthNames.map((month, index) => (
                    <option key={month} value={index}>
                      {month}
                    </option>
                  ))}
                </select>

                <select
                  value={calendarDate.getFullYear()}
                  onChange={(e) => changeYear(e.target.value)}
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <button onClick={goNextMonth}>›</button>
            </div>

            <div className="week-row">
              <span>SUN</span>
              <span>MON</span>
              <span>TUE</span>
              <span>WED</span>
              <span>THU</span>
              <span>FRI</span>
              <span>SAT</span>
            </div>

            <div className="calendar-days">
              {calendarDays.map((item) =>
                item.type === "empty" ? (
                  <div className="day empty" key={item.key}></div>
                ) : (
                  <div className={`day ${item.status}`} key={item.key}>
                    <strong>{item.day}</strong>
                    {item.label && <span>{item.label}</span>}
                  </div>
                )
              )}
            </div>
          </section>

          <aside className="right-stack">
            <section className="card recent-card">
              <h3>⏱ Recent Check-ins</h3>

              <div className="recent-list">
                {recentRecords.map((item) => (
                  <div className="recent-item" key={item.id}>
                    <div className="recent-top">
                      <strong>{formatDate(item.checkInTime)}</strong>
                      <span>{formatDuration(item.totalMinutes)}</span>
                    </div>

                    <div className="recent-times">
                      <p>
                        ⬆ Check In <b>{formatTime(item.checkInTime)}</b>
                      </p>
                      <p>
                        ⬇ Check Out <b>{formatTime(item.checkOutTime)}</b>
                      </p>
                    </div>
                  </div>
                ))}

                {recentRecords.length === 0 && (
                  <div className="empty-box">No recent attendance found.</div>
                )}
              </div>
            </section>

            <section className="card leave-summary-card">
              <h3>Leave Summary</h3>

              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Taken</th>
                    <th>Remaining</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {leaveSummary.map((item) => (
                    <tr key={item.leaveTypeId}>
                      <td>{item.name}</td>
                      <td>{item.taken}</td>
                      <td>{item.remaining}</td>
                      <td>Valid</td>
                    </tr>
                  ))}

                  {leaveSummary.length === 0 && (
                    <tr>
                      <td colSpan="4">No leave summary found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </aside>

          <section className="card apply-leave-card">
            <h3>Apply for Leave</h3>

            <form className="leave-form" onSubmit={applyLeave}>
              <select
                value={leaveForm.leaveTypeId}
                onChange={(e) =>
                  setLeaveForm({ ...leaveForm, leaveTypeId: e.target.value })
                }
                required
              >
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={leaveForm.startDate}
                onChange={(e) =>
                  setLeaveForm({ ...leaveForm, startDate: e.target.value })
                }
                required
              />

              <input
                type="date"
                value={leaveForm.endDate}
                onChange={(e) =>
                  setLeaveForm({ ...leaveForm, endDate: e.target.value })
                }
                required
              />

              <label>
                <input
                  type="checkbox"
                  checked={leaveForm.isHalfDay}
                  onChange={(e) =>
                    setLeaveForm({ ...leaveForm, isHalfDay: e.target.checked })
                  }
                />
                Half Day
              </label>

              <textarea
                placeholder="Reason for leave"
                value={leaveForm.reason}
                onChange={(e) =>
                  setLeaveForm({ ...leaveForm, reason: e.target.value })
                }
              />

              <button type="submit" disabled={loading}>
                Submit Leave Request
              </button>
            </form>
          </section>

          <section className="card leave-history-card">
            <h3>My Leave Requests</h3>

            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Days</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {leaveRequests.map((item) => (
                  <tr key={item.id}>
                    <td>{item.leaveType?.name}</td>
                    <td>{formatDate(item.startDate)}</td>
                    <td>{formatDate(item.endDate)}</td>
                    <td>{item.days}</td>
                    <td>
                      <span className={`leave-status ${item.status.toLowerCase()}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}

                {leaveRequests.length === 0 && (
                  <tr>
                    <td colSpan="5">No leave requests found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;