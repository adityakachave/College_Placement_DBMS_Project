// TPO Portal Logic
const TPOPortal = {
    analyticsData: null,
    deptChart: null,
    tierChart: null,
    genderChart: null,

    async init() {
        await this.loadAnalytics();
        await this.loadPlacedStudents();
        await this.loadDrivesFunnel();
        await this.loadAuditLogs();
        this.populateProcedureDrives();
        this.populateProcedureStudents();
    },

    async loadAnalytics() {
        try {
            const res = await fetch('/api/tpo/analytics');
            const data = await res.json();
            this.analyticsData = data;

            this.renderMetrics();
            this.renderDeptTable();
            this.renderCharts();
        } catch (err) {
            console.error('Failed to load TPO analytics', err);
        }
    },

    renderMetrics() {
        const { stats } = this.analyticsData;
        if (!stats) return;

        const elEnrolled = document.getElementById('tpoTotalEnrolled');
        if (elEnrolled) elEnrolled.textContent = stats.total_students || 0;

        const elPlaced = document.getElementById('tpoTotalPlaced');
        if (elPlaced) elPlaced.textContent = stats.placed_count || 0;
        
        const rate = stats.total_students ? ((stats.placed_count / stats.total_students) * 100).toFixed(1) : 0;
        const elRate = document.getElementById('tpoPlacementRate');
        if (elRate) elRate.textContent = `${rate}%`;
        
        const elHigh = document.getElementById('tpoHighestCtc');
        if (elHigh) elHigh.textContent = `₹${parseFloat(stats.highest_ctc || 0).toFixed(1)} LPA`;

        const elAvg = document.getElementById('tpoAvgCtc');
        if (elAvg) elAvg.textContent = `₹${parseFloat(stats.avg_ctc || 0).toFixed(1)} LPA`;

        const elHigher = document.getElementById('tpoHigherStudies');
        if (elHigher) elHigher.textContent = stats.higher_studies_count || 0;
    },

    renderDeptTable() {
        const tbody = document.getElementById('deptPlacementTableBody');
        if (!tbody) return;

        const { deptStats } = this.analyticsData;
        if (!deptStats || deptStats.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-6 text-slate-400">No data found in View vw_department_placement_stats</td></tr>';
            return;
        }

        tbody.innerHTML = deptStats.map(d => `
            <tr class="border-b border-slate-800/60 hover:bg-slate-800/30 text-xs">
                <td class="py-3 px-4 font-bold text-white">${d.department_name} (${d.department_code})</td>
                <td class="py-3 px-4 text-center font-semibold text-slate-300">${d.total_enrolled}</td>
                <td class="py-3 px-4 text-center font-bold text-emerald-400">${d.total_placed}</td>
                <td class="py-3 px-4 text-center font-bold text-indigo-400">${d.placement_percentage}%</td>
                <td class="py-3 px-4 text-right font-black text-purple-400">₹${parseFloat(d.highest_package_lpa).toFixed(1)} LPA</td>
                <td class="py-3 px-4 text-right font-bold text-sky-400">₹${parseFloat(d.average_package_lpa).toFixed(1)} LPA</td>
            </tr>
        `).join('');
    },

    renderCharts() {
        if (typeof Chart === 'undefined') return;

        const { deptStats, tierStats, genderStats } = this.analyticsData;

        // 1. Department Placement Rates Bar Chart
        const deptCanvas = document.getElementById('deptBarChart');
        if (deptCanvas && deptStats) {
            if (this.deptChart) this.deptChart.destroy();
            this.deptChart = new Chart(deptCanvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: deptStats.map(d => d.department_code),
                    datasets: [
                        {
                            label: 'Placement %',
                            data: deptStats.map(d => parseFloat(d.placement_percentage)),
                            backgroundColor: 'rgba(99, 102, 241, 0.7)',
                            borderColor: '#6366f1',
                            borderWidth: 1,
                            borderRadius: 6
                        },
                        {
                            label: 'Average Package (LPA)',
                            data: deptStats.map(d => parseFloat(d.average_package_lpa)),
                            backgroundColor: 'rgba(16, 185, 129, 0.7)',
                            borderColor: '#10b981',
                            borderWidth: 1,
                            borderRadius: 6
                        }
                    ]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { labels: { color: '#cbd5e1', font: { size: 11 } } }
                    },
                    scales: {
                        x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
                        y: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } }
                    }
                }
            });
        }

        // 2. Tier Distribution Doughnut Chart
        const tierCanvas = document.getElementById('tierPieChart');
        if (tierCanvas && tierStats) {
            if (this.tierChart) this.tierChart.destroy();
            this.tierChart = new Chart(tierCanvas.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: tierStats.map(t => t.tier_category.split(' ')[0]),
                    datasets: [{
                        data: tierStats.map(t => t.offers_count),
                        backgroundColor: ['#a855f7', '#38bdf8', '#34d399']
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#cbd5e1' } }
                    }
                }
            });
        }

        // 3. Gender Distribution Pie Chart
        const genderCanvas = document.getElementById('genderPieChart');
        if (genderCanvas && genderStats) {
            if (this.genderChart) this.genderChart.destroy();
            this.genderChart = new Chart(genderCanvas.getContext('2d'), {
                type: 'pie',
                data: {
                    labels: genderStats.map(g => g.gender),
                    datasets: [{
                        data: genderStats.map(g => g.placed),
                        backgroundColor: ['#3b82f6', '#ec4899']
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#cbd5e1' } }
                    }
                }
            });
        }
    },

    async loadPlacedStudents() {
        try {
            const res = await fetch('/api/tpo/placed-students');
            const data = await res.json();
            const tbody = document.getElementById('placedStudentsTableBody');
            if (!tbody) return;

            const list = data.placedStudents || [];
            if (list.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-slate-400">No placed students yet.</td></tr>';
                return;
            }

            tbody.innerHTML = list.map(s => `
                <tr class="border-b border-slate-800/60 hover:bg-slate-800/30 text-xs">
                    <td class="py-3 px-4 font-bold text-white">${s.student_name}</td>
                    <td class="py-3 px-4 text-slate-300 font-mono">${s.usn}</td>
                    <td class="py-3 px-4 font-semibold text-indigo-300">${s.department_code}</td>
                    <td class="py-3 px-4 font-bold text-slate-100">${s.company_name}</td>
                    <td class="py-3 px-4 text-slate-300">${s.job_title}</td>
                    <td class="py-3 px-4 font-black text-emerald-400">₹${parseFloat(s.offered_ctc_lpa).toFixed(2)} LPA</td>
                    <td class="py-3 px-4 text-slate-400">${s.tentative_joining_date}</td>
                    <td class="py-3 px-4">
                        <button onclick="StudentPortal.openResume('${s.student_id}')" class="px-2.5 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 text-[11px] font-semibold transition" title="Inspect Candidate Auto-Generated Resume">
                            📄 Resume
                        </button>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Failed to load placed students', err);
        }
    },

    async loadDrivesFunnel() {
        try {
            const res = await fetch('/api/tpo/drives-status');
            const data = await res.json();
            const tbody = document.getElementById('drivesFunnelTableBody');
            if (!tbody) return;

            const drives = data.drives || [];
            tbody.innerHTML = drives.map(d => `
                <tr class="border-b border-slate-800/60 hover:bg-slate-800/30 text-xs">
                    <td class="py-3 px-4 font-bold text-white">${d.company_name}</td>
                    <td class="py-3 px-4 text-indigo-300 font-medium">${d.job_title}</td>
                    <td class="py-3 px-4 font-semibold text-slate-300">₹${parseFloat(d.ctc_annual_lpa).toFixed(1)} LPA</td>
                    <td class="py-3 px-4 text-center font-bold text-sky-400">${d.total_registered}</td>
                    <td class="py-3 px-4 text-center font-bold text-emerald-400">${d.total_selected}</td>
                    <td class="py-3 px-4 text-center font-bold text-purple-300">
                        ${d.total_registered > 0 ? ((d.total_selected / d.total_registered) * 100).toFixed(1) + '%' : '0.0%'}
                    </td>
                    <td class="py-3 px-4">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 border border-slate-700 text-slate-300">
                            ${d.drive_status}
                        </span>
                    </td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Failed to load funnel', err);
        }
    },

    async loadAuditLogs() {
        try {
            const res = await fetch('/api/tpo/audit-logs');
            const data = await res.json();
            const tbody = document.getElementById('auditLogsTableBody');
            if (!tbody) return;

            const logs = data.logs || [];
            if (logs.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-slate-400">No trigger audit log records yet. Modify an offer to see Trigger 4 in action!</td></tr>';
                return;
            }

            tbody.innerHTML = logs.map(l => `
                <tr class="border-b border-slate-800/60 hover:bg-slate-800/30 text-xs font-mono">
                    <td class="py-2.5 px-4 text-slate-400">#${l.log_id}</td>
                    <td class="py-2.5 px-4 font-bold text-indigo-300">${l.offer_id}</td>
                    <td class="py-2.5 px-4 text-slate-300">${l.student_id}</td>
                    <td class="py-2.5 px-4 text-rose-400">₹${parseFloat(l.old_ctc_lpa || 0).toFixed(1)} LPA (${l.old_status})</td>
                    <td class="py-2.5 px-4 text-emerald-400">₹${parseFloat(l.new_ctc_lpa || 0).toFixed(1)} LPA (${l.new_status})</td>
                    <td class="py-2.5 px-4 text-slate-300">${l.changed_by}</td>
                    <td class="py-2.5 px-4 text-slate-400">${l.changed_at}</td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Failed to load audit logs', err);
        }
    },

    async populateProcedureDrives() {
        try {
            const res = await fetch('/api/tpo/drives-status');
            const data = await res.json();
            const select = document.getElementById('spJobSelect');
            if (select && data.drives) {
                select.innerHTML = data.drives.map(d => `<option value="${d.job_id}">${d.company_name} - ${d.job_title} (${d.job_id})</option>`).join('');
            }
        } catch (e) {}
    },

    async populateProcedureStudents() {
        const select = document.getElementById('spStudentSelect');
        if (select && App.availableUsers.students) {
            select.innerHTML = App.availableUsers.students.map(s => `<option value="${s.usn}">${s.first_name} ${s.last_name} (${s.usn})</option>`).join('');
        }
    },

    async runEligibleStudentsProcedure() {
        const jobId = document.getElementById('spJobSelect').value;
        const resultContainer = document.getElementById('spResultContainer');
        resultContainer.innerHTML = '<div class="py-6 text-center text-slate-400"><div class="spinner mx-auto mb-2"></div>Executing CALL sp_GetEligibleStudentsForJob...</div>';

        try {
            const res = await fetch('/api/tpo/procedures/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ procedure_name: 'sp_GetEligibleStudentsForJob', param: jobId })
            });
            const data = await res.json();

            if (data.success) {
                const list = data.results || [];
                resultContainer.innerHTML = `
                    <div class="mb-3 flex justify-between items-center text-xs">
                        <span class="text-emerald-400 font-bold">✓ Returned ${list.length} eligible candidates</span>
                        <span class="text-slate-400">Execution time: ${data.executionTimeMs} ms</span>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs">
                            <thead class="bg-slate-900 text-slate-300 border-b border-slate-700">
                                <tr>
                                    <th class="py-2.5 px-3">Student Name</th>
                                    <th class="py-2.5 px-3">USN</th>
                                    <th class="py-2.5 px-3">Branch</th>
                                    <th class="py-2.5 px-3">CGPA</th>
                                    <th class="py-2.5 px-3">Backlogs</th>
                                    <th class="py-2.5 px-3">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${list.map(s => `
                                    <tr class="border-b border-slate-800 hover:bg-slate-800/40">
                                        <td class="py-2 px-3 font-semibold text-white">${s.full_name}</td>
                                        <td class="py-2 px-3 text-slate-300 font-mono">${s.usn}</td>
                                        <td class="py-2 px-3 text-indigo-400 font-bold">${s.department_code}</td>
                                        <td class="py-2 px-3 font-bold text-emerald-400">${s.cgpa}</td>
                                        <td class="py-2 px-3 text-slate-300">${s.active_backlogs}</td>
                                        <td class="py-2 px-3 text-slate-300">${s.placement_status}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
        } catch (err) {
            resultContainer.innerHTML = `<p class="text-rose-400 text-xs py-4">${err.message}</p>`;
        }
    },

    async runStudentProfileProcedure() {
        const usn = document.getElementById('spStudentSelect').value;
        const resultContainer = document.getElementById('spProfileResultContainer');
        resultContainer.innerHTML = '<div class="py-6 text-center text-slate-400"><div class="spinner mx-auto mb-2"></div>Executing CALL sp_GetStudentPlacementProfile...</div>';

        try {
            const res = await fetch('/api/tpo/procedures/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ procedure_name: 'sp_GetStudentPlacementProfile', param: usn })
            });
            const data = await res.json();

            if (data.success) {
                const stu = (data.academicDetails && data.academicDetails[0]) || {};
                const history = data.applicationHistory || [];

                resultContainer.innerHTML = `
                    <div class="p-4 bg-slate-900/80 rounded-xl border border-slate-800 mb-4">
                        <div class="flex justify-between items-center mb-2">
                            <h4 class="text-sm font-bold text-white">${stu.student_name} (${stu.usn})</h4>
                            <span class="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">${stu.placement_status}</span>
                        </div>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-300">
                            <div><span class="text-slate-400">Department:</span> ${stu.department_name}</div>
                            <div><span class="text-slate-400">CGPA:</span> <strong class="text-emerald-400">${stu.cgpa}</strong></div>
                            <div><span class="text-slate-400">10th:</span> ${stu.tenth_percentage}%</div>
                            <div><span class="text-slate-400">12th:</span> ${stu.twelfth_percentage}%</div>
                        </div>
                    </div>

                    <h5 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Application & Offer Timeline</h5>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs">
                            <thead class="bg-slate-900 text-slate-300 border-b border-slate-700">
                                <tr>
                                    <th class="py-2.5 px-3">Company</th>
                                    <th class="py-2.5 px-3">Role</th>
                                    <th class="py-2.5 px-3">CTC</th>
                                    <th class="py-2.5 px-3">Applied At</th>
                                    <th class="py-2.5 px-3">Status</th>
                                    <th class="py-2.5 px-3">Offer Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${history.map(h => `
                                    <tr class="border-b border-slate-800 hover:bg-slate-800/40">
                                        <td class="py-2 px-3 font-semibold text-white">${h.company_name}</td>
                                        <td class="py-2 px-3 text-slate-300">${h.job_title}</td>
                                        <td class="py-2 px-3 text-emerald-400 font-bold">₹${parseFloat(h.ctc_annual_lpa).toFixed(1)} LPA</td>
                                        <td class="py-2 px-3 text-slate-400">${h.applied_at}</td>
                                        <td class="py-2 px-3 font-semibold text-indigo-300">${h.application_status}</td>
                                        <td class="py-2 px-3 font-bold ${h.offer_status === 'Accepted' ? 'text-emerald-400' : 'text-slate-400'}">${h.offer_status || 'None'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;
            }
        } catch (err) {
            resultContainer.innerHTML = `<p class="text-rose-400 text-xs py-4">${err.message}</p>`;
        }
    }
};
