(function () {
    const config = window.APP_CONFIG;
    const SIDEBAR_GROUPS_STORAGE_KEY = "it-management-sidebar-groups-v2";
    const SIDEBAR_ALERTS_STORAGE_KEY = "it-management-sidebar-alerts-v1";
    const SIDEBAR_COLLAPSED_STORAGE_KEY = "it-management-sidebar-collapsed-v1";

    function normalizeRole(role) {
        return String(role || "").trim().toLowerCase();
    }

    function formatRole(role) {
        const normalized = normalizeRole(role);
        if (normalized === "admin") {
            return "Admin";
        }
        if (normalized === "user") {
            return "User";
        }
        return String(role || "-");
    }

    function getRoute(viewKey) {
        return config.pageRoutes[viewKey] || "dashboard.html";
    }

    function getSessionToken() {
        return window.ApiClient ? window.ApiClient.getSessionToken() : "";
    }

    function hasLikelyActiveSession(session) {
        if (!session || !session.token || !session.user) {
            return false;
        }

        if (!session.expiresAt) {
            return true;
        }

        const expiry = new Date(session.expiresAt);
        return !Number.isNaN(expiry.getTime()) && expiry.getTime() > Date.now();
    }

    function getModule(viewKey) {
        return config.modules[viewKey] || null;
    }

    function canAccess(viewKey, session) {
        if (viewKey === "dashboard" || viewKey === "reports") {
            return true;
        }
        const module = getModule(viewKey);
        return module
            ? (module.roles || []).some((role) => normalizeRole(role) === normalizeRole(session.user.Role))
            : false;
    }

    function canDo(module, action, session) {
        if (!module || !module.permissions) {
            return false;
        }
        const roles = module.permissions[action] || [];
        return roles.some((role) => normalizeRole(role) === normalizeRole(session.user.Role));
    }

    function currentTimestampLabel() {
        return new Date().toLocaleString("en-GB", {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function navigateTo(viewKey, query = {}) {
        const url = new URL(getRoute(viewKey), window.location.href);
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== "") {
                url.searchParams.set(key, value);
            }
        });
        window.location.href = url.toString();
    }

    function getGroupStorageState() {
        try {
            const raw = window.localStorage.getItem(SIDEBAR_GROUPS_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    function setGroupStorageState(state) {
        try {
            window.localStorage.setItem(SIDEBAR_GROUPS_STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            // Ignore storage issues and keep the sidebar usable.
        }
    }

    function getSidebarAlertsState() {
        try {
            const raw = window.sessionStorage.getItem(SIDEBAR_ALERTS_STORAGE_KEY)
                || window.localStorage.getItem(SIDEBAR_ALERTS_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    function setSidebarAlertsState(state) {
        try {
            const serialized = JSON.stringify(state);
            window.sessionStorage.setItem(SIDEBAR_ALERTS_STORAGE_KEY, serialized);
            window.localStorage.setItem(SIDEBAR_ALERTS_STORAGE_KEY, serialized);
        } catch (error) {
            // Ignore storage issues and keep the sidebar usable.
        }
    }

    function applyTooltips(root) {
        if (!root) {
            return;
        }

        root.querySelectorAll("button, a.nav-link, .nav-group__toggle").forEach((element) => {
            if (element.hasAttribute("title")) {
                return;
            }

            const strongLabel = element.querySelector("strong");
            const textLabel = strongLabel ? strongLabel.textContent : element.textContent;
            const label = (
                element.getAttribute("aria-label")
                || element.dataset.tooltip
                || textLabel
                || ""
            ).trim();

            if (label) {
                element.setAttribute("title", label);
            }
        });
    }

    function renderSidebar(currentView, session, sidebarNav) {
        const collapsedState = getGroupStorageState();
        const markup = config.menu.map((group) => {
            const items = group.items.filter((item) => canAccess(item.key, session));
            if (!items.length) {
                return "";
            }

            const groupKey = String(group.group || "").trim().toLowerCase().replace(/\s+/g, "-");
            const defaultCollapsed = !(currentView === "dashboard" && groupKey === "overview");
            const isCollapsed = Object.prototype.hasOwnProperty.call(collapsedState, groupKey)
                ? Boolean(collapsedState[groupKey])
                : defaultCollapsed;

            return `
                <section class="nav-group ${isCollapsed ? "is-collapsed" : ""}" data-nav-group="${UI.escapeHtml(groupKey)}">
                    <button class="nav-group__toggle" type="button" data-nav-group-toggle="${UI.escapeHtml(groupKey)}" aria-expanded="${isCollapsed ? "false" : "true"}">
                        <span class="nav-group__label">${UI.escapeHtml(group.group)}</span>
                        <i class="fa-solid fa-chevron-down nav-group__chevron" aria-hidden="true"></i>
                    </button>
                    <div class="nav-group__items">
                        ${items.map((item) => `
                            <a class="nav-link ${currentView === item.key ? "is-active" : ""}" href="${UI.escapeHtml(getRoute(item.key))}" data-nav-link="${item.key}">
                                <i class="fa-solid ${item.icon}"></i>
                                <span class="nav-link__label">
                                    <strong>${UI.escapeHtml(item.label)}</strong>
                                    ${item.key === "assets" ? `
                                        <span class="nav-link__badges">
                                            <span class="nav-link__badge nav-link__badge--warning hidden" data-nav-badge="assets-expiring"></span>
                                            <span class="nav-link__badge nav-link__badge--danger hidden" data-nav-badge="assets-expired"></span>
                                        </span>
                                    ` : item.key === "accessRequests" ? `
                                        <span class="nav-link__badges">
                                            <span class="nav-link__badge nav-link__badge--warning hidden" data-nav-badge="accessRequests-pending"></span>
                                        </span>
                                    ` : item.key === "stockItems" ? `
                                        <span class="nav-link__badges">
                                            <span class="nav-link__badge nav-link__badge--warning hidden" data-nav-badge="stockItems-low"></span>
                                            <span class="nav-link__badge nav-link__badge--danger hidden" data-nav-badge="stockItems-out"></span>
                                        </span>
                                    ` : `<span class="nav-link__badges"></span>`}
                                </span>
                            </a>
                        `).join("")}
                    </div>
                </section>
            `;
        }).join("");

        sidebarNav.innerHTML = markup;
    }

    function updateSidebarAlerts(summary) {
        const assetExpiringBadge = document.querySelector('[data-nav-badge="assets-expiring"]');
        const assetExpiredBadge = document.querySelector('[data-nav-badge="assets-expired"]');
        const accessPendingBadge = document.querySelector('[data-nav-badge="accessRequests-pending"]');
        const lowBadge = document.querySelector('[data-nav-badge="stockItems-low"]');
        const outBadge = document.querySelector('[data-nav-badge="stockItems-out"]');
        if (!assetExpiringBadge || !assetExpiredBadge || !accessPendingBadge || !lowBadge || !outBadge) {
            return;
        }

        const previousState = getSidebarAlertsState();
        const nextState = {
            expiringSoonAssets: Object.prototype.hasOwnProperty.call(summary || {}, "expiringSoonAssets")
                ? Number(summary.expiringSoonAssets || 0)
                : Number(previousState.expiringSoonAssets || 0),
            expiredAssets: Object.prototype.hasOwnProperty.call(summary || {}, "expiredAssets")
                ? Number(summary.expiredAssets || 0)
                : Number(previousState.expiredAssets || 0),
            pendingAccessRequests: Object.prototype.hasOwnProperty.call(summary || {}, "pendingAccessRequests")
                ? Number(summary.pendingAccessRequests || 0)
                : Number(previousState.pendingAccessRequests || 0),
            lowStock: Object.prototype.hasOwnProperty.call(summary || {}, "lowStock")
                ? Number(summary.lowStock || 0)
                : Number(previousState.lowStock || 0),
            outOfStock: Object.prototype.hasOwnProperty.call(summary || {}, "outOfStock")
                ? Number(summary.outOfStock || 0)
                : Number(previousState.outOfStock || 0)
        };
        setSidebarAlertsState(nextState);

        const expiringSoonCount = nextState.expiringSoonAssets;
        const expiredAssetsCount = nextState.expiredAssets;
        const pendingAccessCount = nextState.pendingAccessRequests;
        const lowStockCount = nextState.lowStock;
        const outOfStockCount = nextState.outOfStock;

        if (expiringSoonCount > 0) {
            assetExpiringBadge.textContent = String(expiringSoonCount);
            assetExpiringBadge.classList.remove("hidden");
        } else {
            assetExpiringBadge.textContent = "";
            assetExpiringBadge.classList.add("hidden");
        }

        if (expiredAssetsCount > 0) {
            assetExpiredBadge.textContent = String(expiredAssetsCount);
            assetExpiredBadge.classList.remove("hidden");
        } else {
            assetExpiredBadge.textContent = "";
            assetExpiredBadge.classList.add("hidden");
        }

        if (pendingAccessCount > 0) {
            accessPendingBadge.textContent = String(pendingAccessCount);
            accessPendingBadge.classList.remove("hidden");
        } else {
            accessPendingBadge.textContent = "";
            accessPendingBadge.classList.add("hidden");
        }

        if (lowStockCount > 0) {
            lowBadge.textContent = String(lowStockCount);
            lowBadge.classList.remove("hidden");
        } else {
            lowBadge.textContent = "";
            lowBadge.classList.add("hidden");
        }

        if (outOfStockCount > 0) {
            outBadge.textContent = String(outOfStockCount);
            outBadge.classList.remove("hidden");
        } else {
            outBadge.textContent = "";
            outBadge.classList.add("hidden");
        }
    }

    function bindSidebarGroupToggles(sidebarNav) {
        const buttons = sidebarNav.querySelectorAll("[data-nav-group-toggle]");
        if (!buttons.length) {
            return;
        }

        buttons.forEach((button) => {
            button.addEventListener("click", () => {
                const groupKey = button.getAttribute("data-nav-group-toggle");
                const section = button.closest("[data-nav-group]");
                if (!groupKey || !section) {
                    return;
                }

                const nextCollapsed = !section.classList.contains("is-collapsed");
                section.classList.toggle("is-collapsed", nextCollapsed);
                button.setAttribute("aria-expanded", nextCollapsed ? "false" : "true");

                const state = getGroupStorageState();
                state[groupKey] = nextCollapsed;
                setGroupStorageState(state);
            });
        });
    }

    function ensureTopbarImportButton(elements) {
        let button = document.getElementById("importButton");
        if (button) {
            return button;
        }

        button = document.createElement("button");
        button.id = "importButton";
        button.type = "button";
        button.className = "icon-btn hidden";
        button.setAttribute("aria-label", "Import file");
        button.innerHTML = '<i class="fa-solid fa-file-import"></i>';

        if (elements.exportButton && elements.exportButton.parentNode) {
            elements.exportButton.insertAdjacentElement("beforebegin", button);
        } else if (elements.topbarActions) {
            elements.topbarActions.appendChild(button);
        }

        return button;
    }

    function ensureSidebarToggleButton(elements) {
        let button = document.getElementById("toggleSidebarBtn");
        if (button) {
            return button;
        }

        const topbar = document.querySelector(".topbar");
        const titleGroup = document.querySelector(".topbar__title-group");
        if (!topbar || !titleGroup) {
            return null;
        }

        button = document.createElement("button");
        button.id = "toggleSidebarBtn";
        button.className = "topbar__menu-btn";
        button.type = "button";
        button.setAttribute("aria-label", "Hide sidebar");
        button.setAttribute("title", "Hide sidebar");
        button.innerHTML = '<i class="fa-solid fa-bars"></i>';
        topbar.insertBefore(button, titleGroup);
        return button;
    }

    function configureTopbarButtons(elements, options, context) {
        const importButton = ensureTopbarImportButton(elements);
        elements.importButton = importButton;

        if (typeof options.onImport === "function") {
            importButton.classList.remove("hidden");
            importButton.onclick = async () => {
                try {
                    await options.onImport(context);
                } catch (error) {
                    Swal.close();
                    UI.alert({
                        icon: "error",
                        title: "Import failed",
                        text: error.message || "Unexpected error"
                    });
                }
            };
        } else {
            importButton.classList.add("hidden");
            importButton.onclick = null;
        }

        if (typeof options.onExport === "function") {
            elements.exportButton.classList.remove("hidden");
        } else {
            elements.exportButton.classList.add("hidden");
        }

        applyTooltips(elements.topbarActions);
    }

    async function validateSession() {
        const savedSession = window.ApiClient ? window.ApiClient.getSavedSession() : null;
        if (!hasLikelyActiveSession(savedSession)) {
            ApiClient.clearSession();
            window.location.href = "index.html";
            return null;
        }

        return savedSession;
    }

    async function handleSessionError(error) {
        const message = String(error && error.message || "");
        if (!error || (error.code !== "SESSION_EXPIRED" && !/^session expired or invalid$/i.test(message))) {
            return false;
        }

        ApiClient.clearSession();
        await UI.alert({
            icon: "warning",
            title: "Session expired",
            text: "Your session is no longer valid. Please sign in again."
        });
        window.location.replace("index.html");
        return true;
    }

    function bindSidebarToggle(sidebar, toggleSidebarBtn) {
        if (!toggleSidebarBtn) {
            return;
        }
        const shell = sidebar.closest(".app-shell");
        const desktopQuery = window.matchMedia("(min-width: 1281px)");
        const updateButton = (collapsed) => {
            const label = collapsed ? "Show sidebar" : "Hide sidebar";
            toggleSidebarBtn.setAttribute("aria-label", label);
            toggleSidebarBtn.setAttribute("title", label);
            toggleSidebarBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
        };
        const applyDesktopState = () => {
            if (!shell || !desktopQuery.matches) {
                return;
            }
            const collapsed = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
            shell.classList.toggle("is-sidebar-collapsed", collapsed);
            sidebar.classList.remove("is-open");
            updateButton(collapsed);
        };

        applyDesktopState();
        toggleSidebarBtn.addEventListener("click", () => {
            if (!desktopQuery.matches) {
                sidebar.classList.toggle("is-open");
                return;
            }

            const collapsed = !(shell && shell.classList.contains("is-sidebar-collapsed"));
            if (shell) {
                shell.classList.toggle("is-sidebar-collapsed", collapsed);
            }
            window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
            updateButton(collapsed);
        });
        desktopQuery.addEventListener("change", applyDesktopState);
    }

    function bindLogout(logoutButton) {
        logoutButton.addEventListener("click", async () => {
            const confirmation = await UI.confirm({
                title: "Logout from system?",
                text: "Your current session will be closed.",
                confirmButtonText: "Logout"
            });
            if (!confirmation.isConfirmed) {
                return;
            }

            const token = getSessionToken();
            ApiClient.clearSession();
            ApiClient.fireAndForget("logout", { token });
            window.location.href = "index.html";
        });
    }

    function removeActionQuery() {
        const url = new URL(window.location.href);
        if (!url.searchParams.has("action")) {
            return;
        }
        url.searchParams.delete("action");
        window.history.replaceState({}, "", url.toString());
    }

    async function init(options) {
        const elements = {
            sidebar: document.getElementById("sidebar"),
            sidebarNav: document.getElementById("sidebarNav"),
            pageTitle: document.getElementById("pageTitle"),
            pageEyebrow: document.getElementById("pageEyebrow"),
            topbarActions: document.querySelector(".topbar__actions"),
            userName: document.getElementById("userName"),
            userRole: document.getElementById("userRole"),
            userAvatar: document.getElementById("userAvatar"),
            globalSearch: document.getElementById("globalSearch"),
            refreshButton: document.getElementById("refreshButton"),
            exportButton: document.getElementById("exportButton"),
            logoutButton: document.getElementById("logoutButton"),
            toggleSidebarBtn: null,
            heroPanel: document.getElementById("heroPanel"),
            viewContainer: document.getElementById("viewContainer")
        };

        const session = await validateSession();
        if (!session) {
            return null;
        }

        elements.userName.textContent = session.user.FullName || session.user.Username || "User";
        elements.userRole.textContent = formatRole(session.user.Role);
        elements.userAvatar.textContent = (session.user.FullName || session.user.Username || "U").charAt(0).toUpperCase();
        elements.pageTitle.textContent = options.title || config.appName;
        elements.pageEyebrow.textContent = options.eyebrow || config.projectProfile;
        elements.globalSearch.placeholder = options.searchPlaceholder || "Search current module";
        elements.toggleSidebarBtn = ensureSidebarToggleButton(elements);
        renderSidebar(options.currentView, session, elements.sidebarNav);
        updateSidebarAlerts(getSidebarAlertsState());
        bindSidebarGroupToggles(elements.sidebarNav);
        applyTooltips(elements.sidebarNav);
        bindSidebarToggle(elements.sidebar, elements.toggleSidebarBtn);
        bindLogout(elements.logoutButton);

        if (typeof options.onSearch === "function") {
            elements.globalSearch.addEventListener("input", (event) => {
                options.onSearch(event.target.value.trim(), { session, elements });
            });
        }

        const context = { session, elements };
        configureTopbarButtons(elements, options, context);

        if (typeof options.onRefresh === "function") {
            elements.refreshButton.addEventListener("click", async () => {
                try {
                    UI.loading("Refreshing data", "Loading the latest information");
                    await options.onRefresh(context);
                    Swal.close();
                } catch (error) {
                    Swal.close();
                    if (await handleSessionError(error)) {
                        return;
                    }
                    UI.alert({
                        icon: "error",
                        title: "Refresh failed",
                        text: error.message || "Unexpected error"
                    });
                }
            });
        }

        if (typeof options.onExport === "function") {
            elements.exportButton.addEventListener("click", async () => {
                try {
                    await options.onExport(context);
                } catch (error) {
                    Swal.close();
                    if (await handleSessionError(error)) {
                        return;
                    }
                    UI.alert({
                        icon: "error",
                        title: "Export failed",
                        text: error.message || "Unexpected error"
                    });
                }
            });
        }

        applyTooltips(document);
        return context;
    }

    function renderHero(heroPanel, model) {
        const statsMarkup = (model.stats || []).map((item) => `
            <div class="hero-stat">
                <p>${UI.escapeHtml(item.label)}</p>
                <strong>${UI.escapeHtml(String(item.value ?? 0))}</strong>
            </div>
        `).join("");

        const chipsMarkup = (model.meta || []).map((item) => `
            <span class="meta-chip"><i class="fa-solid ${item.icon}"></i>${UI.escapeHtml(item.text)}</span>
        `).join("");

        heroPanel.innerHTML = `
            <div>
                <p class="section-card__eyebrow">${UI.escapeHtml(model.profile || config.projectProfile)}</p>
                <h1 class="hero-panel__title">${UI.escapeHtml(model.title)}</h1>
                <p class="hero-panel__lead">${UI.escapeHtml(model.description)}</p>
                <div class="hero-panel__meta">${chipsMarkup}</div>
            </div>
            <div class="hero-panel__stats">${statsMarkup}</div>
        `;
    }

    window.AppShell = {
        canAccess,
        canDo,
        currentTimestampLabel,
        formatRole,
        getModule,
        getRoute,
        handleSessionError,
        init,
        normalizeRole,
        navigateTo,
        removeActionQuery,
        renderHero,
        updateSidebarAlerts
    };
})();
