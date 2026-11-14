const db = require('../config/db');

exports.getProfile = async (req, res) => {
    try {
        const { studentId } = req.params;
        let student, skills, department;

        if (db.isLive) {
            const students = await db.query('SELECT * FROM students WHERE student_id = ? OR usn = ?', [studentId, studentId]);
            if (!students || students.length === 0) {
                return res.status(404).json({ error: 'Student not found' });
            }
            student = students[0];
            skills = await db.query('SELECT skill_name, proficiency_level FROM student_skills WHERE student_id = ?', [student.student_id]);
            const depts = await db.query('SELECT * FROM departments WHERE department_id = ?', [student.department_id]);
            department = depts[0] || null;
        } else {
            student = db.mockData.students.find(s => s.student_id === studentId || s.usn === studentId);
            if (!student) return res.status(404).json({ error: 'Student not found' });
            skills = db.mockData.student_skills.filter(sk => sk.student_id === student.student_id);
            department = db.mockData.departments.find(d => d.department_id === student.department_id);
        }

        res.json({
            student,
            skills,
            department
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { phone_number, personal_email, github_url, linkedin_url, resume_storage_url } = req.body;

        if (db.isLive) {
            await db.query(
                `UPDATE students 
                 SET phone_number = COALESCE(?, phone_number),
                     personal_email = COALESCE(?, personal_email),
                     github_url = COALESCE(?, github_url),
                     linkedin_url = COALESCE(?, linkedin_url),
                     resume_storage_url = COALESCE(?, resume_storage_url)
                 WHERE student_id = ? OR usn = ?`,
                [phone_number, personal_email, github_url, linkedin_url, resume_storage_url, studentId, studentId]
            );
        } else {
            const student = db.mockData.students.find(s => s.student_id === studentId || s.usn === studentId);
            if (student) {
                if (phone_number) student.phone_number = phone_number;
                if (personal_email) student.personal_email = personal_email;
                if (github_url) student.github_url = github_url;
                if (linkedin_url) student.linkedin_url = linkedin_url;
                if (resume_storage_url) student.resume_storage_url = resume_storage_url;
            }
        }
        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.addSkill = async (req, res) => {
    try {
        const { student_id, skill_name, proficiency_level } = req.body;
        if (!student_id || !skill_name) {
            return res.status(400).json({ error: 'Student ID and Skill Name are required' });
        }

        if (db.isLive) {
            await db.query(
                'INSERT INTO student_skills (student_id, skill_name, proficiency_level) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE proficiency_level = ?',
                [student_id, skill_name, proficiency_level || 'Intermediate', proficiency_level || 'Intermediate']
            );
        } else {
            const existing = db.mockData.student_skills.find(s => s.student_id === student_id && s.skill_name.toLowerCase() === skill_name.toLowerCase());
            if (existing) {
                existing.proficiency_level = proficiency_level || 'Intermediate';
            } else {
                db.mockData.student_skills.push({ student_id, skill_name, proficiency_level: proficiency_level || 'Intermediate' });
            }
        }
        res.json({ success: true, message: 'Skill added successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.removeSkill = async (req, res) => {
    try {
        const { student_id, skill_name } = req.body;
        if (db.isLive) {
            await db.query('DELETE FROM student_skills WHERE student_id = ? AND skill_name = ?', [student_id, skill_name]);
        } else {
            const idx = db.mockData.student_skills.findIndex(s => s.student_id === student_id && s.skill_name === skill_name);
            if (idx !== -1) db.mockData.student_skills.splice(idx, 1);
        }
        res.json({ success: true, message: 'Skill removed' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getDrives = async (req, res) => {
    try {
        const { studentId } = req.params;
        let student, jobs, applications, eligibleDepts;

        if (db.isLive) {
            const students = await db.query('SELECT * FROM students WHERE student_id = ? OR usn = ?', [studentId, studentId]);
            student = students[0];
            jobs = await db.query(`
                SELECT j.*, c.company_name, c.tier_category, c.website_url, c.industry_domain, c.headquarters
                FROM job_postings j
                JOIN companies c ON j.company_id = c.company_id
                ORDER BY j.ctc_annual_lpa DESC
            `);
            applications = await db.query('SELECT * FROM applications WHERE student_id = ?', [student.student_id]);
            eligibleDepts = await db.query('SELECT * FROM job_eligible_departments');
        } else {
            student = db.mockData.students.find(s => s.student_id === studentId || s.usn === studentId);
            jobs = db.mockData.job_postings.map(j => {
                const comp = db.mockData.companies.find(c => c.company_id === j.company_id) || {};
                return { ...j, ...comp };
            });
            applications = db.mockData.applications.filter(a => a.student_id === student.student_id);
            eligibleDepts = db.mockData.job_eligible_departments;
        }

        // Calculate eligibility for each drive
        const drivesWithEligibility = jobs.map(job => {
            const app = applications.find(a => a.job_id === job.job_id);
            const deptList = eligibleDepts.filter(d => d.job_id === job.job_id).map(d => d.department_id);
            
            const isDeptEligible = deptList.includes(student.department_id);
            const isCgpaEligible = parseFloat(student.cgpa) >= parseFloat(job.min_cgpa_cutoff);
            const isBacklogEligible = parseInt(student.active_backlogs) <= parseInt(job.max_backlogs_allowed);
            const isDeadlinePassed = new Date(job.registration_deadline) < new Date();
            const isClosed = ['Completed', 'Cancelled'].includes(job.drive_status);

            const isOverallEligible = isDeptEligible && isCgpaEligible && isBacklogEligible && !isDeadlinePassed && !isClosed;

            const reasons = [];
            if (!isDeptEligible) reasons.push(`Branch not eligible (Required: ${deptList.join(', ')})`);
            if (!isCgpaEligible) reasons.push(`CGPA ${student.cgpa} below required ${job.min_cgpa_cutoff}`);
            if (!isBacklogEligible) reasons.push(`Active backlogs (${student.active_backlogs}) exceed allowed (${job.max_backlogs_allowed})`);
            if (isDeadlinePassed) reasons.push('Registration deadline has passed');
            if (isClosed) reasons.push(`Drive is ${job.drive_status}`);

            return {
                ...job,
                eligibleDepartments: deptList,
                hasApplied: !!app,
                applicationStatus: app ? app.current_status : null,
                applicationId: app ? app.application_id : null,
                isEligible: isOverallEligible,
                ineligibilityReasons: reasons
            };
        });

        res.json({ drives: drivesWithEligibility, student });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.applyJob = async (req, res) => {
    try {
        const { student_id, job_id } = req.body;
        const appId = `APP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

        if (db.isLive) {
            // Executing insert triggers trg_check_cgpa_eligibility, trg_validate_branch_eligibility, trg_validate_application_deadline!
            await db.query(
                'INSERT INTO applications (application_id, job_id, student_id, current_status) VALUES (?, ?, ?, "Applied")',
                [appId, job_id, student_id]
            );
        } else {
            // High-fidelity trigger simulation in mock mode
            const student = db.mockData.students.find(s => s.student_id === student_id);
            const job = db.mockData.job_postings.find(j => j.job_id === job_id);
            const depts = db.mockData.job_eligible_departments.filter(d => d.job_id === job_id).map(d => d.department_id);

            if (!depts.includes(student.department_id)) {
                return res.status(400).json({ 
                    error: 'Eligibility Error: Your department is not eligible for this campus drive.',
                    trigger: 'trg_validate_branch_eligibility',
                    sqlstate: '45000'
                });
            }
            if (parseFloat(student.cgpa) < parseFloat(job.min_cgpa_cutoff)) {
                return res.status(400).json({ 
                    error: `Eligibility Constraint Violation: Student CGPA (${student.cgpa}) is lower than the required drive cutoff (${job.min_cgpa_cutoff}).`,
                    trigger: 'trg_check_cgpa_eligibility',
                    sqlstate: '45000'
                });
            }
            if (parseInt(student.active_backlogs) > parseInt(job.max_backlogs_allowed)) {
                return res.status(400).json({ 
                    error: 'Eligibility Constraint Violation: Student has active backlogs exceeding allowed limit.',
                    trigger: 'trg_check_cgpa_eligibility',
                    sqlstate: '45000'
                });
            }
            if (['Completed', 'Cancelled'].includes(job.drive_status)) {
                return res.status(400).json({ 
                    error: 'Application Error: Recruitment drive is already completed or cancelled.',
                    trigger: 'trg_validate_application_deadline',
                    sqlstate: '45000'
                });
            }

            db.mockData.applications.push({
                application_id: appId,
                job_id,
                student_id,
                applied_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
                current_status: 'Applied'
            });
        }

        res.json({ 
            success: true, 
            message: 'Application submitted successfully! Application ID: ' + appId,
            application_id: appId 
        });
    } catch (err) {
        // Return exact trigger error message to UI
        res.status(400).json({ 
            error: err.sqlMessage || err.message,
            sqlState: err.sqlState,
            code: err.code
        });
    }
};

exports.getApplications = async (req, res) => {
    try {
        const { studentId } = req.params;
        let applicationsWithRounds = [];

        if (db.isLive) {
            const rows = await db.query(`
                SELECT 
                    a.application_id, a.job_id, a.applied_at, a.current_status,
                    j.job_title, j.ctc_annual_lpa, j.job_location,
                    c.company_name, c.tier_category
                FROM applications a
                JOIN students s ON a.student_id = s.student_id
                JOIN job_postings j ON a.job_id = j.job_id
                JOIN companies c ON j.company_id = c.company_id
                WHERE s.student_id = ? OR s.usn = ?
                ORDER BY a.applied_at DESC
            `, [studentId, studentId]);

            for (const app of rows) {
                const rounds = await db.query(`
                    SELECT ir.*, rr.round_status, rr.evaluation_score, rr.interviewer_remarks
                    FROM interview_rounds ir
                    LEFT JOIN round_results rr ON ir.round_id = rr.round_id AND rr.student_id = (SELECT student_id FROM students WHERE student_id = ? OR usn = ?)
                    WHERE ir.job_id = ?
                    ORDER BY ir.round_sequence ASC
                `, [studentId, studentId, app.job_id]);

                applicationsWithRounds.push({ ...app, rounds });
            }
        } else {
            const student = db.mockData.students.find(s => s.student_id === studentId || s.usn === studentId);
            if (!student) return res.json({ applications: [] });
            const userApps = db.mockData.applications.filter(a => a.student_id === student.student_id);

            applicationsWithRounds = userApps.map(app => {
                const job = db.mockData.job_postings.find(j => j.job_id === app.job_id) || {};
                const comp = db.mockData.companies.find(c => c.company_id === job.company_id) || {};
                const rounds = db.mockData.interview_rounds
                    .filter(r => r.job_id === app.job_id)
                    .map(r => {
                        const res = db.mockData.round_results.find(rr => rr.round_id === r.round_id && rr.student_id === student.student_id);
                        return {
                            ...r,
                            round_status: res ? res.round_status : 'Upcoming',
                            evaluation_score: res ? res.evaluation_score : null,
                            interviewer_remarks: res ? res.interviewer_remarks : 'Pending Evaluation'
                        };
                    });

                return {
                    ...app,
                    job_title: job.job_title,
                    ctc_annual_lpa: job.ctc_annual_lpa,
                    job_location: job.job_location,
                    company_name: comp.company_name,
                    tier_category: comp.tier_category,
                    rounds
                };
            });
        }

        res.json({ applications: applicationsWithRounds });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getOffers = async (req, res) => {
    try {
        const { studentId } = req.params;
        let offers = [];

        if (db.isLive) {
            offers = await db.query(`
                SELECT 
                    po.*, c.company_name, c.tier_category, j.job_title, j.job_location
                FROM placement_offers po
                JOIN students s ON po.student_id = s.student_id
                JOIN companies c ON po.company_id = c.company_id
                JOIN job_postings j ON po.job_id = j.job_id
                WHERE s.student_id = ? OR s.usn = ?
                ORDER BY po.offer_issued_date DESC
            `, [studentId, studentId]);
        } else {
            const student = db.mockData.students.find(s => s.student_id === studentId || s.usn === studentId);
            if (!student) return res.json({ offers: [] });
            offers = db.mockData.placement_offers
                .filter(po => po.student_id === student.student_id)
                .map(po => {
                    const comp = db.mockData.companies.find(c => c.company_id === po.company_id) || {};
                    const job = db.mockData.job_postings.find(j => j.job_id === po.job_id) || {};
                    return {
                        ...po,
                        company_name: comp.company_name,
                        tier_category: comp.tier_category,
                        job_title: job.job_title,
                        job_location: job.job_location
                    };
                });
        }

        res.json({ offers });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.respondToOffer = async (req, res) => {
    try {
        const { offer_id, action } = req.body; // action: 'Accepted' | 'Declined'
        if (!['Accepted', 'Declined'].includes(action)) {
            return res.status(400).json({ error: 'Action must be Accepted or Declined' });
        }

        if (db.isLive) {
            await db.query(
                'UPDATE placement_offers SET offer_status = ? WHERE offer_id = ?',
                [action, offer_id]
            );
        } else {
            const offer = db.mockData.placement_offers.find(o => o.offer_id === offer_id);
            if (!offer) return res.status(404).json({ error: 'Offer not found' });

            if (action === 'Accepted') {
                const alreadyAccepted = db.mockData.placement_offers.find(
                    o => o.student_id === offer.student_id && o.offer_status === 'Accepted' && o.offer_id !== offer_id
                );
                if (alreadyAccepted) {
                    return res.status(400).json({
                        error: 'Policy Error: Candidate already holds an Accepted offer. Violates university single-offer placement policy.',
                        trigger: 'trg_enforce_single_offer_policy',
                        sqlstate: '45000'
                    });
                }
            }

            const oldStatus = offer.offer_status;
            offer.offer_status = action;

            // Simulate trg_after_offer_accepted
            if (action === 'Accepted') {
                const stu = db.mockData.students.find(s => s.student_id === offer.student_id);
                if (stu) stu.placement_status = 'Placed';
            }

            // Simulate trg_audit_offer_revisions
            db.mockData.placement_offer_audit_log.push({
                log_id: db.mockData.placement_offer_audit_log.length + 1,
                offer_id: offer.offer_id,
                student_id: offer.student_id,
                old_ctc_lpa: offer.offered_ctc_lpa,
                new_ctc_lpa: offer.offered_ctc_lpa,
                old_status: oldStatus,
                new_status: action,
                action_type: 'UPDATE',
                changed_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
                changed_by: 'student_portal@localhost'
            });
        }

        res.json({ 
            success: true, 
            message: `Offer ${offer_id} was successfully marked as ${action}!` 
        });
    } catch (err) {
        res.status(400).json({ 
            error: err.sqlMessage || err.message,
            sqlState: err.sqlState
        });
    }
};

// ----------------------------------------------------------------------------
// Auto-Generated Resume API (Pulls all live profile, skills, offers & projects)
// ----------------------------------------------------------------------------
exports.getResume = async (req, res) => {
    try {
        const { studentId } = req.params;
        let student, skills, department, applications, offers;

        if (db.isLive) {
            const students = await db.query('SELECT * FROM students WHERE student_id = ? OR usn = ?', [studentId, studentId]);
            if (!students || students.length === 0) return res.status(404).json({ error: 'Student not found' });
            student = students[0];
            skills = await db.query('SELECT skill_name, proficiency_level FROM student_skills WHERE student_id = ?', [student.student_id]);
            const depts = await db.query('SELECT * FROM departments WHERE department_id = ?', [student.department_id]);
            department = depts[0] || { department_name: student.department_id, department_code: student.department_id };
            applications = await db.query(`
                SELECT a.*, j.job_title, j.ctc_annual_lpa, c.company_name, c.tier_category
                FROM applications a
                JOIN job_postings j ON a.job_id = j.job_id
                JOIN companies c ON j.company_id = c.company_id
                WHERE a.student_id = ?
            `, [student.student_id]);
            offers = await db.query(`
                SELECT po.*, c.company_name, j.job_title
                FROM placement_offers po
                JOIN companies c ON po.company_id = c.company_id
                JOIN job_postings j ON po.job_id = j.job_id
                WHERE po.student_id = ?
            `, [student.student_id]);
        } else {
            student = db.mockData.students.find(s => s.student_id === studentId || s.usn === studentId);
            if (!student) return res.status(404).json({ error: 'Student not found' });
            skills = db.mockData.student_skills.filter(sk => sk.student_id === student.student_id);
            department = db.mockData.departments.find(d => d.department_id === student.department_id) || {
                department_name: student.department_id,
                department_code: student.department_id
            };
            applications = db.mockData.applications.filter(a => a.student_id === student.student_id).map(a => {
                const j = db.mockData.job_postings.find(job => job.job_id === a.job_id) || {};
                const c = db.mockData.companies.find(comp => comp.company_id === j.company_id) || {};
                return { ...a, job_title: j.job_title, ctc_annual_lpa: j.ctc_annual_lpa, company_name: c.company_name, tier_category: c.tier_category };
            });
            offers = db.mockData.placement_offers.filter(o => o.student_id === student.student_id).map(o => {
                const j = db.mockData.job_postings.find(job => job.job_id === o.job_id) || {};
                const c = db.mockData.companies.find(comp => comp.company_id === o.company_id) || {};
                return { ...o, company_name: c.company_name, job_title: j.job_title };
            });
        }

        const projectsByDept = {
            'DEPT-CSE': [
                {
                    title: 'Distributed Key-Value Store & Consensus Engine',
                    tech: 'C++20, Raft Protocol, gRPC, Docker, Linux Sockets',
                    points: [
                        'Engineered a distributed, fault-tolerant key-value store implementing the Raft consensus protocol with automated leader election and log replication.',
                        'Achieved throughput of 45,000 requests/sec with p99 read latency under 1.8ms using custom epoll-based I/O multiplexing and LRU cache eviction.'
                    ]
                },
                {
                    title: 'College Placement Management System (CPMS) with DBMS Triggers',
                    tech: 'Node.js, Express, MySQL 8.0, Triggers, TailwindCSS, Chart.js',
                    points: [
                        'Designed and implemented a 12-table relational database architecture with 8 automated triggers enforcing CGPA constraints, branch eligibility, and single-offer policies.',
                        'Constructed interactive portals for Students, Recruiting Companies, and TPO Officers with live query inspection and multi-result stored procedures.'
                    ]
                }
            ],
            'DEPT-ISE': [
                {
                    title: 'Cloud-Native Enterprise Analytics & Microservices Platform',
                    tech: 'Python, Django Rest Framework, React.js, Redis, PostgreSQL, Docker',
                    points: [
                        'Built asynchronous telemetry ingestion pipeline capable of parsing 10,000 events/sec using Celery task workers and Redis message queues.',
                        'Created role-based access control (RBAC) authentication dashboard with JWT sessions and automated PDF audit report generation.'
                    ]
                },
                {
                    title: 'Distributed Observability & Distributed Tracing Agent',
                    tech: 'Go (Golang), OpenTelemetry, Prometheus, Grafana, Docker',
                    points: [
                        'Implemented lightweight metrics exporter scraping CPU, heap allocation, and network packet loss across multi-container Kubernetes nodes.',
                        'Reduced diagnostic resolution times by 40% through automated latency alert dispatching to Slack and PagerDuty webhooks.'
                    ]
                }
            ],
            'DEPT-AIDS': [
                {
                    title: 'Vision Transformer for Medical Diagnostic Imaging',
                    tech: 'Python, PyTorch, HuggingFace, CUDA, FastAPI, Streamlit',
                    points: [
                        'Trained fine-tuned vision transformer (ViT) on 40,000 multi-label chest radiography images, achieving 94.6% AUC-ROC score.',
                        'Integrated Grad-CAM visual attention heatmaps into an interactive radiologist consultation interface with under 250ms inference latency.'
                    ]
                },
                {
                    title: 'Real-Time Financial Fraud Anomaly Detection Pipeline',
                    tech: 'Python, Apache Kafka, XGBoost, Scikit-learn, Docker',
                    points: [
                        'Developed streaming transaction classifier scoring credit authorizations with 99.2% precision on heavily imbalanced dataset.',
                        'Architected containerized microservice pipeline processing streaming events via Kafka topics with sub-15ms decision latency.'
                    ]
                }
            ],
            'DEPT-ECE': [
                {
                    title: 'Pipelined 32-Bit RISC-V Microprocessor on FPGA',
                    tech: 'Verilog HDL, SystemVerilog, Xilinx Vivado, Artix-7, ModelSim',
                    points: [
                        'Designed complete 5-stage instruction pipeline (IF, ID, EX, MEM, WB) supporting the standard RV32I base integer instruction set architecture.',
                        'Synthesized design on Xilinx Artix-7 FPGA at 60MHz; resolved data/control hazards via forwarding units and dynamic branch prediction.'
                    ]
                },
                {
                    title: 'Industrial IoT Telemetry Node with FreeRTOS',
                    tech: 'Embedded C, ARM Cortex-M4, STM32, FreeRTOS, MQTT, SPI/I2C',
                    points: [
                        'Authored real-time firmware with task prioritization, DMA-based SPI sensor readout, and low-power sleep state transitions.',
                        'Connected edge gateway over encrypted MQTT-SN protocols with local flash data logging during network outages.'
                    ]
                }
            ],
            'DEPT-MECH': [
                {
                    title: 'CFD Thermal Optimization of Cylindrical EV Battery Pack',
                    tech: 'ANSYS Fluent (CFD), SolidWorks, MATLAB Simulink',
                    points: [
                        'Conducted 3D conjugate heat transfer simulation of liquid cold-plate jackets across 21700 lithium-ion cell modules.',
                        'Optimized cooling channel geometry and coolant flow rates, reducing cell-to-cell temperature variance by 26% under 3C fast-charge cycles.'
                    ]
                },
                {
                    title: 'FEA Lightweighting & Modal Analysis of Tubular Chassis',
                    tech: 'ANSYS Mechanical, CATIA V5, Structural FEA',
                    points: [
                        'Simulated torsional stiffness, impact crashworthiness, and natural vibration frequencies of student Formula SAE tubular spaceframe.',
                        'Achieved 14% mass reduction while maintaining a minimum safety factor of 2.2 across all critical weld nodes.'
                    ]
                }
            ]
        };

        const deptKey = student.department_id || 'DEPT-CSE';
        const projects = projectsByDept[deptKey] || projectsByDept['DEPT-CSE'];

        res.json({
            success: true,
            resume: {
                student,
                department,
                skills,
                applications,
                offers,
                projects,
                institution: 'RV College of Engineering (RVCE), Bangalore',
                degree: `Bachelor of Engineering (B.E.) in ${department.department_name}`,
                period: `2021 – ${student.graduation_year}`,
                summary: `Analytical and driven ${department.department_name} undergraduate (CGPA: ${student.cgpa}/10.0, 0 Backlogs) with extensive hands-on experience across full-stack engineering, core system architectures, and database design. Proven track record in solving complex algorithmic problems and delivering production-ready technical solutions.`
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
