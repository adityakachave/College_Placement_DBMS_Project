-- ============================================================================
-- COLLEGE PLACEMENT MANAGEMENT SYSTEM (CPMS)


USE college_placement_db;
SET SQL_SAFE_UPDATES = 0;


-- ----------------------------------------------------------------------------
-- NEW QUERY 1: Recruitment Turnaround Duration & Days-to-Join Analysis
-- Purpose: Compute the exact selection latency (days between application submission 
--          and offer issuance) and remaining days until the student's joining date.
-- ----------------------------------------------------------------------------
SELECT 
    s.usn,
    CONCAT(s.first_name, ' ', s.last_name) AS student_name,
    c.company_name,
    j.job_title,
    DATE(a.applied_at) AS application_date,
    po.offer_issued_date,
    DATEDIFF(po.offer_issued_date, DATE(a.applied_at)) AS selection_turnaround_days,
    po.tentative_joining_date,
    DATEDIFF(po.tentative_joining_date, po.offer_issued_date) AS days_between_offer_and_joining
FROM placement_offers po
JOIN applications a ON po.application_id = a.application_id
JOIN students s ON po.student_id = s.student_id
JOIN companies c ON po.company_id = c.company_id
JOIN job_postings j ON po.job_id = j.job_id
WHERE po.offer_status = 'Accepted'
ORDER BY selection_turnaround_days ASC;


-- ----------------------------------------------------------------------------




-- Query 2: Display full details of placed students (Student, Department, Company, Package Breakdown).
SELECT 
    s.student_id,
    s.usn,
    CONCAT(s.first_name, ' ', s.last_name) AS student_name,
    d.department_name,
    c.company_name,
    c.tier_category,
    j.job_title,
    po.offered_ctc_lpa,
    po.base_salary_lpa,
    po.joining_bonus_lpa,
    po.tentative_joining_date
FROM placement_offers po
JOIN students s ON po.student_id = s.student_id
JOIN departments d ON s.department_id = d.department_id
JOIN companies c ON po.company_id = c.company_id
JOIN job_postings j ON po.job_id = j.job_id
WHERE po.offer_status = 'Accepted'
ORDER BY po.offered_ctc_lpa DESC;

-- Query 3: Department-wise placement stats with placement rate percentage.
SELECT 
    d.department_code,
    d.department_name,
    COUNT(s.student_id) AS total_enrolled,
    SUM(CASE WHEN s.placement_status = 'Placed' THEN 1 ELSE 0 END) AS total_placed,
    ROUND((SUM(CASE WHEN s.placement_status = 'Placed' THEN 1 ELSE 0 END) / COUNT(s.student_id)) * 100, 2) AS placement_percentage,
    COALESCE(MAX(po.offered_ctc_lpa), 0.00) AS highest_package_lpa,
    COALESCE(ROUND(AVG(po.offered_ctc_lpa), 2), 0.00) AS avg_package_lpa
FROM departments d
LEFT JOIN students s ON d.department_id = s.department_id
LEFT JOIN placement_offers po ON s.student_id = po.student_id AND po.offer_status = 'Accepted'
GROUP BY d.department_id, d.department_code, d.department_name
ORDER BY placement_percentage DESC;

-- Query 4 (Correlated Subquery): Find students with CGPA higher than their department average.
SELECT 
    s.student_id,
    s.usn,
    CONCAT(s.first_name, ' ', s.last_name) AS student_name,
    s.department_id,
    s.cgpa AS student_cgpa,
    ROUND((SELECT AVG(s2.cgpa) FROM students s2 WHERE s2.department_id = s.department_id), 2) AS dept_avg_cgpa
FROM students s
WHERE s.cgpa > (
    SELECT AVG(s2.cgpa) 
    FROM students s2 
    WHERE s2.department_id = s.department_id
)
ORDER BY s.department_id, s.cgpa DESC;

-- Query 5 (Window Functions): Rank students by CGPA within each department.
SELECT 
    d.department_code,
    s.usn,
    CONCAT(s.first_name, ' ', s.last_name) AS student_name,
    s.cgpa,
    DENSE_RANK() OVER (PARTITION BY s.department_id ORDER BY s.cgpa DESC) AS department_rank,
    RANK() OVER (ORDER BY s.cgpa DESC) AS overall_college_rank
FROM students s
JOIN departments d ON s.department_id = d.department_id;

-- Query 6 (Stored Procedure Call): Fetch eligible students for Microsoft Cloud Drive.
CALL sp_GetEligibleStudentsForJob('JOB-2024-MSFT-SWE');

