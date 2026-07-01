# OfficeWatch HRM

**OfficeWatch HRM** is a full-stack Human Resource Management and employee monitoring platform built for organizations that need employee account management, attendance tracking, leave management, screenshot monitoring, and live screen preview from employee workstations.

The system includes a separate **Admin Dashboard**, **Employee Portal**, **Backend API**, and **Windows Employee Agent**.

**Developed by Md. Shahmul Islam**

---

## Live Project Links

| Module | Link |
|---|---|
| Admin Dashboard | https://officewatch-hrm.vercel.app |
| Employee Portal | https://officewatch-portal.vercel.app |
| Backend API | https://ow-api.pixelstack.cloud |

---

## Project Summary

OfficeWatch HRM follows a proper admin-controlled employee workflow.

First, the admin creates an employee account from the Admin Dashboard. After that, the employee can log in to the Employee Portal and the Windows Employee Agent using the assigned email and password.

The Employee Agent runs on the employee’s office PC and handles the monitoring part. Monitoring starts only when the employee is checked in. When the employee checks out, screenshot capture and live screen monitoring stop automatically.

This system is designed for practical HRM usage where attendance, leave, employee activity, and work-session monitoring need to be managed from one centralized platform.

---

## Main Modules

```txt
officewatch-hrm/
├── admin-dashboard/      # React + Vite Admin Dashboard
├── employee-portal/      # React + Vite Employee Portal
├── employee-agent/       # Electron Windows Employee Agent
├── server/               # Node.js + Express Backend API
└── README.md
```

---

## System Architecture

```txt
Admin Dashboard
https://officewatch-hrm.vercel.app
        |
        | HTTPS REST API + Socket.IO
        v
Backend API
https://ow-api.pixelstack.cloud
        ^
        | HTTPS REST API
        |
Employee Portal
https://officewatch-portal.vercel.app


Employee PC
OfficeWatch Employee Agent.exe
        |
        | HTTPS API
        | Socket.IO
        | Screenshot Upload
        | Live Screen Frames
        v
Backend API
https://ow-api.pixelstack.cloud
```

---

## Core Workflow

### 1. Admin Creates Employee

The admin must create the employee account first from the Admin Dashboard.

The employee account includes:

```txt
Employee ID
Employee Name
Email
Password
Department
Position
PC Name
```

Employee ID format example:

```txt
0001
0002
0003
```

After the admin creates the employee, the employee can log in to the Employee Portal and Employee Agent.

---

### 2. Employee Logs Into Employee Portal

Employee opens:

```txt
https://officewatch-portal.vercel.app
```

From the Employee Portal, the employee can:

```txt
Check in
Check out
View attendance calendar
Apply for leave
View leave request status
```

---

### 3. Employee Installs Employee Agent

The employee PC needs the Windows desktop agent:

```txt
OfficeWatch Employee Agent Setup.exe
```

After installation, the employee logs in using the same email and password created by the admin.

The Employee Agent connects to the backend API and stays active in the background/tray.

---

### 4. Employee Checks In

When the employee checks in from the Employee Portal:

```txt
Attendance Status = Checked In
Agent Status = Online
Screenshot Status = Active
Live Screen = Available for admin request
```

Monitoring does not start before check-in.

---

### 5. Screenshot Monitoring Starts Automatically

When the employee is checked in, the Employee Agent automatically starts screenshot monitoring.

In production mode:

```txt
Screenshots are captured randomly every 15–25 minutes.
```

Screenshots are uploaded to the backend server and can be viewed by the admin from the Admin Dashboard.

Admin path:

```txt
Admin Dashboard
→ Search Employee
→ Employee Management
→ Screenshots
```

Screenshots are only captured during checked-in work sessions.

---

### 6. Admin Can Start Live Screen

Live screen does not run all the time. It starts only when the admin requests it.

Admin path:

```txt
Admin Dashboard
→ Search Employee
→ Employee Management
→ Live Screen
```

Live screen workflow:

```txt
Admin clicks Live Screen
Backend sends live screen request to Employee Agent
Employee Agent captures compressed screen frames
Frames are sent through Socket.IO
Backend forwards frames to Admin Dashboard
Admin views employee live screen preview
```

Live screen works only when:

```txt
Employee Agent is online
Employee is checked in
Admin starts live screen request
```

When the employee checks out, live screen and screenshot monitoring stop automatically.

---

## Monitoring Logic

OfficeWatch monitoring is controlled by attendance status.

