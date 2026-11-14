-- ============================================================================
-- COLLEGE PLACEMENT MANAGEMENT SYSTEM (CPMS)
-- 6 USEFUL ENTERPRISE TRIGGERS & READY-TO-DEMO TEST CASES
-- Target RDBMS: MySQL 8.0+ / MariaDB (InnoDB Engine)
-- ============================================================================

USE college_placement_db;

-- ============================================================================
-- AUDIT TABLE SETUP (Required for Trigger 4)
-- ============================================================================
CREATE TABLE IF NOT EXISTS placement_offer_audit_log (
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

-- Drop existing triggers before creating to prevent collisions
DROP TRIGGER IF EXISTS trg_validate_branch_eligibility;
DROP TRIGGER IF EXISTS trg_validate_application_deadline;
DROP TRIGGER IF EXISTS trg_enforce_single_offer_policy;
DROP TRIGGER IF EXISTS trg_audit_offer_revisions;
DROP TRIGGER IF EXISTS trg_sync_app_status_on_round_result;
DROP TRIGGER IF EXISTS trg_validate_salary_breakdown;
DROP TRIGGER IF EXISTS trg_validate_salary_breakdown_update;

DELIMITER //

-- ============================================================================
-- TRIGGER 1: Branch Eligibility Gatekeeper
-- Type: BEFORE INSERT ON applications
-- Practical Implementation:
--   Ensures a student cannot apply for a recruitment drive if their academic
--   department is not listed in `job_eligible_departments`.
-- ============================================================================
CREATE TRIGGER trg_validate_branch_eligibility
BEFORE INSERT ON applications
FOR EACH ROW
BEGIN
    DECLARE v_student_dept VARCHAR(15);
    DECLARE v_is_eligible INT DEFAULT 0;

    -- Fetch the student's department
    SELECT department_id INTO v_student_dept
    FROM students
    WHERE student_id = NEW.student_id;

    -- Check if that department is approved for this job posting
    SELECT COUNT(*) INTO v_is_eligible
    FROM job_eligible_departments
    WHERE job_id = NEW.job_id AND department_id = v_student_dept;

    IF v_is_eligible = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Eligibility Error: Your department is not eligible for this campus drive.';
    END IF;
END //


-- ============================================================================
-- TRIGGER 2: Application Deadline & Drive State Validator
-- Type: BEFORE INSERT ON applications
-- Practical Implementation:
--   Prevents students from applying after the registration deadline has passed,
--   or if the company recruitment drive has already been 'Completed' or 'Cancelled'.
-- ============================================================================
CREATE TRIGGER trg_validate_application_deadline
BEFORE INSERT ON applications
FOR EACH ROW
BEGIN
    DECLARE v_deadline DATETIME;
    DECLARE v_status VARCHAR(20);

    -- Fetch drive status and deadline
    SELECT registration_deadline, drive_status 
    INTO v_deadline, v_status
    FROM job_postings 
    WHERE job_id = NEW.job_id;

    -- Check if drive is closed
    IF v_status IN ('Completed', 'Cancelled') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Application Error: Recruitment drive is already completed or cancelled.';
    END IF;

    -- Check if registration deadline has elapsed
    IF NEW.applied_at > v_deadline THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Application Error: Registration deadline for this drive has already expired.';
    END IF;
END //


-- ============================================================================
-- TRIGGER 3: College "One Student, One Offer" Policy Enforcer
-- Type: BEFORE UPDATE ON placement_offers
-- Practical Implementation:
--   Enforces university placement policy where a candidate who has already
--   accepted an offer cannot accept another company offer without formally
--   declining the previous one.
-- ============================================================================
CREATE TRIGGER trg_enforce_single_offer_policy
BEFORE UPDATE ON placement_offers
FOR EACH ROW
BEGIN
    DECLARE v_accepted_count INT DEFAULT 0;

    -- Trigger fires when a candidate attempts to set offer status to 'Accepted'
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


-- ============================================================================
-- TRIGGER 4: Enterprise Audit Log for Offer Revisions & Tampering
-- Type: AFTER UPDATE ON placement_offers
-- Practical Implementation:
--   Tracks and logs every modification made to a candidate's package (CTC)
--   or offer status into a permanent audit table with timestamp and database user.
-- ============================================================================
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


-- ============================================================================
-- TRIGGER 5: Automated Workflow Sync on Interview Disqualification
-- Type: AFTER INSERT ON round_results
-- Practical Implementation:
--   When an interviewer marks a candidate as 'Disqualified' in any round,
--   this trigger automatically marks the candidate's master application status
--   as 'Rejected'.
-- ============================================================================
CREATE TRIGGER trg_sync_app_status_on_round_result
AFTER INSERT ON round_results
FOR EACH ROW
BEGIN
    DECLARE v_job_id VARCHAR(30);

    IF NEW.round_status = 'Disqualified' THEN
        -- Find which job drive this round belongs to
        SELECT job_id INTO v_job_id
        FROM interview_rounds
        WHERE round_id = NEW.round_id;

        -- Automatically update application status
        UPDATE applications
        SET current_status = 'Rejected'
        WHERE job_id = v_job_id AND student_id = NEW.student_id;
    END IF;
END //


-- ============================================================================
-- TRIGGER 6: Financial CTC Breakdown & Salary Consistency Guard
-- Type: BEFORE INSERT & BEFORE UPDATE ON placement_offers
-- Practical Implementation:
--   Ensures base salary is strictly positive and that the sum of base salary
--   and joining bonus does not exceed the total offered CTC.
-- ============================================================================
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

DELIMITER ;

-- ============================================================================
-- 🧪 LIVE TEST CASES (RUN THESE IN FRONT OF YOUR TEACHER)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TEST 1: Demonstrating Branch Ineligibility (Trigger 1)
-- L&T Drive ('JOB-2024-LTTS-GET') is only open to MECH students.
-- Trying to register student 'STU-2021-CS001' (CSE) will fail.
-- ----------------------------------------------------------------------------
-- EXPECTED: Fails with "Eligibility Error: Your department is not eligible for this campus drive."
/*
INSERT INTO applications (application_id, job_id, student_id, applied_at, current_status)
VALUES ('APP-TEST-BR01', 'JOB-2024-LTTS-GET', 'STU-2021-CS001', NOW(), 'Applied');
*/


-- ----------------------------------------------------------------------------
-- TEST 2: Demonstrating Registration Deadline Passed (Trigger 2)
-- Google Drive deadline was 2024-09-10. Attempting to apply with current date/time.
-- ----------------------------------------------------------------------------
-- EXPECTED: Fails with "Application Error: Recruitment drive is already completed or cancelled."
/*
INSERT INTO applications (application_id, job_id, student_id, applied_at, current_status)
VALUES ('APP-TEST-DL01', 'JOB-2024-GOOG-SDE', 'STU-2021-CS088', NOW(), 'Applied');
*/


-- ----------------------------------------------------------------------------
-- TEST 3: Demonstrating "One Student, One Offer" Policy (Trigger 3)
-- Student 'STU-2021-CS001' already accepted Google's offer.
-- If someone creates a second offer and attempts to accept it, trigger stops it.
-- ----------------------------------------------------------------------------
-- Setup a mock second offer:
INSERT INTO applications (application_id, job_id, student_id, applied_at, current_status)
VALUES ('APP-TEST-PL01', 'JOB-2024-TCS-DIGI', 'STU-2021-CS001', '2024-10-21 10:00:00', 'Shortlisted');

INSERT INTO placement_offers (offer_id, application_id, student_id, company_id, job_id, offered_ctc_lpa, base_salary_lpa, joining_bonus_lpa, offer_issued_date, tentative_joining_date, offer_status)
VALUES ('OFFR-TEST-PL01', 'APP-TEST-PL01', 'STU-2021-CS001', 'CMP-TCS-05', 'JOB-2024-TCS-DIGI', 7.00, 5.50, 0.50, '2024-11-01', '2025-08-01', 'Offered');

-- EXPECTED: Fails with "Policy Error: Candidate already holds an Accepted offer. Violates single-offer policy."
/*
UPDATE placement_offers
SET offer_status = 'Accepted'
WHERE offer_id = 'OFFR-TEST-PL01';
*/


-- ----------------------------------------------------------------------------
-- TEST 4: Demonstrating Audit Trail Logging (Trigger 4)
-- Update an existing offer's CTC and check if an audit record is created.
-- ----------------------------------------------------------------------------
UPDATE placement_offers
SET offered_ctc_lpa = 20.00
WHERE offer_id = 'OFFR-2024-CSCO-01';

-- View the audit trail table:
SELECT * FROM placement_offer_audit_log;


-- ----------------------------------------------------------------------------
-- TEST 5: Demonstrating Workflow Sync on Disqualification (Trigger 5)
-- Student 'STU-2021-EC012' has application 'APP-2024-0908' with status 'In-Process'.
-- Insert a 'Disqualified' round result for this student in Cisco Round 2.
-- ----------------------------------------------------------------------------
INSERT INTO round_results (result_id, round_id, student_id, round_status, evaluation_score, interviewer_remarks)
VALUES ('RES-TEST-DQ01', 'RND-CSCO-02', 'STU-2021-EC012', 'Disqualified', 52.00, 'Did not clear network protocols interview.');

-- Check application status (Notice it automatically turned into 'Rejected'):
SELECT application_id, job_id, student_id, current_status 
FROM applications 
WHERE application_id = 'APP-2024-0908';


-- ----------------------------------------------------------------------------
-- TEST 6: Demonstrating Salary Consistency Check (Trigger 6)
-- Base salary (15 LPA) + Bonus (10 LPA) = 25 LPA, which exceeds offered CTC (20 LPA).
-- ----------------------------------------------------------------------------
-- EXPECTED: Fails with "Salary Error: Base salary plus joining bonus exceeds the total offered CTC."
/*
INSERT INTO placement_offers (offer_id, application_id, student_id, company_id, job_id, offered_ctc_lpa, base_salary_lpa, joining_bonus_lpa, offer_issued_date, tentative_joining_date, offer_status)
VALUES ('OFFR-TEST-SAL01', 'APP-2024-0912', 'STU-2021-EC012', 'CMP-TCS-05', 'JOB-2024-TCS-DIGI', 20.00, 15.00, 10.00, '2024-11-05', '2025-08-01', 'Offered');
*/
