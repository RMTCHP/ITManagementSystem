(function () {
    const config = window.APP_CONFIG;
    const state = {
        session: null,
        dashboard: null
    };

    async function loadDashboard() {
        const result = await ApiClient.request("dashboardSummary", { token: ApiClient.getSessionToken() });
        state.dashboard = result.data || {};
    }

    function renderDashboard() {
        const summary = state.dashboard || {};
        const buildMetricCards = (items) => items.map((item) => `
            <article class="metric-card">
                <p class="metric-card__label"><i class="fa-solid ${item.icon}"></i> ${UI.escapeHtml(item.label)}</p>
                <h3 class="metric-card__value">${UI.escapeHtml(String(item.value))}</h3>
                <div class="metric-card__delta">${UI.escapeHtml(item.note)}</div>
            </article>
        `).join("");

        const assetCards = buildMetricCards([
            { label: "Total Assets", value: summary.totalAssets || 0, icon: "fa-laptop-file", note: "Registered asset records" },
            { label: "Expired Assets", value: summary.expiredAssets || 0, icon: "fa-triangle-exclamation", note: "Beyond defined lifetime" },
            { label: "Expiring Soon", value: summary.expiringSoonAssets || 0, icon: "fa-hourglass-half", note: "Within next 6 months" },
            { label: "Total Asset Value", value: Number(summary.totalAssetValue || 0).toLocaleString("en-US"), icon: "fa-baht-sign", note: "Asset register value" }
        ]);

        const inventoryCards = buildMetricCards([
            { label: "Inventory Items", value: summary.totalStockItems || 0, icon: "fa-boxes-stacked", note: "Inventory master records" },
            { label: "Available Items", value: summary.availableStockItems || 0, icon: "fa-circle-check", note: "Above minimum stock" },
            { label: "Low Stock", value: summary.lowStock || 0, icon: "fa-box-open", note: "Items near minimum stock" },
            { label: "Out Of Stock", value: summary.outOfStock || 0, icon: "fa-ban", note: "Items with zero balance" },
            { label: "Stock Units", value: summary.totalStockUnits || 0, icon: "fa-cubes", note: "Current inventory balance" },
            { label: "Stock Categories", value: summary.stockCategories || 0, icon: "fa-layer-group", note: "Inventory master groups" }
        ]);

        const serviceCards = buildMetricCards([
            { label: "Open Tickets", value: summary.openTickets || 0, icon: "fa-ticket", note: "Current unresolved requests" },
            { label: "Pending Approvals", value: summary.pendingApproval || 0, icon: "fa-user-clock", note: "Waiting for decision" }
        ]);

        const quickCards = config.quickActions
            .filter((item) => AppShell.canAccess(item.key, state.session))
            .map((item) => `
                <button class="quick-card" data-quick-module="${item.key}" data-quick-mode="${item.mode}">
                    <i class="fa-solid ${item.icon}"></i>
                    <h3>${UI.escapeHtml(item.title)}</h3>
                    <p>${UI.escapeHtml(item.description)}</p>
                </button>
            `).join("");

        const expiredAssetRows = (summary.expiredAssetItems || []).map((item) => `
            <tr>
                <td>${UI.escapeHtml(item.FixedAssetNo || "-")}</td>
                <td>${UI.escapeHtml(item.AssetName || "-")}</td>
                <td>${UI.escapeHtml(item.Group || "-")}</td>
                <td>${UI.escapeHtml(item.Location || "-")}</td>
            </tr>
        `).join("");

        const lowStockRows = (summary.lowStockItems || []).map((item) => `
            <tr>
                <td>${UI.escapeHtml(item.ItemID || "-")}</td>
                <td>${UI.escapeHtml(item.ItemName || "-")}</td>
                <td>${UI.escapeHtml(item.Quantity || 0)}</td>
                <td>${UI.escapeHtml(item.MinimumStock || 0)}</td>
                <td>${UI.escapeHtml(item.Location || "-")}</td>
            </tr>
        `).join("");

        const recentRows = (summary.recentRequests || []).map((item) => `
            <tr>
                <td>${UI.escapeHtml(item.TicketID)}</td>
                <td>${UI.escapeHtml(item.Subject)}</td>
                <td>${UI.badge(item.Priority, "priority")}</td>
                <td>${UI.badge(item.Status)}</td>
                <td>${UI.escapeHtml(item.AssignedTo || "-")}</td>
            </tr>
        `).join("");

        const auditRows = (summary.recentAuditLogs || []).map((item) => `
            <tr>
                <td>${UI.escapeHtml(item.Timestamp)}</td>
                <td>${UI.badge(item.Action)}</td>
                <td>${UI.escapeHtml(item.Module)}</td>
                <td>${UI.escapeHtml(item.ActorName)}</td>
                <td>${UI.escapeHtml(item.Detail)}</td>
            </tr>
        `).join("");

        document.getElementById("viewContainer").innerHTML = `
            <section class="dashboard-grid">
                <section class="dashboard-section">
                    <div class="dashboard-section__header">
                        <div>
                            <p class="section-card__eyebrow">Asset Control</p>
                            <h3>Lifecycle And Value Overview</h3>
                        </div>
                    </div>
                    <div class="metrics-grid metrics-grid--dashboard">${assetCards}</div>
                </section>

                <section class="dashboard-section">
                    <div class="dashboard-section__header">
                        <div>
                            <p class="section-card__eyebrow">Inventory Control</p>
                            <h3>Stock Position And Availability</h3>
                        </div>
                    </div>
                    <div class="metrics-grid metrics-grid--dashboard">${inventoryCards}</div>
                </section>

                <section class="dashboard-section">
                    <div class="dashboard-section__header">
                        <div>
                            <p class="section-card__eyebrow">Service Desk And Access</p>
                            <h3>Requests And Approval Queue</h3>
                        </div>
                    </div>
                    <div class="metrics-grid metrics-grid--dashboard">${serviceCards}</div>
                </section>

                <section class="dashboard-section">
                    <div class="dashboard-section__header">
                        <div>
                            <p class="section-card__eyebrow">Quick Actions</p>
                            <h3>Common Daily Tasks</h3>
                        </div>
                    </div>
                    <div class="quick-grid quick-grid--dashboard">${quickCards}</div>
                </section>

                <section class="dashboard-section">
                    <div class="dashboard-section__header">
                        <div>
                            <p class="section-card__eyebrow">Operational Watchlists</p>
                            <h3>Assets And Inventory Requiring Attention</h3>
                        </div>
                    </div>
                    <div class="dashboard-watch-grid">
                        <article class="table-panel">
                            <div class="table-panel__header">
                                <div>
                                    <p class="section-card__eyebrow">Asset Watchlist</p>
                                    <h3>Expired Asset Items</h3>
                                </div>
                            </div>
                            <div class="data-table-wrap">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Fixed Asset No.</th>
                                            <th>Asset Name</th>
                                            <th>Group</th>
                                            <th>Location</th>
                                        </tr>
                                    </thead>
                                    <tbody>${expiredAssetRows || `<tr><td colspan="4">${UI.emptyState("No expired asset", "Expired asset items will appear here.")}</td></tr>`}</tbody>
                                </table>
                            </div>
                        </article>
                        <article class="table-panel">
                            <div class="table-panel__header">
                                <div>
                                    <p class="section-card__eyebrow">Inventory Watchlist</p>
                                    <h3>Low Stock Items</h3>
                                </div>
                            </div>
                            <div class="data-table-wrap">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Item ID</th>
                                            <th>Item Name</th>
                                            <th>Qty</th>
                                            <th>Min</th>
                                            <th>Location</th>
                                        </tr>
                                    </thead>
                                    <tbody>${lowStockRows || `<tr><td colspan="5">${UI.emptyState("No low stock", "Low stock items will appear here.")}</td></tr>`}</tbody>
                                </table>
                            </div>
                        </article>
                    </div>
                </section>

                <section class="dashboard-section">
                    <div class="dashboard-section__header">
                        <div>
                            <p class="section-card__eyebrow">Activity</p>
                            <h3>Requests And Audit Timeline</h3>
                        </div>
                    </div>
                    <div class="dashboard-watch-grid">
                        <article class="table-panel">
                            <div class="table-panel__header">
                                <div>
                                    <p class="section-card__eyebrow">Recent Requests</p>
                                    <h3>Latest Ticket Queue</h3>
                                </div>
                            </div>
                            <div class="data-table-wrap">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Ticket ID</th>
                                            <th>Subject</th>
                                            <th>Priority</th>
                                            <th>Status</th>
                                            <th>Assigned To</th>
                                        </tr>
                                    </thead>
                                    <tbody>${recentRows || `<tr><td colspan="5">${UI.emptyState("No recent ticket", "Create a new ticket from quick action.")}</td></tr>`}</tbody>
                                </table>
                            </div>
                        </article>
                        <article class="table-panel">
                            <div class="table-panel__header">
                                <div>
                                    <p class="section-card__eyebrow">Audit Trail</p>
                                    <h3>Latest Critical Events</h3>
                                </div>
                            </div>
                            <div class="data-table-wrap">
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Timestamp</th>
                                            <th>Action</th>
                                            <th>Module</th>
                                            <th>Actor</th>
                                            <th>Detail</th>
                                        </tr>
                                    </thead>
                                    <tbody>${auditRows || `<tr><td colspan="5">${UI.emptyState("No audit log", "Audit entries will appear after data activity.")}</td></tr>`}</tbody>
                                </table>
                            </div>
                        </article>
                    </div>
                </section>
            </section>
        `;
    }

    async function renderPage() {
        await loadDashboard();
        AppShell.updateSidebarAlerts(state.dashboard);
        const heroPanel = document.getElementById("heroPanel");
        if (heroPanel) {
            heroPanel.classList.add("hidden");
            heroPanel.innerHTML = "";
        }
        renderDashboard();
    }

    function attachEvents() {
        document.getElementById("viewContainer").addEventListener("click", (event) => {
            const quick = event.target.closest("[data-quick-module]");
            if (!quick) {
                return;
            }
            AppShell.navigateTo(quick.getAttribute("data-quick-module"), {
                action: quick.getAttribute("data-quick-mode")
            });
        });
    }

    async function bootstrap() {
        const shell = await AppShell.init({
            currentView: "dashboard",
            title: "Dashboard",
            eyebrow: "Operations Dashboard",
            searchPlaceholder: "Search modules and records",
            onSearch(value) {
                if (!value) {
                    return;
                }
                const q = value.toLowerCase();
                const menuTarget = config.menu
                    .flatMap((group) => group.items)
                    .find((item) =>
                        item.label.toLowerCase().includes(q) ||
                        item.description.toLowerCase().includes(q)
                    );
                if (menuTarget) {
                    AppShell.navigateTo(menuTarget.key);
                }
            },
            async onRefresh() {
                await renderPage();
            },
            async onExport() {
                await UI.alert({
                    title: "Use report export",
                    text: "Dashboard is not exported directly. Use the Reports page for structured exports."
                });
            }
        });

        if (!shell) {
            return;
        }

        state.session = shell.session;
        attachEvents();
        try {
            UI.loading("Loading dashboard", "Preparing operational summary");
            await renderPage();
            Swal.close();
        } catch (error) {
            Swal.close();
            if (await AppShell.handleSessionError(error)) {
                return;
            }
            UI.alert({
                icon: "error",
                title: "Dashboard failed",
                text: error.message || "Unexpected error"
            });
        }
    }

    bootstrap();
})();
