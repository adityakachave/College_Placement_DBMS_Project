const express = require('express');
const router = express.Router();
const db = require('../config/db');

const studentCtrl = require('../controllers/studentController');
const companyCtrl = require('../controllers/companyController');
const tpoCtrl = require('../controllers/tpoController');
const authCtrl = require('../controllers/authController');

// ----------------------------------------------------------------------------
// System & Auth Routes
// ----------------------------------------------------------------------------
router.get('/status', (req, res) => {
    res.json(db.getStatus());
});

router.post('/auth/register/student', authCtrl.registerStudent);
router.post('/auth/register/company', authCtrl.registerCompany);
router.post('/auth/login', authCtrl.verifyLogin);

router.post('/db/reconnect', async (req, res) => {
    const { host, port, user, password, database } = req.body;
    if (host) process.env.DB_HOST = host;
    if (port) process.env.DB_PORT = port;
    if (user) process.env.DB_USER = user;
    if (password !== undefined) process.env.DB_PASSWORD = password;
    if (database) process.env.DB_NAME = database;

    await db.initDB();
    res.json(db.getStatus());
});

router.get('/auth/users', async (req, res) => {
    try {
        let students = [];
        let companies = [];
        let officers = [];

        if (db.isLive) {
            students = await db.query('SELECT student_id, usn, first_name, last_name, department_id, cgpa, placement_status FROM students ORDER BY cgpa DESC');
            companies = await db.query('SELECT company_id, company_name, tier_category, hr_contact_name FROM companies ORDER BY company_name');
            officers = await db.query('SELECT officer_id, officer_name, designation, email FROM placement_officers ORDER BY officer_id');
        } else {
            students = db.mockData.students.map(s => ({
                student_id: s.student_id,
                usn: s.usn,
                first_name: s.first_name,
                last_name: s.last_name,
                department_id: s.department_id,
                cgpa: s.cgpa,
                placement_status: s.placement_status
            }));
            companies = db.mockData.companies.map(c => ({
                company_id: c.company_id,
                company_name: c.company_name,
                tier_category: c.tier_category,
                hr_contact_name: c.hr_contact_name
            }));
            officers = db.mockData.placement_officers.map(o => ({
                officer_id: o.officer_id,
                officer_name: o.officer_name,
                designation: o.designation,
                email: o.email
            }));
        }

        res.json({
            students,
            companies,
            officers
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ----------------------------------------------------------------------------
// Student Portal Endpoints
// ----------------------------------------------------------------------------
router.get('/student/profile/:studentId', studentCtrl.getProfile);
router.put('/student/profile/:studentId', studentCtrl.updateProfile);
router.post('/student/skills', studentCtrl.addSkill);
router.delete('/student/skills', studentCtrl.removeSkill);
router.get('/student/drives/:studentId', studentCtrl.getDrives);
router.post('/student/apply', studentCtrl.applyJob);
router.get('/student/applications/:studentId', studentCtrl.getApplications);
router.get('/student/offers/:studentId', studentCtrl.getOffers);
router.post('/student/offers/respond', studentCtrl.respondToOffer);
router.get('/student/resume/:studentId', studentCtrl.getResume);

// ----------------------------------------------------------------------------
// Company Portal Endpoints
// ----------------------------------------------------------------------------
router.get('/company/profile/:companyId', companyCtrl.getCompanyProfile);
router.post('/company/jobs', companyCtrl.postJobDrive);
router.get('/company/jobs/:jobId/applicants', companyCtrl.getApplicants);
router.post('/company/applicants/status', companyCtrl.updateApplicantStatus);
router.post('/company/rounds', companyCtrl.createInterviewRound);
router.post('/company/rounds/results', companyCtrl.submitRoundResult);
router.post('/company/offers', companyCtrl.issueOffer);

// ----------------------------------------------------------------------------
// TPO / University Admin Endpoints
// ----------------------------------------------------------------------------
router.get('/tpo/analytics', tpoCtrl.getAnalytics);
router.get('/tpo/placed-students', tpoCtrl.getPlacedStudents);
router.get('/tpo/drives-status', tpoCtrl.getDrivesStatus);
router.get('/tpo/audit-logs', tpoCtrl.getAuditLogs);
router.post('/tpo/procedures/run', tpoCtrl.runStoredProcedure);
router.post('/tpo/query/execute', tpoCtrl.executeCustomSQL);

// ----------------------------------------------------------------------------
// Pre-built Lab/Viva SQL Queries
// ----------------------------------------------------------------------------
router.get('/tpo/prebuilt-queries', (req, res) => {
    const prebuilt = [
        {
            id: 'Q1',
            title: '1. Placed Students Summary (Multi-Table Join on 5 Tables)',
            sql: `SELECT s.usn, CONCAT(s.first_name, ' ', s.last_name) AS student_name, d.department_code, c.company_name, j.job_title, po.offered_ctc_lpa, po.base_salary_lpa, po.joining_bonus_lpa, po.tentative_joining_date FROM placement_offers po JOIN students s ON po.student_id = s.student_id JOIN departments d ON s.department_id = d.department_id JOIN companies c ON po.company_id = c.company_id JOIN job_postings j ON po.job_id = j.job_id WHERE po.offer_status = 'Accepted' ORDER BY po.offered_ctc_lpa DESC;`
        },
        {
            id: 'Q2',
            title: '2. Department-wise Placement Statistics (View: vw_department_placement_stats)',
            sql: `SELECT * FROM vw_department_placement_stats;`
        },
        {
            id: 'Q3',
            title: '3. Correlated Subquery: Students CGPA > Department Average',
            sql: `SELECT s.student_id, s.usn, CONCAT(s.first_name, ' ', s.last_name) AS student_name, s.department_id, s.cgpa AS student_cgpa, ROUND((SELECT AVG(s2.cgpa) FROM students s2 WHERE s2.department_id = s.department_id), 2) AS dept_avg_cgpa FROM students s WHERE s.cgpa > (SELECT AVG(s2.cgpa) FROM students s2 WHERE s2.department_id = s.department_id) ORDER BY s.department_id, s.cgpa DESC;`
        },
        {
            id: 'Q4',
            title: '4. Window Function: DENSE_RANK() by Department and Overall Rank',
            sql: `SELECT d.department_code, s.usn, CONCAT(s.first_name, ' ', s.last_name) AS student_name, s.cgpa, DENSE_RANK() OVER (PARTITION BY s.department_id ORDER BY s.cgpa DESC) AS department_rank, RANK() OVER (ORDER BY s.cgpa DESC) AS overall_college_rank FROM students s JOIN departments d ON s.department_id = d.department_id;`
        },
        {
            id: 'Q5',
            title: '5. Aggregate with HAVING: High CTC Companies (> 20 LPA Average)',
            sql: `SELECT c.tier_category, COUNT(po.offer_id) AS total_offers_released, MIN(po.offered_ctc_lpa) AS min_package_offered, MAX(po.offered_ctc_lpa) AS max_package_offered, ROUND(AVG(po.offered_ctc_lpa), 2) AS avg_package_offered FROM companies c JOIN placement_offers po ON c.company_id = po.company_id GROUP BY c.tier_category HAVING COUNT(po.offer_id) > 1 AND AVG(po.offered_ctc_lpa) > 20.00;`
        },
        {
            id: 'Q6',
            title: '6. Package Benchmarking using > ALL Nested Subquery',
            sql: `SELECT s.usn, CONCAT(s.first_name, ' ', s.last_name) AS student_name, d.department_code, c.company_name, po.offered_ctc_lpa FROM placement_offers po JOIN students s ON po.student_id = s.student_id JOIN departments d ON s.department_id = d.department_id JOIN companies c ON po.company_id = c.company_id WHERE po.offer_status = 'Accepted' AND po.offered_ctc_lpa > ALL (SELECT po2.offered_ctc_lpa FROM placement_offers po2 JOIN students s2 ON po2.student_id = s2.student_id WHERE s2.department_id = 'DEPT-MECH' AND po2.offer_status = 'Accepted') ORDER BY po.offered_ctc_lpa DESC;`
        },
        {
            id: 'Q7',
            title: '7. Gender Diversity & Female Placement Share',
            sql: `SELECT d.department_code, COUNT(s.student_id) AS total_enrolled, SUM(CASE WHEN s.gender = 'Female' AND s.placement_status = 'Placed' THEN 1 ELSE 0 END) AS female_placed, SUM(CASE WHEN s.gender = 'Male' AND s.placement_status = 'Placed' THEN 1 ELSE 0 END) AS male_placed, ROUND((SUM(CASE WHEN s.gender = 'Female' AND s.placement_status = 'Placed' THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN s.placement_status = 'Placed' THEN 1 ELSE 0 END), 0)) * 100, 2) AS female_placement_share_pct FROM departments d JOIN students s ON d.department_id = s.department_id LEFT JOIN placement_offers po ON s.student_id = po.student_id AND po.offer_status = 'Accepted' GROUP BY d.department_code ORDER BY female_placement_share_pct DESC;`
        },
        {
            id: 'Q8',
            title: '8. Turnaround Duration & Days-to-Join (DATEDIFF)',
            sql: `SELECT s.usn, CONCAT(s.first_name, ' ', s.last_name) AS student_name, c.company_name, j.job_title, DATE(a.applied_at) AS application_date, po.offer_issued_date, DATEDIFF(po.offer_issued_date, DATE(a.applied_at)) AS selection_turnaround_days, po.tentative_joining_date, DATEDIFF(po.tentative_joining_date, po.offer_issued_date) AS days_between_offer_and_joining FROM placement_offers po JOIN applications a ON po.application_id = a.application_id JOIN students s ON po.student_id = s.student_id JOIN companies c ON po.company_id = c.company_id JOIN job_postings j ON po.job_id = j.job_id WHERE po.offer_status = 'Accepted' ORDER BY selection_turnaround_days ASC;`
        },
        {
            id: 'Q9',
            title: '9. Live Trigger Audit Trail (placement_offer_audit_log)',
            sql: `SELECT * FROM placement_offer_audit_log ORDER BY changed_at DESC;`
        },
        {
            id: 'Q10',
            title: '10. Left Outer Join: Unplaced Students & Application Gaps',
            sql: `SELECT s.usn, CONCAT(s.first_name, ' ', s.last_name) AS student_name, d.department_code, s.cgpa, s.placement_status, COALESCE(c.company_name, 'No Offer Yet') AS placed_company, COALESCE(po.offered_ctc_lpa, 0.00) AS ctc_lpa FROM students s JOIN departments d ON s.department_id = d.department_id LEFT JOIN placement_offers po ON s.student_id = po.student_id AND po.offer_status = 'Accepted' LEFT JOIN companies c ON po.company_id = c.company_id ORDER BY s.placement_status, s.cgpa DESC;`
        }
    ];
    res.json({ queries: prebuilt });
});

module.exports = router;
