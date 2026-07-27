(function () {
    const state = {
        session: null
    };

    function renderHero() {
        AppShell.renderHero(document.getElementById("heroPanel"), {
            profile: "Governance & Export",
            title: "Reports",
            description: "Export structured data for asset, service desk, inventory, license, access review and audit reporting.",
            meta: [
                { icon: "fa-user-shield", text: AppShell.formatRole(state.session.user.Role) },
                { icon: "fa-clock", text: `Updated ${AppShell.currentTimestampLabel()}` },
                { icon: "fa-file-export", text: "Excel and CSV exports" }
            ],
            stats: [
                { label: "Asset Report", value: "Ready" },
                { label: "Ticket Report", value: "Ready" },
                { label: "Audit Report", value: "Ready" },
                { label: "CSV / XLSX", value: "2 formats" }
            ]
        });
    }

    function renderReports() {
        const reports = [
            { key: "assets", title: "Asset Report", text: "Register, status, assignment and warranty report." },
            { key: "tickets", title: "Ticket Report", text: "Service request and incident workload." },
            { key: "stockItems", title: "Inventory Report", text: "Stock levels and replenishment status." },
            { key: "licenses", title: "License Report", text: "Software allocation and renewal planning." },
            { key: "accessRequests", title: "Access Review Report", text: "Permission approvals and access changes." },
            { key: "auditLogs", title: "Audit Report", text: "Operational traceability and control evidence." }
        ];

        document.getElementById("viewContainer").innerHTML = `
            <section class="report-grid">
                ${reports.filter((item) => AppShell.canAccess(item.key, state.session)).map((item) => `
                    <article class="report-card">
                        <p class="section-card__eyebrow">Export Ready</p>
                        <h3>${UI.escapeHtml(item.title)}</h3>
                        <p>${UI.escapeHtml(item.text)}</p>
                        <div class="report-card__actions">
                            <button class="primary-btn" data-report="${item.key}" data-format="xlsx">
                                <i class="fa-solid fa-file-excel"></i>
                                <span>Export Excel</span>
                            </button>
                            <button class="secondary-btn" data-report="${item.key}" data-format="csv">
                                <i class="fa-solid fa-file-csv"></i>
                                <span>Export CSV</span>
                            </button>
                        </div>
                    </article>
                `).join("")}
            </section>
        `;
    }

    async function exportModule(moduleKey, format) {
        const confirmation = await UI.confirm({
            title: `Export ${moduleKey}?`,
            text: `The current ${moduleKey} dataset will be exported as ${format.toUpperCase()}.`,
            confirmButtonText: "Export"
        });
        if (!confirmation.isConfirmed) {
            return;
        }

        UI.loading("Exporting data", `Preparing ${moduleKey} ${format.toUpperCase()} file`);
        const result = await ApiClient.request("listRecords", {
            token: ApiClient.getSessionToken(),
            module: moduleKey
        });
        const rows = result.data.records || [];
        const fileName = `${moduleKey}_${UI.buildTimestampForFileName()}`;
        if (format === "csv") {
            UI.exportToCsv(fileName, rows);
        } else {
            UI.exportToExcel(fileName, rows);
        }
        Swal.close();
        UI.toast("success", "Export completed", `${moduleKey} exported as ${format.toUpperCase()}.`);
    }

    function attachEvents() {
        document.getElementById("viewContainer").addEventListener("click", async (event) => {
            const reportButton = event.target.closest("[data-report]");
            if (!reportButton) {
                return;
            }
            await exportModule(reportButton.getAttribute("data-report"), reportButton.getAttribute("data-format"));
        });
    }

    async function bootstrap() {
        const shell = await AppShell.init({
            currentView: "reports",
            title: "Reports",
            eyebrow: "Governance & Export",
            searchPlaceholder: "Search report module",
            onSearch(value) {
                if (!value) {
                    return;
                }
                const q = value.toLowerCase();
                const matchedModule = Object.values(window.APP_CONFIG.modules).find((item) => item.label.toLowerCase().includes(q));
                if (matchedModule) {
                    AppShell.navigateTo(matchedModule.key);
                }
            },
            async onRefresh() {
                renderHero();
                renderReports();
            },
            async onExport() {
                await UI.alert({
                    title: "Choose a report card",
                    text: "Select Excel or CSV on the report card you want to export."
                });
            }
        });

        if (!shell) {
            return;
        }

        state.session = shell.session;
        renderHero();
        renderReports();
        attachEvents();
        Swal.close();
    }

    bootstrap();
})();
