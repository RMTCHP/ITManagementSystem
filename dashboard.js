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
        const isAdmin = AppShell.normalizeRole(state.session.user.Role) === "admin";
        const items = [
            ...(isAdmin ? [{
                label: "Open tickets",
                value: count(summary.openTickets),
                note: "Waiting for IT action",
                icon: "fa-ticket",
                tone: "blue",
                route: "tickets.html?ticketStatus=active"
            }] : []),
            {
                label: "Assets to review",
                value: count(summary.expiredAssets) + count(summary.expiringSoonAssets),
                note: `${formatCount(summary.expiredAssets)} expired / ${formatCount(summary.expiringSoonAssets)} expiring`,
                icon: "fa-laptop-file",
                tone: "orange",
                route: "assets.html?summary=expired"
            },
            {
                label: "Inventory alerts",
                value: count(summary.lowStock) + count(summary.outOfStock),
                note: `${formatCount(summary.lowStock)} low / ${formatCount(summary.outOfStock)} out of stock`,
                icon: "fa-box-open",
                tone: "violet",
                route: "inventory.html?summary=lowStock"
            },
            {
                label: "Contracts to review",
                value: count(summary.maintenanceExpiring) + count(summary.maintenanceExpired),
                note: `${formatCount(summary.maintenanceExpiring)} expiring / ${formatCount(summary.maintenanceExpired)} expired`,
                icon: "fa-file-signature",
                tone: "teal",
                route: "ma-renewal.html"
            },
            {
                label: "Access requests",
                value: count(summary.pendingAccessRequests),
                note: "Pending approval",
                icon: "fa-user-shield",
                tone: "rose",
                route: "access-management.html"
            }
        ];
        const total = items.reduce((sum, item) => sum + item.value, 0);
        const largest = items.reduce((top, item) => item.value > top.value ? item : top, items[0]);
        const updatedAt = UI.escapeHtml(summary.updatedAt || "Not available");

        document.getElementById("viewContainer").innerHTML = `
            <section class="dashboard-command" aria-label="IT operations overview">
                <div class="dashboard-command__hero">
                    <div class="dashboard-command__hero-copy">
                        <span class="dashboard-command__eyebrow"><span class="dashboard-command__pulse"></span> IT OPERATIONS CENTER</span>
                        <h3>Stay ahead of<br><span>what needs attention.</span></h3>
                        <p>A focused view of outstanding work across your IT service and asset operations.</p>
                        <div class="dashboard-command__hero-footer">
                            <span><i class="fa-regular fa-clock" aria-hidden="true"></i> Updated ${updatedAt}</span>
                            <span>${items.length} areas monitored</span>
                        </div>
                    </div>
                    <div class="dashboard-command__hero-stat" aria-label="${formatCount(total)} items needing attention">
                        <span class="dashboard-command__stat-label">TOTAL ITEMS FLAGGED</span>
                        <strong>${formatCount(total)}</strong>
                        <span class="dashboard-command__stat-caption">Across ${items.length} operational areas</span>
                        <div class="dashboard-command__stat-divider"></div>
                        <span class="dashboard-command__largest-label">LARGEST QUEUE</span>
                        <span class="dashboard-command__largest"><i class="fa-solid ${largest.icon}" aria-hidden="true"></i> ${UI.escapeHtml(largest.label)} <b>${formatCount(largest.value)}</b></span>
                    </div>
                </div>

                <div class="dashboard-command__section-heading">
                    <div>
                        <p class="dashboard-command__section-kicker">OPERATIONAL PULSE</p>
                        <h3>Needs your attention</h3>
                    </div>
                    <span>Choose a card to open its workspace <i class="fa-solid fa-arrow-down" aria-hidden="true"></i></span>
                </div>
                <div class="dashboard-command__cards">
                    ${items.map((item) => `
                        <button type="button" class="dashboard-command__card dashboard-command__card--${item.tone}"
                            data-dashboard-route="${UI.escapeHtml(item.route)}"
                            aria-label="Open ${UI.escapeHtml(item.label)}, ${formatCount(item.value)} items">
                            <span class="dashboard-command__card-top">
                                <span class="dashboard-command__card-icon"><i class="fa-solid ${item.icon}" aria-hidden="true"></i></span>
                                <i class="fa-solid fa-arrow-up-right dashboard-command__card-arrow" aria-hidden="true"></i>
                            </span>
                            <span class="dashboard-command__card-value">${formatCount(item.value)}</span>
                            <span class="dashboard-command__card-title">${UI.escapeHtml(item.label)}</span>
                            <span class="dashboard-command__card-note">${UI.escapeHtml(item.note)}</span>
                            <span class="dashboard-command__card-bottom">OPEN WORKSPACE <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>
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
