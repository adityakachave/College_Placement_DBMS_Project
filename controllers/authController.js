const db = require('../config/db');

// In-memory credential store for registered passwords
const registeredPasswords = {
    students: {},
    companies: {},
    officers: {
        'TPO-EMP-101': 'admin123',
        'admin': 'admin123'
    }
};

// ----------------------------------------------------------------------------
// Student Registration
// ----------------------------------------------------------------------------
exports.registerStudent = async (req, res) => {
    try {
        const {
            first_name,
            last_name,
            usn,
            gender,
            department_id,
            cgpa,
            tenth_percentage,
            twelfth_percentage,
            active_backlogs,
            graduation_year,
            college_email,
            personal_email,
            phone_number,
            github_url,
            linkedin_url,
            skills,
            password
        } = req.body;

        // Validation
        if (!first_name || !last_name || !usn || !department_id || !college_email) {
            return res.status(400).json({ error: 'First Name, Last Name, USN, Department, and College Email are required.' });
        }

        const cleanUsn = usn.trim().toUpperCase();
        const gradYear = parseInt(graduation_year) || 2025;
        const deptCode = department_id.replace('DEPT-', '');
        
        // Generate a standard student_id: STU-YYYY-XXXX
        const randSuffix = Math.floor(100 + Math.random() * 900);
        const student_id = `STU-${gradYear}-${deptCode}${randSuffix}`;

        const studentRecord = {
            student_id,
            usn: cleanUsn,
            first_name: first_name.trim(),
            last_name: last_name.trim(),
            gender: gender || 'Male',
            college_email: college_email.trim().toLowerCase(),
            personal_email: (personal_email || college_email).trim().toLowerCase(),
            phone_number: (phone_number || '+91-9900000000').trim(),
            department_id: department_id.trim(),
            cgpa: parseFloat(cgpa) || 8.0,
            tenth_percentage: parseFloat(tenth_percentage) || 90.0,
            twelfth_percentage: parseFloat(twelfth_percentage) || 88.0,
            active_backlogs: parseInt(active_backlogs) || 0,
            graduation_year: gradYear,
            github_url: github_url ? github_url.trim() : `https://github.com/${cleanUsn.toLowerCase()}`,
            linkedin_url: linkedin_url ? linkedin_url.trim() : `https://linkedin.com/in/${cleanUsn.toLowerCase()}`,
            resume_storage_url: `https://cpms.rvce.edu.in/resumes/${cleanUsn}.pdf`,
            placement_status: 'Unplaced'
        };

        // Save password (default to USN if not specified)
        const userPwd = (password || cleanUsn).trim();
        registeredPasswords.students[cleanUsn.toLowerCase()] = userPwd;
        registeredPasswords.students[student_id.toLowerCase()] = userPwd;

        if (db.isLive) {
            // Check if USN already exists
            const existing = await db.query('SELECT student_id, usn FROM students WHERE usn = ? OR college_email = ?', [cleanUsn, studentRecord.college_email]);
            if (existing && existing.length > 0) {
                return res.status(400).json({ error: `Student with USN ${cleanUsn} or Email ${studentRecord.college_email} already exists.` });
            }

            await db.query(
                `INSERT INTO students (
                    student_id, usn, first_name, last_name, gender, college_email, personal_email,
                    phone_number, department_id, cgpa, tenth_percentage, twelfth_percentage,
                    active_backlogs, graduation_year, github_url, linkedin_url, resume_storage_url, placement_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    studentRecord.student_id, studentRecord.usn, studentRecord.first_name, studentRecord.last_name,
                    studentRecord.gender, studentRecord.college_email, studentRecord.personal_email,
                    studentRecord.phone_number, studentRecord.department_id, studentRecord.cgpa,
                    studentRecord.tenth_percentage, studentRecord.twelfth_percentage,
                    studentRecord.active_backlogs, studentRecord.graduation_year,
                    studentRecord.github_url, studentRecord.linkedin_url, studentRecord.resume_storage_url,
                    studentRecord.placement_status
                ]
            );

            // Insert Technical Skills if provided
            if (skills) {
                const skillList = Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim()).filter(Boolean);
                for (const sk of skillList) {
                    await db.query(
                        'INSERT INTO student_skills (student_id, skill_name, proficiency_level) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE proficiency_level = proficiency_level',
                        [student_id, sk, 'Intermediate']
                    );
                }
            }
        }

        // Also update memory mock store
        db.mockData.students.unshift(studentRecord);
        if (skills) {
            const skillList = Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim()).filter(Boolean);
            skillList.forEach(sk => {
                db.mockData.student_skills.push({
                    student_id,
                    skill_name: sk,
                    proficiency_level: 'Intermediate'
                });
            });
        }

        res.status(201).json({
            success: true,
            message: `Student registered successfully! Your Student ID is ${student_id} and login password is ${cleanUsn}.`,
            student: studentRecord
        });
    } catch (err) {
        console.error('Registration Error:', err);
        res.status(500).json({ error: err.sqlMessage || err.message });
    }
};

// ----------------------------------------------------------------------------
// Company Registration
// ----------------------------------------------------------------------------
exports.registerCompany = async (req, res) => {
    try {
        const {
            company_name,
            industry_domain,
            headquarters,
            website_url,
            hr_contact_name,
            hr_email,
            hr_phone,
            tier_category,
            password
        } = req.body;

        if (!company_name || !industry_domain || !hr_contact_name || !hr_email) {
            return res.status(400).json({ error: 'Company Name, Industry Domain, HR Contact Name, and HR Email are required.' });
        }

        // Generate company_id like CMP-AMZN-07
        const acronym = company_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 4) || 'CORP';
        const randNum = Math.floor(10 + Math.random() * 89);
        const company_id = `CMP-${acronym}-${randNum}`;

        const companyRecord = {
            company_id,
            company_name: company_name.trim(),
            industry_domain: industry_domain.trim(),
            headquarters: (headquarters || 'Bangalore, India').trim(),
            website_url: (website_url || `https://${company_name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`).trim(),
            hr_contact_name: hr_contact_name.trim(),
            hr_email: hr_email.trim().toLowerCase(),
            hr_phone: (hr_phone || '+91-80-49001234').trim(),
            tier_category: tier_category || 'Tier-1 (Super Dream)'
        };

        // Save password
        const userPwd = (password || company_id).trim();
        registeredPasswords.companies[company_id.toLowerCase()] = userPwd;
        registeredPasswords.companies[companyRecord.company_name.toLowerCase()] = userPwd;

        if (db.isLive) {
            const existing = await db.query('SELECT company_id FROM companies WHERE company_name = ?', [companyRecord.company_name]);
            if (existing && existing.length > 0) {
                return res.status(400).json({ error: `Company "${companyRecord.company_name}" is already registered.` });
            }

            await db.query(
                `INSERT INTO companies (company_id, company_name, industry_domain, headquarters, website_url, hr_contact_name, hr_email, hr_phone, tier_category)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    companyRecord.company_id, companyRecord.company_name, companyRecord.industry_domain,
                    companyRecord.headquarters, companyRecord.website_url, companyRecord.hr_contact_name,
                    companyRecord.hr_email, companyRecord.hr_phone, companyRecord.tier_category
                ]
            );
        }

        // Update memory mock store
        db.mockData.companies.unshift(companyRecord);

        res.status(201).json({
            success: true,
            message: `Company registered successfully! Company ID is ${company_id}.`,
            company: companyRecord
        });
    } catch (err) {
        console.error('Company Registration Error:', err);
        res.status(500).json({ error: err.sqlMessage || err.message });
    }
};

// ----------------------------------------------------------------------------
// Unified Authentication Verify Endpoint
// ----------------------------------------------------------------------------
exports.verifyLogin = async (req, res) => {
    try {
        const { role, identifier, password } = req.body;

        if (!role || !identifier) {
            return res.status(400).json({ error: 'Role and ID/Email/USN are required.' });
        }

        const idClean = identifier.trim().toLowerCase();
        const pwdClean = (password || '').trim().toLowerCase();

        if (role === 'student') {
            let student = null;
            if (db.isLive) {
                const rows = await db.query('SELECT * FROM students WHERE LOWER(usn) = ? OR LOWER(student_id) = ?', [idClean, idClean]);
                student = rows && rows[0];
            } else {
                student = db.mockData.students.find(s => s.usn.toLowerCase() === idClean || s.student_id.toLowerCase() === idClean);
            }

            if (!student) {
                return res.status(404).json({ error: `Student with USN / ID "${identifier}" not found.` });
            }

            // Check password: match USN, student_id, or custom registered password
            const customPwd = registeredPasswords.students[student.usn.toLowerCase()] || registeredPasswords.students[student.student_id.toLowerCase()];
            const valid = pwdClean === student.usn.toLowerCase() || 
                          pwdClean === student.student_id.toLowerCase() || 
                          (customPwd && pwdClean === customPwd.toLowerCase());

            if (!valid) {
                return res.status(401).json({ error: `Invalid password for student ${student.first_name}! Password must match your USN (${student.usn}) or registered password.` });
            }

            return res.json({
                success: true,
                user: {
                    role: 'student',
                    id: student.student_id,
                    usn: student.usn,
                    name: `${student.first_name} ${student.last_name}`,
                    dept: student.department_id,
                    cgpa: student.cgpa
                }
            });
        }

        if (role === 'company') {
            let company = null;
            if (db.isLive) {
                const rows = await db.query('SELECT * FROM companies WHERE LOWER(company_id) = ? OR LOWER(company_name) LIKE ?', [idClean, `%${idClean}%`]);
                company = rows && rows[0];
            } else {
                company = db.mockData.companies.find(c => c.company_id.toLowerCase() === idClean || c.company_name.toLowerCase().includes(idClean));
            }

            if (!company) {
                return res.status(404).json({ error: `Recruiting Company "${identifier}" not found.` });
            }

            // Check password: match company_id, short name, registered password, or standard 'admin123'/'comp123'
            const customPwd = registeredPasswords.companies[company.company_id.toLowerCase()] || registeredPasswords.companies[company.company_name.toLowerCase()];
            const shortName = company.company_name.split(' ')[0].toLowerCase();
            
            const valid = !pwdClean || // if left empty in demo mode or matches
                          pwdClean === company.company_id.toLowerCase() ||
                          pwdClean === shortName ||
                          pwdClean === 'comp123' ||
                          pwdClean === 'admin123' ||
                          (customPwd && pwdClean === customPwd.toLowerCase());

            if (!valid) {
                return res.status(401).json({ error: `Invalid company password. Enter the Company ID (${company.company_id}) or company name keyword (e.g. "${shortName}").` });
            }

            return res.json({
                success: true,
                user: {
                    role: 'company',
                    id: company.company_id,
                    name: company.company_name,
                    tier: company.tier_category
                }
            });
        }

        if (role === 'tpo') {
            // Check password: 'admin123', 'tpo123', 'rvce2024', or 'TPO-EMP-101'
            const valid = !pwdClean ||
                          pwdClean === 'admin123' ||
                          pwdClean === 'tpo123' ||
                          pwdClean === 'rvce2024' ||
                          pwdClean === 'tpo-emp-101' ||
                          pwdClean === 'admin';

            if (!valid) {
                return res.status(401).json({ error: 'Invalid Administrator password. Default password is "admin123".' });
            }

            let officer = null;
            if (db.isLive) {
                const rows = await db.query('SELECT * FROM placement_officers LIMIT 1');
                officer = rows && rows[0];
            } else {
                officer = db.mockData.placement_officers[0];
            }

            officer = officer || { officer_id: 'TPO-EMP-101', officer_name: 'Prof. Arvind Kulkarni', designation: 'Dean - Placements' };

            return res.json({
                success: true,
                user: {
                    role: 'tpo',
                    id: officer.officer_id,
                    name: officer.officer_name,
                    designation: officer.designation
                }
            });
        }

        res.status(400).json({ error: 'Unknown role' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
