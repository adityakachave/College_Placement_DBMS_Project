-- ============================================================================
-- DATABASE: College Placement Management System (CPMS)
-- Enterprise-Grade Relational Schema with Realistic Alphanumeric Identifiers
-- Target RDBMS: MySQL 8.0+ / MariaDB (InnoDB Engine, utf8mb4)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS college_placement_db;
USE college_placement_db;

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_SAFE_UPDATES = 0;

-- Drop views if they exist
DROP VIEW IF EXISTS vw_placed_students_summary;
DROP VIEW IF EXISTS vw_job_drive_status;
DROP VIEW IF EXISTS vw_department_placement_stats;
DROP VIEW IF EXISTS vw_company_recruitment_summary;

-- Drop procedures if they exist
DROP PROCEDURE IF EXISTS sp_GetEligibleStudentsForJob;
DROP PROCEDURE IF EXISTS sp_GetStudentPlacementProfile;

-- Drop triggers if they exist
DROP TRIGGER IF EXISTS trg_after_offer_accepted;
DROP TRIGGER IF EXISTS trg_check_cgpa_eligibility;
DROP TRIGGER IF EXISTS trg_validate_branch_eligibility;
DROP TRIGGER IF EXISTS trg_validate_application_deadline;
DROP TRIGGER IF EXISTS trg_enforce_single_offer_policy;
DROP TRIGGER IF EXISTS trg_audit_offer_revisions;
DROP TRIGGER IF EXISTS trg_sync_app_status_on_round_result;
DROP TRIGGER IF EXISTS trg_validate_salary_breakdown;
DROP TRIGGER IF EXISTS trg_validate_salary_breakdown_update;

-- Drop tables in proper dependency order
DROP TABLE IF EXISTS placement_offer_audit_log;
DROP TABLE IF EXISTS student_skills;
DROP TABLE IF EXISTS placement_offers;
DROP TABLE IF EXISTS round_results;
DROP TABLE IF EXISTS interview_rounds;
DROP TABLE IF EXISTS applications;
DROP TABLE IF EXISTS job_eligible_departments;
DROP TABLE IF EXISTS job_postings;
DROP TABLE IF EXISTS companies;
DROP TABLE IF EXISTS placement_officers;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS departments;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- 1. TABLE DEFINITIONS (DDL)
-- ============================================================================

