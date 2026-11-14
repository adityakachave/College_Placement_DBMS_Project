-- ============================================================================
-- COLLEGE PLACEMENT MANAGEMENT SYSTEM - DBMS LAB & VIVA QUERIES
-- Enterprise Real-World Query Demonstrations
-- ============================================================================
USE college_placement_db;

-- ----------------------------------------------------------------------------
-- 1. BASIC SELECTION & FILTERING
-- ----------------------------------------------------------------------------

-- Q1: List all students with CGPA >= 8.5 who are currently Unplaced.
SELECT 
    student_id,
    usn, 
    CONCAT(first_name, ' ', last_name) AS full_name, 
    department_id,
    cgpa, 
    active_backlogs,
    college_email
FROM students
WHERE cgpa >= 8.50 AND placement_status = 'Unplaced'
ORDER BY cgpa DESC;

-- Q2: Find all Tier-1 (Super Dream) companies visiting the campus.
SELECT company_id, company_name, industry_domain, headquarters, hr_contact_name, hr_email
FROM companies
WHERE tier_category = 'Tier-1 (Super Dream)';


-- ----------------------------------------------------------------------------
-- 2. INNER & MULTI-TABLE JOINS
-- ----------------------------------------------------------------------------

-- Q3: Retrieve all students with their Department Name and technical skills.
SELECT 
    s.student_id,
    s.usn,
    CONCAT(s.first_name, ' ', s.last_name) AS student_name,
    d.department_name,
    s.cgpa,
    GROUP_CONCAT(CONCAT(sk.skill_name, ' (', sk.proficiency_level, ')') SEPARATOR ', ') AS technical_stack
FROM students s
JOIN departments d ON s.department_id = d.department_id
LEFT JOIN student_skills sk ON s.student_id = sk.student_id
GROUP BY s.student_id, s.usn, s.first_name, s.last_name, d.department_name, s.cgpa;

-- Q4: Display all accepted placements with breakdown of Base Salary and Joining Bonus.
SELECT 
    po.offer_id,
    s.usn,
    CONCAT(s.first_name, ' ', s.last_name) AS student_name,
    d.department_code,
    c.company_name,
    j.job_title,
    po.offered_ctc_lpa AS total_ctc_lpa,
    po.base_salary_lpa,
    po.joining_bonus_lpa,
    po.offer_issued_date,
    po.tentative_joining_date
FROM placement_offers po
JOIN students s ON po.student_id = s.student_id
JOIN departments d ON s.department_id = d.department_id
JOIN companies c ON po.company_id = c.company_id
JOIN job_postings j ON po.job_id = j.job_id
WHERE po.offer_status = 'Accepted'
ORDER BY po.offered_ctc_lpa DESC;


-- ----------------------------------------------------------------------------
-- 3. AGGREGATE FUNCTIONS & GROUP BY / HAVING
-- ----------------------------------------------------------------------------

-- Q5: Department-wise placement statistics (Total Enrolled, Placed Count, Highest CTC, Avg CTC).
SELECT 
    d.department_name,
    d.department_code,
    COUNT(DISTINCT s.student_id) AS total_enrolled_students,
    COUNT(DISTINCT po.student_id) AS total_placed_students,
    ROUND((COUNT(DISTINCT po.student_id) / COUNT(DISTINCT s.student_id)) * 100, 2) AS placement_rate_percentage,
    MAX(po.offered_ctc_lpa) AS highest_package_lpa,
    ROUND(AVG(po.offered_ctc_lpa), 2) AS avg_package_lpa
FROM departments d
LEFT JOIN students s ON d.department_id = s.department_id
LEFT JOIN placement_offers po ON s.student_id = po.student_id AND po.offer_status = 'Accepted'
GROUP BY d.department_id, d.department_name, d.department_code
ORDER BY total_placed_students DESC;

-- Q6: Find companies that hired candidates with an average CTC > 20 LPA.
SELECT 
    c.company_id,
    c.company_name,
    c.tier_category,
    COUNT(po.offer_id) AS total_hires,
    ROUND(AVG(po.offered_ctc_lpa), 2) AS avg_package_lpa
FROM companies c
JOIN placement_offers po ON c.company_id = po.company_id
WHERE po.offer_status = 'Accepted'
GROUP BY c.company_id, c.company_name, c.tier_category
HAVING AVG(po.offered_ctc_lpa) > 20.00;


-- ----------------------------------------------------------------------------
-- 4. SUBQUERIES & NESTED QUERIES
-- ----------------------------------------------------------------------------

-- Q7: Find students whose CGPA is higher than the department average (Correlated Subquery).
SELECT 
    s.student_id,
    s.usn,
    CONCAT(s.first_name, ' ', s.last_name) AS student_name,
    d.department_code,
    s.cgpa
FROM students s
JOIN departments d ON s.department_id = d.department_id
WHERE s.cgpa > (
    SELECT AVG(s2.cgpa)
    FROM students s2
    WHERE s2.department_id = s.department_id
);

-- Q8: Find students who appeared in interview rounds for Google India but did not get selected.
SELECT 
    s.usn,
    CONCAT(s.first_name, ' ', s.last_name) AS student_name,
    a.current_status AS final_application_status
FROM applications a
JOIN students s ON a.student_id = s.student_id
JOIN job_postings j ON a.job_id = j.job_id
JOIN companies c ON j.company_id = c.company_id
WHERE c.company_name = 'Google India Pvt Ltd' 
  AND a.current_status != 'Selected';


-- ----------------------------------------------------------------------------
-- 5. TEST STORED PROCEDURES & VIEWS
-- ----------------------------------------------------------------------------

-- Test Procedure 1: Check all eligible students for Microsoft Cloud Drive
CALL sp_GetEligibleStudentsForJob('JOB-2024-MSFT-SWE');

-- Test Procedure 2: Fetch complete placement profile for Aarav Sharma
CALL sp_GetStudentPlacementProfile('1RV21CS001');

-- Query View 1: Placed students summary
SELECT * FROM vw_placed_students_summary;

-- Query View 2: Department-wise placement stats
SELECT * FROM vw_department_placement_stats;

-- Query View 3: Job Drive status & applicant funnel
SELECT * FROM vw_job_drive_status;
