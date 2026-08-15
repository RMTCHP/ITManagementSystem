(function () {
    const config = window.APP_CONFIG;
    const windowSessionKey = "__itms_session__";

    function clone(data) {
        return JSON.parse(JSON.stringify(data));
    }

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

    function nowIso() {
        return new Date().toISOString();
    }

    function nowDisplay() {
        return new Date().toISOString().slice(0, 19).replace("T", " ");
    }

    function getRequestTimeoutMs(action) {
        const timeoutMap = {
            login: 60000,
            dashboardSummary: 30000,
            listRecords: 30000,
            listKnowledgeCategories: 30000,
            createKnowledgeCategory: 30000,
            saveKnowledgeDocument: 90000,
            createPublicTicket: 60000,
            listPublicTicketJobs: 30000,
            getPublicTicketJobSummary: 30000,
            resolveTicket: 60000,
            createRecord: 30000,
            saveRecord: 30000,
            importRecords: 45000
        };
        return timeoutMap[action] || 15000;
    }

    function createToken() {
        return `mock-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    }

    function createStore() {
        return {
            sessions: [],
            data: clone(config.sampleData)
        };
    }

    function getStore() {
        const raw = localStorage.getItem(config.mockStorageKey);
        if (!raw) {
            const initial = createStore();
            localStorage.setItem(config.mockStorageKey, JSON.stringify(initial));
            return initial;
        }
        return JSON.parse(raw);
    }

    function saveStore(store) {
        localStorage.setItem(config.mockStorageKey, JSON.stringify(store));
    }

    function getModuleConfig(moduleKey) {
        return config.modules[moduleKey];
    }

    function normalizeRole(role) {
        return String(role || "").trim().toLowerCase();
    }

    function nextMockId(moduleKey, store) {
        const module = getModuleConfig(moduleKey);
        if (!module) {
            return "";
        }

        const prefixMap = {
            assets: "ITA",
            tickets: "TCK",
            accessRequests: "ACC",
            stockItems: "STK",
            stockMovements: "MOV",
            licenses: "LIC",
            documents: "DOC",
            users: "USR",
            auditLogs: "LOG"
        };

        const prefix = prefixMap[moduleKey] || module.idField.replace(/[^A-Z]/g, "").slice(0, 3) || "REC";
        const currentCount = ((store && store.data && store.data[moduleKey]) || []).length + 1;
        return `${prefix}-${String(currentCount).padStart(3, "0")}`;
    }

    function getMockUserByToken(store, token) {
        const session = store.sessions.find((item) => item.token === token && item.expiresAt > nowIso());
        if (!session) {
            return null;
        }
        const user = store.data.users.find((item) => item.UserID === session.userId);
        if (!user) {
            return null;
        }
        return {
            token: session.token,
            expiresAt: session.expiresAt,
            user: clone(user)
        };
    }

    function appendAudit(store, payload) {
        const nextNumber = String(store.data.auditLogs.length + 1).padStart(3, "0");
        store.data.auditLogs.unshift({
            LogID: `LOG-${nextNumber}`,
            Timestamp: nowDisplay(),
            Action: payload.action,
            Module: payload.module,
            RecordID: payload.recordId || "",
            ActorUserID: payload.actorUserId || "",
            ActorName: payload.actorName || "",
            ActorRole: payload.actorRole || "",
            Detail: payload.detail || ""
        });
    }

    function applyMockScope(moduleKey, records, currentUser) {
        if (normalizeRole(currentUser.Role) === "admin") {
            return records;
        }
        if (moduleKey === "tickets" || moduleKey === "accessRequests") {
            if (normalizeRole(currentUser.Role) === "user") {
                return records.filter((item) => item.Requester === currentUser.FullName || item.Requester === currentUser.Username);
            }
        }
        return records;
    }

    function computeDashboard(store, currentUser) {
        const isAdmin = currentUser && normalizeRole(currentUser.Role) === "admin";
        const assets = isAdmin ? (store.data.assets || []) : applyMockScope("assets", store.data.assets || [], currentUser);
        const tickets = currentUser ? applyMockScope("tickets", store.data.tickets || [], currentUser) : (store.data.tickets || []);
        const access = currentUser ? applyMockScope("accessRequests", store.data.accessRequests || [], currentUser) : (store.data.accessRequests || []);
        const stock = isAdmin ? (store.data.stockItems || []) : applyMockScope("stockItems", store.data.stockItems || [], currentUser);
        const licenses = isAdmin ? (store.data.licenses || []) : applyMockScope("licenses", store.data.licenses || [], currentUser);
        const auditLogs = isAdmin ? (store.data.auditLogs || []) : [];

        return {
            totalAssets: assets.reduce((total, item) => total + Number(item.Quantity || 0), 0),
            activeAssets: assets.length,
            repairAssets: 0,
            warrantyExpiring: assets.filter((item) => item.DateOfDepreciation && item.DateOfDepreciation <= "2026-12-31").length,
            openTickets: tickets.filter((item) => !["Resolved", "Closed", "Rejected"].includes(item.Status)).length,
            pendingApproval: tickets.filter((item) => item.ApprovalStatus === "Pending Approval").length + access.filter((item) => item.Status === "Pending Approval").length,
            lowStock: stock.filter((item) => item.StockStatus === "Low Stock").length,
            licenseExpiring: licenses.filter((item) => ["Expiring", "Expired"].includes(item.Status)).length,
            recentRequests: clone(tickets.slice(0, 5)),
            recentAuditLogs: clone(auditLogs.slice(0, 5))
        };
    }

    function assertMockPermission(user, moduleKey, type) {
        const module = getModuleConfig(moduleKey);
        if (!module) {
            throw new Error("Unknown module");
        }
        if (!(module.roles || []).some((role) => normalizeRole(role) === normalizeRole(user.Role))) {
            throw new Error("Access denied");
        }
        const allowedRoles = (module.permissions && module.permissions[type]) || [];
        if (allowedRoles.length && !allowedRoles.some((role) => normalizeRole(role) === normalizeRole(user.Role))) {
            throw new Error("Permission denied");
        }
    }

    function upsertMockRecord(store, moduleKey, payload, currentUser) {
        const collection = store.data[moduleKey];
        const module = getModuleConfig(moduleKey);
        const idField = module.idField;
        const timestamp = nowDisplay();
        const record = { ...payload };
        if (!String(record[idField] || "").trim()) {
            record[idField] = nextMockId(moduleKey, store);
        }
        const index = collection.findIndex((item) => item[idField] === record[idField]);
        record.UpdatedAt = timestamp;
        if (index === -1) {
            record.CreatedAt = timestamp;
            collection.unshift(record);
            appendAudit(store, {
                action: "CREATE",
                module: moduleKey,
                recordId: record[idField],
                actorUserId: currentUser.UserID,
                actorName: currentUser.FullName,
                actorRole: currentUser.Role,
                detail: `Created record in ${module.label}`
            });
        } else {
            record.CreatedAt = collection[index].CreatedAt || timestamp;
            collection[index] = record;
            appendAudit(store, {
                action: "UPDATE",
                module: moduleKey,
                recordId: record[idField],
                actorUserId: currentUser.UserID,
                actorName: currentUser.FullName,
                actorRole: currentUser.Role,
                detail: `Updated record in ${module.label}`
            });
        }
        if (moduleKey === "users" && payload.Password) {
            const account = config.mockAccounts.find((item) => item.userId === payload.UserID);
            if (account) {
                account.password = payload.Password;
            } else {
                config.mockAccounts.push({
                    username: payload.Username,
                    password: payload.Password,
                    userId: payload.UserID,
                    role: payload.Role
                });
            }
        }
        saveStore(store);
        return clone(record);
    }

    function deleteMockRecord(store, moduleKey, id, currentUser) {
        const collection = store.data[moduleKey];
        const module = getModuleConfig(moduleKey);
        const index = collection.findIndex((item) => item[module.idField] === id);
        if (index === -1) {
            throw new Error("Record not found");
        }
        collection.splice(index, 1);
        if (moduleKey === "users") {
            const accountIndex = config.mockAccounts.findIndex((item) => item.userId === id);
            if (accountIndex !== -1) {
                config.mockAccounts.splice(accountIndex, 1);
            }
        }
        appendAudit(store, {
            action: "DELETE",
            module: moduleKey,
            recordId: id,
            actorUserId: currentUser.UserID,
            actorName: currentUser.FullName,
            actorRole: currentUser.Role,
            detail: `Deleted record in ${module.label}`
        });
        saveStore(store);
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
        const retryableActions = new Set(["login", "checkSession", "dashboardSummary", "listRecords", "listKnowledgeCategories"]);

        try {
            response = await fetch(config.webAppUrl, requestOptions);
            if (response.status === 404 && retryableActions.has(action)) {
                await new Promise((resolve) => window.setTimeout(resolve, 700));
                response = await fetch(config.webAppUrl, requestOptions);
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
                throw new Error(`Apps Script Web App URL returned 404. Update webAppUrl in config.js and redeploy the latest code.gs.`);
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

    async function callMock(action, payload = {}) {
        const store = getStore();

        if (action === "login") {
            const normalizedUsername = String(payload.username || "").trim().toLowerCase();
            const account = config.mockAccounts.find((item) =>
                String(item.username || "").trim().toLowerCase() === normalizedUsername &&
                item.password === payload.password
            );
            if (!account) {
                throw new Error("Invalid username or password");
            }
            const user = store.data.users.find((item) => item.UserID === account.userId);
            const token = createToken();
            const expiresAt = new Date(Date.now() + config.sessionHours * 60 * 60 * 1000).toISOString();
            store.sessions = store.sessions.filter((item) => item.userId !== user.UserID);
            store.sessions.push({ token, userId: user.UserID, expiresAt });
            user.LastLogin = nowDisplay();
            appendAudit(store, {
                action: "LOGIN",
                module: "auth",
                recordId: user.UserID,
                actorUserId: user.UserID,
                actorName: user.FullName,
                actorRole: user.Role,
                detail: "User logged in via mock API"
            });
            saveStore(store);
            return { success: true, data: { token, expiresAt, user } };
        }

        if (action === "register") {
            const username = String(payload.username || "").trim();
            const email = String(payload.email || "").trim().toLowerCase();
            const fullName = String(payload.fullName || "").trim();
            const department = String(payload.department || "").trim();
            const password = String(payload.password || "").trim();

            if (!username || !fullName || !department || !password) {
                throw new Error("Registration data is incomplete");
            }
            if (store.data.users.some((item) => String(item.Username || "").toLowerCase() === username.toLowerCase())) {
                throw new Error("Username already exists");
            }
            if (email && store.data.users.some((item) => String(item.Email || "").toLowerCase() === email)) {
                throw new Error("Email already exists");
            }

            const userId = `USR-${String(store.data.users.length + 1).padStart(3, "0")}`;
            const now = nowDisplay();
            const user = {
                UserID: userId,
                Username: username,
                FullName: fullName,
                Department: department,
                Role: "User",
                Status: "Active",
                Email: email,
                LastLogin: "",
                CreatedAt: now,
                UpdatedAt: now
            };

            store.data.users.push(user);
            config.mockAccounts.push({
                username,
                password,
                userId,
                role: "User"
            });
            appendAudit(store, {
                action: "REGISTER",
                module: "auth",
                recordId: userId,
                actorUserId: userId,
                actorName: fullName,
                actorRole: "User",
                detail: "User self-registered account"
            });
            saveStore(store);
            return { success: true, data: { user: clone(user) } };
        }

        if (action === "checkSession") {
            const auth = getMockUserByToken(store, payload.token || getSessionToken());
            if (!auth) {
                return { success: true, data: { valid: false } };
            }
            return { success: true, data: { valid: true, token: auth.token, expiresAt: auth.expiresAt, user: auth.user } };
        }

        if (action === "logout") {
            const token = payload.token || getSessionToken();
            const auth = getMockUserByToken(store, token);
            if (auth) {
                store.sessions = store.sessions.filter((item) => item.token !== token);
                appendAudit(store, {
                    action: "LOGOUT",
                    module: "auth",
                    recordId: auth.user.UserID,
                    actorUserId: auth.user.UserID,
                    actorName: auth.user.FullName,
                    actorRole: auth.user.Role,
                    detail: "User logged out via mock API"
                });
                saveStore(store);
            }
            return { success: true, data: { loggedOut: true } };
        }

        const auth = getMockUserByToken(store, payload.token || getSessionToken());
        if (!auth) {
            throw new Error("Session expired or invalid");
        }
        const currentUser = auth.user;

        if (action === "dashboardSummary") {
            return { success: true, data: computeDashboard(store, currentUser) };
        }

        if (action === "listRecords") {
            const moduleKey = payload.module;
            const module = getModuleConfig(moduleKey);
            if (!module || !module.roles.includes(currentUser.Role)) {
                throw new Error("Access denied");
            }
            const records = clone(applyMockScope(moduleKey, store.data[moduleKey] || [], currentUser));
            return { success: true, data: { records } };
        }

        if (action === "saveRecord") {
            assertMockPermission(currentUser, payload.module, "edit");
            const record = upsertMockRecord(store, payload.module, payload.record, currentUser);
            return { success: true, data: { record } };
        }

        if (action === "createRecord") {
            assertMockPermission(currentUser, payload.module, "create");
            const record = upsertMockRecord(store, payload.module, payload.record, currentUser);
            return { success: true, data: { record } };
        }

        if (action === "deleteRecord") {
            assertMockPermission(currentUser, payload.module, "delete");
            deleteMockRecord(store, payload.module, payload.recordId, currentUser);
            return { success: true, data: { deleted: true } };
        }

        if (action === "importRecords") {
            assertMockPermission(currentUser, payload.module, "create");
            const imported = (Array.isArray(payload.records) ? payload.records : []).map((record) =>
                upsertMockRecord(store, payload.module, record, currentUser)
            );
            return { success: true, data: { importedCount: imported.length, records: imported } };
        }

        throw new Error(`Unsupported mock action: ${action}`);
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
