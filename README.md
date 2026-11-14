# 🎓 College Placement Management System (CPMS) - Full-Stack DBMS Project

An enterprise-grade, full-stack **University Placement Management System** designed for DBMS Lab and Course Project evaluation. Connects directly to **MySQL (InnoDB Engine)** and features 3 distinct role-based portals (**Student**, **Company**, and **University TPO**), database views, stored procedures, audit logging, and live database trigger enforcement.

---

## 🌟 Key Features of the Web Application

### 1. 🎓 Student Portal
- **Profile & Academics**: Displays verified CGPA, 10th%, 12th%, active backlogs, academic department, and resume/GitHub/LinkedIn links.
- **Skills Manager**: Add and delete technical skills with proficiency tiers (`Expert`, `Advanced`, `Intermediate`, `Beginner`).
- **Placement Drives & Real-Time Eligibility Inspector**:
  - Live calculations check student CGPA vs. cutoff, backlogs vs. allowed, and department eligibility.
  - Clicking "Apply" invokes MySQL triggers. If a student is ineligible (e.g., lower CGPA or non-eligible branch), the exact **MySQL Trigger Error (`SQLSTATE 45000`)** is caught and rendered in a high-visibility modal.
- **Applications & Interview Timeline**: Tracks rounds (Coding OA, Technical 1, System Design, HR) with scores and interviewer feedback.
- **Placement Offers**: View CTC breakdown (**Base Salary + Joining Bonus = Total CTC**) and accept/decline offers (enforces University "One Student, One Offer" policy).

### 2. 🏢 Recruiting Company Partner Portal
- **Company Overview**: Tier category (`Tier-1 Super Dream`, `Tier-2 Dream`, `Tier-3 Mass/Core`), headquarters, and HR lead contacts.
- **Campus Drive Creator**: Post drives with CTC package, cutoff CGPA, max backlogs, deadlines, and multi-select checkboxes for eligible departments (populates M:N table `job_eligible_departments`).
- **Applicant Review**: Review registered applicants, filter by branch/CGPA, and update status (`Shortlisted`, `In-Process`, `Selected`, `Rejected`).
- **Interview Rounds & Grading**: Schedule rounds and evaluate candidates. Disqualifying a candidate triggers automatic application status synchronization to `Rejected` (Trigger 5).
- **Issue Job Offers**: Extend formal offers with Base Salary, Joining Bonus, and Total CTC (Trigger 6 validates that Base + Bonus $\le$ Total CTC).

### 3. 🏛️ University TPO (Placement Cell Admin) Portal
- **Executive Analytics Dashboard**:
  - Placement rate %, total enrolled, placed count, highest CTC package, average CTC package.
  - Interactive Chart.js graphs for department placement rates, package tiers, and gender diversity.
  - Live table querying MySQL View: `vw_department_placement_stats`.
- **Drives & Funnel Analysis**: Table querying MySQL View: `vw_job_drive_status`.
- **Placed Students Directory**: Table querying MySQL View: `vw_placed_students_summary`.
- **Stored Procedure Runner**:
  - Interactive UI executing `CALL sp_GetEligibleStudentsForJob(job_id)`.
  - Interactive UI executing `CALL sp_GetStudentPlacementProfile(usn)`.
- **Live Trigger Audit Trail**: Displays `placement_offer_audit_log` records generated automatically by Trigger 4.
- **DBMS Query Console (Lab/Viva Mode)**:
  - Select from 10 preloaded DBMS lab queries (Joins, Correlated Subqueries, Window Functions, HAVING, DATEDIFF).
  - Custom SQL editor to run any query live and display execution time in milliseconds and formatted tabular results.

---

## 🚀 How to Run the Project

### Prerequisites
- Node.js (v18+)
- MySQL Server (XAMPP, MySQL Workbench, or MariaDB)

### Step 1: Initialize the MySQL Database
1. Open **MySQL Workbench** or **phpMyAdmin**.
2. Open and execute the master SQL script:
   `college_placement_management.sql`
3. This creates the database `college_placement_db`, all 12 normalized tables, views, stored procedures, and triggers.

### Step 2: Configure Database Connection
Edit the `.env` file in the project folder with your MySQL credentials:
```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=college_placement_db
```

### Step 3: Start the Web Server
Open a terminal inside the project directory:
```bash
node server.js
```
or
```bash
npm start
```

### Step 4: Open in Your Browser
Visit:
```
http://localhost:3000
```

> **Note**: If MySQL is stopped or not yet running, the web application automatically switches to a **High-Fidelity Simulation Mode** with pre-seeded data so you can always demonstrate the interface seamlessly without server crashes!

---

## ⚡ Credentials & Demo Accounts for Presentation

| Role | Username / Identifier | Password | Notes |
| :--- | :--- | :--- | :--- |
| **Student** | `1RV21CS001` (or any USN/ID) | `1RV21CS001` | Password is always the student's USN or Student ID |
| **Company** | `CMP-MSFT-02` (or select dropdown) | `CMP-MSFT-02` or `microsoft` | Company ID or lowercase short name |
| **University TPO** | `TPO-EMP-101` | `admin123` | Master administrator credentials |
| **New Student** | Self-registered USN | Self-chosen password (or USN) | Registered via **`➕ Register Student`** |
| **New Company** | Self-registered Name | Self-chosen password | Registered via **`➕ Register Company`** |

---

## 📁 Project File Structure

```
College_Placement_DBMS_Project/
│
├── config/
│   └── db.js                        # MySQL connection pool & high-fidelity simulation engine
├── controllers/
│   ├── authController.js            # Registration (Student & Company) & unified password verification
│   ├── studentController.js         # Student operations, resume generation & eligibility checks
│   ├── companyController.js         # Company drives, applicants & evaluations
│   └── tpoController.js             # Analytics, stored procedures & query console
├── public/
│   ├── index.html                   # Interactive Single Page Application (TailwindCSS + Chart.js)
│   ├── css/
│   │   └── style.css                # Glassmorphism dark theme, print stylesheet & animations
│   └── js/
│       ├── app.js                   # Application state, persona switcher & registration handlers
│       ├── student.js               # Student portal logic, applications & ATS resume rendering
│       ├── company.js               # Recruiter portal logic & drive creator
│       ├── tpo.js                   # Analytics, conversion funnel & stored procedure caller
│       └── console.js               # Live DBMS query runner
├── routes/
│   └── api.js                       # Express REST API routes
├── .env                             # Database connection parameters
├── college_placement_management.sql # Master DDL, DML, Views, Procedures & Triggers
├── operations_and_queries.sql       # 10 Top DBMS lab evaluation queries
├── placement_triggers_and_tests.sql # 6 Advanced triggers & test scripts
├── viva_and_analysis_queries.sql    # Viva analysis queries & expected outputs
├── server.js                        # Express HTTP server
├── package.json
└── README.md
```
