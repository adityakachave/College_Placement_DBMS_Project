// DBMS Lab Query Console
const QueryConsole = {
    queries: [],

    async init() {
        await this.loadPrebuiltQueries();
        this.bindEvents();
    },

    async loadPrebuiltQueries() {
        try {
            const res = await fetch('/api/tpo/prebuilt-queries');
            const data = await res.json();
            this.queries = data.queries || [];

            const select = document.getElementById('prebuiltQuerySelect');
            if (select) {
                select.innerHTML = '<option value="">-- Select a Pre-Built Lab/Viva Query --</option>' +
                    this.queries.map(q => `<option value="${q.id}">${q.title}</option>`).join('');
            }
        } catch (err) {
            console.error('Failed to load prebuilt queries', err);
        }
    },

    loadSelectedQuery(queryId) {
        const q = this.queries.find(item => item.id === queryId);
        const editor = document.getElementById('sqlEditor');
        if (q && editor) {
            editor.value = q.sql;
        }
    },

    async executeQuery() {
        const editor = document.getElementById('sqlEditor');
        const sql = editor.value.trim();
        if (!sql) {
            App.notify('Please enter an SQL query first', 'warning');
            return;
        }

        const container = document.getElementById('queryOutputContainer');
        const metaEl = document.getElementById('queryOutputMeta');
        container.innerHTML = '<div class="py-12 text-center text-slate-400"><div class="spinner mx-auto mb-3"></div>Executing Query on Database...</div>';

        try {
            const res = await fetch('/api/tpo/query/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql })
            });
            const data = await res.json();

            if (res.ok && data.success) {
                metaEl.innerHTML = `
                    <div class="flex items-center space-x-3 text-xs">
                        <span class="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                            ✓ Status: Success
                        </span>
                        <span class="text-slate-300">Rows: <strong>${data.rowCount}</strong></span>
                        <span class="text-slate-400">Execution Time: <strong>${data.executionTimeMs} ms</strong></span>
                    </div>
                `;

                if (Array.isArray(data.rows) && data.rows.length > 0) {
                    const fields = data.fields && data.fields.length > 0 ? data.fields : Object.keys(data.rows[0]);

                    container.innerHTML = `
                        <div class="overflow-x-auto max-h-[480px]">
                            <table class="w-full text-left text-xs">
                                <thead class="bg-slate-900 sticky top-0 text-slate-200 border-b border-slate-700 shadow-md">
                                    <tr>
                                        ${fields.map(f => `<th class="py-3 px-4 font-bold uppercase tracking-wider text-[11px] text-indigo-300 whitespace-nowrap">${f}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.rows.map(row => `
                                        <tr class="border-b border-slate-800/60 hover:bg-slate-800/40 transition">
                                            ${fields.map(f => `<td class="py-2.5 px-4 text-slate-300 whitespace-nowrap">${row[f] !== null && row[f] !== undefined ? row[f] : '<span class="text-slate-500 italic">NULL</span>'}</td>`).join('')}
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                } else {
                    container.innerHTML = `<div class="p-6 text-slate-400 text-xs text-center">${data.message || 'Query executed successfully. 0 rows returned.'}</div>`;
                }
            } else {
                metaEl.innerHTML = `<span class="px-2.5 py-1 rounded-md bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30 text-xs">Error</span>`;
                container.innerHTML = `
                    <div class="p-5 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs font-mono">
                        <strong class="block text-sm mb-1">SQL Execution Error:</strong>
                        ${data.error || 'Syntax or relational constraint error'}
                        ${data.sqlState ? `<div class="text-[11px] text-rose-400 mt-2">SQLSTATE: ${data.sqlState} (Code: ${data.code})</div>` : ''}
                    </div>
                `;
            }
        } catch (err) {
            container.innerHTML = `<p class="text-rose-400 text-xs p-4">${err.message}</p>`;
        }
    },

    bindEvents() {
        document.getElementById('prebuiltQuerySelect')?.addEventListener('change', (e) => {
            this.loadSelectedQuery(e.target.value);
        });

        document.getElementById('btnRunQuery')?.addEventListener('click', () => {
            this.executeQuery();
        });
    }
};

window.addEventListener('DOMContentLoaded', () => {
    QueryConsole.init();
});
