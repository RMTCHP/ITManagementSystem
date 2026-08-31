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
        const buildMetricCards = (items, className = "") => items.map((item) => {
            const tagName = item.route ? "button" : "article";
            const attributes = item.route
                ? ` type="button" class="metric-card metric-card--action" data-dashboard-route="${UI.escapeHtml(item.route)}" title="${UI.escapeHtml(item.title || `Open ${item.label}`)}"`
                : ` class="metric-card"`;
            return `
            <${tagName}${attributes}>
                <p class="metric-card__label"><i class="fa-solid ${item.icon}"></i> ${UI.escapeHtml(item.label)}</p>
                <h3 class="metric-card__value">${UI.escapeHtml(String(item.value))}</h3>
                <div class="metric-card__delta">${UI.escapeHtml(item.note)}</div>
            ${item.route ? '<i class="fa-solid fa-arrow-up-right-from-square metric-card__link-icon"></i>' : ""}
            </${tagName}>`;
        }).join("");

        const formatNumber = (value) => Number(value || 0).toLocaleString("en-US");

        const attentionCards = buildMetricCards([
            { label: "Expired Assets", value: summary.expiredAssets || 0, icon: "fa-triangle-exclamation", note: "Require review", route: "assets.html?summary=expired" },
            { label: "Expiring Soon", value: summary.expiringSoonAssets || 0, icon: "fa-hourglass-half", note: "Within 6 months", route: "assets.html?summary=expiringSoon" },
            { label: "Low Stock", value: summary.lowStock || 0, icon: "fa-box-open", note: "At minimum level", route: "inventory.html?summary=lowStock" },
            { label: "Out Of Stock", value: summary.outOfStock || 0, icon: "fa-ban", note: "Replenishment needed", route: "inventory.html?summary=outOfStock" },
            { label: "Open Tickets", value: summary.openTickets || 0, icon: "fa-ticket", note: "Unresolved IT work", route: "tickets.html?ticketStatus=active" }
        ]);

        const overviewCards = buildMetricCards([
            { label: "Total Assets", value: formatNumber(summary.totalAssets), icon: "fa-laptop-file", note: "Registered asset records", route: "assets.html" },
            { label: "Total Asset Value", value: formatNumber(summary.totalAssetValue), icon: "fa-baht-sign", note: "Baht", route: "assets.html" },
            { label: "Inventory Items", value: formatNumber(summary.totalStockItems), icon: "fa-boxes-stacked", note: "Inventory master records", route: "inventory.html" },
            { label: "Stock Units", value: formatNumber(summary.totalStockUnits), icon: "fa-cubes", note: "Current inventory balance", route: "inventory.html" }
        ]);

        const lifecycleRows = (summary.assetLifecycleByGroup || []).map((item) => {
            const total = Number(item.normal || 0) + Number(item.expiringSoon || 0) + Number(item.expired || 0) + Number(item.unknown || 0);
            const percent = (value) => total ? Math.max(0, (Number(value || 0) / total) * 100) : 0;
            const groupLabel = item.group === "Office Equiment" ? "Office Equipment" : item.group;
            return `<div class="dashboard-lifecycle-row">
                <div class="dashboard-lifecycle-row__label"><strong>${UI.escapeHtml(groupLabel)}</strong><span>${total}</span></div>
                <div class="dashboard-lifecycle-row__bar" title="Normal ${item.normal || 0}, Expiring soon ${item.expiringSoon || 0}, Expired ${item.expired || 0}, Unknown ${item.unknown || 0}">
                    <i class="is-normal" style="width:${percent(item.normal)}%"></i><i class="is-expiring" style="width:${percent(item.expiringSoon)}%"></i><i class="is-expired" style="width:${percent(item.expired)}%"></i><i class="is-unknown" style="width:${percent(item.unknown)}%"></i>
                </div>
            </div>`;
        }).join("");

        const movementTrend = summary.stockMovementTrend || [];
        const movementMax = Math.max(1, ...movementTrend.map((item) => Math.max(Number(item.inbound || 0), Number(item.outbound || 0))));
        const movementBars = movementTrend.map((item) => `
            <div class="dashboard-trend-item" title="Inbound ${formatNumber(item.inbound)}, Outbound ${formatNumber(item.outbound)}">
                <div class="dashboard-trend-item__bars"><i class="is-inbound" style="height:${Math.max(3, (Number(item.inbound || 0) / movementMax) * 100)}%"></i><i class="is-outbound" style="height:${Math.max(3, (Number(item.outbound || 0) / movementMax) * 100)}%"></i></div>
                <span>${UI.escapeHtml(item.label || item.month || "-")}</span>
            </div>
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

        document.getElementById("viewContainer").innerHTML = `
            <section class="dashboard-grid">
                <section class="dashboard-section">
                    <div class="dashboard-section__header">
                        <div>
                            <p class="section-card__eyebrow">Attention Required</p>
                            <h3>Items Requiring Action</h3>
                        </div>
                    </div>
                    <div class="metrics-grid metrics-grid--attention">${attentionCards}</div>
                </section>

                <section class="dashboard-section">
                    <div class="dashboard-section__header">
                        <div>
                            <p class="section-card__eyebrow">Business Overview</p>
                            <h3>Asset And Inventory Position</h3>
                        </div>
                    </div>
                    <div class="metrics-grid metrics-grid--dashboard">${overviewCards}</div>
                </section>

                <section class="dashboard-chart-grid">
                    <article class="dashboard-chart-card">
                        <div class="dashboard-chart-card__header"><div><p class="section-card__eyebrow">Asset Lifecycle</p><h3>Lifecycle By Group</h3></div><span class="dashboard-chart-card__total">${formatNumber(summary.totalAssets)} assets</span></div>
                        <div class="dashboard-lifecycle-legend"><span><i class="is-normal"></i>Normal</span><span><i class="is-expiring"></i>Expiring soon</span><span><i class="is-expired"></i>Expired</span><span><i class="is-unknown"></i>Unknown</span></div>
                        <div class="dashboard-lifecycle-chart">${lifecycleRows || UI.emptyState("No asset data", "Asset lifecycle data will appear here.")}</div>
                    </article>
                    <article class="dashboard-chart-card">
                        <div class="dashboard-chart-card__header"><div><p class="section-card__eyebrow">Stock Movement</p><h3>Inbound And Outbound Trend</h3></div><span class="dashboard-chart-card__total">Last 6 months</span></div>
                        <div class="dashboard-trend-legend"><span><i class="is-inbound"></i>Inbound</span><span><i class="is-outbound"></i>Outbound</span></div>
                        <div class="dashboard-trend-chart">${movementBars || UI.emptyState("No movement data", "Inbound and outbound activity will appear here.")}</div>
                    </article>
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
                                <button class="ghost-btn dashboard-view-all" type="button" data-dashboard-route="assets.html?summary=expired">View all</button>
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
                                <button class="ghost-btn dashboard-view-all" type="button" data-dashboard-route="inventory.html?summary=lowStock">View all</button>
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

            </section>
        `;

        document.querySelectorAll("[data-dashboard-route]").forEach((button) => {
            button.addEventListener("click", () => {
                window.location.href = button.getAttribute("data-dashboard-route");
            });
        });
    }

    async function renderPage() {
        await loadDashboard();
        AppShell.updateSidebarAlerts(state.dashboard);
        renderDashboard();
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
            }
        });

        if (!shell) {
            return;
        }

        state.session = shell.session;
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
