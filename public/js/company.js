// Company Portal Logic
const CompanyPortal = {
    companyId: null,
    companyData: null,
    jobsList: [],
    selectedJobId: null,
    applicantsList: [],

    async init(companyId) {
        this.companyId = companyId;
        await this.loadProfile();
        this.bindEvents();
    },

    async loadProfile() {
        try {
            const res = await fetch(`/api/company/profile/${this.companyId}`);
            const data = await res.json();
            this.companyData = data.company;
            this.jobsList = data.jobs || [];

            this.renderProfile();
            this.renderJobs();
            this.populateJobSelectors();
        } catch (err) {
            console.error('Failed to load company profile', err);
        }
    },

    renderProfile() {
        const c = this.companyData;
        if (!c) return;

        document.getElementById('compBannerName').textContent = c.company_name;
        document.getElementById('compBannerDomain').textContent = c.industry_domain;
        document.getElementById('compBannerTier').textContent = c.tier_category;
        document.getElementById('compBannerHq').textContent = `HQ: ${c.headquarters}`;
        document.getElementById('compBannerHr').textContent = `HR Lead: ${c.hr_contact_name} (${c.hr_email})`;
    },

    renderJobs() {
        const container = document.getElementById('compJobsContainer');
        if (!container) return;

        if (this.jobsList.length === 0) {
            container.innerHTML = '<p class="text-slate-400 text-center py-10 col-span-full">No placement drives posted yet.</p>';
            return;
        }

        container.innerHTML = this.jobsList.map(j => `
            <div class="glass-panel card-hover rounded-2xl p-6 border border-slate-800 flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-start mb-3">
                        <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            ${j.drive_status}
                        </span>
                        <span class="text-xl font-bold text-emerald-400">₹${parseFloat(j.ctc_annual_lpa).toFixed(1)} LPA</span>
                    </div>
                    <h3 class="text-lg font-bold text-white mb-1">${j.job_title}</h3>
                    <p class="text-xs text-slate-400 mb-3">${j.job_location}</p>

                    <div class="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-800 mb-4">
                        <div><span class="text-slate-400">Cutoff CGPA:</span> <strong class="text-slate-200">${j.min_cgpa_cutoff}</strong></div>
                        <div><span class="text-slate-400">Max Backlogs:</span> <strong class="text-slate-200">${j.max_backlogs_allowed}</strong></div>
                        <div><span class="text-slate-400">Drive Date:</span> <span class="text-slate-200">${j.drive_date}</span></div>
                        <div><span class="text-slate-400">Applicants:</span> <strong class="text-indigo-400 font-bold">${j.total_applicants}</strong></div>
                    </div>
                </div>

                <div class="flex gap-2">
                    <button onclick="CompanyPortal.selectJobForApplicants('${j.job_id}')" class="flex-1 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-lg shadow-indigo-600/30">
                        View Applicants (${j.total_applicants})
                    </button>
                    <button onclick="CompanyPortal.selectJobForRounds('${j.job_id}')" class="py-2 px-3 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition">
                        Rounds
                    </button>
                </div>
            </div>
        `).join('');
    },

    populateJobSelectors() {
        const appSelect = document.getElementById('applicantJobSelect');
        const roundSelect = document.getElementById('roundsJobSelect');
        const offerJobSelect = document.getElementById('offerJobSelect');

        const options = this.jobsList.map(j => `<option value="${j.job_id}">${j.job_title} (${j.job_id})</option>`).join('');

        if (appSelect) {
            appSelect.innerHTML = options;
            if (this.jobsList.length > 0 && !this.selectedJobId) {
                this.selectedJobId = this.jobsList[0].job_id;
                this.loadApplicants(this.selectedJobId);
            }
        }
        if (roundSelect) roundSelect.innerHTML = options;
        if (offerJobSelect) offerJobSelect.innerHTML = options;
    },

    selectJobForApplicants(jobId) {
        this.selectedJobId = jobId;
        const appSelect = document.getElementById('applicantJobSelect');
        if (appSelect) appSelect.value = jobId;
        App.switchTab('company', 'applicants');
        this.loadApplicants(jobId);
    },

    selectJobForRounds(jobId) {
        const roundSelect = document.getElementById('roundsJobSelect');
        if (roundSelect) roundSelect.value = jobId;
        App.switchTab('company', 'rounds');
        this.loadRoundsForJob(jobId);
    },

    async loadApplicants(jobId) {
        try {
            const res = await fetch(`/api/company/jobs/${jobId}/applicants`);
            const data = await res.json();
            this.applicantsList = data.applicants || [];
            this.renderApplicants();
            this.populateOfferApplicants();

            const studentSelect = document.getElementById('gradeStudentSelect');
            if (studentSelect && this.applicantsList.length > 0) {
                studentSelect.innerHTML = this.applicantsList.map(a => `<option value="${a.student_id}">${a.first_name} ${a.last_name} (${a.usn})</option>`).join('');
            }
        } catch (err) {
            console.error('Failed to load applicants', err);
        }
    },

    renderApplicants() {
        const tbody = document.getElementById('applicantsTableBody');
        if (!tbody) return;

        if (this.applicantsList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-400">No students applied for this drive yet.</td></tr>';
            return;
        }

        const statusBadges = {
            'Applied': 'bg-sky-500/20 text-sky-300 border-sky-500/30',
            'Shortlisted': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
            'In-Process': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
            'Selected': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
            'Rejected': 'bg-rose-500/20 text-rose-300 border-rose-500/30'
        };

        tbody.innerHTML = this.applicantsList.map(a => `
            <tr class="border-b border-slate-800/60 hover:bg-slate-800/30 text-xs">
                <td class="py-3 px-4">
                    <span class="font-bold text-slate-100">${a.first_name} ${a.last_name}</span>
                    <span class="text-slate-400 block">${a.usn}</span>
                </td>
                <td class="py-3 px-4 font-semibold text-indigo-300">${a.department_code}</td>
                <td class="py-3 px-4">
                    <span class="font-bold text-emerald-400">${a.cgpa}</span>
                    <span class="text-slate-500 text-[10px] block">Backlogs: ${a.active_backlogs}</span>
                </td>
                <td class="py-3 px-4 max-w-xs truncate text-slate-300" title="${a.skills || 'None'}">
                    ${a.skills || '<span class="text-slate-500">None</span>'}
                </td>
                <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded-full font-semibold border ${statusBadges[a.current_status] || statusBadges.Applied}">
                        ${a.current_status}
                    </span>
                </td>
                <td class="py-3 px-4 flex items-center space-x-2">
                    <select onchange="CompanyPortal.updateStatus('${a.application_id}', this.value)" class="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs">
                        <option value="Applied" ${a.current_status === 'Applied' ? 'selected' : ''}>Applied</option>
                        <option value="Shortlisted" ${a.current_status === 'Shortlisted' ? 'selected' : ''}>Shortlist</option>
                        <option value="In-Process" ${a.current_status === 'In-Process' ? 'selected' : ''}>In-Process</option>
                        <option value="Selected" ${a.current_status === 'Selected' ? 'selected' : ''}>Selected</option>
                        <option value="Rejected" ${a.current_status === 'Rejected' ? 'selected' : ''}>Reject</option>
                    </select>
                    <button onclick="StudentPortal.openResume('${a.student_id}')" class="px-2 py-1 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded border border-indigo-500/40 font-semibold text-[11px] transition" title="Inspect Candidate Auto-Generated Resume">
                        📄 Resume
                    </button>
                </td>
            </tr>
        `).join('');
    },

    async updateStatus(applicationId, newStatus) {
        try {
            const res = await fetch('/api/company/applicants/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ application_id: applicationId, status: newStatus })
            });
            const data = await res.json();
            if (data.success) {
                App.notify(data.message, 'success');
                if (this.selectedJobId) await this.loadApplicants(this.selectedJobId);
            }
        } catch (err) {
            App.notify(err.message, 'error');
        }
    },

    async postJob(e) {
        e.preventDefault();
        const job_title = document.getElementById('postJobTitle').value;
        const job_description = document.getElementById('postJobDesc').value;
        const job_role_type = document.getElementById('postJobType').value;
        const ctc_annual_lpa = document.getElementById('postJobCtc').value;
        const min_cgpa_cutoff = document.getElementById('postJobMinCgpa').value;
        const max_backlogs_allowed = document.getElementById('postJobMaxBacklogs').value;
        const job_location = document.getElementById('postJobLocation').value;
        const drive_date = document.getElementById('postJobDate').value;
        const registration_deadline = document.getElementById('postJobDeadline').value;

        // Checkboxes for eligible departments
        const checkboxes = document.querySelectorAll('input[name="eligibleDepts"]:checked');
        const eligible_departments = Array.from(checkboxes).map(cb => cb.value);

        if (eligible_departments.length === 0) {
            App.notify('Please select at least one eligible academic department', 'warning');
            return;
        }

        try {
            const res = await fetch('/api/company/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    company_id: this.companyId,
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
                })
            });
            const data = await res.json();
            if (data.success) {
                App.notify(data.message, 'success');
                e.target.reset();
                await this.loadProfile();
                App.switchTab('company', 'drives');
            } else {
                App.notify(data.error, 'error');
            }
        } catch (err) {
            App.notify(err.message, 'error');
        }
    },

    async loadRoundsForJob(jobId) {
        const container = document.getElementById('roundsListContainer');
        if (!container) return;

        // Fetch drive details from student apps or company API
        const job = this.jobsList.find(j => j.job_id === jobId);
        if (!job) return;

        // Populate student dropdown in grading form
        const studentSelect = document.getElementById('gradeStudentSelect');
        if (studentSelect) {
            const apps = this.applicantsList;
            studentSelect.innerHTML = apps.map(a => `<option value="${a.student_id}">${a.first_name} ${a.last_name} (${a.usn})</option>`).join('');
        }
    },

    async createRound(e) {
        e.preventDefault();
        const job_id = document.getElementById('roundsJobSelect').value;
        const round_type = document.getElementById('roundTypeName').value;
        const scheduled_timestamp = document.getElementById('roundTimestamp').value;
        const platform_or_venue = document.getElementById('roundVenue').value;

        try {
            const res = await fetch('/api/company/rounds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ job_id, round_type, scheduled_timestamp, platform_or_venue })
            });
            const data = await res.json();
            if (data.success) {
                App.notify(data.message, 'success');
                e.target.reset();
            } else {
                App.notify(data.error, 'error');
            }
        } catch (err) {
            App.notify(err.message, 'error');
        }
    },

    async submitEvaluation(e) {
        e.preventDefault();
        const round_id = document.getElementById('gradeRoundSelect').value;
        const student_id = document.getElementById('gradeStudentSelect').value;
        const round_status = document.getElementById('gradeStatusSelect').value;
        const evaluation_score = document.getElementById('gradeScore').value;
        const interviewer_remarks = document.getElementById('gradeRemarks').value;

        try {
            const res = await fetch('/api/company/rounds/results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ round_id, student_id, round_status, evaluation_score, interviewer_remarks })
            });
            const data = await res.json();
            if (data.success) {
                App.notify(data.message, 'success');
                e.target.reset();
                if (this.selectedJobId) await this.loadApplicants(this.selectedJobId);
            } else {
                App.notify(data.error, 'error');
            }
        } catch (err) {
            App.notify(err.message, 'error');
        }
    },

    populateOfferApplicants() {
        const select = document.getElementById('offerApplicationSelect');
        if (!select) return;

        select.innerHTML = this.applicantsList
            .filter(a => a.current_status !== 'Rejected')
            .map(a => `<option value="${a.application_id}">${a.first_name} ${a.last_name} (${a.usn}) - Status: ${a.current_status}</option>`)
            .join('');
    },

    async submitOffer(e) {
        e.preventDefault();
        const application_id = document.getElementById('offerApplicationSelect').value;
        const offered_ctc_lpa = document.getElementById('offerCtc').value;
        const base_salary_lpa = document.getElementById('offerBaseSalary').value;
        const joining_bonus_lpa = document.getElementById('offerBonus').value;
        const tentative_joining_date = document.getElementById('offerJoiningDate').value;

        try {
            const res = await fetch('/api/company/offers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    application_id,
                    offered_ctc_lpa,
                    base_salary_lpa,
                    joining_bonus_lpa,
                    tentative_joining_date
                })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                App.notify(data.message, 'success');
                e.target.reset();
                if (this.selectedJobId) await this.loadApplicants(this.selectedJobId);
            } else {
                // Trigger 6 violation caught!
                App.showTriggerError(data.error || 'Failed to issue offer', data.trigger || 'Salary Breakdown Constraint Trigger');
            }
        } catch (err) {
            App.notify(err.message, 'error');
        }
    },

    bindEvents() {
        document.getElementById('postJobForm')?.addEventListener('submit', (e) => this.postJob(e));
        document.getElementById('createRoundForm')?.addEventListener('submit', (e) => this.createRound(e));
        document.getElementById('gradeCandidateForm')?.addEventListener('submit', (e) => this.submitEvaluation(e));
        document.getElementById('issueOfferForm')?.addEventListener('submit', (e) => this.submitOffer(e));

        document.getElementById('applicantJobSelect')?.addEventListener('change', (e) => {
            this.selectedJobId = e.target.value;
            this.loadApplicants(e.target.value);
        });

        document.getElementById('roundsJobSelect')?.addEventListener('change', (e) => {
            this.loadRoundsForJob(e.target.value);
        });
    }
};
