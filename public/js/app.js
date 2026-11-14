// Main App State & Global Handlers
const App = {
    user: null, // { role: 'student' | 'company' | 'tpo', id, name, details }
    dbStatus: null,
    availableUsers: { students: [], companies: [], officers: [] },

    async init() {
        await this.checkDBStatus();
        await this.loadAvailableUsers();
        this.restoreSession();
        this.bindGlobalEvents();
    },

    async checkDBStatus() {
        try {
            const res = await fetch('/api/status');
            const data = await res.json();
            this.dbStatus = data;
            this.renderDBBadge();
        } catch (err) {
            console.error('Failed to get DB status', err);
        }
    },

    renderDBBadge() {
        const badge = document.getElementById('dbStatusBadge');
        if (!badge) return;
        if (this.dbStatus && this.dbStatus.isConnected) {
            badge.innerHTML = `
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <span class="w-2 h-2 mr-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                    MySQL Connected (${this.dbStatus.database})
                </span>
            `;
        } else {
            badge.innerHTML = `
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 cursor-pointer" onclick="App.openDBModal()">
                    <span class="w-2 h-2 mr-1.5 bg-amber-400 rounded-full"></span>
                    Demo Simulation Mode ⚙️
                </span>
            `;
        }
    },

    async loadAvailableUsers() {
        try {
            const res = await fetch('/api/auth/users');
            const data = await res.json();
            this.availableUsers = data;
            this.renderQuickLogins();
        } catch (err) {
            console.error('Failed to load users', err);
        }
    },

    renderQuickLogins() {
        // Populate Student quick buttons
        const stuContainer = document.getElementById('quickStudentList');
        if (stuContainer && this.availableUsers.students) {
            stuContainer.innerHTML = this.availableUsers.students.slice(0, 5).map(s => `
                <button onclick="App.selectQuickStudent('${s.usn}')" class="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white transition border border-slate-700">
                    ${s.first_name} (${s.department_id.replace('DEPT-', '')}) - ${s.cgpa} CGPA
                </button>
            `).join('');
        }

        // Populate Company quick buttons
        const compContainer = document.getElementById('quickCompanyList');
        if (compContainer && this.availableUsers.companies) {
            compContainer.innerHTML = this.availableUsers.companies.slice(0, 4).map(c => `
                <button onclick="App.quickLogin('company', '${c.company_id}')" class="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-sky-600 text-slate-200 hover:text-white transition border border-slate-700">
                    ${c.company_name.split(' ')[0]} (${c.tier_category.includes('Super') ? 'Super Dream' : c.tier_category.split(' ')[0]})
                </button>
            `).join('');
        }
    },

    selectQuickStudent(usn) {
        const uInput = document.getElementById('studentUsnInput');
        const pInput = document.getElementById('studentPasswordInput');
        if (uInput) uInput.value = usn;
        if (pInput) pInput.value = usn;
        const stu = this.availableUsers.students.find(s => s.usn.toLowerCase() === usn.toLowerCase() || s.student_id.toLowerCase() === usn.toLowerCase());
        if (stu) {
            this.quickLogin('student', stu.student_id);
        }
    },

    quickLogin(role, id) {
        if (role === 'student') {
            const stu = this.availableUsers.students.find(s => s.student_id === id || s.usn === id);
            if (!stu) return;
            this.login({
                role: 'student',
                id: stu.student_id,
                usn: stu.usn,
                name: `${stu.first_name} ${stu.last_name}`,
                dept: stu.department_id,
                cgpa: stu.cgpa
            });
        } else if (role === 'company') {
            const comp = this.availableUsers.companies.find(c => c.company_id === id);
            if (!comp) return;
            this.login({
                role: 'company',
                id: comp.company_id,
                name: comp.company_name,
                tier: comp.tier_category
            });
        } else if (role === 'tpo') {
            const off = this.availableUsers.officers[0] || { officer_id: 'TPO-EMP-101', officer_name: 'Prof. Arvind Kulkarni' };
            this.login({
                role: 'tpo',
                id: off.officer_id,
                name: off.officer_name,
                designation: off.designation
            });
        }
    },

    login(userData) {
        this.user = userData;
        localStorage.setItem('cpms_user', JSON.stringify(userData));
        this.showPortal();
    },

    logout() {
        this.user = null;
        localStorage.removeItem('cpms_user');
        document.getElementById('portalView').classList.add('hidden');
        document.getElementById('loginView').classList.remove('hidden');
        document.getElementById('activeUserBar').classList.add('hidden');
    },

    restoreSession() {
        const saved = localStorage.getItem('cpms_user');
        if (saved) {
            try {
                this.user = JSON.parse(saved);
                this.showPortal();
            } catch (e) {
                this.logout();
            }
        } else {
            // Default to student login view
            this.logout();
        }
    },

    showPortal() {
        document.getElementById('loginView').classList.add('hidden');
        document.getElementById('portalView').classList.remove('hidden');
        document.getElementById('activeUserBar').classList.remove('hidden');

        // Update active user bar
        const nameEl = document.getElementById('activeUserName');
        const roleEl = document.getElementById('activeUserRole');
        const iconEl = document.getElementById('activeUserIcon');

        if (this.user.role === 'student') {
            nameEl.textContent = `${this.user.name} (${this.user.usn || this.user.id})`;
            roleEl.textContent = `Student • ${this.user.dept ? this.user.dept.replace('DEPT-', '') : ''} • CGPA: ${this.user.cgpa || ''}`;
            iconEl.innerHTML = '🎓';
            
            document.getElementById('studentPortal').classList.remove('hidden');
            document.getElementById('companyPortal').classList.add('hidden');
            document.getElementById('tpoPortal').classList.add('hidden');

            StudentPortal.init(this.user.id);
        } else if (this.user.role === 'company') {
            nameEl.textContent = this.user.name;
            roleEl.textContent = `Recruiting Partner • ${this.user.tier || 'Tier-1'}`;
            iconEl.innerHTML = '🏢';

            document.getElementById('studentPortal').classList.add('hidden');
            document.getElementById('companyPortal').classList.remove('hidden');
            document.getElementById('tpoPortal').classList.add('hidden');

            CompanyPortal.init(this.user.id);
        } else if (this.user.role === 'tpo') {
            nameEl.textContent = this.user.name;
            roleEl.textContent = `University TPO • ${this.user.designation || 'Placement Cell'}`;
            iconEl.innerHTML = '🏛️';

            document.getElementById('studentPortal').classList.add('hidden');
            document.getElementById('companyPortal').classList.add('hidden');
            document.getElementById('tpoPortal').classList.remove('hidden');

            TPOPortal.init();
        }
    },

    switchTab(portal, tabId) {
        // Map portal identifiers to their HTML container and prefix
        const portalConfig = {
            stu: { containerId: 'studentPortal', prefix: 'stu' },
            student: { containerId: 'studentPortal', prefix: 'stu' },
            comp: { containerId: 'companyPortal', prefix: 'comp' },
            company: { containerId: 'companyPortal', prefix: 'comp' },
            tpo: { containerId: 'tpoPortal', prefix: 'tpo' }
        };

        const config = portalConfig[portal] || { containerId: `${portal}Portal`, prefix: portal };
        const container = document.getElementById(config.containerId);
        if (!container) return;

        // Update Tab Buttons styling
        container.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.dataset.tab === tabId) {
                btn.classList.add('active');
                btn.classList.remove('text-slate-400');
            } else {
                btn.classList.remove('active');
                btn.classList.add('text-slate-400');
            }
        });

        // Update Tab Contents visibility
        container.querySelectorAll('.tab-pane').forEach(pane => {
            if (pane.id === `${config.prefix}-${tabId}`) {
                pane.classList.remove('hidden');
            } else {
                pane.classList.add('hidden');
            }
        });

        // Trigger dynamic data loader on tab change so no page stays blank!
        if (config.prefix === 'stu') {
            if (tabId === 'drives') StudentPortal.loadDrives();
            else if (tabId === 'apps') StudentPortal.loadApplications();
            else if (tabId === 'offers') StudentPortal.loadOffers();
            else if (tabId === 'profile') StudentPortal.loadProfile();
        } else if (config.prefix === 'comp') {
            if (tabId === 'drives') CompanyPortal.loadProfile();
            else if (tabId === 'applicants' && CompanyPortal.selectedJobId) CompanyPortal.loadApplicants(CompanyPortal.selectedJobId);
            else if (tabId === 'rounds' && CompanyPortal.selectedJobId) CompanyPortal.loadRoundsForJob(CompanyPortal.selectedJobId);
            else if (tabId === 'offers') CompanyPortal.populateOfferApplicants();
        } else if (config.prefix === 'tpo') {
            if (tabId === 'analytics') { TPOPortal.loadAnalytics(); }
            else if (tabId === 'funnel') { TPOPortal.loadDrivesFunnel(); }
            else if (tabId === 'placed') { TPOPortal.loadPlacedStudents(); }
            else if (tabId === 'audit') { TPOPortal.loadAuditLogs(); }
            else if (tabId === 'sp') { TPOPortal.populateProcedureDrives(); TPOPortal.populateProcedureStudents(); }
        }
    },

    notify(message, type = 'success') {
        const toast = document.createElement('div');
        const colors = {
            success: 'bg-emerald-600 border-emerald-400 text-white',
            error: 'bg-rose-600 border-rose-400 text-white',
            info: 'bg-indigo-600 border-indigo-400 text-white',
            warning: 'bg-amber-600 border-amber-300 text-white'
        };

        toast.className = `fixed bottom-5 right-5 z-50 px-5 py-3 rounded-xl shadow-2xl border flex items-center space-x-3 transition-all duration-300 transform translate-y-10 opacity-0 ${colors[type] || colors.info}`;
        toast.innerHTML = `
            <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
            <div class="text-sm font-medium">${message}</div>
        `;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.remove('translate-y-10', 'opacity-0');
        }, 10);

        setTimeout(() => {
            toast.classList.add('translate-y-10', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    showTriggerError(errorMsg, triggerName) {
        const modal = document.getElementById('triggerErrorModal');
        if (!modal) return;
        document.getElementById('triggerErrorText').textContent = errorMsg;
        document.getElementById('triggerNameBadge').textContent = triggerName ? `Trigger: ${triggerName}` : 'DBMS Constraint / Trigger Gatekeeper';
        modal.classList.remove('hidden');
    },

    closeTriggerError() {
        document.getElementById('triggerErrorModal').classList.add('hidden');
    },

    openDBModal() {
        document.getElementById('dbConfigModal').classList.remove('hidden');
        if (this.dbStatus) {
            document.getElementById('dbHost').value = this.dbStatus.host || 'localhost';
            document.getElementById('dbPort').value = this.dbStatus.port || 3306;
            document.getElementById('dbUser').value = this.dbStatus.user || 'root';
            document.getElementById('dbName').value = this.dbStatus.database || 'college_placement_db';
        }
    },

    closeDBModal() {
        document.getElementById('dbConfigModal').classList.add('hidden');
    },

    async reconnectDB(e) {
        e.preventDefault();
        const host = document.getElementById('dbHost').value;
        const port = document.getElementById('dbPort').value;
        const user = document.getElementById('dbUser').value;
        const password = document.getElementById('dbPassword').value;
        const database = document.getElementById('dbName').value;

        try {
            const res = await fetch('/api/db/reconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ host, port, user, password, database })
            });
            const data = await res.json();
            this.dbStatus = data;
            this.renderDBBadge();
            this.closeDBModal();

            if (data.isConnected) {
                this.notify('Connected successfully to MySQL database!', 'success');
            } else {
                this.notify(`MySQL Connection Failed: ${data.connectionError}. Remaining in Simulation Mode.`, 'warning');
            }
        } catch (err) {
            this.notify(err.message, 'error');
        }
    },

    bindGlobalEvents() {
        // 1. Student Login Form
        document.getElementById('studentLoginForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const usn = (document.getElementById('studentUsnInput')?.value || '').trim();
            const pwd = (document.getElementById('studentPasswordInput')?.value || '').trim();

            if (!usn) {
                this.notify('Please enter your USN or Student ID', 'warning');
                return;
            }

            // Try backend login verification first
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role: 'student', identifier: usn, password: pwd })
                });
                const contentType = res.headers.get('content-type') || '';
                if (res.ok && contentType.includes('application/json')) {
                    const data = await res.json();
                    if (data.success && data.user) {
                        this.login(data.user);
                        this.notify(`Welcome, ${data.user.name}! Logged in as Student.`, 'success');
                        return;
                    }
                }
            } catch (err) {
                console.warn('Backend login check fell back to local verify', err);
            }

            // Local fallback verification
            const stu = this.availableUsers.students.find(s => 
                s.usn.toLowerCase() === usn.toLowerCase() || 
                s.student_id.toLowerCase() === usn.toLowerCase()
            );

            if (!stu) {
                this.notify(`Student with USN/ID "${usn}" not found in database. Try registering your profile!`, 'error');
                return;
            }

            // Default student password is their USN or student_id
            if (pwd && pwd.toLowerCase() !== stu.usn.toLowerCase() && pwd.toLowerCase() !== stu.student_id.toLowerCase()) {
                this.notify(`Invalid password! For students, password must match your USN (${stu.usn}) or Student ID (${stu.student_id}).`, 'error');
                return;
            }

            this.quickLogin('student', stu.student_id);
            this.notify(`Welcome, ${stu.first_name}! Logged in as Student.`, 'success');
        });

        // 2. Company Login Form with Password Verification
        document.getElementById('companyLoginForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const compId = document.getElementById('companySelect').value;
            const pwd = (document.getElementById('companyPasswordInput')?.value || '').trim();

            if (!pwd) {
                this.notify('Please enter the recruiting partner password', 'warning');
                return;
            }

            // Try backend login verification
            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role: 'company', identifier: compId, password: pwd })
                });
                const contentType = res.headers.get('content-type') || '';
                if (res.ok && contentType.includes('application/json')) {
                    const data = await res.json();
                    if (data.success && data.user) {
                        this.login(data.user);
                        this.notify(`Welcome, ${data.user.name}! Logged in as Recruiting Partner.`, 'success');
                        return;
                    } else if (data.error) {
                        this.notify(data.error, 'error');
                        return;
                    }
                }
            } catch (err) {
                console.warn('Backend company login check warning', err);
            }

            // Client-side fallback check
            const comp = this.availableUsers.companies.find(c => c.company_id === compId);
            const shortName = comp ? comp.company_name.split(' ')[0].toLowerCase() : '';
            const valid = !pwd || pwd.toLowerCase() === compId.toLowerCase() || pwd.toLowerCase() === shortName || pwd.toLowerCase() === 'comp123' || pwd.toLowerCase() === 'admin123';

            if (!valid) {
                this.notify(`Invalid company password! Default is Company ID (${compId}) or company name keyword (e.g. "${shortName}").`, 'error');
                return;
            }

            this.quickLogin('company', compId);
            this.notify(`Welcome! Logged in as ${comp ? comp.company_name : 'Recruiting Partner'}.`, 'success');
        });

        // 3. TPO Login Form with Password Verification
        document.getElementById('tpoLoginForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const pwd = (document.getElementById('tpoPasswordInput')?.value || '').trim();

            if (!pwd) {
                this.notify('Please enter the administrator password', 'warning');
                return;
            }

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ role: 'tpo', identifier: 'TPO-EMP-101', password: pwd })
                });
                const contentType = res.headers.get('content-type') || '';
                if (res.ok && contentType.includes('application/json')) {
                    const data = await res.json();
                    if (data.success && data.user) {
                        this.login(data.user);
                        this.notify('Access Granted: University TPO Administration Portal', 'success');
                        return;
                    } else if (data.error) {
                        this.notify(data.error, 'error');
                        return;
                    }
                }
            } catch (err) {
                console.warn('Backend TPO login check warning', err);
            }

            // Fallback check
            const valid = pwd === 'admin123' || pwd === 'tpo123' || pwd === 'rvce2024' || pwd.toUpperCase() === 'TPO-EMP-101' || pwd === 'admin';
            if (!valid) {
                this.notify('Invalid Administrator password. Default password is "admin123".', 'error');
                return;
            }

            this.quickLogin('tpo');
            this.notify('Access Granted: University TPO Administration Portal', 'success');
        });

        // 4. Student Registration Form Submission (Persists to Database)
        document.getElementById('studentRegistrationForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const first_name = document.getElementById('regStuFirstName').value;
            const last_name = document.getElementById('regStuLastName').value;
            const usn = document.getElementById('regStuUsn').value;
            const gender = document.getElementById('regStuGender').value;
            const department_id = document.getElementById('regStuDept').value;
            const graduation_year = document.getElementById('regStuGradYear').value;
            const college_email = document.getElementById('regStuCollegeEmail').value;
            const personal_email = document.getElementById('regStuPersonalEmail').value;
            const phone_number = document.getElementById('regStuPhone').value;
            const cgpa = document.getElementById('regStuCgpa').value;
            const tenth_percentage = document.getElementById('regStuTenth').value;
            const twelfth_percentage = document.getElementById('regStuTwelfth').value;
            const active_backlogs = document.getElementById('regStuBacklogs').value;
            const password = document.getElementById('regStuPassword').value;
            const skills = document.getElementById('regStuSkills').value;
            const github_url = document.getElementById('regStuGithub').value;
            const linkedin_url = document.getElementById('regStuLinkedin').value;

            try {
                const res = await fetch('/api/auth/register/student', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        first_name, last_name, usn, gender, department_id, graduation_year,
                        college_email, personal_email, phone_number, cgpa, tenth_percentage,
                        twelfth_percentage, active_backlogs, password, skills, github_url, linkedin_url
                    })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    this.notify(data.message || 'Student registration successful!', 'success');
                    
                    // Add to availableUsers list
                    const newStu = data.student;
                    this.availableUsers.students.unshift({
                        student_id: newStu.student_id,
                        usn: newStu.usn,
                        first_name: newStu.first_name,
                        last_name: newStu.last_name,
                        department_id: newStu.department_id,
                        cgpa: newStu.cgpa,
                        placement_status: newStu.placement_status
                    });
                    this.renderQuickLogins();

                    // Auto login new student
                    this.login({
                        role: 'student',
                        id: newStu.student_id,
                        usn: newStu.usn,
                        name: `${newStu.first_name} ${newStu.last_name}`,
                        dept: newStu.department_id,
                        cgpa: newStu.cgpa
                    });
                } else {
                    this.notify(data.error || 'Failed to register student record', 'error');
                }
            } catch (err) {
                this.notify(err.message, 'error');
            }
        });

        // 5. Company Registration Form Submission (Persists to Database)
        document.getElementById('companyRegistrationForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const company_name = document.getElementById('regCompName').value;
            const industry_domain = document.getElementById('regCompDomain').value;
            const tier_category = document.getElementById('regCompTier').value;
            const headquarters = document.getElementById('regCompHq').value;
            const website_url = document.getElementById('regCompWebsite').value;
            const password = document.getElementById('regCompPassword').value;
            const hr_contact_name = document.getElementById('regCompHrName').value;
            const hr_email = document.getElementById('regCompHrEmail').value;
            const hr_phone = document.getElementById('regCompHrPhone').value;

            try {
                const res = await fetch('/api/auth/register/company', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        company_name, industry_domain, tier_category, headquarters,
                        website_url, password, hr_contact_name, hr_email, hr_phone
                    })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    this.notify(data.message || 'Company registration successful!', 'success');
                    
                    const newComp = data.company;
                    this.availableUsers.companies.unshift({
                        company_id: newComp.company_id,
                        company_name: newComp.company_name,
                        tier_category: newComp.tier_category,
                        hr_contact_name: newComp.hr_contact_name
                    });
                    this.renderQuickLogins();

                    // Update company select dropdown
                    const sel = document.getElementById('companySelect');
                    if (sel) {
                        const opt = document.createElement('option');
                        opt.value = newComp.company_id;
                        opt.textContent = `${newComp.company_name} (${newComp.tier_category})`;
                        sel.prepend(opt);
                        sel.value = newComp.company_id;
                    }

                    // Auto login as company
                    this.login({
                        role: 'company',
                        id: newComp.company_id,
                        name: newComp.company_name,
                        tier: newComp.tier_category
                    });
                } else {
                    this.notify(data.error || 'Failed to register company record', 'error');
                }
            } catch (err) {
                this.notify(err.message, 'error');
            }
        });
    }
};

window.addEventListener('DOMContentLoaded', () => {
    App.init();
});