```txt
Employee Checked Out
→ Screenshot stopped
→ Live screen stopped
→ Monitoring disabled

Employee Checked In
→ Screenshot active
→ Admin can request live screen
→ Monitoring enabled
```

The Employee Agent handles:

```txt
Employee authentication
Attendance status checking
Screenshot capture
Screenshot upload
Live screen response
Socket.IO connection
Background/tray operation
Auto-start with Windows
Logout prevention while checked in
```

---

## Screenshot Monitoring vs Live Screen Monitoring

### Screenshot Monitoring

```txt
Purpose: Historical work-session record
Trigger: Automatic while checked in
Frequency: Random interval
Storage: Saved on backend server
Admin View: Screenshot history
```

### Live Screen Monitoring

```txt
Purpose: Real-time screen preview
Trigger: Admin request
Frequency: Fast compressed frames
Storage: Not saved as screenshot history
Admin View: Live screen modal
```

---

## Admin Dashboard Features

Admin Dashboard link:

```txt
https://officewatch-hrm.vercel.app
```

Main features:

```txt
Admin login
Create employee
Edit employee
Reset employee password
Search employee by ID, name, email, department, position, or PC name
View employee online/offline status
View today check-in and check-out
View full attendance history
Manual attendance control
View manual attendance records
Approve or reject leave requests
Configure shift time
Configure weekend days
View screenshot history
Start live screen monitoring
```

The admin dashboard is designed so employee-related modules can be filtered using employee search.

---

## Employee Portal Features

Employee Portal link:

```txt
https://officewatch-portal.vercel.app
```

Main features:

```txt
Employee login
Check in
Check out
View attendance calendar
View present, absent, leave, and weekend status
Apply for leave
View leave request history
```

The employee portal is used for attendance and leave workflow. Monitoring is handled by the Windows Employee Agent.

---

## Employee Agent Features

The Employee Agent is a Windows desktop application built with Electron.

Main features:

```txt
Employee login
Connects to backend API
Runs in background/tray
Starts with Windows
Detects check-in/check-out status
Captures screenshots only while checked in
Stops screenshot capture after check-out
Responds to admin live screen request
Sends compressed live screen frames
Prevents logout while employee is checked in
```

---

## Backend API Features

Backend API link:

```txt
https://ow-api.pixelstack.cloud
```

The backend handles:

```txt
Authentication
JWT session management
Role-based access control
Employee management
Attendance management
Manual attendance override
Leave management
Screenshot upload
Screenshot retention
Socket.IO live screen communication
Work policy settings
Admin and employee data flow
```

---

## Technology Stack

### Frontend

```txt
React
Vite
Axios
Socket.IO Client
CSS
```

### Backend

```txt
Node.js
Express.js
Prisma ORM
SQLite
JWT Authentication
Bcrypt
Multer
Socket.IO
PM2
Nginx
Let's Encrypt SSL
```

### Desktop Agent

```txt
Electron
Electron Builder
Axios
Socket.IO Client
screenshot-desktop
```

---

## Production Deployment

### Frontend Deployment

The Admin Dashboard and Employee Portal are deployed separately on Vercel.

```txt
Admin Dashboard → Vercel
Employee Portal → Vercel
```

Both frontend projects use the backend API URL through environment variable:

```env
VITE_API_BASE_URL=https://ow-api.pixelstack.cloud
```

---

### Backend Deployment

The backend is deployed on a VPS.

Production setup:

```txt
Node.js backend runs on internal port 5057
Nginx reverse proxy exposes the API publicly
HTTPS is enabled with Let's Encrypt SSL
PM2 keeps the backend running
```

Public backend URL:

```txt
https://ow-api.pixelstack.cloud
```

---

### Employee Agent Deployment

The Employee Agent is packaged as a Windows `.exe` installer.

Build output location:

```txt
employee-agent/dist/
```

Installer example:

```txt
OfficeWatch Employee Agent Setup.exe
```

Only the generated `.exe` installer is needed for employee PCs.

---

## Environment Variables

### Backend Environment

Create a `.env` file inside the `server` folder.

```env
NODE_ENV=production
PORT=5057
DATABASE_URL="file:./dev.db"

JWT_SECRET=replace_with_secure_random_secret

ADMIN_ORIGIN=https://officewatch-hrm.vercel.app
PORTAL_ORIGIN=https://officewatch-portal.vercel.app
```

Generate a secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Do not commit `.env` files to GitHub.

---

## Local Development