-- Table 1: Departments
CREATE TABLE departments (
    department_id VARCHAR(15) PRIMARY KEY COMMENT 'Format: DEPT-CSE, DEPT-ECE, etc.',
    department_code VARCHAR(10) NOT NULL UNIQUE,
    department_name VARCHAR(100) NOT NULL,
    head_of_department VARCHAR(100) NOT NULL,
    building_block VARCHAR(50) NOT NULL,
    contact_email VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 2: Placement Officers / Coordinators
CREATE TABLE placement_officers (
    officer_id VARCHAR(20) PRIMARY KEY COMMENT 'Format: TPO-EMP-101, TPO-EMP-102, etc.',
    officer_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone_number VARCHAR(20) NOT NULL,
    designation VARCHAR(60) NOT NULL,
    cabin_location VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 3: Students
CREATE TABLE students (
    student_id VARCHAR(20) PRIMARY KEY COMMENT 'Format: STU-2021-CS001, etc.',
    usn VARCHAR(20) NOT NULL UNIQUE COMMENT 'University Seat / Roll Number',
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    gender ENUM('Male', 'Female', 'Other') NOT NULL,
    college_email VARCHAR(100) NOT NULL UNIQUE,
    personal_email VARCHAR(100) NOT NULL UNIQUE,
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    department_id VARCHAR(15) NOT NULL,
    cgpa DECIMAL(4, 2) NOT NULL CHECK (cgpa >= 0.00 AND cgpa <= 10.00),
    tenth_percentage DECIMAL(5, 2) NOT NULL CHECK (tenth_percentage >= 0.00 AND tenth_percentage <= 100.00),
    twelfth_percentage DECIMAL(5, 2) NOT NULL CHECK (twelfth_percentage >= 0.00 AND twelfth_percentage <= 100.00),
    active_backlogs INT DEFAULT 0 CHECK (active_backlogs >= 0),
    graduation_year YEAR NOT NULL,
    github_url VARCHAR(255),
    linkedin_url VARCHAR(255),
    resume_storage_url VARCHAR(255),
    placement_status ENUM('Unplaced', 'Placed', 'Higher Studies', 'Opted Out') DEFAULT 'Unplaced',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_students_department FOREIGN KEY (department_id) 
        REFERENCES departments(department_id) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 4: Student Technical Skills
CREATE TABLE student_skills (
    student_id VARCHAR(20) NOT NULL,
    skill_name VARCHAR(50) NOT NULL,
    proficiency_level ENUM('Beginner', 'Intermediate', 'Advanced', 'Expert') DEFAULT 'Intermediate',
    PRIMARY KEY (student_id, skill_name),
    CONSTRAINT fk_skills_student FOREIGN KEY (student_id) 
        REFERENCES students(student_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 5: Recruiting Companies
CREATE TABLE companies (
    company_id VARCHAR(20) PRIMARY KEY COMMENT 'Format: CMP-GOOG-01, CMP-MSFT-02, etc.',
    company_name VARCHAR(100) NOT NULL UNIQUE,
    industry_domain VARCHAR(60) NOT NULL,
    headquarters VARCHAR(100) NOT NULL,
    website_url VARCHAR(150),
    hr_contact_name VARCHAR(100) NOT NULL,
    hr_email VARCHAR(100) NOT NULL,
    hr_phone VARCHAR(20) NOT NULL,
    tier_category ENUM('Tier-1 (Super Dream)', 'Tier-2 (Dream)', 'Tier-3 (Mass/Core)') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 6: Job Postings (Campus Recruitment Drives)
CREATE TABLE job_postings (
    job_id VARCHAR(30) PRIMARY KEY COMMENT 'Format: JOB-2024-GOOG-SDE, etc.',
    company_id VARCHAR(20) NOT NULL,
    officer_in_charge VARCHAR(20) NOT NULL,
    job_title VARCHAR(100) NOT NULL,
    job_description TEXT NOT NULL,
    job_role_type ENUM('Full-Time SDE', 'Internship', 'Internship + Full-Time', 'Core Engineering Trainee') DEFAULT 'Full-Time SDE',
    ctc_annual_lpa DECIMAL(10, 2) NOT NULL COMMENT 'Cost to Company in Lakhs Per Annum',
    min_cgpa_cutoff DECIMAL(4, 2) DEFAULT 6.50,
    max_backlogs_allowed INT DEFAULT 0,
    job_location VARCHAR(100) NOT NULL,
    drive_date DATE NOT NULL,
    registration_deadline DATETIME NOT NULL,
    drive_status ENUM('Upcoming', 'Ongoing', 'Completed', 'Cancelled') DEFAULT 'Upcoming',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_jobs_company FOREIGN KEY (company_id) 
        REFERENCES companies(company_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_jobs_officer FOREIGN KEY (officer_in_charge) 
        REFERENCES placement_officers(officer_id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 7: Job Eligible Departments (M:N Relationship)
CREATE TABLE job_eligible_departments (
    job_id VARCHAR(30) NOT NULL,
    department_id VARCHAR(15) NOT NULL,
    PRIMARY KEY (job_id, department_id),
    CONSTRAINT fk_jed_job FOREIGN KEY (job_id) 
        REFERENCES job_postings(job_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_jed_department FOREIGN KEY (department_id) 
        REFERENCES departments(department_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 8: Student Applications
CREATE TABLE applications (
    application_id VARCHAR(25) PRIMARY KEY COMMENT 'Format: APP-2024-101, APP-2024-102, etc.',
    job_id VARCHAR(30) NOT NULL,
    student_id VARCHAR(20) NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    current_status ENUM('Applied', 'Shortlisted', 'In-Process', 'Selected', 'Rejected') DEFAULT 'Applied',
    UNIQUE KEY uq_student_job_app (job_id, student_id),
    CONSTRAINT fk_app_job FOREIGN KEY (job_id) 
        REFERENCES job_postings(job_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_app_student FOREIGN KEY (student_id) 
        REFERENCES students(student_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 9: Interview Rounds
CREATE TABLE interview_rounds (
    round_id VARCHAR(30) PRIMARY KEY COMMENT 'Format: RND-GOOG-01, RND-MSFT-02, etc.',
    job_id VARCHAR(30) NOT NULL,
    round_sequence INT NOT NULL,
    round_type VARCHAR(60) NOT NULL COMMENT 'e.g., Online Coding Assessment, Technical Interview 1, HR',
    scheduled_timestamp DATETIME NOT NULL,
    platform_or_venue VARCHAR(255) NOT NULL,
    CONSTRAINT fk_ir_job FOREIGN KEY (job_id) 
        REFERENCES job_postings(job_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 10: Round Results & Feedback
CREATE TABLE round_results (
    result_id VARCHAR(25) PRIMARY KEY COMMENT 'Format: RES-2024-801, RES-2024-802, etc.',
    round_id VARCHAR(30) NOT NULL,
    student_id VARCHAR(20) NOT NULL,
    round_status ENUM('Qualified', 'Disqualified', 'Absent', 'Under Evaluation') DEFAULT 'Under Evaluation',
    evaluation_score DECIMAL(5, 2) COMMENT 'Score out of 100',
    interviewer_remarks TEXT,
    UNIQUE KEY uq_round_student_result (round_id, student_id),
    CONSTRAINT fk_rr_round FOREIGN KEY (round_id) 
        REFERENCES interview_rounds(round_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_rr_student FOREIGN KEY (student_id) 
        REFERENCES students(student_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 11: Placement Offers
CREATE TABLE placement_offers (
    offer_id VARCHAR(30) PRIMARY KEY COMMENT 'Format: OFFR-2024-GOOG-01, etc.',
    application_id VARCHAR(25) NOT NULL UNIQUE,
    student_id VARCHAR(20) NOT NULL,
    company_id VARCHAR(20) NOT NULL,
    job_id VARCHAR(30) NOT NULL,
    offered_ctc_lpa DECIMAL(10, 2) NOT NULL,
    base_salary_lpa DECIMAL(10, 2) NOT NULL,
    joining_bonus_lpa DECIMAL(10, 2) DEFAULT 0.00,
    offer_issued_date DATE NOT NULL,
    tentative_joining_date DATE NOT NULL,
    offer_status ENUM('Offered', 'Accepted', 'Declined', 'Revoked') DEFAULT 'Offered',
    CONSTRAINT fk_po_application FOREIGN KEY (application_id) 
        REFERENCES applications(application_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_po_student FOREIGN KEY (student_id) 
        REFERENCES students(student_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_po_company FOREIGN KEY (company_id) 
        REFERENCES companies(company_id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_po_job FOREIGN KEY (job_id) 
        REFERENCES job_postings(job_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table 12: Placement Offer Audit Log (For Triggers & Compliance)
CREATE TABLE placement_offer_audit_log (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    offer_id VARCHAR(30) NOT NULL,
    student_id VARCHAR(20) NOT NULL,
    old_ctc_lpa DECIMAL(10, 2),
    new_ctc_lpa DECIMAL(10, 2),
    old_status VARCHAR(30),
    new_status VARCHAR(30),
    action_type ENUM('UPDATE', 'DELETE') DEFAULT 'UPDATE',
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(50) DEFAULT (CURRENT_USER())
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================================
-- 2. MEANINGFUL ENTERPRISE SAMPLE DATA (DML)
-- ============================================================================

-- Insert Departments
INSERT INTO departments (department_id, department_code, department_name, head_of_department, building_block, contact_email) VALUES
('DEPT-CSE', 'CSE', 'Computer Science and Engineering', 'Dr. Ramesh K. Sundaram, Ph.D. (IIT-B)', 'Sir M.V. Block, 3rd Floor', 'hod.cse@rvce.edu.in'),
('DEPT-ISE', 'ISE', 'Information Science and Engineering', 'Dr. Ananya P. Sharma, Ph.D. (IISc)', 'Dr. Kalam Block, 2nd Floor', 'hod.ise@rvce.edu.in'),
('DEPT-ECE', 'ECE', 'Electronics and Communication Engineering', 'Dr. Suresh V. Rao, Ph.D. (IIT-M)', 'C.V. Raman Block, 1st Floor', 'hod.ece@rvce.edu.in'),
('DEPT-MECH', 'MECH', 'Mechanical Engineering', 'Dr. Rajesh N. Patil, Ph.D. (IIT-R)', 'Workshop Complex, Ground Floor', 'hod.mech@rvce.edu.in'),
('DEPT-AIDS', 'AIDS', 'Artificial Intelligence & Data Science', 'Dr. Priya M. Varma, Ph.D. (IIIT-H)', 'Turing Technology Wing, 4th Floor', 'hod.aids@rvce.edu.in');

-- Insert Placement Officers
INSERT INTO placement_officers (officer_id, officer_name, email, phone_number, designation, cabin_location) VALUES
('TPO-EMP-101', 'Prof. Arvind Kulkarni', 'arvind.kulkarni@rvce.edu.in', '+91-9845012341', 'Dean - Corporate Relations & Placements', 'Admin Wing, Room 204'),
('TPO-EMP-104', 'Prof. Meera Deshmukh', 'meera.deshmukh@rvce.edu.in', '+91-9845012342', 'Associate Director - Placements', 'Admin Wing, Room 205'),
('TPO-EMP-108', 'Mr. Karthik Nair', 'karthik.nair@rvce.edu.in', '+91-9845012343', 'Senior Manager - Corporate Alliances', 'Placement Block, Room 102');

-- Insert Students (Realistic CGPAs aligned with drive thresholds)
INSERT INTO students (student_id, usn, first_name, last_name, gender, college_email, personal_email, phone_number, department_id, cgpa, tenth_percentage, twelfth_percentage, active_backlogs, graduation_year, github_url, linkedin_url, resume_storage_url, placement_status) VALUES
('STU-2021-CS001', '1RV21CS001', 'Aarav', 'Sharma', 'Male', 'aarav.sharma.cs21@rvce.edu.in', 'aaravsharma.dev@gmail.com', '+91-9845110001', 'DEPT-CSE', 9.42, 96.50, 94.20, 0, 2025, 'https://github.com/aaravsharma-dev', 'https://linkedin.com/in/aarav-sharma-cs', 'https://cloud.rvce.edu.in/resumes/2025/1RV21CS001.pdf', 'Placed'),
('STU-2021-CS015', '1RV21CS015', 'Sneha', 'Reddy', 'Female', 'sneha.reddy.cs21@rvce.edu.in', 'sneha.reddy99@gmail.com', '+91-9845110002', 'DEPT-CSE', 8.85, 93.00, 90.50, 0, 2025, 'https://github.com/snehareddy-cloud', 'https://linkedin.com/in/sneha-reddy-swe', 'https://cloud.rvce.edu.in/resumes/2025/1RV21CS015.pdf', 'Placed'),
('STU-2021-IS022', '1RV21IS022', 'Rohan', 'Gupta', 'Male', 'rohan.gupta.is21@rvce.edu.in', 'rohan.gupta.tech@gmail.com', '+91-9845110003', 'DEPT-ISE', 8.15, 90.00, 86.50, 0, 2025, 'https://github.com/rohan-gupta-fullstack', 'https://linkedin.com/in/rohan-gupta-dev', 'https://cloud.rvce.edu.in/resumes/2025/1RV21IS022.pdf', 'Placed'),
('STU-2021-EC045', '1RV21EC045', 'Ananya', 'Iyer', 'Female', 'ananya.iyer.ec21@rvce.edu.in', 'ananya.iyer.vlsi@gmail.com', '+91-9845110004', 'DEPT-ECE', 8.60, 94.50, 92.00, 0, 2025, 'https://github.com/ananya-iyer-embedded', 'https://linkedin.com/in/ananya-iyer-ece', 'https://cloud.rvce.edu.in/resumes/2025/1RV21EC045.pdf', 'Placed'),
('STU-2021-AI010', '1RV21AI010', 'Vikram', 'Singh', 'Male', 'vikram.singh.ai21@rvce.edu.in', 'vikram.singh.ai@gmail.com', '+91-9845110005', 'DEPT-AIDS', 9.10, 97.00, 95.50, 0, 2025, 'https://github.com/vikram-singh-ml', 'https://linkedin.com/in/vikram-singh-ai', 'https://cloud.rvce.edu.in/resumes/2025/1RV21AI010.pdf', 'Placed'),
('STU-2021-ME030', '1RV21ME030', 'Rahul', 'Nambiar', 'Male', 'rahul.nambiar.me21@rvce.edu.in', 'rahul.nambiar.mech@gmail.com', '+91-9845110006', 'DEPT-MECH', 7.20, 84.50, 80.00, 0, 2025, 'https://github.com/rahul-nambiar-cad', 'https://linkedin.com/in/rahul-nambiar-mech', 'https://cloud.rvce.edu.in/resumes/2025/1RV21ME030.pdf', 'Unplaced'),
('STU-2021-CS088', '1RV21CS088', 'Pooja', 'Hegde', 'Female', 'pooja.hegde.cs21@rvce.edu.in', 'pooja.hegde.dev@gmail.com', '+91-9845110007', 'DEPT-CSE', 6.75, 80.00, 76.50, 1, 2025, 'https://github.com/pooja-hegde-web', 'https://linkedin.com/in/pooja-hegde-cs', 'https://cloud.rvce.edu.in/resumes/2025/1RV21CS088.pdf', 'Unplaced'),
('STU-2021-EC012', '1RV21EC012', 'Aditya', 'Verma', 'Male', 'aditya.verma.ec21@rvce.edu.in', 'aditya.verma.tech@gmail.com', '+91-9845110008', 'DEPT-ECE', 8.25, 91.00, 88.00, 0, 2025, 'https://github.com/aditya-verma-circuits', 'https://linkedin.com/in/aditya-verma-ec', 'https://cloud.rvce.edu.in/resumes/2025/1RV21EC012.pdf', 'Unplaced'),
('STU-2021-IS050', '1RV21IS050', 'Divya', 'Menon', 'Female', 'divya.menon.is21@rvce.edu.in', 'divya.menon.research@gmail.com', '+91-9845110009', 'DEPT-ISE', 8.40, 92.50, 89.00, 0, 2025, 'https://github.com/divya-menon-systems', 'https://linkedin.com/in/divya-menon-is', 'https://cloud.rvce.edu.in/resumes/2025/1RV21IS050.pdf', 'Higher Studies'),
('STU-2021-ME018', '1RV21ME018', 'Tanmay', 'Bhat', 'Male', 'tanmay.bhat.me21@rvce.edu.in', 'tanmay.bhat.cad@gmail.com', '+91-9845110010', 'DEPT-MECH', 8.10, 88.00, 86.00, 0, 2025, 'https://github.com/tanmay-bhat-ansys', 'https://linkedin.com/in/tanmay-bhat-me', 'https://cloud.rvce.edu.in/resumes/2025/1RV21ME018.pdf', 'Placed');

-- Insert Skills
INSERT INTO student_skills (student_id, skill_name, proficiency_level) VALUES
('STU-2021-CS001', 'C++', 'Expert'),
('STU-2021-CS001', 'Data Structures & Algorithms', 'Expert'),
('STU-2021-CS001', 'Distributed Systems', 'Advanced'),
('STU-2021-CS001', 'MySQL & PostgreSQL', 'Advanced'),
('STU-2021-CS015', 'Java 17', 'Expert'),
('STU-2021-CS015', 'Spring Boot & Microservices', 'Advanced'),
('STU-2021-CS015', 'Docker & Kubernetes', 'Intermediate'),
('STU-2021-IS022', 'Python', 'Advanced'),
('STU-2021-IS022', 'Django Rest Framework', 'Advanced'),
('STU-2021-IS022', 'React.js', 'Intermediate'),
('STU-2021-EC045', 'Embedded C', 'Expert'),
('STU-2021-EC045', 'Verilog HDL / FPGA', 'Advanced'),
('STU-2021-EC045', 'ARM Cortex Architecture', 'Intermediate'),
('STU-2021-AI010', 'Python & PyTorch', 'Expert'),
('STU-2021-AI010', 'Computer Vision & LLMs', 'Advanced'),
('STU-2021-AI010', 'TensorFlow & MLOps', 'Intermediate'),
('STU-2021-ME030', 'AutoCAD 3D', 'Advanced'),
('STU-2021-ME030', 'SolidWorks & CATIA', 'Intermediate'),
('STU-2021-EC012', 'SystemVerilog', 'Intermediate'),
('STU-2021-EC012', 'VLSI Physical Design', 'Intermediate'),
('STU-2021-ME018', 'ANSYS Mechanical FEA', 'Advanced'),
('STU-2021-ME018', 'MATLAB & Simulink', 'Advanced'),
('STU-2021-ME018', 'Computational Fluid Dynamics', 'Intermediate');

-- Insert Companies
INSERT INTO companies (company_id, company_name, industry_domain, headquarters, website_url, hr_contact_name, hr_email, hr_phone, tier_category) VALUES
('CMP-GOOG-01', 'Google India Pvt Ltd', 'Software, Cloud & Artificial Intelligence', 'Mountain View, CA (Bangalore Office)', 'https://careers.google.com', 'Ms. Neha Kapoor', 'neha.kapoor@google.com', '+91-80-67210001', 'Tier-1 (Super Dream)'),
('CMP-MSFT-02', 'Microsoft India R&D Pvt Ltd', 'Cloud Computing & Enterprise Platforms', 'Redmond, WA (Hyderabad IDC)', 'https://careers.microsoft.com', 'Mr. Siddharth Roy', 'siddharth.roy@microsoft.com', '+91-40-66920002', 'Tier-1 (Super Dream)'),
('CMP-CSCO-03', 'Cisco Systems India Pvt Ltd', 'Networking, Security & Cloud Observability', 'San Jose, CA (Bangalore Campus)', 'https://jobs.cisco.com', 'Ms. Ritu Mathur', 'ritu.mathur@cisco.com', '+91-80-44260003', 'Tier-2 (Dream)'),
('CMP-QCOM-04', 'Qualcomm India Pvt Ltd', 'Semiconductors, 5G & Wireless Modems', 'San Diego, CA (Bangalore R&D)', 'https://qualcomm.com/careers', 'Mr. Kunal Ghosh', 'kunal.ghosh@qualcomm.com', '+91-80-66510004', 'Tier-1 (Super Dream)'),
('CMP-TCS-05', 'Tata Consultancy Services Ltd', 'Digital Engineering & Cloud Services', 'Mumbai, India', 'https://tcs.com/careers', 'Mr. Alok Pandey', 'alok.pandey@tcs.com', '+91-22-67780005', 'Tier-3 (Mass/Core)'),
('CMP-LTTS-06', 'L&T Technology Services Ltd', 'Automotive, Industrial & Smart Plant R&D', 'Vadodara / Mumbai, India', 'https://ltts.com/careers', 'Mr. Deepak Joshi', 'deepak.joshi@ltts.com', '+91-265-6700006', 'Tier-3 (Mass/Core)');

-- Insert Job Postings
INSERT INTO job_postings (job_id, company_id, officer_in_charge, job_title, job_description, job_role_type, ctc_annual_lpa, min_cgpa_cutoff, max_backlogs_allowed, job_location, drive_date, registration_deadline, drive_status) VALUES
('JOB-2024-GOOG-SDE', 'CMP-GOOG-01', 'TPO-EMP-101', 'Software Development Engineer - 1 (L3)', 'Core backend engineering for scalable distributed systems, search infra, and high-performance APIs.', 'Full-Time SDE', 32.50, 8.50, 0, 'Bangalore (RMZ Infinity)', '2024-09-15', '2024-09-10 23:59:59', 'Completed'),
('JOB-2024-MSFT-SWE', 'CMP-MSFT-02', 'TPO-EMP-101', 'Software Development Engineer - Core Cloud', 'Design and implementation of distributed telemetry, Azure kernel tooling, and hyperscale cloud services.', 'Full-Time SDE', 28.00, 8.00, 0, 'Hyderabad (Gachibowli Campus)', '2024-09-22', '2024-09-18 23:59:59', 'Completed'),
('JOB-2024-CSCO-NET', 'CMP-CSCO-03', 'TPO-EMP-104', 'Network Software & Automation Engineer', 'Building software-defined networking controllers, packet inspection engines, and security microservices.', 'Internship + Full-Time', 18.00, 7.50, 0, 'Bangalore (Cessna Business Park)', '2024-10-05', '2024-10-01 23:59:59', 'Completed'),
('JOB-2024-QCOM-HW', 'CMP-QCOM-04', 'TPO-EMP-104', 'Hardware & Modem Firmware Engineer', 'SoC validation, RTL synthesis, and high-speed memory controller firmware for 5G modem chips.', 'Full-Time SDE', 22.00, 8.00, 0, 'Bangalore & Chennai', '2024-10-18', '2024-10-14 23:59:59', 'Completed'),
('JOB-2024-TCS-DIGI', 'CMP-TCS-05', 'TPO-EMP-108', 'Assistant System Engineer (TCS Digital)', 'Enterprise application development across Java, Python, Angular, Cloud Migration, and Data Pipelines.', 'Full-Time SDE', 7.00, 6.50, 0, 'PAN India (Bangalore / Pune / Hyderabad)', '2024-11-02', '2024-10-28 23:59:59', 'Ongoing'),
('JOB-2024-LTTS-GET', 'CMP-LTTS-06', 'TPO-EMP-108', 'Graduate Engineer Trainee (GET) - Simulation & CAD', 'Structural FEA simulation, thermal dissipation modeling, and CAD component design for EV powertrains.', 'Core Engineering Trainee', 6.50, 7.00, 0, 'Mysore & Pune Engineering Centers', '2024-11-15', '2024-11-10 23:59:59', 'Completed');

-- Insert Eligible Departments
INSERT INTO job_eligible_departments (job_id, department_id) VALUES 
('JOB-2024-GOOG-SDE', 'DEPT-CSE'),
('JOB-2024-GOOG-SDE', 'DEPT-ISE'),
('JOB-2024-GOOG-SDE', 'DEPT-AIDS'),
('JOB-2024-MSFT-SWE', 'DEPT-CSE'),
('JOB-2024-MSFT-SWE', 'DEPT-ISE'),
('JOB-2024-MSFT-SWE', 'DEPT-ECE'),
('JOB-2024-MSFT-SWE', 'DEPT-AIDS'),
('JOB-2024-CSCO-NET', 'DEPT-CSE'),
('JOB-2024-CSCO-NET', 'DEPT-ISE'),
('JOB-2024-CSCO-NET', 'DEPT-ECE'),
('JOB-2024-QCOM-HW', 'DEPT-ECE'),
('JOB-2024-QCOM-HW', 'DEPT-CSE'),
('JOB-2024-TCS-DIGI', 'DEPT-CSE'),
('JOB-2024-TCS-DIGI', 'DEPT-ISE'),
('JOB-2024-TCS-DIGI', 'DEPT-ECE'),
('JOB-2024-TCS-DIGI', 'DEPT-MECH'),
('JOB-2024-TCS-DIGI', 'DEPT-AIDS'),
('JOB-2024-LTTS-GET', 'DEPT-MECH');

-- Insert Applications
INSERT INTO applications (application_id, job_id, student_id, applied_at, current_status) VALUES
('APP-2024-0901', 'JOB-2024-GOOG-SDE', 'STU-2021-CS001', '2024-09-05 10:15:00', 'Selected'),
('APP-2024-0902', 'JOB-2024-GOOG-SDE', 'STU-2021-CS015', '2024-09-05 11:30:00', 'Rejected'),
('APP-2024-0903', 'JOB-2024-GOOG-SDE', 'STU-2021-AI010', '2024-09-06 09:00:00', 'Rejected'),
('APP-2024-0904', 'JOB-2024-MSFT-SWE', 'STU-2021-CS015', '2024-09-12 14:20:00', 'Selected'),
('APP-2024-0905', 'JOB-2024-MSFT-SWE', 'STU-2021-IS022', '2024-09-12 15:45:00', 'Rejected'),
('APP-2024-0906', 'JOB-2024-MSFT-SWE', 'STU-2021-AI010', '2024-09-13 18:00:00', 'Selected'),
('APP-2024-0907', 'JOB-2024-CSCO-NET', 'STU-2021-IS022', '2024-09-25 10:00:00', 'Selected'),
('APP-2024-0908', 'JOB-2024-CSCO-NET', 'STU-2021-EC012', '2024-09-25 11:15:00', 'In-Process'),
('APP-2024-0909', 'JOB-2024-QCOM-HW',  'STU-2021-EC045', '2024-10-02 09:30:00', 'Selected'),
('APP-2024-0910', 'JOB-2024-QCOM-HW',  'STU-2021-EC012', '2024-10-02 10:45:00', 'Rejected'),
('APP-2024-0911', 'JOB-2024-TCS-DIGI', 'STU-2021-ME030', '2024-10-20 16:00:00', 'Applied'),
('APP-2024-0912', 'JOB-2024-TCS-DIGI', 'STU-2021-EC012', '2024-10-21 11:00:00', 'Shortlisted'),
('APP-2024-0913', 'JOB-2024-LTTS-GET', 'STU-2021-ME030', '2024-11-01 12:00:00', 'Rejected'),
('APP-2024-0914', 'JOB-2024-LTTS-GET', 'STU-2021-ME018', '2024-11-01 14:30:00', 'Selected');

-- Insert Interview Rounds
INSERT INTO interview_rounds (round_id, job_id, round_sequence, round_type, scheduled_timestamp, platform_or_venue) VALUES
('RND-GOOG-01', 'JOB-2024-GOOG-SDE', 1, 'Online Coding Assessment (DSA & Graphs)', '2024-09-15 10:00:00', 'https://hackerrank.com/rvce-google-oa-2024'),
('RND-GOOG-02', 'JOB-2024-GOOG-SDE', 2, 'Technical Round 1 (Trees & Dynamic Programming)', '2024-09-16 14:00:00', 'Google Meet Room - Alpha'),
('RND-GOOG-03', 'JOB-2024-GOOG-SDE', 3, 'Technical Round 2 (System Architecture & Concurrency)', '2024-09-17 11:00:00', 'Google Meet Room - Beta'),
('RND-GOOG-04', 'JOB-2024-GOOG-SDE', 4, 'Googleyness & Leadership Behavioral Interview', '2024-09-18 15:30:00', 'Google Meet Room - HR'),
('RND-MSFT-01', 'JOB-2024-MSFT-SWE', 1, 'Online Diagnostic Coding Test', '2024-09-22 09:30:00', 'https://codility.com/msft-university-recruiting-2024'),
('RND-MSFT-02', 'JOB-2024-MSFT-SWE', 2, 'Technical Interview 1 (OOPs & Multithreading)', '2024-09-23 10:00:00', 'MS Teams Conference Link 1'),
('RND-MSFT-03', 'JOB-2024-MSFT-SWE', 3, 'Technical Interview 2 + Managerial Fitment', '2024-09-24 14:00:00', 'MS Teams Conference Link 2'),
('RND-CSCO-01', 'JOB-2024-CSCO-NET', 1, 'Online Technical & Networking Aptitude', '2024-10-05 10:00:00', 'Cisco Online Testing Portal'),
('RND-CSCO-02', 'JOB-2024-CSCO-NET', 2, 'Technical Interview (TCP/IP & Socket Programming)', '2024-10-06 11:00:00', 'Webex Room 101'),
('RND-QCOM-01', 'JOB-2024-QCOM-HW', 1, 'Hardware & Embedded C Aptitude Assessment', '2024-10-18 10:00:00', 'ECE VLSI Computer Lab 3'),
('RND-QCOM-02', 'JOB-2024-QCOM-HW', 2, 'Core Technical Interview (RTL & Microcontrollers)', '2024-10-19 11:30:00', 'Placement Cell Boardroom 1'),
('RND-LTTS-01', 'JOB-2024-LTTS-GET', 1, 'Core Mechanical Aptitude & Thermodynamics Test', '2024-11-15 10:00:00', 'Mechanical Seminar Hall'),
('RND-LTTS-02', 'JOB-2024-LTTS-GET', 2, 'Technical & Personal Domain Interview', '2024-11-16 11:00:00', 'Placement Cell Boardroom 2');

-- Insert Round Results
INSERT INTO round_results (result_id, round_id, student_id, round_status, evaluation_score, interviewer_remarks) VALUES
('RES-2024-101', 'RND-GOOG-01', 'STU-2021-CS001', 'Qualified', 98.00, 'Solved both 2 LeetCode Hard graph problems in 42 mins with O(V+E) time.'),
('RES-2024-102', 'RND-GOOG-01', 'STU-2021-CS015', 'Qualified', 85.00, 'Solved 1.5 questions. Good approach.'),
('RES-2024-103', 'RND-GOOG-01', 'STU-2021-AI010', 'Qualified', 90.00, 'Solid algorithmic thinking.'),
('RES-2024-104', 'RND-GOOG-02', 'STU-2021-CS001', 'Qualified', 95.00, 'Flawless binary tree and topological sort implementation.'),
('RES-2024-105', 'RND-GOOG-02', 'STU-2021-CS015', 'Disqualified', 60.00, 'Struggled with complex dynamic programming state transitions.'),
('RES-2024-106', 'RND-GOOG-02', 'STU-2021-AI010', 'Disqualified', 65.00, 'Average space complexity optimization.'),
('RES-2024-107', 'RND-GOOG-03', 'STU-2021-CS001', 'Qualified', 92.00, 'Strong understanding of distributed key-value store architecture & caching.'),
('RES-2024-108', 'RND-GOOG-04', 'STU-2021-CS001', 'Qualified', 94.00, 'Excellent team player mindset and communication. Strongly recommended for hire.'),
('RES-2024-201', 'RND-MSFT-01', 'STU-2021-CS015', 'Qualified', 92.00, 'All edge cases and memory constraints passed.'),
('RES-2024-202', 'RND-MSFT-01', 'STU-2021-IS022', 'Disqualified', 58.00, 'Failed concurrency and performance test cases.'),
('RES-2024-203', 'RND-MSFT-01', 'STU-2021-AI010', 'Qualified', 95.00, 'Clean, modular, and optimized solution.'),
('RES-2024-204', 'RND-MSFT-02', 'STU-2021-CS015', 'Qualified', 88.00, 'Deep knowledge of Java virtual thread concurrency & garbage collection.'),
('RES-2024-205', 'RND-MSFT-02', 'STU-2021-AI010', 'Qualified', 90.00, 'Demonstrated high aptitude in system kernels and ML pipeline integration.'),
('RES-2024-206', 'RND-MSFT-03', 'STU-2021-CS015', 'Qualified', 86.00, 'Positive attitude, recommended for Azure Cloud Storage team.'),
('RES-2024-207', 'RND-MSFT-03', 'STU-2021-AI010', 'Qualified', 93.00, 'Exceptional candidate, assigned to Azure Copilot R&D team.'),
('RES-2024-301', 'RND-CSCO-01', 'STU-2021-IS022', 'Qualified', 84.00, 'Great score in network protocols and IP routing logic.'),
('RES-2024-302', 'RND-CSCO-02', 'STU-2021-IS022', 'Qualified', 88.00, 'Clean socket server implementation using C++ and Python.'),
('RES-2024-401', 'RND-QCOM-01', 'STU-2021-EC045', 'Qualified', 94.00, 'Highest score in digital logic synthesis and C.'),
('RES-2024-402', 'RND-QCOM-01', 'STU-2021-EC012', 'Disqualified', 64.00, 'Scored below cutoff in Verilog test section.'),
('RES-2024-403', 'RND-QCOM-02', 'STU-2021-EC045', 'Qualified', 92.00, 'Strong RTL state machine design and SPI/I2C protocol fundamentals.'),
('RES-2024-501', 'RND-LTTS-01', 'STU-2021-ME030', 'Disqualified', 55.00, 'Did not clear the quantitative aptitude cutoff.'),
('RES-2024-502', 'RND-LTTS-01', 'STU-2021-ME018', 'Qualified', 89.00, 'Excellent grasp on thermodynamics, fluid mechanics, and CAD.'),
('RES-2024-503', 'RND-LTTS-02', 'STU-2021-ME018', 'Qualified', 86.00, 'Practical knowledge in ANSYS simulations demonstrated during project defense.');

-- Insert Offers
INSERT INTO placement_offers (offer_id, application_id, student_id, company_id, job_id, offered_ctc_lpa, base_salary_lpa, joining_bonus_lpa, offer_issued_date, tentative_joining_date, offer_status) VALUES
('OFFR-2024-GOOG-01', 'APP-2024-0901', 'STU-2021-CS001', 'CMP-GOOG-01', 'JOB-2024-GOOG-SDE', 32.50, 18.00, 5.00, '2024-09-20', '2025-07-15', 'Accepted'),
('OFFR-2024-MSFT-01', 'APP-2024-0904', 'STU-2021-CS015', 'CMP-MSFT-02', 'JOB-2024-MSFT-SWE', 28.00, 16.50, 3.50, '2024-09-28', '2025-08-01', 'Accepted'),
('OFFR-2024-MSFT-02', 'APP-2024-0906', 'STU-2021-AI010', 'CMP-MSFT-02', 'JOB-2024-MSFT-SWE', 28.00, 16.50, 3.50, '2024-09-28', '2025-08-01', 'Accepted'),
('OFFR-2024-CSCO-01', 'APP-2024-0907', 'STU-2021-IS022', 'CMP-CSCO-03', 'JOB-2024-CSCO-NET', 18.00, 12.00, 2.00, '2024-10-10', '2025-07-01', 'Accepted'),
('OFFR-2024-QCOM-01', 'APP-2024-0909', 'STU-2021-EC045', 'CMP-QCOM-04', 'JOB-2024-QCOM-HW',  22.00, 14.00, 3.00, '2024-10-22', '2025-07-20', 'Accepted'),
('OFFR-2024-LTTS-01', 'APP-2024-0914', 'STU-2021-ME018', 'CMP-LTTS-06', 'JOB-2024-LTTS-GET',  6.50,  5.20, 0.50, '2024-11-20', '2025-08-10', 'Accepted');

-- ============================================================================
-- 3. VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW vw_placed_students_summary AS
SELECT 
    s.student_id,
    s.usn,
    CONCAT(s.first_name, ' ', s.last_name) AS student_name,
    d.department_code,
    s.cgpa,
    c.company_name,
    c.tier_category,
    j.job_title,
    po.offered_ctc_lpa,
    po.base_salary_lpa,
    po.joining_bonus_lpa,
    po.offer_status,
    po.offer_issued_date,
    po.tentative_joining_date
FROM placement_offers po
JOIN students s ON po.student_id = s.student_id
JOIN departments d ON s.department_id = d.department_id
JOIN companies c ON po.company_id = c.company_id
JOIN job_postings j ON po.job_id = j.job_id;

CREATE OR REPLACE VIEW vw_department_placement_stats AS
SELECT 
    d.department_id,
    d.department_code,
    d.department_name,
    COUNT(s.student_id) AS total_enrolled,
    SUM(CASE WHEN s.placement_status = 'Placed' THEN 1 ELSE 0 END) AS total_placed,
    ROUND((SUM(CASE WHEN s.placement_status = 'Placed' THEN 1 ELSE 0 END) / COUNT(s.student_id)) * 100, 2) AS placement_percentage,
    MAX(po.offered_ctc_lpa) AS highest_package_lpa,
    ROUND(AVG(po.offered_ctc_lpa), 2) AS average_package_lpa
FROM departments d
LEFT JOIN students s ON d.department_id = s.department_id
LEFT JOIN placement_offers po ON s.student_id = po.student_id AND po.offer_status = 'Accepted'
GROUP BY d.department_id, d.department_code, d.department_name;

CREATE OR REPLACE VIEW vw_job_drive_status AS
SELECT 
    j.job_id,
    c.company_name,
    j.job_title,
    j.ctc_annual_lpa,
    j.drive_date,
    j.drive_status,
    COUNT(a.application_id) AS total_registered,
    SUM(CASE WHEN a.current_status = 'Selected' THEN 1 ELSE 0 END) AS total_selected
FROM job_postings j
JOIN companies c ON j.company_id = c.company_id
LEFT JOIN applications a ON j.job_id = a.job_id
GROUP BY j.job_id, c.company_name, j.job_title, j.ctc_annual_lpa, j.drive_date, j.drive_status;

-- ============================================================================
-- 4. TRIGGERS (DATA INTEGRITY & AUTOMATION)
-- ============================================================================

DELIMITER //

-- Trigger 1: Academic CGPA & Backlog Cutoff Validator
CREATE TRIGGER trg_check_cgpa_eligibility
BEFORE INSERT ON applications
FOR EACH ROW
BEGIN
    DECLARE v_student_cgpa DECIMAL(4, 2);
    DECLARE v_required_cgpa DECIMAL(4, 2);
    DECLARE v_backlogs INT;
    DECLARE v_allowed_backlogs INT;

    SELECT cgpa, active_backlogs INTO v_student_cgpa, v_backlogs
    FROM students WHERE student_id = NEW.student_id;

    SELECT min_cgpa_cutoff, max_backlogs_allowed INTO v_required_cgpa, v_allowed_backlogs
    FROM job_postings WHERE job_id = NEW.job_id;

    IF v_student_cgpa < v_required_cgpa THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Eligibility Constraint Violation: Student CGPA is lower than the required drive cutoff.';
    END IF;

    IF v_backlogs > v_allowed_backlogs THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Eligibility Constraint Violation: Student has active backlogs exceeding allowed limit.';
    END IF;
END //

-- Trigger 2: Branch / Department Eligibility Gatekeeper
CREATE TRIGGER trg_validate_branch_eligibility
BEFORE INSERT ON applications
FOR EACH ROW
BEGIN
    DECLARE v_student_dept VARCHAR(15);
    DECLARE v_is_eligible INT DEFAULT 0;

    SELECT department_id INTO v_student_dept
    FROM students
    WHERE student_id = NEW.student_id;

    SELECT COUNT(*) INTO v_is_eligible
    FROM job_eligible_departments
    WHERE job_id = NEW.job_id AND department_id = v_student_dept;

    IF v_is_eligible = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Eligibility Error: Your department is not eligible for this campus drive.';
    END IF;
END //

-- Trigger 3: Registration Deadline & Drive State Validator
CREATE TRIGGER trg_validate_application_deadline
BEFORE INSERT ON applications
FOR EACH ROW
BEGIN
    DECLARE v_deadline DATETIME;
    DECLARE v_status VARCHAR(20);

    SELECT registration_deadline, drive_status 
    INTO v_deadline, v_status
    FROM job_postings 
    WHERE job_id = NEW.job_id;

    IF v_status IN ('Completed', 'Cancelled') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Application Error: Recruitment drive is already completed or cancelled.';
    END IF;

    IF NEW.applied_at > v_deadline THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Application Error: Registration deadline for this drive has already expired.';
    END IF;
END //

-- Trigger 4: "One Student, One Offer" Placement Policy Enforcer
CREATE TRIGGER trg_enforce_single_offer_policy
BEFORE UPDATE ON placement_offers
FOR EACH ROW
BEGIN
    DECLARE v_accepted_count INT DEFAULT 0;

    IF NEW.offer_status = 'Accepted' AND OLD.offer_status != 'Accepted' THEN
        SELECT COUNT(*) INTO v_accepted_count
        FROM placement_offers
        WHERE student_id = NEW.student_id 
          AND offer_status = 'Accepted'
          AND offer_id != NEW.offer_id;

        IF v_accepted_count > 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Policy Error: Candidate already holds an Accepted offer. Violates single-offer policy.';
        END IF;
    END IF;
END //

-- Trigger 5: Enterprise Audit Log for Offer Revisions & Tampering
CREATE TRIGGER trg_audit_offer_revisions
AFTER UPDATE ON placement_offers
FOR EACH ROW
BEGIN
    IF (OLD.offered_ctc_lpa != NEW.offered_ctc_lpa) OR (OLD.offer_status != NEW.offer_status) THEN
        INSERT INTO placement_offer_audit_log (
            offer_id, 
            student_id, 
            old_ctc_lpa, 
            new_ctc_lpa, 
            old_status, 
            new_status, 
            action_type, 
            changed_at, 
            changed_by
        ) VALUES (
            OLD.offer_id, 
            OLD.student_id, 
            OLD.offered_ctc_lpa, 
            NEW.offered_ctc_lpa,
            OLD.offer_status, 
            NEW.offer_status, 
            'UPDATE', 
            NOW(), 
            CURRENT_USER()
        );
    END IF;
END //

-- Trigger 6: Automated Workflow Sync on Interview Disqualification
CREATE TRIGGER trg_sync_app_status_on_round_result
AFTER INSERT ON round_results
FOR EACH ROW
BEGIN
    DECLARE v_job_id VARCHAR(30);

    IF NEW.round_status = 'Disqualified' THEN
        SELECT job_id INTO v_job_id
        FROM interview_rounds
        WHERE round_id = NEW.round_id;

        UPDATE applications
        SET current_status = 'Rejected'
        WHERE job_id = v_job_id AND student_id = NEW.student_id;
    END IF;
END //

-- Trigger 7: Financial CTC Breakdown & Salary Consistency Guard
CREATE TRIGGER trg_validate_salary_breakdown
BEFORE INSERT ON placement_offers
FOR EACH ROW
BEGIN
    IF NEW.base_salary_lpa <= 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Salary Error: Base salary must be strictly greater than zero.';
    END IF;

    IF (NEW.base_salary_lpa + NEW.joining_bonus_lpa) > NEW.offered_ctc_lpa THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Salary Error: Base salary plus joining bonus exceeds the total offered CTC.';
    END IF;
END //

CREATE TRIGGER trg_validate_salary_breakdown_update
BEFORE UPDATE ON placement_offers
FOR EACH ROW
BEGIN
    IF NEW.base_salary_lpa <= 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Salary Error: Base salary must be strictly greater than zero.';
    END IF;

    IF (NEW.base_salary_lpa + NEW.joining_bonus_lpa) > NEW.offered_ctc_lpa THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Salary Error: Base salary plus joining bonus exceeds the total offered CTC.';
    END IF;
END //

-- Trigger 8: Auto-update student placement_status to 'Placed' when an offer is Accepted
CREATE TRIGGER trg_after_offer_accepted
AFTER UPDATE ON placement_offers
FOR EACH ROW
BEGIN
    IF NEW.offer_status = 'Accepted' THEN
        UPDATE students 
        SET placement_status = 'Placed'
        WHERE student_id = NEW.student_id;
    END IF;
END //

DELIMITER ;

-- ============================================================================
-- 5. STORED PROCEDURES
-- ============================================================================

DELIMITER //

CREATE PROCEDURE sp_GetEligibleStudentsForJob(IN p_job_id VARCHAR(30))
BEGIN
    DECLARE v_min_cgpa DECIMAL(4, 2);
    DECLARE v_max_backlogs INT;

    SELECT min_cgpa_cutoff, max_backlogs_allowed 
    INTO v_min_cgpa, v_max_backlogs
    FROM job_postings 
    WHERE job_id = p_job_id;

    SELECT 
        s.student_id,
        s.usn,
        CONCAT(s.first_name, ' ', s.last_name) AS full_name,
        d.department_code,
        s.cgpa,
        s.active_backlogs,
        s.college_email,
        s.phone_number,
        s.placement_status
    FROM students s
    JOIN departments d ON s.department_id = d.department_id
    WHERE s.cgpa >= v_min_cgpa
      AND s.active_backlogs <= v_max_backlogs
      AND s.placement_status IN ('Unplaced', 'Placed')
      AND s.department_id IN (
          SELECT department_id 
          FROM job_eligible_departments 
          WHERE job_id = p_job_id
      )
    ORDER BY s.cgpa DESC;
END //

CREATE PROCEDURE sp_GetStudentPlacementProfile(IN p_usn VARCHAR(20))
BEGIN
    SELECT 
        s.student_id,
        s.usn,
        CONCAT(s.first_name, ' ', s.last_name) AS student_name,
        s.college_email,
        s.phone_number,
        d.department_name,
        s.cgpa,
        s.tenth_percentage,
        s.twelfth_percentage,
        s.placement_status,
        s.github_url,
        s.linkedin_url
    FROM students s
    JOIN departments d ON s.department_id = d.department_id
    WHERE s.usn = p_usn;

    SELECT 
        c.company_name,
        j.job_title,
        j.ctc_annual_lpa,
        a.applied_at,
        a.current_status AS application_status,
        po.offered_ctc_lpa,
        po.offer_status
    FROM applications a
    JOIN students s ON a.student_id = s.student_id
    JOIN job_postings j ON a.job_id = j.job_id
    JOIN companies c ON j.company_id = c.company_id
    LEFT JOIN placement_offers po ON a.application_id = po.application_id
    WHERE s.usn = p_usn
    ORDER BY a.applied_at DESC;
END //

DELIMITER ;
