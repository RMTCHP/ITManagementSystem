(function () {
    const config = window.APP_CONFIG;
    const state = {
        session: null,
        dashboard: null
    };

    async function loadDashboard() {
        const result = await ApiClient.request("dashboardOverview", { token: ApiClient.getSessionToken() });
        state.dashboard = result.data || {};
    }

    function renderDashboard() {
        const summary = state.dashboard || {};
        const count = (value) => Math.max(0, Number(value) || 0);
        const formatCount = (value) => count(value).toLocaleString("en-US");
        const items = [
            ...(AppShell.normalizeRole(state.session.user.Role) === "admin" ? [{
                label: "Open tickets",
                value: count(summary.openTickets),
                note: "Waiting for IT action",
                icon: "fa-ticket",
                route: "tickets.html?ticketStatus=active"
            }] : []),
            {
                label: "Assets to review",
                value: count(summary.expiredAssets) + count(summary.expiringSoonAssets),
                note: `${formatCount(summary.expiredAssets)} expired / ${formatCount(summary.expiringSoonAssets)} expiring`,
                icon: "fa-laptop-file",
                route: "assets.html?summary=expired"
            },
            {
                label: "Inventory alerts",
                value: count(summary.lowStock) + count(summary.outOfStock),
                note: `${formatCount(summary.lowStock)} low / ${formatCount(summary.outOfStock)} out of stock`,
                icon: "fa-box-open",
                route: "inventory.html?summary=lowStock"
            },
            {
                label: "Contracts to review",
                value: count(summary.maintenanceExpiring) + count(summary.maintenanceExpired),
                note: `${formatCount(summary.maintenanceExpiring)} expiring / ${formatCount(summary.maintenanceExpired)} expired`,
                icon: "fa-file-signature",
                route: "ma-renewal.html"
            },
            {
                label: "Access requests",
                value: count(summary.pendingAccessRequests),
                note: "Pending approval",
                icon: "fa-user-shield",
                route: "access-management.html"
            }
        ];

        document.getElementById("viewContainer").innerHTML = `
            <section class="dashboard-grid dashboard-grid--overview">
                <div class="dashboard-section__header">
                    <div>
                        <p class="section-card__eyebrow">Operations overview</p>
                        <h3>Items needing attention</h3>
                    </div>
                    <span class="dashboard-overview__updated">Updated ${UI.escapeHtml(summary.updatedAt || "-")}</span>
                </div>
                <div class="metrics-grid dashboard-overview__metrics">
                    ${items.map((item) => `
                        <button type="button" class="metric-card metric-card--action"
                            data-dashboard-route="${UI.escapeHtml(item.route)}"
                            aria-label="Open ${UI.escapeHtml(item.label)}">
                            <p class="metric-card__label"><i class="fa-solid ${item.icon}"></i> ${UI.escapeHtml(item.label)}</p>
                            <h3 class="metric-card__value">${formatCount(item.value)}</h3>
                            <span class="dashboard-overview__note">${UI.escapeHtml(item.note)}</span>
                            <i class="fa-solid fa-arrow-up-right-from-square metric-card__link-icon" aria-hidden="true"></i>
                        </button>
                    `).join("")}
                </div>
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
