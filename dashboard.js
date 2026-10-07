(function () {
    const config = window.APP_CONFIG;
    const state = {
        session: null,
        dashboard: null,
        jobTrend: null,
        jobTrendLoading: false
    };

    async function loadDashboard() {
        const result = await ApiClient.request("dashboardOverview", { token: ApiClient.getSessionToken() });
        state.dashboard = result.data || {};
    }

    function monthKey(value) {
        const raw = String(value == null ? "" : value).trim();
        const iso = raw.match(/^(\d{4})-(\d{2})/);
        if (iso) return `${iso[1]}-${iso[2]}`;
        const local = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
        return local ? `${local[3]}-${local[2]}` : "";
    }

    function getRecentMonths(count = 6) {
        const today = new Date();
        const months = [];
        for (let offset = count - 1; offset >= 0; offset -= 1) {
            const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            months.push({
                key,
                label: date.toLocaleDateString("en-US", { month: "short" })
            });
        }
        return months;
    }

    function buildJobTrend(records) {
        const months = getRecentMonths();
        const byMonth = new Map(months.map((month) => [month.key, { ...month, onsite: 0, remote: 0 }]));
        (records || []).forEach((ticket) => {
            const item = byMonth.get(monthKey(ticket.RequestDate));
            const service = String(ticket.RequestedService || "").trim().toLowerCase();
            if (!item) return;
            if (service === "on-site" || service === "onsite") item.onsite += 1;
            if (service === "remote support") item.remote += 1;
        });
        return months.map((month) => byMonth.get(month.key));
    }

    async function loadJobTrendInBackground(force = false) {
        if (AppShell.normalizeRole(state.session.user.Role) !== "admin" || state.jobTrendLoading || (!force && state.jobTrend)) {
            return;
        }
        state.jobTrendLoading = true;
        renderDashboard();
        try {
            const result = await ApiClient.request("listTicketWorkspace", { token: ApiClient.getSessionToken() });
            state.jobTrend = buildJobTrend((result.data && result.data.records) || []);
        } catch (error) {
            // The operational cards remain useful even if the optional trend
            // request is delayed by Apps Script or temporarily unavailable.
            state.jobTrend = [];
        } finally {
            state.jobTrendLoading = false;
            renderDashboard();
        }
    }

    function renderJobTrend() {
        if (state.jobTrendLoading) {
            return `<section class="dashboard-job-trend dashboard-job-trend--loading" aria-label="Loading job trend"><div><p class="dashboard-command__eyebrow">SERVICE ACTIVITY</p><h4>On-site and Remote jobs</h4><p>Loading the last six months of ticket activity.</p></div><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i></section>`;
        }
        const trend = state.jobTrend || [];
        if (!trend.length) {
            return `<section class="dashboard-job-trend dashboard-job-trend--empty"><div><p class="dashboard-command__eyebrow">SERVICE ACTIVITY</p><h4>On-site and Remote jobs</h4><p>Job trend is temporarily unavailable. Refresh to try again.</p></div></section>`;
        }
        const total = trend.reduce((sum, month) => sum + month.onsite + month.remote, 0);
        const max = Math.max(1, ...trend.map((month) => month.onsite + month.remote));
        return `<section class="dashboard-job-trend" aria-label="On-site and Remote Support ticket trend over six months"><div class="dashboard-job-trend__header"><div><p class="dashboard-command__eyebrow">SERVICE ACTIVITY</p><h4>Job volume by month</h4><p>Tickets created in the last 6 months, separated by service method.</p></div><div class="dashboard-job-trend__summary"><strong>${total.toLocaleString("en-US")}</strong><span>jobs total</span></div></div><div class="dashboard-job-trend__legend"><span><i class="is-onsite"></i>On-site</span><span><i class="is-remote"></i>Remote Support</span></div><div class="dashboard-job-trend__chart">${trend.map((month) => {
            const totalMonth = month.onsite + month.remote;
            const onSiteHeight = (month.onsite / max) * 100;
            const remoteHeight = (month.remote / max) * 100;
            return `<div class="dashboard-job-trend__month"><strong>${totalMonth || ""}</strong><div class="dashboard-job-trend__bars" title="${month.label}: ${month.onsite} On-site, ${month.remote} Remote Support"><i class="is-onsite" style="height:${onSiteHeight}%"></i><i class="is-remote" style="height:${remoteHeight}%"></i></div><span>${month.label}</span></div>`;
        }).join("")}</div><a class="dashboard-job-trend__link" href="tickets.html">Open Ticket Workspace <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></a></section>`;
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
            ${isAdmin ? renderJobTrend() : ""}
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
        void loadJobTrendInBackground();
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
                state.jobTrend = null;
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
