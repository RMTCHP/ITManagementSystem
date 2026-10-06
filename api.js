(function () {
    const config = window.APP_CONFIG;
    const windowSessionKey = "__itms_session__";

    function parseWindowNameSession() {
        try {
            if (!window.name || !window.name.startsWith(`${windowSessionKey}:`)) {
                return null;
            }
            return JSON.parse(window.name.slice(windowSessionKey.length + 1));
        } catch (error) {
            return null;
        }
    }

    function getSavedSession() {
        try {
            const sessionFromSessionStorage = JSON.parse(sessionStorage.getItem(config.sessionStorageKey) || "null");
            if (sessionFromSessionStorage && sessionFromSessionStorage.token) {
                return sessionFromSessionStorage;
            }
        } catch (error) {
        }

        try {
            const sessionFromLocalStorage = JSON.parse(localStorage.getItem(config.sessionStorageKey) || "null");
            if (sessionFromLocalStorage && sessionFromLocalStorage.token) {
                return sessionFromLocalStorage;
            }
        } catch (error) {
        }

        const sessionFromWindowName = parseWindowNameSession();
        if (sessionFromWindowName && sessionFromWindowName.token) {
            return sessionFromWindowName;
        }

        return null;
    }

    function getSessionToken() {
        const session = getSavedSession();
        return session && session.token ? session.token : "";
    }

    function saveSession(session) {
        const serialized = JSON.stringify(session);
        try {
            localStorage.setItem(config.sessionStorageKey, serialized);
        } catch (error) {
        }
        try {
            sessionStorage.setItem(config.sessionStorageKey, serialized);
        } catch (error) {
        }
        window.name = `${windowSessionKey}:${serialized}`;
    }

    function clearSession() {
        try {
            localStorage.removeItem(config.sessionStorageKey);
        } catch (error) {
        }
        try {
            sessionStorage.removeItem(config.sessionStorageKey);
        } catch (error) {
        }
        if (window.name && window.name.startsWith(`${windowSessionKey}:`)) {
            window.name = "";
        }
    }

    function getRequestTimeoutMs(action) {
        const timeoutMap = {
            login: 60000,
            recordLoginActivity: 30000,
            dashboardSummary: 60000,
            dashboardOverview: 60000,
            sidebarAlerts: 30000,
            listRecords: 30000,
            searchAssets: 30000,
            getPublicTicketWorkspace: 30000,
            listTicketWorkspace: 60000,
            getTicketRecord: 30000,
            listKnowledgeCategories: 30000,
            createKnowledgeCategory: 30000,
            renameKnowledgeCategory: 30000,
            deleteKnowledgeCategory: 120000,
            saveKnowledgeDocument: 90000,
            getKnowledgePreviewData: 60000,
            createPublicTicket: 60000,
            createUserRequest: 60000,
            listPublicInventoryItems: 30000,
            listPublicTicketJobs: 30000,
            getPublicTicketJobSummary: 30000,
            getTicketSignatures: 30000,
            listAssetAssignmentHistory: 30000,
            listComputerBorrowings: 30000,
            createComputerBorrowing: 60000,
            createComputerReturn: 60000,
            returnComputerBorrowing: 60000,
            getComputerBorrowingPdfData: 30000,
            resolveTicket: 60000,
            renewMaintenanceAgreement: 60000,
            createRecord: 30000,
            saveRecord: 30000,
            importRecords: 45000
        };
        return timeoutMap[action] || 15000;
    }

    async function callWebApp(action, payload = {}) {
        const body = new URLSearchParams();
        body.set("action", action);
        Object.entries(payload).forEach(([key, value]) => {
            if (value === undefined || value === null) {
                return;
            }
            body.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
        });

        const timeoutMs = getRequestTimeoutMs(action);
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
        let response;
        const requestOptions = {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
            },
            body: body.toString(),
            signal: controller.signal
        };
        const retryableActions = new Set(["login", "checkSession", "dashboardSummary", "dashboardOverview", "sidebarAlerts", "listRecords", "listTicketWorkspace", "listKnowledgeCategories"]);

        try {
            const retryDelays = [0, 800, 1800];
            for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
                if (retryDelays[attempt]) {
                    await new Promise((resolve) => window.setTimeout(resolve, retryDelays[attempt]));
                }
                response = await fetch(config.webAppUrl, requestOptions);
                if (response.status !== 404 || !retryableActions.has(action)) {
                    break;
                }
            }
        } catch (error) {
            if (error && error.name === "AbortError") {
                throw new Error(`API request timed out after ${Math.round(timeoutMs / 1000)} seconds`);
            }
            throw error;
        } finally {
            window.clearTimeout(timeoutId);
        }

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error("Apps Script Web App returned 404. Check that the deployment URL in config.js is active and accessible.");
            }
            throw new Error(`API request failed with status ${response.status}`);
        }

        const result = await response.json();
        if (!result.success) {
            const error = new Error(result.message || "Request failed");
            if (/^session expired or invalid$/i.test(error.message)) {
                error.code = "SESSION_EXPIRED";
            }
            throw error;
        }
        return result;
    }

    async function request(action, payload = {}) {
        const isWebAppReady = Boolean(config.webAppUrl && config.webAppUrl.startsWith("https://"));
        if (isWebAppReady) {
            return callWebApp(action, payload);
        }
        throw new Error("Google Apps Script Web App URL is not configured");
    }

    function fireAndForget(action, payload = {}) {
        const isWebAppReady = Boolean(config.webAppUrl && config.webAppUrl.startsWith("https://"));
        if (!isWebAppReady) {
            return;
        }

        const body = new URLSearchParams();
        body.set("action", action);
        Object.entries(payload).forEach(([key, value]) => {
            if (value === undefined || value === null) {
                return;
            }
            body.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
        });

        fetch(config.webAppUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
            },
            body: body.toString(),
            keepalive: true
        }).catch(() => {});
    }

    window.ApiClient = {
        request,
        fireAndForget,
        getSessionToken,
        getSavedSession,
        saveSession,
        clearSession
    };
})();
