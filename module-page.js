(function () {
    const moduleKey = document.body.dataset.module || "";
    const moduleConfig = AppShell.getModule(moduleKey);
    const state = {
        session: null,
        dashboard: null,
        records: [],
        stockItems: [],
        stockMovements: [],
        filters: {
            search: "",
            status: "",
            summary: "all",
            assetGroup: "all"
        },
        sort: {
            key: "",
            direction: "asc"
        },
        page: 1,
        pageSize: 8,
        heroView: "summary",
        movementTab: "outbound",
        movementDrafts: {
            outbound: {},
            inbound: {}
        }
    };

    function isAssetModule() {
        return moduleKey === "assets";
    }

    function isInventoryModule() {
        return moduleKey === "stockItems";
    }

    function isStockMovementModule() {
        return moduleKey === "stockMovements";
    }

    function needsDashboardSummary() {
        return isAssetModule() || isInventoryModule() || isStockMovementModule();
    }

    function getSortIndicator(fieldKey) {
        if (state.sort.key !== fieldKey) {
            return "";
        }
        return state.sort.direction === "asc" ? "▲" : "▼";
    }

    function getFieldConfig(fieldKey) {
        return (moduleConfig.fields || []).find((item) => item.key === fieldKey) || null;
    }

    function getFieldLabel(fieldKey) {
        const field = getFieldConfig(fieldKey);
        if (field && field.label) {
            return field.label;
        }

        return String(fieldKey || "")
            .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
            .replace(/_/g, " ")
            .trim();
    }

    function normalizeHeaderKey(value) {
        return String(value || "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");
    }

    function normalizeSearchText(value) {
        return String(value || "")
            .trim()
            .toLocaleLowerCase();
    }

    function formatImportDate(value) {
        if (value == null || value === "") {
            return "";
        }

        if (Object.prototype.toString.call(value) === "[object Date]" && !Number.isNaN(value.getTime())) {
            return value.toISOString().slice(0, 10);
        }

        if (typeof value === "number" && Number.isFinite(value)) {
            const parsed = XLSX.SSF.parse_date_code(value);
            if (parsed) {
                return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
            }
        }

        const raw = String(value).trim();
        if (!raw) {
            return "";
        }

        const isoMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (isoMatch) {
            return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
        }

        const localMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
        if (localMatch) {
            return `${localMatch[3]}-${localMatch[2].padStart(2, "0")}-${localMatch[1].padStart(2, "0")}`;
        }

        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toISOString().slice(0, 10);
        }

        return raw;
    }

    function normalizeImportedFieldValue(field, value) {
        if (!field) {
            return value;
        }

        if (field.type === "date") {
            return formatImportDate(value);
        }

        return value;
    }

    function mapImportedRows(rows) {
        const fieldLookup = {};
        const fieldConfigByKey = {};
        (moduleConfig.fields || []).forEach((field) => {
            fieldLookup[normalizeHeaderKey(field.key)] = field.key;
            fieldLookup[normalizeHeaderKey(field.label)] = field.key;
            fieldConfigByKey[field.key] = field;
        });
        fieldLookup[normalizeHeaderKey(moduleConfig.idField)] = moduleConfig.idField;

        return rows
            .map((row) => {
                const mapped = {};
                Object.keys(row || {}).forEach((header) => {
                    const fieldKey = fieldLookup[normalizeHeaderKey(header)];
                    if (fieldKey) {
                        mapped[fieldKey] = normalizeImportedFieldValue(fieldConfigByKey[fieldKey], row[header]);
                    }
                });
                return mapped;
            })
            .filter((row) => Object.keys(row).length > 0);
    }

    function formatDateDisplay(value) {
        const raw = String(value || "").trim();
        if (!raw) {
            return "-";
        }

        const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
            return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`;
        }

        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) {
            return [
                String(parsed.getDate()).padStart(2, "0"),
                String(parsed.getMonth() + 1).padStart(2, "0"),
                String(parsed.getFullYear())
            ].join("-");
        }

        return raw;
    }

    function formatDateTimeDisplay(value) {
        const raw = String(value || "").trim();
        if (!raw) {
            return "-";
        }

        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) {
            return [
                String(parsed.getDate()).padStart(2, "0"),
                String(parsed.getMonth() + 1).padStart(2, "0"),
                String(parsed.getFullYear())
            ].join("-") + " " + [
                String(parsed.getHours()).padStart(2, "0"),
                String(parsed.getMinutes()).padStart(2, "0")
            ].join(":");
        }

        const normalized = raw.replace("T", " ").replace(".000Z", "");
        const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
        if (match) {
            return `${match[3]}-${match[2]}-${match[1]} ${match[4]}:${match[5]}`;
        }

        return raw;
    }

    function parseRecordDate(value) {
        const raw = String(value || "").trim();
        if (!raw) {
            return null;
        }

        const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
            const year = Number(isoMatch[1]);
            const month = Number(isoMatch[2]) - 1;
            const day = Number(isoMatch[3]);
            const parsed = new Date(year, month, day);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        const localMatch = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
        if (localMatch) {
            const day = Number(localMatch[1]);
            const month = Number(localMatch[2]) - 1;
            const year = Number(localMatch[3]);
            const parsed = new Date(year, month, day);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        const parsed = new Date(raw);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    function buildAssetAgeFromDate(value) {
        const depreciationDate = parseRecordDate(value);
        if (!depreciationDate) {
            return "-";
        }

        const today = new Date();
        let years = today.getFullYear() - depreciationDate.getFullYear();
        let months = today.getMonth() - depreciationDate.getMonth();

        if (today.getDate() < depreciationDate.getDate()) {
            months -= 1;
        }

        if (months < 0) {
            years -= 1;
            months += 12;
        }

        if (years < 0) {
            return "0m";
        }

        if (years === 0 && months === 0) {
            return "0m";
        }

        if (years === 0) {
            return `${months}m`;
        }

        if (months === 0) {
            return `${years}y`;
        }

        return `${years}y ${months}m`;
    }

    function getAssetAgeMonths(value) {
        const depreciationDate = parseRecordDate(value);
        if (!depreciationDate) {
            return -1;
        }

        const today = new Date();
        let years = today.getFullYear() - depreciationDate.getFullYear();
        let months = today.getMonth() - depreciationDate.getMonth();

        if (today.getDate() < depreciationDate.getDate()) {
            months -= 1;
        }

        if (months < 0) {
            years -= 1;
            months += 12;
        }

        return Math.max(0, (years * 12) + months);
    }

    function getLifeTimeMonths(value) {
        const raw = String(value || "").trim().toLowerCase();
        if (!raw) {
            return -1;
        }

        const yearMatch = raw.match(/(\d+(?:\.\d+)?)\s*(year|years|yr|yrs|y)/);
        if (yearMatch) {
            return Math.round(Number(yearMatch[1]) * 12);
        }

        const monthMatch = raw.match(/(\d+(?:\.\d+)?)\s*(month|months|mo|mos|m)/);
        if (monthMatch) {
            return Math.round(Number(monthMatch[1]));
        }

        const numericOnly = Number(raw.replace(/[^0-9.]/g, ""));
        if (Number.isFinite(numericOnly) && numericOnly > 0) {
            return Math.round(numericOnly * 12);
        }

        return -1;
    }

    function getAssetLifeStatus(record) {
        const assetAgeMonths = getAssetAgeMonths(record.DateOfDepreciation);
        const lifeTimeMonths = getLifeTimeMonths(record.LifeTime);

        if (lifeTimeMonths < 0 || assetAgeMonths < 0) {
            return "Unknown";
        }

        return assetAgeMonths > lifeTimeMonths ? "Expired" : "Normal";
    }

    function getAssetLifeRemainingMonths(record) {
        const assetAgeMonths = getAssetAgeMonths(record.DateOfDepreciation);
        const lifeTimeMonths = getLifeTimeMonths(record.LifeTime);
        if (lifeTimeMonths < 0 || assetAgeMonths < 0) {
            return null;
        }
        return lifeTimeMonths - assetAgeMonths;
    }

    function getAssetSummaryStats() {
        const summary = {
            totalAssets: state.records.length,
            normalAssets: 0,
            expiredAssets: 0,
            expiringSoon: 0,
            unknownLifetime: 0,
            totalValueBaht: 0,
            groupCounts: {
                Computer: 0,
                Software: 0,
                "Office Equiment": 0
            }
        };

        state.records.forEach((record) => {
            const status = getAssetLifeStatus(record);
            const remainingMonths = getAssetLifeRemainingMonths(record);
            const amount = Number(String(record.AmountBaht || "").replace(/,/g, ""));
            const assetGroup = String(record.Group || "").trim();

            if (status === "Expired") {
                summary.expiredAssets += 1;
            }

            if (status === "Normal") {
                summary.normalAssets += 1;
            }

            if (status === "Unknown") {
                summary.unknownLifetime += 1;
            }

            if (remainingMonths !== null && remainingMonths >= 0 && remainingMonths <= 6) {
                summary.expiringSoon += 1;
            }

            if (Number.isFinite(amount)) {
                summary.totalValueBaht += amount;
            }

            if (Object.prototype.hasOwnProperty.call(summary.groupCounts, assetGroup)) {
                summary.groupCounts[assetGroup] += 1;
            }
        });

        return summary;
    }

    function getInventorySummaryStats() {
        const sourceRecords = isStockMovementModule() ? state.stockItems : state.records;
        const summary = {
            totalItems: sourceRecords.length,
            availableItems: 0,
            lowStockItems: 0,
            outOfStockItems: 0,
            totalUnits: 0,
            totalCategories: 0
        };

        const categories = new Set();

        sourceRecords.forEach((record) => {
            const quantity = Number(record.Quantity || 0);
            const minimumStock = Number(record.MinimumStock || 0);
            const category = String(record.Category || "").trim();

            if (category) {
                categories.add(category);
            }

            if (quantity <= 0) {
                summary.outOfStockItems += 1;
            } else if (quantity <= minimumStock) {
                summary.lowStockItems += 1;
            } else {
                summary.availableItems += 1;
            }

            if (Number.isFinite(quantity)) {
                summary.totalUnits += quantity;
            }
        });

        summary.totalCategories = categories.size;
        return summary;
    }

    function syncSidebarAlerts() {
        if (isAssetModule()) {
            const assetSummary = getAssetSummaryStats();
            AppShell.updateSidebarAlerts({
                expiringSoonAssets: assetSummary.expiringSoon,
                expiredAssets: assetSummary.expiredAssets
            });
            return;
        }

        if (moduleKey === "accessRequests") {
            const pendingAccessRequests = state.records.filter((record) => String(record.Status || "") === "Pending Approval").length;
            AppShell.updateSidebarAlerts({
                pendingAccessRequests
            });
            return;
        }

        if (isInventoryModule()) {
            const inventorySummary = getInventorySummaryStats();
            AppShell.updateSidebarAlerts({
                lowStock: inventorySummary.lowStockItems,
                outOfStock: inventorySummary.outOfStockItems
            });
            return;
        }

        if (isStockMovementModule()) {
            const inventorySummary = getInventorySummaryStats();
            AppShell.updateSidebarAlerts({
                lowStock: inventorySummary.lowStockItems,
                outOfStock: inventorySummary.outOfStockItems
            });
            return;
        }

        if (state.dashboard) {
            AppShell.updateSidebarAlerts(state.dashboard);
        }
    }

    function matchesAssetGroupFilter(record) {
        if (!isAssetModule()) {
            return true;
        }

        const assetGroup = state.filters.assetGroup || "all";
        if (assetGroup === "all") {
            return true;
        }
        return String(record.Group || "").trim() === assetGroup;
    }

    function matchesSummaryFilter(record) {
        if (isStockMovementModule()) {
            return true;
        }

        if (isInventoryModule()) {
            const quantity = Number(record.Quantity || 0);
            const minimumStock = Number(record.MinimumStock || 0);
            const summaryFilter = state.filters.summary || "all";

            if (summaryFilter === "available") {
                return quantity > minimumStock;
            }

            if (summaryFilter === "lowStock") {
                return quantity > 0 && quantity <= minimumStock;
            }

            if (summaryFilter === "outOfStock") {
                return quantity <= 0;
            }

            return true;
        }

        if (!isAssetModule()) {
            return true;
        }

        const summaryFilter = state.filters.summary || "all";
        if (summaryFilter === "all") {
            return true;
        }

        if (summaryFilter === "expired") {
            return getAssetLifeStatus(record) === "Expired";
        }

        if (summaryFilter === "normal") {
            return getAssetLifeStatus(record) === "Normal";
        }

        if (summaryFilter === "expiringSoon") {
            const remainingMonths = getAssetLifeRemainingMonths(record);
            return remainingMonths !== null && remainingMonths >= 0 && remainingMonths <= 6;
        }

        if (summaryFilter === "unknown") {
            return getAssetLifeStatus(record) === "Unknown";
        }

        return true;
    }

    function getRecordValue(record, fieldKey) {
        if (isStockMovementModule() && fieldKey === "ItemName") {
            const stockItem = state.stockItems.find((item) => String(item.ItemID || "") === String(record.ItemID || ""));
            return stockItem ? stockItem.ItemName : "-";
        }
        if (fieldKey === "AssetAge") {
            return buildAssetAgeFromDate(record.DateOfDepreciation);
        }
        if (fieldKey === "AssetLifeStatus") {
            return getAssetLifeStatus(record);
        }
        return record[fieldKey];
    }

    function getSortValue(record, fieldKey) {
        if (fieldKey === "AssetAge") {
            return getAssetAgeMonths(record.DateOfDepreciation);
        }
        if (fieldKey === "AssetLifeStatus") {
            const status = getAssetLifeStatus(record);
            if (status === "Expired") {
                return 2;
            }
            if (status === "Normal") {
                return 1;
            }
            return 0;
        }

        const field = getFieldConfig(fieldKey);
        const value = getRecordValue(record, fieldKey);
        if (field && field.type === "number") {
            const numeric = Number(value || 0);
            return Number.isFinite(numeric) ? numeric : 0;
        }

        return String(value || "");
    }

    function formatCellValue(fieldKey, value) {
        if (value == null || value === "") {
            return "-";
        }

        const field = getFieldConfig(fieldKey);
        if (field && field.type === "date") {
            return formatDateDisplay(value);
        }

        if (/^(LastLogin|CreatedAt|UpdatedAt|LastUpdated|Timestamp)$/i.test(fieldKey)) {
            return formatDateTimeDisplay(value);
        }

        if (fieldKey === "AmountBaht") {
            const amount = Number(String(value).replace(/,/g, ""));
            if (Number.isFinite(amount)) {
                return amount.toLocaleString("en-US");
            }
        }

        return String(value);
    }

    function getTodayInputValue() {
        const today = new Date();
        return [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, "0"),
            String(today.getDate()).padStart(2, "0")
        ].join("-");
    }

    function getMovementTypeFromTab(tabKey) {
        return tabKey === "inbound" ? "Inbound" : "Outbound";
    }

    function getOperatorName() {
        if (!state.session) {
            return "";
        }

        const sessionUser = state.session.user || state.session;
        return String(
            sessionUser.FullName ||
            sessionUser.fullName ||
            sessionUser.Username ||
            sessionUser.username ||
            sessionUser.UserID ||
            ""
        ).trim();
    }

    function getDefaultMovementDraft(tabKey) {
        return {
            MovementDate: getTodayInputValue(),
            ItemID: "",
            Quantity: "",
            ReferenceNo: "",
            PerformedBy: getOperatorName(),
            Remark: "",
            MovementType: getMovementTypeFromTab(tabKey)
        };
    }

    function getMovementDraft(tabKey = state.movementTab) {
        const existing = state.movementDrafts[tabKey] || {};
        const draft = {
            ...getDefaultMovementDraft(tabKey),
            ...existing,
            MovementType: getMovementTypeFromTab(tabKey)
        };
        if (!draft.ItemSearch && draft.ItemID) {
            const stockItem = getStockItemById(draft.ItemID);
            if (stockItem) {
                draft.ItemSearch = getStockItemSearchLabel(stockItem);
            }
        }
        return draft;
    }

    function getStockItemById(itemId) {
        return state.stockItems.find((item) => String(item.ItemID || "") === String(itemId || "")) || null;
    }

    function getStockItemSearchLabel(item) {
        const itemName = String((item && item.ItemName) || "").trim();
        const itemId = String((item && item.ItemID) || "").trim();
        return itemName || itemId;
    }

    function findStockItemBySearchLabel(label) {
        const normalized = normalizeSearchText(label);
        if (!normalized) {
            return null;
        }

        return state.stockItems.find((item) => normalizeSearchText(getStockItemSearchLabel(item)) === normalized) || null;
    }

    function getStockMovementFormSummary(itemId) {
        const item = getStockItemById(itemId);
        if (!item) {
            return null;
        }

        const quantity = Number(item.Quantity || 0);
        const minimumStock = Number(item.MinimumStock || 0);
        return {
            item,
            quantity: Number.isFinite(quantity) ? quantity : 0,
            minimumStock: Number.isFinite(minimumStock) ? minimumStock : 0,
            status: item.StockStatus || "-"
        };
    }

    async function openInventoryHistory(recordId) {
        const stockItem = state.records.find((item) => String(item.ItemID || "") === String(recordId || ""));
        if (!state.stockMovements.length) {
            UI.loading("Loading history", "Fetching inbound and outbound records");
            try {
                const movementResult = await ApiClient.request("listRecords", {
                    token: ApiClient.getSessionToken(),
                    module: "stockMovements"
                });
                state.stockMovements = movementResult.data.records || [];
            } finally {
                Swal.close();
            }
        }

        const movementRows = (state.stockMovements || [])
            .filter((item) => String(item.ItemID || "") === String(recordId || ""))
            .sort((left, right) => String(right.MovementDate || "").localeCompare(String(left.MovementDate || "")));

        const rowsMarkup = movementRows.map((item) => `
            <tr>
                <td>${UI.escapeHtml(formatDateDisplay(item.MovementDate))}</td>
                <td>${UI.badge(item.MovementType || "-")}</td>
                <td>${UI.escapeHtml(String(item.Quantity || "-"))}</td>
                <td>${UI.escapeHtml(item.PerformedBy || "-")}</td>
                <td>${UI.escapeHtml(item.ReferenceNo || "-")}</td>
                <td>${UI.escapeHtml(item.Remark || "-")}</td>
            </tr>
        `).join("");

        await Swal.fire({
            title: `Inventory History`,
            html: `
                <div class="inventory-history">
                    <div class="inventory-history__header">
                        <strong>${UI.escapeHtml(stockItem ? stockItem.ItemName || recordId : recordId)}</strong>
                        <span>${UI.escapeHtml(recordId)}</span>
                    </div>
                    <div class="data-table-wrap inventory-history__table">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Qty</th>
                                    <th>Performed By</th>
                                    <th>Reference</th>
                                    <th>Remark</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rowsMarkup || `<tr><td colspan="6">${UI.emptyState("No movement history", "This inventory item has no inbound or outbound records yet.")}</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>
            `,
            width: "min(1080px, calc(100vw - 32px))",
            confirmButtonText: "Close"
        });
    }

    function getCellClass(fieldKey) {
        const field = getFieldConfig(fieldKey);
        const classNames = ["cell-data"];

        if (fieldKey === moduleConfig.idField || /^(AssetID|FixedAssetNo|PONo|TicketID|RequestID|ItemID|MovementID|LicenseID|InfraID|DocumentID)$/i.test(fieldKey)) {
            classNames.push("cell-data--nowrap", "cell-data--id");
        }

        if (field && field.type === "date") {
            classNames.push("cell-data--nowrap", "cell-data--date");
        }

        if (field && field.type === "number") {
            classNames.push("cell-data--number");
        }

        if (/^(AssetName|ItemName|Title|Subject)$/i.test(fieldKey)) {
            classNames.push("cell-data--title");
        }

        if (/^(Location|Remark|Description|Detail)$/i.test(fieldKey)) {
            classNames.push("cell-data--wrap");
        }

        return classNames.join(" ");
    }

    async function loadDashboard() {
        const result = await ApiClient.request("dashboardSummary", { token: ApiClient.getSessionToken() });
        state.dashboard = result.data || {};
    }

    async function refreshSidebarAlertsInBackground() {
        try {
            await loadDashboard();
            syncSidebarAlerts();
        } catch (error) {
        }
    }

    async function loadModuleData() {
        if (isStockMovementModule()) {
            const [movementResult, inventoryResult] = await Promise.all([
                ApiClient.request("listRecords", {
                    token: ApiClient.getSessionToken(),
                    module: moduleKey
                }),
                ApiClient.request("listRecords", {
                    token: ApiClient.getSessionToken(),
                    module: "stockItems"
                })
            ]);
            state.records = movementResult.data.records || [];
            state.stockItems = inventoryResult.data.records || [];
            state.sort.key = "MovementDate";
            state.sort.direction = "desc";
            syncSidebarAlerts();
            return;
        }

        if (isInventoryModule()) {
            const inventoryResult = await ApiClient.request("listRecords", {
                token: ApiClient.getSessionToken(),
                module: moduleKey
            });
            state.records = inventoryResult.data.records || [];
            state.stockMovements = [];
            state.sort.key = moduleConfig.listFields[0] || "";
            state.sort.direction = "asc";
            syncSidebarAlerts();
            return;
        }

        const result = await ApiClient.request("listRecords", {
            token: ApiClient.getSessionToken(),
            module: moduleKey
        });
        state.records = result.data.records || [];
        state.stockMovements = [];
        state.sort.key = moduleConfig.listFields[0] || "";
        state.sort.direction = "asc";
        syncSidebarAlerts();
    }

    function upsertStateRecord(record, mode) {
        if (!record) {
            return;
        }

        const idField = moduleConfig.idField;
        const recordId = record[idField];
        const index = state.records.findIndex((item) => item[idField] === recordId);

        if (index === -1) {
            state.records.unshift(record);
            return;
        }

        state.records[index] = record;
        if (mode === "create" && index > 0) {
            state.records.splice(index, 1);
            state.records.unshift(record);
        }
    }

    function renderHero() {
        const heroPanel = document.getElementById("heroPanel");
        heroPanel.className = "hero-panel hero-panel--compact";
        heroPanel.style.display = "";
        if (isAssetModule() && state.heroView === "groups") {
            const assetSummary = getAssetSummaryStats();
            heroPanel.innerHTML = `
                <div class="hero-panel__group-stats hero-panel__group-stats--expanded">
                    ${[
                        { key: "Computer", label: "Computer", icon: "fa-computer", note: "Workstations and devices", tone: "computer" },
                        { key: "Software", label: "Software", icon: "fa-window-maximize", note: "Applications and licenses", tone: "software" },
                        { key: "Office Equiment", label: "Office Eq", icon: "fa-print", note: "Shared office equipment", tone: "office" }
                    ].map((groupItem) => `
                        <button
                            class="hero-stat hero-stat--button hero-stat--sub hero-stat--group hero-stat--group-${groupItem.tone} ${state.filters.assetGroup === groupItem.key ? "is-active" : ""}"
                            type="button"
                            data-group-filter="${UI.escapeHtml(groupItem.key)}"
                            title="Show ${UI.escapeHtml(groupItem.label)} assets"
                        >
                            <span class="hero-stat__icon"><i class="fa-solid ${groupItem.icon}"></i></span>
                            <div class="hero-stat__content">
                                <p>${UI.escapeHtml(groupItem.label)}</p>
                                <strong>${UI.escapeHtml(String(assetSummary.groupCounts[groupItem.key] || 0))}</strong>
                                <span class="hero-stat__note">${UI.escapeHtml(groupItem.note)}</span>
                            </div>
                        </button>
                    `).join("")}
                </div>
                <div class="hero-panel__actions">
                    <button class="ghost-btn hero-panel__back-btn" type="button" data-hero-view="summary" title="Back to summary">
                        <i class="fa-solid fa-arrow-left"></i>
                        <span>Back to Summary</span>
                    </button>
                </div>
            `;
            return;
        }

        if (isAssetModule()) {
            const assetSummary = getAssetSummaryStats();
            heroPanel.innerHTML = `
                <div class="hero-panel__stats hero-panel__stats--asset">
                    <button class="hero-stat hero-stat--button hero-stat--summary ${state.filters.summary === "all" ? "is-active" : ""}" type="button" data-summary-filter="all" title="Show all assets">
                        <p>Total Assets</p>
                        <strong>${UI.escapeHtml(String(assetSummary.totalAssets))}</strong>
                    </button>
                    <button class="hero-stat hero-stat--button hero-stat--summary ${state.filters.summary === "normal" ? "is-active" : ""}" type="button" data-summary-filter="normal" title="Show normal assets">
                        <p>Normal Assets</p>
                        <strong>${UI.escapeHtml(String(assetSummary.normalAssets))}</strong>
                    </button>
                    <button class="hero-stat hero-stat--button hero-stat--summary ${state.filters.summary === "expired" ? "is-active" : ""}" type="button" data-summary-filter="expired" title="Show expired assets">
                        <p>Expired Assets</p>
                        <strong>${UI.escapeHtml(String(assetSummary.expiredAssets))}</strong>
                    </button>
                    <button class="hero-stat hero-stat--button hero-stat--summary ${state.filters.summary === "expiringSoon" ? "is-active" : ""}" type="button" data-summary-filter="expiringSoon" title="Show assets expiring within 6 months">
                        <p>Expiring Soon</p>
                        <strong>${UI.escapeHtml(String(assetSummary.expiringSoon))}</strong>
                    </button>
                    <button class="hero-stat hero-stat--button hero-stat--summary ${state.filters.summary === "unknown" ? "is-active" : ""}" type="button" data-summary-filter="unknown" title="Show assets with unknown lifetime">
                        <p>Unknown Lifetime</p>
                        <strong>${UI.escapeHtml(String(assetSummary.unknownLifetime))}</strong>
                    </button>
                    <div class="hero-stat hero-stat--summary hero-stat--value">
                        <p>Total Value (Baht)</p>
                        <strong>${UI.escapeHtml(assetSummary.totalValueBaht.toLocaleString("en-US"))}</strong>
                    </div>
                </div>
            `;
            return;
        }

        if (isInventoryModule()) {
            const inventorySummary = getInventorySummaryStats();
            heroPanel.innerHTML = `
                <div class="hero-panel__stats hero-panel__stats--asset">
                    <button class="hero-stat hero-stat--button hero-stat--summary ${state.filters.summary === "all" ? "is-active" : ""}" type="button" data-summary-filter="all" title="Show all stock items">
                        <p>Total Items</p>
                        <strong>${UI.escapeHtml(String(inventorySummary.totalItems))}</strong>
                    </button>
                    <button class="hero-stat hero-stat--button hero-stat--summary ${state.filters.summary === "available" ? "is-active" : ""}" type="button" data-summary-filter="available" title="Show available stock">
                        <p>Available</p>
                        <strong>${UI.escapeHtml(String(inventorySummary.availableItems))}</strong>
                    </button>
                    <button class="hero-stat hero-stat--button hero-stat--summary ${state.filters.summary === "lowStock" ? "is-active" : ""}" type="button" data-summary-filter="lowStock" title="Show low stock items">
                        <p>Low Stock</p>
                        <strong>${UI.escapeHtml(String(inventorySummary.lowStockItems))}</strong>
                    </button>
                    <button class="hero-stat hero-stat--button hero-stat--summary ${state.filters.summary === "outOfStock" ? "is-active" : ""}" type="button" data-summary-filter="outOfStock" title="Show out of stock items">
                        <p>Out of Stock</p>
                        <strong>${UI.escapeHtml(String(inventorySummary.outOfStockItems))}</strong>
                    </button>
                    <div class="hero-stat hero-stat--summary">
                        <p>Total Units</p>
                        <strong>${UI.escapeHtml(String(inventorySummary.totalUnits))}</strong>
                    </div>
                    <div class="hero-stat hero-stat--summary hero-stat--value">
                        <p>Categories</p>
                        <strong>${UI.escapeHtml(String(inventorySummary.totalCategories))}</strong>
                    </div>
                </div>
            `;
            return;
        }

        if (isStockMovementModule()) {
            heroPanel.innerHTML = "";
            heroPanel.style.display = "none";
            return;
        }

        heroPanel.style.display = "";

        heroPanel.innerHTML = `
            <div class="hero-panel__stats hero-panel__stats--asset">
                <div class="hero-stat hero-stat--summary">
                    <p>Total Records</p>
                    <strong>${UI.escapeHtml(String(state.records.length))}</strong>
                </div>
                <div class="hero-stat hero-stat--summary">
                    <p>Create Access</p>
                    <strong>${UI.escapeHtml(AppShell.canDo(moduleConfig, "create", state.session) ? "Yes" : "No")}</strong>
                </div>
                <div class="hero-stat hero-stat--summary">
                    <p>Edit Access</p>
                    <strong>${UI.escapeHtml(AppShell.canDo(moduleConfig, "edit", state.session) ? "Yes" : "No")}</strong>
                </div>
                <div class="hero-stat hero-stat--summary hero-stat--value">
                    <p>Updated</p>
                    <strong>${UI.escapeHtml(AppShell.currentTimestampLabel())}</strong>
                </div>
            </div>
        `;
    }

    function getFilteredRecords() {
        let rows = [...state.records];

        if (isStockMovementModule()) {
            const movementType = getMovementTypeFromTab(state.movementTab).toLowerCase();
            rows = rows.filter((record) => String(record.MovementType || "").toLowerCase() === movementType);
            const draft = getMovementDraft();
            if (draft.ItemID) {
                rows = rows.filter((record) => String(record.ItemID || "") === String(draft.ItemID || ""));
            }
        }

        if (state.filters.search) {
            const q = normalizeSearchText(state.filters.search);
            rows = rows.filter((record) => {
                const values = Object.values(record);
                if (isStockMovementModule()) {
                    const stockItem = getStockItemById(record.ItemID);
                    if (stockItem) {
                        values.push(stockItem.ItemName, stockItem.Description);
                    }
                }
                return values.some((value) => normalizeSearchText(value).includes(q));
            });
        }

        rows = rows.filter((record) => matchesSummaryFilter(record));
        rows = rows.filter((record) => matchesAssetGroupFilter(record));

        if (state.filters.status && moduleConfig.statusField) {
            rows = rows.filter((record) => String(record[moduleConfig.statusField] || "") === state.filters.status);
        }

        if (state.sort.key) {
            rows.sort((left, right) => {
                const a = getSortValue(left, state.sort.key);
                const b = getSortValue(right, state.sort.key);
                if (typeof a === "number" && typeof b === "number") {
                    return state.sort.direction === "asc" ? a - b : b - a;
                }
                return state.sort.direction === "asc"
                    ? String(a).localeCompare(String(b))
                    : String(b).localeCompare(String(a));
            });
        }

        return rows;
    }

    function renderStockMovementWorkspace() {
        const filtered = getFilteredRecords();
        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
        const page = Math.min(state.page, totalPages);
        const start = (page - 1) * state.pageSize;
        const pageRows = filtered.slice(start, start + state.pageSize);
        const currentTab = state.movementTab;
        const draft = getMovementDraft(currentTab);
        const isInboundTab = currentTab === "inbound";
        const isAutoMovementTab = isInboundTab || currentTab === "outbound";
        const selectedSummary = getStockMovementFormSummary(draft.ItemID);
        const hasSelectedItem = Boolean(draft.ItemID);
        const tabTitle = currentTab === "inbound" ? "นำของเข้า" : "เบิกออก";
        const tabSubtitle = currentTab === "inbound"
            ? "บันทึกรับสินค้าเข้า Inventory และอัปเดตจำนวนคงเหลือทันที"
            : "บันทึกเบิกสินค้าออกจาก Inventory ตามใบร้องขอและอัปเดตจำนวนคงเหลือทันที";

        const itemOptions = state.stockItems
            .slice()
            .sort((left, right) => String(left.ItemName || "").localeCompare(String(right.ItemName || "")))
            .map((item) => `
                <option value="${UI.escapeHtml(getStockItemSearchLabel(item))}"></option>
            `)
            .join("");

        const rowsMarkup = pageRows.map((record) => {
            const stockItem = getStockItemById(record.ItemID);
            const itemName = stockItem ? stockItem.ItemName : "-";
            const editButton = AppShell.canDo(moduleConfig, "edit", state.session)
                ? `<button class="table-action" data-action="edit" data-id="${UI.escapeHtml(record[moduleConfig.idField])}" title="Edit"><i class="fa-solid fa-pen"></i></button>`
                : "";
            const deleteButton = AppShell.canDo(moduleConfig, "delete", state.session)
                ? `<button class="table-action table-action--danger" data-action="delete" data-id="${UI.escapeHtml(record[moduleConfig.idField])}" title="Delete"><i class="fa-solid fa-trash"></i></button>`
                : "";

            return `
                <tr>
                    <td><span class="cell-data cell-data--nowrap cell-data--date">${UI.escapeHtml(formatDateDisplay(record.MovementDate))}</span></td>
                    <td><span class="cell-data cell-data--nowrap cell-data--id">${UI.escapeHtml(record.ItemID || "-")}</span></td>
                    <td><span class="cell-data cell-data--title">${UI.escapeHtml(itemName)}</span></td>
                    <td><span class="cell-data cell-data--number">${UI.escapeHtml(String(record.Quantity || "-"))}</span></td>
                    <td><span class="cell-data cell-data--nowrap">${UI.escapeHtml(record.ReferenceNo || "-")}</span></td>
                    <td><span class="cell-data">${UI.escapeHtml(record.PerformedBy || "-")}</span></td>
                    <td><span class="cell-data cell-data--wrap">${UI.escapeHtml(record.Remark || "-")}</span></td>
                    <td>
                        <div class="table-actions">
                            ${editButton}
                            ${deleteButton}
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        document.getElementById("viewContainer").innerHTML = `
            <section class="table-panel stock-movement-panel">
                <div class="table-panel__header stock-movement-panel__header">
                    <div class="table-panel__header-copy">
                        <p class="section-card__eyebrow">Computer Work Order</p>
                        <h3>Stock Movement</h3>
                        <p class="table-panel__subtext">จัดการรับเข้าและเบิกออกจากคลังโดยอ้างอิงรายการสินค้าใน Inventory เดียวกัน</p>
                    </div>
                </div>

                <div class="stock-movement-tabs" role="tablist" aria-label="Stock movement type">
                    <button class="stock-tab ${currentTab === "outbound" ? "is-active" : ""}" type="button" data-movement-tab="outbound" title="เบิกของออกจากคลัง">
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        <span>เบิกออก</span>
                    </button>
                    <button class="stock-tab ${currentTab === "inbound" ? "is-active" : ""}" type="button" data-movement-tab="inbound" title="รับของเข้าคลัง">
                        <i class="fa-solid fa-arrow-down-to-square"></i>
                        <span>นำของเข้า</span>
                    </button>
                </div>

                <div class="stock-movement-form-card">
                    <div class="stock-movement-form-card__heading">
                        <div>
                            <p class="section-card__eyebrow">Part 1</p>
                            <h4>${UI.escapeHtml(tabTitle)}</h4>
                            <p>${UI.escapeHtml(tabSubtitle)}</p>
                        </div>
                        <button class="primary-btn" id="submitMovementButton" type="button" title="${UI.escapeHtml(tabTitle)}">
                            <i class="fa-solid ${currentTab === "inbound" ? "fa-box-open" : "fa-hand-holding"}"></i>
                            <span>${currentTab === "inbound" ? "บันทึกรับเข้า" : "บันทึกเบิกออก"}</span>
                        </button>
                    </div>

                    <div class="stock-movement-form">
                        ${isAutoMovementTab ? "" : `
                            <label class="stock-movement-field">
                                <span>วันที่รายการ <em>*</em></span>
                                <input type="date" data-movement-field="MovementDate" value="${UI.escapeHtml(draft.MovementDate || "")}">
                            </label>
                            <label class="stock-movement-field">
                                <span>ผู้ดำเนินการ <em>*</em></span>
                                <input type="text" data-movement-field="PerformedBy" value="${UI.escapeHtml(draft.PerformedBy || "")}" placeholder="ชื่อผู้เบิกหรือผู้รับเข้า">
                            </label>
                        `}
                        <label class="stock-movement-field stock-movement-field--item">
                            <span>เลือกรายการสินค้า <em>*</em></span>
                            <input
                                type="text"
                                data-movement-item-search
                                list="stockMovementItemOptions"
                                value="${UI.escapeHtml(draft.ItemSearch || "")}"
                                placeholder="พิมพ์ค้นหารายการสินค้า"
                                autocomplete="off"
                            >
                            <datalist id="stockMovementItemOptions">${itemOptions}</datalist>
                            <input type="hidden" data-movement-field="ItemID" value="${UI.escapeHtml(draft.ItemID || "")}">
                        </label>
                        <label class="stock-movement-field stock-movement-field--qty">
                            <span>จำนวน <em>*</em></span>
                            <input type="number" min="1" step="1" data-movement-field="Quantity" value="${UI.escapeHtml(draft.Quantity || "")}" placeholder="0">
                        </label>
                        ${isAutoMovementTab ? "" : `
                            <label class="stock-movement-field">
                                <span>เลขอ้างอิง</span>
                                <input type="text" data-movement-field="ReferenceNo" value="${UI.escapeHtml(draft.ReferenceNo || "")}" placeholder="REQ / GRN / PO / Form No.">
                            </label>
                        `}
                        <label class="stock-movement-field stock-movement-field--full">
                            <span>รายละเอียด</span>
                            <textarea data-movement-field="Remark" placeholder="ระบุเหตุผลการเบิก, หน่วยงาน, จุดใช้งาน หรือรายละเอียดรับเข้า">${UI.escapeHtml(draft.Remark || "")}</textarea>
                        </label>
                    </div>

                    <div class="stock-movement-item-summary ${selectedSummary ? "" : "is-empty"}">
                        ${selectedSummary ? `
                            <div class="stock-movement-item-summary__title">
                                <strong>${UI.escapeHtml(selectedSummary.item.ItemName || "-")}</strong>
                                <span>${UI.escapeHtml(selectedSummary.item.Description || "")}</span>
                            </div>
                            <div class="stock-movement-item-summary__stats">
                                <div><span>Current Stock</span><strong>${UI.escapeHtml(String(selectedSummary.quantity))}</strong></div>
                                <div><span>Minimum Stock</span><strong>${UI.escapeHtml(String(selectedSummary.minimumStock))}</strong></div>
                                <div><span>Status</span>${UI.badge(selectedSummary.status)}</div>
                            </div>
                            ${selectedSummary.item.Description ? "" : `<p class="stock-movement-item-summary__note">No description</p>`}
                        ` : `
                            <div class="stock-movement-item-summary__placeholder">
                                <i class="fa-solid fa-boxes-stacked"></i>
                                <p>เลือกรายการสินค้าเพื่อดูจำนวนคงเหลือและสถานะล่าสุด</p>
                            </div>
                        `}
                    </div>
                </div>

                <div class="stock-movement-toolbar__meta">
                    <span>Movement history moved to Inventory actions for each item.</span>
                </div>
            </section>
        `;
    }

    function renderTable() {
        if (isStockMovementModule()) {
            renderStockMovementWorkspace();
            return;
        }

        const filtered = getFilteredRecords();
        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
        const page = Math.min(state.page, totalPages);
        const start = (page - 1) * state.pageSize;
        const pageRows = filtered.slice(start, start + state.pageSize);
        const statusValues = moduleConfig.statusField
            ? [...new Set(state.records.map((record) => record[moduleConfig.statusField]).filter(Boolean))]
            : [];

        const canCreate = AppShell.canDo(moduleConfig, "create", state.session);
        const createButton = canCreate
            ? `<button class="primary-btn" id="createRecordButton" title="Add record"><i class="fa-solid fa-plus"></i><span>Add Record</span></button>`
            : "";

        const headerCells = moduleConfig.listFields.map((fieldKey) => `
            <th>
                <button data-sort="${fieldKey}" title="Sort by ${UI.escapeHtml(getFieldLabel(fieldKey))}">
                    ${UI.escapeHtml(getFieldLabel(fieldKey))}
                    ${getSortIndicator(fieldKey)}
                </button>
            </th>
        `).join("");

        const rowsMarkup = pageRows.map((record) => {
            const cells = moduleConfig.listFields.map((fieldKey) => {
                const displayValue = getRecordValue(record, fieldKey);
                if (fieldKey === "Priority") {
                    return `<td>${UI.badge(record[fieldKey], "priority")}</td>`;
                }
                if (fieldKey === "LinkURL") {
                    return `<td><a href="${UI.escapeHtml(record[fieldKey] || "#")}" target="_blank" rel="noopener noreferrer">Open Link</a></td>`;
                }
                if (fieldKey === moduleConfig.statusField || fieldKey === "AssetLifeStatus") {
                    return `<td>${UI.badge(displayValue)}</td>`;
                }
                return `<td><span class="${getCellClass(fieldKey)}">${UI.escapeHtml(formatCellValue(fieldKey, displayValue))}</span></td>`;
            }).join("");

            const editButton = AppShell.canDo(moduleConfig, "edit", state.session)
                ? `<button class="table-action" data-action="edit" data-id="${UI.escapeHtml(record[moduleConfig.idField])}" title="Edit"><i class="fa-solid fa-pen"></i></button>`
                : "";
            const deleteButton = AppShell.canDo(moduleConfig, "delete", state.session)
                ? `<button class="table-action table-action--danger" data-action="delete" data-id="${UI.escapeHtml(record[moduleConfig.idField])}" title="Delete"><i class="fa-solid fa-trash"></i></button>`
                : "";
            const historyButton = isInventoryModule()
                ? `<button class="table-action table-action--info" data-action="history" data-id="${UI.escapeHtml(record[moduleConfig.idField])}" title="View history"><i class="fa-solid fa-clock-rotate-left"></i></button>`
                : "";

            return `
                <tr>
                    ${cells}
                    <td>
                        <div class="table-actions">
                            ${historyButton}
                            ${editButton}
                            ${deleteButton}
                        </div>
                    </td>
                </tr>
            `;
        }).join("");

        document.getElementById("viewContainer").innerHTML = `
            <section class="table-panel">
                <div class="table-panel__header">
                    <div class="table-panel__header-copy">
                        <p class="section-card__eyebrow">Module Data</p>
                        <h3>Records Table</h3>
                        <p class="table-panel__subtext">Search, filter, sort and maintain ${UI.escapeHtml(moduleConfig.label.toLowerCase())} records.</p>
                    </div>
                    <div class="table-panel__header-actions">
                        ${createButton}
                    </div>
                </div>

                <input id="importExcelInput" type="file" accept=".xlsx,.xls,.csv" class="hidden">

                <div class="toolbar">
                    <div class="toolbar__filters">
                        <select id="statusFilter">
                            <option value="">All status</option>
                            ${statusValues.map((status) => `<option value="${UI.escapeHtml(status)}" ${state.filters.status === status ? "selected" : ""}>${UI.escapeHtml(status)}</option>`).join("")}
                        </select>
                        <select id="pageSizeSelect">
                            ${[8, 12, 20, 50].map((size) => `<option value="${size}" ${state.pageSize === size ? "selected" : ""}>${size} rows</option>`).join("")}
                        </select>
                    </div>
                    <div class="toolbar__actions"></div>
                </div>

                <div class="data-table-wrap">
                    <table class="data-table">
                        <thead>
                            <tr>
                                ${headerCells}
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsMarkup || `<tr><td colspan="${moduleConfig.listFields.length + 1}">${UI.emptyState("No matching records", "Try a different filter or create a new record.")}</td></tr>`}
                        </tbody>
                    </table>
                </div>

                <div class="pagination">
                    <div class="pagination__info">Showing ${total ? start + 1 : 0}-${Math.min(start + state.pageSize, total)} of ${total} records</div>
                    <div class="toolbar__actions">
                        <button class="ghost-btn" id="prevPageButton" title="Previous page" ${page <= 1 ? "disabled" : ""}>Previous</button>
                        <button class="ghost-btn" id="nextPageButton" title="Next page" ${page >= totalPages ? "disabled" : ""}>Next</button>
                    </div>
                </div>
            </section>
        `;
    }

    async function exportModule(format) {
        const confirmation = await UI.confirm({
            title: `Export ${moduleConfig.label}?`,
            text: `The current dataset will be exported as ${format.toUpperCase()}.`,
            confirmButtonText: "Export"
        });
        if (!confirmation.isConfirmed) {
            return;
        }

        UI.loading("Exporting data", `Preparing ${moduleConfig.label} ${format.toUpperCase()} file`);
        const fileName = `${moduleConfig.key}_${UI.buildTimestampForFileName()}`;
        if (format === "csv") {
            UI.exportToCsv(fileName, state.records);
        } else {
            UI.exportToExcel(fileName, state.records);
        }
        Swal.close();
        UI.toast("success", "Export completed", `${moduleConfig.label} exported as ${format.toUpperCase()}.`);
    }

    async function importExcelFile(file) {
        if (typeof XLSX === "undefined") {
            throw new Error("Excel import library is not available");
        }

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheet = workbook.SheetNames[0];
        if (!firstSheet) {
            throw new Error("Excel file has no worksheet");
        }

        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: "" });
        const mappedRows = mapImportedRows(rows);
        if (!mappedRows.length) {
            throw new Error("No matching columns found for this module");
        }

        const confirmation = await UI.confirm({
            title: `Import ${mappedRows.length} records?`,
            text: `The selected Excel file will be imported into ${moduleConfig.label}.`,
            confirmButtonText: "Import"
        });
        if (!confirmation.isConfirmed) {
            return;
        }

        UI.loading("Importing Excel", `Saving ${mappedRows.length} records to ${moduleConfig.label}`);
        const result = await ApiClient.request("importRecords", {
            token: ApiClient.getSessionToken(),
            module: moduleKey,
            records: mappedRows
        });
        await loadModuleData();
        syncSidebarAlerts();
        renderHero();
        renderTable();
        Swal.close();
        const importedCount = result.data.importedCount || 0;
        const skippedCount = result.data.skippedCount || 0;
        const importMessage = skippedCount
            ? `${importedCount} records imported, ${skippedCount} duplicate rows skipped.`
            : `${importedCount} records imported successfully.`;
        UI.toast("success", "Import completed", importMessage);
    }

    async function saveRecord(mode, record) {
        const action = mode === "create" ? "createRecord" : "saveRecord";
        const confirmation = await UI.confirm({
            title: mode === "create" ? "Create this record?" : "Update this record?",
            text: `${moduleConfig.label} data will be ${mode === "create" ? "created" : "updated"}.`,
            confirmButtonText: mode === "create" ? "Create" : "Update"
        });
        if (!confirmation.isConfirmed) {
            return;
        }

        UI.loading(
            mode === "create" ? "Creating record" : "Updating record",
            `${mode === "create" ? "Saving" : "Updating"} ${moduleConfig.label.toLowerCase()} data`
        );
        try {
            const result = await ApiClient.request(action, {
                token: ApiClient.getSessionToken(),
                module: moduleKey,
                record
            });
            if (isStockMovementModule()) {
                await renderPage();
                Swal.close();
                UI.toast("success", mode === "create" ? "Record created" : "Record updated", `${moduleConfig.label} saved successfully.`);
                return result;
            }
            upsertStateRecord(result.data && result.data.record ? result.data.record : record, mode);
            syncSidebarAlerts();
            renderHero();
            renderTable();
            Swal.close();
            UI.toast("success", mode === "create" ? "Record created" : "Record updated", `${moduleConfig.label} saved successfully.`);
        } catch (error) {
            Swal.close();
            await UI.alert({
                icon: "error",
                title: mode === "create" ? "Create failed" : "Update failed",
                text: error.message || "Unexpected error"
            });
            throw error;
        }
    }

    async function openRecordModal(mode, recordId = "") {
        const existing = recordId ? state.records.find((item) => item[moduleConfig.idField] === recordId) : {};
        const result = await UI.openFormModal(moduleConfig, existing, mode);
        if (!result.isConfirmed || !result.value) {
            return;
        }

        const values = { ...existing, ...result.value };
        try {
            await saveRecord(mode, values);
        } catch (error) {
        }
    }

    async function deleteRecord(recordId) {
        const confirmation = await UI.confirm({
            title: "Delete selected record?",
            text: `This will remove ${recordId} from ${moduleConfig.label}.`,
            icon: "warning",
            confirmButtonText: "Delete"
        });
        if (!confirmation.isConfirmed) {
            return;
        }

        UI.loading("Deleting record", "Please wait while data is being removed");
        await ApiClient.request("deleteRecord", {
            token: ApiClient.getSessionToken(),
            module: moduleKey,
            recordId
        });
        if (isStockMovementModule()) {
            await renderPage();
            Swal.close();
            UI.toast("success", "Record deleted", `${recordId} removed successfully.`);
            return;
        }
        state.records = state.records.filter((item) => item[moduleConfig.idField] !== recordId);
        syncSidebarAlerts();
        renderHero();
        renderTable();
        Swal.close();
        UI.toast("success", "Record deleted", `${recordId} removed successfully.`);
    }

    function attachEvents() {
        document.getElementById("heroPanel").addEventListener("click", (event) => {
            const heroViewButton = event.target.closest("[data-hero-view]");
            if (heroViewButton) {
                state.heroView = heroViewButton.getAttribute("data-hero-view") || "summary";
                state.filters.assetGroup = "all";
                renderHero();
                renderTable();
                return;
            }

            const groupButton = event.target.closest("[data-group-filter]");
            if (groupButton) {
                const currentGroup = groupButton.getAttribute("data-group-filter") || "all";
                state.filters.assetGroup = state.filters.assetGroup === currentGroup ? "all" : currentGroup;
                state.page = 1;
                renderHero();
                renderTable();
                return;
            }

            const button = event.target.closest("[data-summary-filter]");
            if (!button) {
                return;
            }

            const nextSummary = button.getAttribute("data-summary-filter") || "all";
            state.filters.summary = nextSummary;
            state.filters.assetGroup = "all";
            state.heroView = isAssetModule() && nextSummary === "all" ? "groups" : "summary";
            state.page = 1;
            renderHero();
            renderTable();
        });

        document.getElementById("viewContainer").addEventListener("click", async (event) => {
            const movementTabButton = event.target.closest("[data-movement-tab]");
            if (movementTabButton) {
                state.movementTab = movementTabButton.getAttribute("data-movement-tab") || "outbound";
                state.page = 1;
                renderHero();
                renderTable();
                return;
            }

            if (event.target.closest("#submitMovementButton")) {
                const draft = getMovementDraft();
                const selectedItem = getStockItemById(draft.ItemID);
                const quantity = Number(draft.Quantity || 0);
                const movementRecord = {
                    ...draft,
                    MovementType: getMovementTypeFromTab(state.movementTab),
                    MovementDate: (state.movementTab === "inbound" || state.movementTab === "outbound") ? getTodayInputValue() : draft.MovementDate,
                    PerformedBy: (state.movementTab === "inbound" || state.movementTab === "outbound")
                        ? getOperatorName()
                        : draft.PerformedBy,
                    ReferenceNo: (state.movementTab === "inbound" || state.movementTab === "outbound") ? "" : draft.ReferenceNo
                };

                if (!movementRecord.MovementDate) {
                    await UI.alert({ icon: "warning", title: "Missing date", text: "Please select movement date." });
                    return;
                }

                if (!movementRecord.PerformedBy) {
                    await UI.alert({ icon: "warning", title: "Missing operator", text: "Please enter performed by." });
                    return;
                }

                if (!draft.ItemID || !selectedItem) {
                    await UI.alert({ icon: "warning", title: "Missing item", text: "Please select inventory item." });
                    return;
                }

                if (!Number.isFinite(quantity) || quantity <= 0) {
                    await UI.alert({ icon: "warning", title: "Invalid quantity", text: "Quantity must be greater than zero." });
                    return;
                }

                if (state.movementTab === "outbound" && quantity > Number(selectedItem.Quantity || 0)) {
                    await UI.alert({
                        icon: "warning",
                        title: "Insufficient stock",
                        text: `Current stock for ${selectedItem.ItemName} is ${selectedItem.Quantity || 0}.`
                    });
                    return;
                }

                await saveRecord("create", {
                    ...movementRecord
                });
                state.movementDrafts[state.movementTab] = getDefaultMovementDraft(state.movementTab);
                renderHero();
                renderTable();
                return;
            }

            if (event.target.closest("#createRecordButton")) {
                await openRecordModal("create");
                return;
            }

            if (event.target.closest("#prevPageButton")) {
                state.page = Math.max(1, state.page - 1);
                renderTable();
                return;
            }

            if (event.target.closest("#nextPageButton")) {
                state.page += 1;
                renderTable();
                return;
            }

            const actionButton = event.target.closest("[data-action]");
            if (actionButton) {
                const action = actionButton.getAttribute("data-action");
                const id = actionButton.getAttribute("data-id");
                if (action === "history") {
                    await openInventoryHistory(id);
                } else if (action === "edit") {
                    await openRecordModal("edit", id);
                } else if (action === "delete") {
                    await deleteRecord(id);
                }
                return;
            }

            const sortButton = event.target.closest("[data-sort]");
            if (sortButton) {
                const sortKey = sortButton.getAttribute("data-sort");
                if (state.sort.key === sortKey) {
                    state.sort.direction = state.sort.direction === "asc" ? "desc" : "asc";
                } else {
                    state.sort.key = sortKey;
                    state.sort.direction = "asc";
                }
                renderTable();
            }
        });

        document.getElementById("viewContainer").addEventListener("change", (event) => {
            if (event.target.matches("[data-movement-item-search]")) {
                const stockItem = findStockItemBySearchLabel(event.target.value);
                state.movementDrafts[state.movementTab] = {
                    ...getMovementDraft(),
                    ItemID: stockItem ? stockItem.ItemID : "",
                    ItemSearch: event.target.value
                };
                renderTable();
                return;
            }

            const movementField = event.target.getAttribute("data-movement-field");
            if (movementField) {
                const nextDraft = {
                    ...getMovementDraft(),
                    [movementField]: event.target.value
                };
                state.movementDrafts[state.movementTab] = nextDraft;
                if (movementField === "ItemID") {
                    renderTable();
                }
                return;
            }

            if (event.target.id === "importExcelInput") {
                const file = event.target.files && event.target.files[0];
                if (file) {
                    importExcelFile(file).catch((error) => {
                        Swal.close();
                        UI.alert({
                            icon: "error",
                            title: "Import failed",
                            text: error.message || "Unable to import Excel file"
                        });
                    });
                }
                return;
            }

            if (event.target.id === "statusFilter") {
                state.filters.status = event.target.value;
                state.page = 1;
                renderTable();
                return;
            }

            if (event.target.id === "pageSizeSelect") {
                state.pageSize = Number(event.target.value);
                state.page = 1;
                renderTable();
            }
        });

        document.getElementById("viewContainer").addEventListener("input", (event) => {
            if (event.target.matches("[data-movement-item-search]")) {
                const stockItem = findStockItemBySearchLabel(event.target.value);
                state.movementDrafts[state.movementTab] = {
                    ...getMovementDraft(),
                    ItemID: stockItem ? stockItem.ItemID : "",
                    ItemSearch: event.target.value
                };
                return;
            }

            const movementField = event.target.getAttribute("data-movement-field");
            if (!movementField) {
                return;
            }

            state.movementDrafts[state.movementTab] = {
                ...getMovementDraft(),
                [movementField]: event.target.value
            };
        });
    }

    async function renderPage() {
        if (needsDashboardSummary()) {
            await Promise.all([loadDashboard(), loadModuleData()]);
        } else {
            await loadModuleData();
            refreshSidebarAlertsInBackground();
        }
        syncSidebarAlerts();
        renderHero();
        renderTable();
    }

    async function bootstrap() {
        if (!moduleConfig) {
            UI.alert({ icon: "error", title: "Module unavailable", text: "Invalid module page." });
            return;
        }

        const shell = await AppShell.init({
            currentView: moduleKey,
            title: moduleConfig.label,
            eyebrow: "Module Workspace",
            searchPlaceholder: `Search ${moduleConfig.label.toLowerCase()}`,
            onSearch(value) {
                state.filters.search = value;
                state.page = 1;
                renderTable();
            },
            async onImport() {
                if (!AppShell.canDo(moduleConfig, "create", state.session)) {
                    throw new Error("You do not have permission to import files in this module");
                }

                const fileInput = document.getElementById("importExcelInput");
                if (!fileInput) {
                    throw new Error("Import input is not available");
                }

                fileInput.value = "";
                fileInput.click();
            },
            async onRefresh() {
                await renderPage();
            },
            async onExport() {
                await exportModule("xlsx");
            }
        });

        if (!shell) {
            return;
        }

        state.session = shell.session;
        if (!AppShell.canAccess(moduleKey, state.session)) {
            Swal.close();
            await UI.alert({
                icon: "warning",
                title: "Access denied",
                text: "Your role cannot access this module."
            });
            AppShell.navigateTo("dashboard");
            return;
        }

        attachEvents();

        try {
            UI.loading("Loading module", `Fetching ${moduleConfig.label.toLowerCase()} data`);
            await renderPage();
            Swal.close();
            const action = new URL(window.location.href).searchParams.get("action");
            if (action === "create" && AppShell.canDo(moduleConfig, "create", state.session)) {
                if (isStockMovementModule()) {
                    const target = document.querySelector(".stock-movement-form-card");
                    if (target) {
                        target.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                } else {
                    await openRecordModal("create");
                }
                AppShell.removeActionQuery();
            }
        } catch (error) {
            Swal.close();
            UI.alert({
                icon: "error",
                title: "Module failed",
                text: error.message || "Unexpected error"
            });
        }
    }

    bootstrap();
})();