### Backend

```bash
cd server
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

Local backend URL:

```txt
http://localhost:5000
```

---

### Admin Dashboard

```bash
cd admin-dashboard
npm install
npm run dev
```

Local admin URL:

```txt
http://localhost:5173
```

---

### Employee Portal

```bash
cd employee-portal
npm install
npm run dev
```

Local employee portal URL:

```txt
http://localhost:5174
```

---

### Employee Agent

```bash
cd employee-agent
npm install
npm run dev
```

---

## Build Employee Agent Installer

Run from the `employee-agent` folder:

```powershell
cd employee-agent

taskkill /F /IM electron.exe
taskkill /F /IM "OfficeWatch Employee Agent.exe"

Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue

npm install
npm run dist
```

The installer will be generated inside:

```txt
employee-agent/dist/
```

---

## Employee Agent Installation Flow

On each employee PC:

```txt
1. Install OfficeWatch Employee Agent Setup.exe
2. Open OfficeWatch Employee Agent
3. Login using employee email and password
4. Keep the app running in background/tray
5. Employee checks in from Employee Portal
6. Agent starts screenshot monitoring
7. Admin can request live screen
8. Employee checks out
9. Monitoring stops automatically
```

---

## Screenshot Storage

Screenshots are uploaded to the backend and stored on the server.

Screenshot monitoring works only when:

```txt
Employee Agent is online
Employee is logged in
Employee is checked in
Monitoring is active
```

Admin can view screenshots from:

```txt
Admin Dashboard
→ Search Employee
→ Employee Management
→ Screenshots
```

---

## Live Screen Monitoring

Live screen is handled through Socket.IO.

Live screen works only when:

```txt
Employee Agent is online
Employee is checked in
Admin starts live screen request
```

Live screen uses compressed image frames for real-time preview.

Same-PC testing may show mirror effect. Real testing should use:

```txt
Admin Dashboard on admin PC
Employee Agent on employee PC
```

---

## Common Issues

### Employee Cannot Login

Possible causes:

```txt
Employee account was not created by admin
Wrong email or password
Backend API is not reachable
Frontend environment variable is missing
```

---

### Invalid or Expired Token

Possible cause:

```txt
JWT secret was changed after employee login
Old saved token exists in Employee Agent
```

Fix on employee PC:

```powershell
taskkill /F /IM "OfficeWatch Employee Agent.exe"
taskkill /F /IM electron.exe

Remove-Item "$env:APPDATA\officewatch-employee-agent\agent-session.json" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:APPDATA\OfficeWatch Employee Agent\agent-session.json" -Force -ErrorAction SilentlyContinue
```

Then open Agent and log in again.

---

### Screenshot Not Showing

Check:

```txt
Employee is checked in
Agent is online
Screenshot status is active
Backend upload folder exists
Admin is checking the correct employee
```

---

### Live Screen Is Slow

Live screen uses compressed image frames through Socket.IO.

For smoother performance:

```txt
Use stable internet
Test with admin and employee on separate PCs
Avoid same-PC testing to prevent mirror effect
Use compressed JPEG frames in the Employee Agent
```

---

## Future Update Workflow

### Frontend Update

```bash
git add .
git commit -m "update frontend"
git push origin main
```

Vercel will automatically redeploy frontend projects.

---

### Backend Update on VPS

```bash
cd /home/officewatch-api/officewatch-hrm
git pull origin main

cd server
npm install
npx prisma generate
npx prisma migrate deploy
pm2 restart officewatch-api --update-env
pm2 save
```

---

### Employee Agent Update

```powershell
cd employee-agent
npm install
npm run dist
```

Then distribute the new installer to employee PCs.

---

## Security Notes

```txt
Do not commit .env files
Do not commit database files containing real user data
Do not commit uploaded screenshots
Do not expose backend internal port publicly
Use HTTPS in production
Use a strong JWT secret
Rotate JWT secret if token is exposed
Use proper employee consent and company monitoring policy
Use read-only deploy key for VPS deployment
Keep backend behind Nginx reverse proxy
```

---

## Current Status

```txt
Backend API: Live
Admin Dashboard: Live
Employee Portal: Live
Employee Agent: Windows installer supported
Attendance Management: Supported
Leave Management: Supported
Manual Attendance: Supported
Screenshot Monitoring: Supported
Live Screen Monitoring: Supported
```

---

## Developed By

**Md. Shahmul Islam**

---

## License

This project is private software intended for internal business and HR operations.
