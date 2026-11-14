const db = require('../config/db');

exports.getCompanyProfile = async (req, res) => {
    try {
        const { companyId } = req.params;
        let company, jobs;

        if (db.isLive) {
            const comps = await db.query('SELECT * FROM companies WHERE company_id = ?', [companyId]);
            if (!comps || comps.length === 0) return res.status(404).json({ error: 'Company not found' });
            company = comps[0];
            jobs = await db.query(`
                SELECT j.*, 
                    (SELECT COUNT(*) FROM applications WHERE job_id = j.job_id) as total_applicants,
                    (SELECT COUNT(*) FROM applications WHERE job_id = j.job_id AND current_status = 'Selected') as total_selected
                FROM job_postings j
                WHERE j.company_id = ?
                ORDER BY j.drive_date DESC
            `, [companyId]);
        } else {
            company = db.mockData.companies.find(c => c.company_id === companyId);
            if (!company) return res.status(404).json({ error: 'Company not found' });
            jobs = db.mockData.job_postings
                .filter(j => j.company_id === companyId)
                .map(j => {
                    const apps = db.mockData.applications.filter(a => a.job_id === j.job_id);
                    return {
                        ...j,
                        total_applicants: apps.length,
                        total_selected: apps.filter(a => a.current_status === 'Selected').length
                    };
                });
        }

        res.json({ company, jobs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.postJobDrive = async (req, res) => {
    try {
        const {
            company_id,
            officer_in_charge,
            job_title,
            job_description,
            job_role_type,
            ctc_annual_lpa,
            min_cgpa_cutoff,
            max_backlogs_allowed,
            job_location,
            drive_date,
            registration_deadline,
            eligible_departments
        } = req.body;

        const jobId = `JOB-${new Date().getFullYear()}-${company_id.replace('CMP-', '').split('-')[0]}-${job_role_type.includes('SDE') ? 'SDE' : 'CORE'}-${Math.floor(100 + Math.random() * 900)}`;

        if (db.isLive) {
            await db.query(`
                INSERT INTO job_postings (
                    job_id, company_id, officer_in_charge, job_title, job_description, 
                    job_role_type, ctc_annual_lpa, min_cgpa_cutoff, max_backlogs_allowed, 
                    job_location, drive_date, registration_deadline, drive_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Upcoming')
            `, [
                jobId, company_id, officer_in_charge || 'TPO-EMP-101', job_title, job_description,
                job_role_type || 'Full-Time SDE', ctc_annual_lpa, min_cgpa_cutoff || 6.5,
                max_backlogs_allowed || 0, job_location, drive_date, registration_deadline
            ]);

            // Insert M:N mapping for eligible departments
            if (Array.isArray(eligible_departments)) {
                for (const deptId of eligible_departments) {
                    await db.query('INSERT INTO job_eligible_departments (job_id, department_id) VALUES (?, ?)', [jobId, deptId]);
                }
            }
        } else {
            const newJob = {
                job_id: jobId,
                company_id,
                officer_in_charge: officer_in_charge || 'TPO-EMP-101',
                job_title,
                job_description,
                job_role_type: job_role_type || 'Full-Time SDE',
                ctc_annual_lpa: parseFloat(ctc_annual_lpa),
                min_cgpa_cutoff: parseFloat(min_cgpa_cutoff || 6.5),
                max_backlogs_allowed: parseInt(max_backlogs_allowed || 0),
                job_location,
                drive_date,
                registration_deadline,
                drive_status: 'Upcoming'
            };
            db.mockData.job_postings.unshift(newJob);

            if (Array.isArray(eligible_departments)) {
                eligible_departments.forEach(deptId => {
                    db.mockData.job_eligible_departments.push({ job_id: jobId, department_id: deptId });
                });
            }
        }

        res.json({
            success: true,
            message: `Placement Drive created successfully! Assigned Job ID: ${jobId}`,
            job_id: jobId
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getApplicants = async (req, res) => {
    try {
        const { jobId } = req.params;
        let applicants = [];

        if (db.isLive) {
            applicants = await db.query(`
                SELECT 
                    a.application_id, a.job_id, a.student_id, a.applied_at, a.current_status,
                    s.usn, s.first_name, s.last_name, s.gender, s.college_email, s.phone_number,
                    s.cgpa, s.tenth_percentage, s.twelfth_percentage, s.active_backlogs, s.placement_status,
                    d.department_code, d.department_name,
                    (SELECT GROUP_CONCAT(CONCAT(skill_name, ' (', proficiency_level, ')') SEPARATOR ', ') FROM student_skills WHERE student_id = s.student_id) as skills
                FROM applications a
                JOIN students s ON a.student_id = s.student_id
                JOIN departments d ON s.department_id = d.department_id
                WHERE a.job_id = ?
                ORDER BY s.cgpa DESC
            `, [jobId]);
        } else {
            const apps = db.mockData.applications.filter(a => a.job_id === jobId);
            applicants = apps.map(app => {
                const s = db.mockData.students.find(stu => stu.student_id === app.student_id) || {};
                const d = db.mockData.departments.find(dept => dept.department_id === s.department_id) || {};
                const skills = db.mockData.student_skills
                    .filter(sk => sk.student_id === s.student_id)
                    .map(sk => `${sk.skill_name} (${sk.proficiency_level})`)
                    .join(', ');

                return {
                    ...app,
                    usn: s.usn,
                    first_name: s.first_name,
                    last_name: s.last_name,
                    gender: s.gender,
                    college_email: s.college_email,
                    phone_number: s.phone_number,
                    cgpa: s.cgpa,
                    tenth_percentage: s.tenth_percentage,
                    twelfth_percentage: s.twelfth_percentage,
                    active_backlogs: s.active_backlogs,
                    placement_status: s.placement_status,
                    department_code: d.department_code,
                    department_name: d.department_name,
                    skills
                };
            });
        }

        res.json({ applicants });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateApplicantStatus = async (req, res) => {
    try {
        const { application_id, status } = req.body;
        if (db.isLive) {
            await db.query('UPDATE applications SET current_status = ? WHERE application_id = ?', [status, application_id]);
        } else {
            const app = db.mockData.applications.find(a => a.application_id === application_id);
            if (app) app.current_status = status;
        }
        res.json({ success: true, message: `Applicant status updated to ${status}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.createInterviewRound = async (req, res) => {
    try {
        const { job_id, round_type, scheduled_timestamp, platform_or_venue } = req.body;
        const roundId = `RND-${job_id.replace('JOB-2024-', '')}-${Math.floor(10 + Math.random() * 90)}`;

        let roundSequence = 1;
        if (db.isLive) {
            const [seq] = await db.query('SELECT COALESCE(MAX(round_sequence), 0) + 1 as next_seq FROM interview_rounds WHERE job_id = ?', [job_id]);
            roundSequence = seq[0]?.next_seq || 1;
            await db.query(`
                INSERT INTO interview_rounds (round_id, job_id, round_sequence, round_type, scheduled_timestamp, platform_or_venue)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [roundId, job_id, roundSequence, round_type, scheduled_timestamp, platform_or_venue]);
        } else {
            const rounds = db.mockData.interview_rounds.filter(r => r.job_id === job_id);
            roundSequence = rounds.length + 1;
            db.mockData.interview_rounds.push({
                round_id: roundId,
                job_id,
                round_sequence: roundSequence,
                round_type,
                scheduled_timestamp,
                platform_or_venue
            });
        }

        res.json({ success: true, message: `Round ${roundSequence} (${round_type}) created!`, round_id: roundId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.submitRoundResult = async (req, res) => {
    try {
        const { round_id, student_id, round_status, evaluation_score, interviewer_remarks } = req.body;
        const resultId = `RES-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

        if (db.isLive) {
            // Inserting Disqualified record fires trigger trg_sync_app_status_on_round_result!
            await db.query(`
                INSERT INTO round_results (result_id, round_id, student_id, round_status, evaluation_score, interviewer_remarks)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    round_status = VALUES(round_status),
                    evaluation_score = VALUES(evaluation_score),
                    interviewer_remarks = VALUES(interviewer_remarks)
            `, [resultId, round_id, student_id, round_status, evaluation_score, interviewer_remarks]);
        } else {
            const existing = db.mockData.round_results.find(rr => rr.round_id === round_id && rr.student_id === student_id);
            if (existing) {
                existing.round_status = round_status;
                existing.evaluation_score = evaluation_score;
                existing.interviewer_remarks = interviewer_remarks;
            } else {
                db.mockData.round_results.push({
                    result_id: resultId,
                    round_id,
                    student_id,
                    round_status,
                    evaluation_score,
                    interviewer_remarks
                });
            }

            // Simulate Trigger 5: trg_sync_app_status_on_round_result
            if (round_status === 'Disqualified') {
                const rnd = db.mockData.interview_rounds.find(r => r.round_id === round_id);
                if (rnd) {
                    const app = db.mockData.applications.find(a => a.job_id === rnd.job_id && a.student_id === student_id);
                    if (app) app.current_status = 'Rejected';
                }
            }
        }

        res.json({
            success: true,
            message: `Evaluation recorded! ${round_status === 'Disqualified' ? '(Trigger 5 auto-marked Application as Rejected)' : ''}`
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.issueOffer = async (req, res) => {
    try {
        const { application_id, offered_ctc_lpa, base_salary_lpa, joining_bonus_lpa, offer_issued_date, tentative_joining_date } = req.body;
        const offerId = `OFFR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        const base = parseFloat(base_salary_lpa);
        const bonus = parseFloat(joining_bonus_lpa || 0);
        const ctc = parseFloat(offered_ctc_lpa);

        if (db.isLive) {
            // Fetch student_id, job_id, company_id from application
            const [appRows] = await db.query(`
                SELECT a.student_id, a.job_id, j.company_id
                FROM applications a
                JOIN job_postings j ON a.job_id = j.job_id
                WHERE a.application_id = ?
            `, [application_id]);

            if (!appRows || appRows.length === 0) return res.status(404).json({ error: 'Application not found' });
            const { student_id, job_id, company_id } = appRows;

            // Trigger trg_validate_salary_breakdown runs here!
            await db.query(`
                INSERT INTO placement_offers (
                    offer_id, application_id, student_id, company_id, job_id,
                    offered_ctc_lpa, base_salary_lpa, joining_bonus_lpa, offer_issued_date,
                    tentative_joining_date, offer_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Offered')
            `, [offerId, application_id, student_id, company_id, job_id, ctc, base, bonus, offer_issued_date || new Date().toISOString().slice(0, 10), tentative_joining_date]);

            // Update application status to Selected
            await db.query('UPDATE applications SET current_status = "Selected" WHERE application_id = ?', [application_id]);
        } else {
            // Mock Trigger 6 validation
            if (base <= 0) {
                return res.status(400).json({
                    error: 'Salary Error: Base salary must be strictly greater than zero.',
                    trigger: 'trg_validate_salary_breakdown',
                    sqlstate: '45000'
                });
            }
            if ((base + bonus) > ctc) {
                return res.status(400).json({
                    error: `Salary Error: Base salary (${base}) plus joining bonus (${bonus}) exceeds the total offered CTC (${ctc}).`,
                    trigger: 'trg_validate_salary_breakdown',
                    sqlstate: '45000'
                });
            }

            const app = db.mockData.applications.find(a => a.application_id === application_id);
            if (!app) return res.status(404).json({ error: 'Application not found' });
            const job = db.mockData.job_postings.find(j => j.job_id === app.job_id);

            db.mockData.placement_offers.push({
                offer_id: offerId,
                application_id,
                student_id: app.student_id,
                company_id: job.company_id,
                job_id: job.job_id,
                offered_ctc_lpa: ctc,
                base_salary_lpa: base,
                joining_bonus_lpa: bonus,
                offer_issued_date: offer_issued_date || new Date().toISOString().slice(0, 10),
                tentative_joining_date,
                offer_status: 'Offered'
            });

            app.current_status = 'Selected';
        }

        res.json({
            success: true,
            message: `Placement Offer ${offerId} issued successfully! Candidate selected.`,
            offer_id: offerId
        });
    } catch (err) {
        res.status(400).json({
            error: err.sqlMessage || err.message,
            sqlState: err.sqlState
        });
    }
};
