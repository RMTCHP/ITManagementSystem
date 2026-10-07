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
                label: "Asset lifecycle",
                value: count(summary.expiredAssets) + count(summary.expiringSoonAssets),
                note: "Based on recorded asset life",
                parts: [
                    { label: "Expired", value: count(summary.expiredAssets) },
                    { label: "Expiring", value: count(summary.expiringSoonAssets) }
                ],
                icon: "fa-laptop-file",
                tone: "orange",
                route: "assets.html"
            },
            {
                label: "Inventory alerts",
                value: count(summary.lowStock) + count(summary.outOfStock),
                note: "Items requiring stock review",
                parts: [
                    { label: "Low stock", value: count(summary.lowStock) },
                    { label: "Out of stock", value: count(summary.outOfStock) }
                ],
                icon: "fa-box-open",
                tone: "violet",
                route: "inventory.html"
            },
            {
                label: "Contract renewals",
                value: count(summary.maintenanceExpiring) + count(summary.maintenanceExpired),
                note: "Agreement end dates",
                parts: [
                    { label: "Expiring", value: count(summary.maintenanceExpiring) },
                    { label: "Expired", value: count(summary.maintenanceExpired) }
                ],
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
        const updatedAt = String(summary.updatedAt || "");
        const updatedLabel = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(updatedAt)
            ? `${updatedAt.slice(8, 10)}/${updatedAt.slice(5, 7)}/${updatedAt.slice(0, 4)} ${updatedAt.slice(11, 16)}`
            : (updatedAt || "Not available");

        document.getElementById("viewContainer").innerHTML = `
            <section class="dashboard-command" aria-label="IT operations overview">
                <div class="dashboard-command__hero">
                    <div class="dashboard-command__hero-top">
                        <div class="dashboard-command__hero-copy">
                            <span class="dashboard-command__eyebrow"><span class="dashboard-command__pulse"></span> IT OPERATIONS CENTER</span>
                            <h3>Needs your attention</h3>
                            <p>Service requests, asset lifecycle, stock levels and renewals in one view.</p>
                        </div>
                        <div class="dashboard-command__hero-meta">
                            <span><i class="fa-regular fa-clock" aria-hidden="true"></i> Updated ${UI.escapeHtml(updatedLabel)}</span>
                            <span>${items.length} areas monitored</span>
                        </div>
                    </div>
                    <div class="dashboard-command__cards">
                        ${items.map((item) => `
                            <button type="button" class="dashboard-command__card dashboard-command__card--${item.tone}"
                                data-dashboard-route="${UI.escapeHtml(item.route)}"
                                aria-label="Open ${UI.escapeHtml(item.label)}${item.parts ? `: ${item.parts.map((part) => `${formatCount(part.value)} ${part.label}`).join(", ")}` : `: ${formatCount(item.value)} items`}">
                                <span class="dashboard-command__card-top">
                                    <span class="dashboard-command__card-icon"><i class="fa-solid ${item.icon}" aria-hidden="true"></i></span>
                                    <i class="fa-solid fa-arrow-up-right dashboard-command__card-arrow" aria-hidden="true"></i>
                                </span>
                                <span class="dashboard-command__card-title">${UI.escapeHtml(item.label)}</span>
                                ${item.parts ? `<span class="dashboard-command__card-parts">${item.parts.map((part) => `<span><strong>${formatCount(part.value)}</strong><small>${UI.escapeHtml(part.label)}</small></span>`).join("")}</span>` : `<span class="dashboard-command__card-value">${formatCount(item.value)}</span>`}
                                <span class="dashboard-command__card-note">${UI.escapeHtml(item.note)}</span>
                                <span class="dashboard-command__card-bottom">OPEN WORKSPACE <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>
                            </button>
                        `).join("")}
                    </div>
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
