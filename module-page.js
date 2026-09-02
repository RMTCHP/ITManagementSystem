(function () {
    const moduleKey = document.body.dataset.module || "";
    const moduleConfig = AppShell.getModule(moduleKey);
    const initialQuery = new URLSearchParams(window.location.search);
    const state = {
        session: null,
        dashboard: null,
        records: [],
        stockItems: [],
        stockMovements: [],
        knowledgeCategories: [],
        filters: {
            search: "",
            status: "",
            summary: initialQuery.get("summary") || "all",
            assetGroup: "all",
            knowledgeCategory: "all",
            knowledgeType: "",
            ticketStartDate: "",
            ticketEndDate: "",
            ticketService: "",
            ticketStatus: initialQuery.get("ticketStatus") || ""
        },
        sort: {
            key: "",
            direction: "asc"
        },
        page: 1,
        pageSize: 8,
        heroView: "summary",
        ticketJobsVisible: false,
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

    function isKnowledgeModule() {
        return moduleKey === "documents";
    }

    function isTicketModule() {
        return moduleKey === "tickets";
    }

    function isAccessRequestModule() {
        return moduleKey === "accessRequests";
    }

    const accessRequestForms = [
        { type: "AD Account", label: "บัญชี AD", description: "สร้างหรือปิดใช้งานบัญชีผู้ใช้", icon: "fa-user-gear", tone: "blue", options: ["Create AD User", "Disable AD User"] },
        { type: "Password Reset", label: "Reset Password", description: "ขอรีเซ็ตรหัสผ่านบัญชีผู้ใช้", icon: "fa-key", tone: "amber" },
        { type: "Shared Folder Permission", label: "Shared Folder", description: "ขอเพิ่มหรือแก้ไขสิทธิ์โฟลเดอร์", icon: "fa-folder-open", tone: "green" },
        { type: "Email Group", label: "Email Group", description: "ขอเพิ่มหรือลบสมาชิกกลุ่มอีเมล", icon: "fa-envelope-circle-check", tone: "violet" },
        { type: "ERP / D365 Permission", label: "ERP / D365", description: "ขอสิทธิ์ใช้งานระบบ ERP หรือ D365", icon: "fa-chart-line", tone: "cyan" },
        { type: "VPN Permission", label: "VPN", description: "ขอสิทธิ์เชื่อมต่อระบบจากภายนอก", icon: "fa-shield-halved", tone: "slate" }
    ];

    function needsDashboardSummary() {
        return isAssetModule();
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

        // Date cells from Google Sheets can arrive as UTC ISO strings. Convert before extracting the date.
        if (/^\d{4}-\d{2}-\d{2}T.*Z$/i.test(raw)) {
            const utcDate = new Date(raw);
            if (!Number.isNaN(utcDate.getTime())) {
                return [
                    String(utcDate.getDate()).padStart(2, "0"),
                    String(utcDate.getMonth() + 1).padStart(2, "0"),
                    String(utcDate.getFullYear())
                ].join("-");
            }
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

    function getDateFilterKey(value) {
        const displayDate = formatDateDisplay(value);
        const match = String(displayDate).match(/^(\d{2})-(\d{2})-(\d{4})$/);
        return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
    }

    function formatTimeDisplay(value) {
        if (value == null || value === "") {
            return "-";
        }

        const raw = String(value).trim();
        const directTime = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        if (directTime) {
            return `${String(directTime[1]).padStart(2, "0")}:${directTime[2]}`;
        }

        // Google Sheets can return time-only cells as an Excel serial fraction (for example, 0.5 = 12:00).
        if (/^0(?:\.\d+)?$/.test(raw)) {
            const totalMinutes = Math.round(Number(raw) * 24 * 60) % (24 * 60);
            return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
        }

        // Older records may be returned as UTC ISO strings. Convert them to the browser's local time.
        if (/T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
            const utcDate = new Date(raw);
            if (!Number.isNaN(utcDate.getTime())) {
                return `${String(utcDate.getHours()).padStart(2, "0")}:${String(utcDate.getMinutes()).padStart(2, "0")}`;
            }
        }

        const timeInsideDate = raw.match(/[T\s](\d{2}):(\d{2})(?::\d{2})?/);
        if (timeInsideDate) {
            return `${timeInsideDate[1]}:${timeInsideDate[2]}`;
        }

        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) {
            return `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
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

    async function refreshKnowledgeCategoriesInBackground() {
        if (!isKnowledgeModule()) {
            return;
        }
        try {
            const result = await ApiClient.request("listKnowledgeCategories", {
                token: ApiClient.getSessionToken()
            });
            const configuredCategories = (getFieldConfig("Category") || {}).options || [];
            const recordCategories = state.records.map((record) => String(record.Category || "").trim()).filter(Boolean);
            state.knowledgeCategories = [...new Set([
                ...configuredCategories,
                ...(result.data.categories || []),
                ...recordCategories
            ])];
            const categoryField = getFieldConfig("Category");
            if (categoryField) {
                categoryField.options = state.knowledgeCategories;
            }
            renderTable();
        } catch (error) {
            // Category data is optional during initial page load; keep the library usable.
        }
    }

    async function loadModuleData() {
        if (isStockMovementModule()) {
            const inventoryResult = await ApiClient.request("listRecords", {
                token: ApiClient.getSessionToken(),
                module: "stockItems"
            });
            // The split Inbound/Outbound workspace does not render movement history.
            state.records = [];
            state.stockItems = inventoryResult.data.records || [];
            state.stockMovements = [];
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

        if (isKnowledgeModule()) {
            const documentResult = await ApiClient.request("listRecords", {
                token: ApiClient.getSessionToken(),
                module: moduleKey
            });
            state.records = documentResult.data.records || [];
            state.knowledgeCategories = [...new Set([
                ...((getFieldConfig("Category") || {}).options || []),
                ...state.records.map((record) => String(record.Category || "").trim()).filter(Boolean)
            ])];
            const categoryField = getFieldConfig("Category");
            if (categoryField) {
                categoryField.options = state.knowledgeCategories;
            }
            state.sort.key = "";
            state.sort.direction = "asc";
            refreshKnowledgeCategoriesInBackground();
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
        if (isKnowledgeModule() || isAccessRequestModule()) {
            heroPanel.innerHTML = "";
            heroPanel.style.display = "none";
            return;
        }
        if (isTicketModule()) {
            // Ticket status totals are shown by the queue filters below; the generic module hero is redundant.
            heroPanel.innerHTML = "";
            heroPanel.style.display = "none";
            return;
        }
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

        if (isKnowledgeModule() && state.filters.knowledgeCategory !== "all") {
            rows = rows.filter((record) => String(record.Category || "") === state.filters.knowledgeCategory);
        }

        if (isKnowledgeModule() && state.filters.knowledgeType) {
            rows = rows.filter((record) => String(record.DocumentType || "") === state.filters.knowledgeType);
        }

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

    function renderStockMovementSplitWorkspace() {
        const itemOptions = state.stockItems
            .slice()
            .sort((left, right) => String(left.ItemName || "").localeCompare(String(right.ItemName || "")))
            .map((item) => `<option value="${UI.escapeHtml(getStockItemSearchLabel(item))}"></option>`)
            .join("");

        const renderForm = (tabKey) => {
            const draft = getMovementDraft(tabKey);
            const summary = getStockMovementFormSummary(draft.ItemID);
            const inbound = tabKey === "inbound";
            const title = inbound ? "Inbound Stock" : "Outbound Stock";
            const action = inbound ? "Record Inbound" : "Record Outbound";
            return `
                <section class="stock-movement-form-card stock-movement-form-card--${tabKey}" data-movement-panel="${tabKey}">
                    <div class="stock-movement-form-card__heading">
                        <div>
                            <h4>${title}</h4>
                            <p>${inbound ? "Receive items into inventory." : "Issue items from inventory."}</p>
                        </div>
                        <button class="primary-btn stock-movement-submit-icon" type="button" data-submit-movement="${tabKey}" title="${action}" aria-label="${action}">
                            <i class="fa-solid ${inbound ? "fa-file-import" : "fa-file-export"}"></i>
                        </button>
                    </div>
                    <div class="stock-movement-item-summary ${summary ? "" : "is-empty"}">
                        ${summary ? `
                            <div class="stock-movement-item-summary__title"><strong>${UI.escapeHtml(summary.item.ItemName || "-")}</strong><span>${UI.escapeHtml(summary.item.Description || "")}</span></div>
                            <div class="stock-movement-item-summary__stats">
                                <div><span>Current stock</span><strong>${UI.escapeHtml(String(summary.quantity))}</strong></div>
                                <div><span>Minimum stock</span><strong>${UI.escapeHtml(String(summary.minimumStock))}</strong></div>
                                <div><span>Status</span>${UI.badge(summary.status)}</div>
                            </div>
                        ` : `<div class="stock-movement-item-summary__placeholder"><i class="fa-solid fa-boxes-stacked"></i><p>Select an inventory item to view its current balance.</p></div>`}
                    </div>
                    <div class="stock-movement-form">
                        <label class="stock-movement-field stock-movement-field--item">
                            <span>Inventory item <em>*</em></span>
                            <input type="text" data-movement-item-search list="stockMovementItemOptions" value="${UI.escapeHtml(draft.ItemSearch || "")}" placeholder="Search inventory item" autocomplete="off">
                            <input type="hidden" data-movement-field="ItemID" value="${UI.escapeHtml(draft.ItemID || "")}">
                        </label>
                        <label class="stock-movement-field stock-movement-field--qty">
                            <span>Quantity <em>*</em></span>
                            <input type="number" min="1" step="1" data-movement-field="Quantity" value="${UI.escapeHtml(draft.Quantity || "")}" placeholder="0">
                        </label>
                        <label class="stock-movement-field stock-movement-field--full">
                            <span>Remark</span>
                            <textarea data-movement-field="Remark" placeholder="Reason, department, recipient, or receiving detail">${UI.escapeHtml(draft.Remark || "")}</textarea>
                        </label>
                    </div>
                </section>`;
        };

        document.getElementById("viewContainer").innerHTML = `
            <section class="table-panel stock-movement-panel">
                <datalist id="stockMovementItemOptions">${itemOptions}</datalist>
                <div class="stock-movement-split-layout">
                    ${renderForm("inbound")}
                    ${renderForm("outbound")}
                </div>
            </section>`;
    }

    function renderStockMovementWorkspace() {
        renderStockMovementSplitWorkspace();
        return;
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

    function getKnowledgeCategoryTone(category) {
        const tones = {
            "Network Diagram": "network",
            "Server Guide": "server",
            "IP Plan": "ip-plan",
            "Backup & Recovery": "backup",
            "Configuration": "configuration",
            "Troubleshooting": "troubleshooting"
        };
        return tones[category] || "operations";
    }

    function renderKnowledgeCenter() {
        const categoryField = getFieldConfig("Category");
        const configuredCategories = (categoryField && categoryField.options) || [];
        const existingCategories = state.records.map((record) => String(record.Category || "").trim()).filter(Boolean);
        const categories = [...new Set([...configuredCategories, ...existingCategories])];
        const filtered = getFilteredRecords().sort((left, right) => {
            const leftDate = String(left.ReviewDate || "9999-12-31");
            const rightDate = String(right.ReviewDate || "9999-12-31");
            return leftDate.localeCompare(rightDate);
        });
        const pageSize = 12;
        const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
        const page = Math.min(state.page, totalPages);
        const cards = filtered.slice((page - 1) * pageSize, page * pageSize);
        const canCreate = AppShell.canDo(moduleConfig, "create", state.session);
        const documentTypes = [...new Set(state.records.map((record) => record.DocumentType).filter(Boolean))].sort();

        const cardsMarkup = cards.map((record) => {
            const category = record.Category || "Uncategorized";
            const tone = getKnowledgeCategoryTone(category);
            const canEdit = AppShell.canDo(moduleConfig, "edit", state.session);
            const canDelete = AppShell.canDo(moduleConfig, "delete", state.session);
            return `
                <article class="knowledge-card knowledge-card--${tone}">
                    <div class="knowledge-card__topline">
                        <span class="knowledge-tag knowledge-tag--${tone}">${UI.escapeHtml(category)}</span>
                        <span class="knowledge-card__type">${UI.escapeHtml(record.DocumentType || "Document")}</span>
                    </div>
                    <h3>${UI.escapeHtml(record.Title || "Untitled knowledge")}</h3>
                    <p class="knowledge-card__summary">${UI.escapeHtml(record.Remark || "No description provided.")}</p>
                    <div class="knowledge-card__meta">
                        <span><i class="fa-regular fa-building"></i>${UI.escapeHtml(record.OwnerDepartment || "IT")}</span>
                        <span><i class="fa-regular fa-calendar"></i>${UI.escapeHtml(record.ReviewDate ? formatDateDisplay(record.ReviewDate) : "No review date")}</span>
                        <span><i class="fa-solid fa-code-branch"></i>v${UI.escapeHtml(record.Version || "1")}</span>
                    </div>
                    <div class="knowledge-card__actions">
                        ${record.LinkURL ? `<button class="knowledge-card__open" type="button" data-action="preview" data-id="${UI.escapeHtml(record.DocumentID)}" title="Preview document"><i class="fa-regular fa-eye"></i><span>Preview</span></button>` : ""}
                        ${record.DriveFileId ? `<a class="knowledge-card__download" href="https://drive.google.com/uc?export=download&id=${encodeURIComponent(record.DriveFileId)}" target="_blank" rel="noopener noreferrer" title="Download document"><i class="fa-solid fa-download"></i></a>` : ""}
                        ${canEdit ? `<button class="table-action" data-action="edit" data-id="${UI.escapeHtml(record.DocumentID)}" title="Edit document"><i class="fa-solid fa-pen"></i></button>` : ""}
                        ${canDelete ? `<button class="table-action table-action--danger" data-action="delete" data-id="${UI.escapeHtml(record.DocumentID)}" title="Delete document"><i class="fa-solid fa-trash"></i></button>` : ""}
                    </div>
                </article>`;
        }).join("");

        document.getElementById("viewContainer").innerHTML = `
            <section class="knowledge-layout">
                <aside class="knowledge-categories" aria-label="Knowledge categories">
                    <div class="knowledge-categories__header">
                        <div><p>Browse knowledge</p><strong>Categories</strong></div>
                        ${canCreate ? `<button class="knowledge-category-add" id="addKnowledgeCategoryButton" type="button" title="Add category" aria-label="Add category"><i class="fa-solid fa-plus"></i></button>` : ""}
                    </div>
                    <button class="knowledge-category ${state.filters.knowledgeCategory === "all" ? "is-active" : ""}" type="button" data-knowledge-category="all">
                        <span><i class="fa-solid fa-layer-group"></i>All knowledge</span><b>${state.records.length}</b>
                    </button>
                    ${categories.map((category) => `
                        <button class="knowledge-category ${state.filters.knowledgeCategory === category ? "is-active" : ""}" type="button" data-knowledge-category="${UI.escapeHtml(category)}">
                            <span><i class="fa-solid fa-book-bookmark"></i>${UI.escapeHtml(category)}</span><b>${state.records.filter((record) => String(record.Category || "") === category).length}</b>
                        </button>`).join("")}
                </aside>
                <div class="knowledge-library">
                    <div class="knowledge-library__header">
                        <div>
                            <p class="section-card__eyebrow">Knowledge Library</p>
                            <h3>IT Knowledge Center</h3>
                            <p>Find operational guides, diagrams, recovery plans and technical references.</p>
                        </div>
                        ${canCreate ? `<button class="primary-btn" id="createRecordButton" title="Add knowledge"><i class="fa-solid fa-plus"></i><span>Add Knowledge</span></button>` : ""}
                    </div>
                    <div class="knowledge-filters">
                        <label><span>Document type</span><select id="knowledgeTypeFilter"><option value="">All types</option>${documentTypes.map((type) => `<option value="${UI.escapeHtml(type)}" ${state.filters.knowledgeType === type ? "selected" : ""}>${UI.escapeHtml(type)}</option>`).join("")}</select></label>
                        <label><span>Status</span><select id="statusFilter"><option value="">All status</option>${[...new Set(state.records.map((record) => record.Status).filter(Boolean))].map((status) => `<option value="${UI.escapeHtml(status)}" ${state.filters.status === status ? "selected" : ""}>${UI.escapeHtml(status)}</option>`).join("")}</select></label>
                        <span class="knowledge-filters__count">${filtered.length} knowledge item${filtered.length === 1 ? "" : "s"}</span>
                    </div>
                    <div class="knowledge-card-grid">
                        ${cardsMarkup || `<div class="knowledge-empty-state">${UI.emptyState("No knowledge found", "Try a different category or search phrase.")}</div>`}
                    </div>
                    ${totalPages > 1 ? `<div class="knowledge-pagination"><button class="ghost-btn" id="prevPageButton" ${page <= 1 ? "disabled" : ""}>Previous</button><span>Page ${page} of ${totalPages}</span><button class="ghost-btn" id="nextPageButton" ${page >= totalPages ? "disabled" : ""}>Next</button></div>` : ""}
                </div>
            </section>`;
    }

    function isCompletedTicket(record) {
        return ["resolved", "closed", "rejected"].includes(String(record.Status || "Open").toLowerCase());
    }

    function getVisibleTicketRecords() {
        const getTicketSequence = (ticketId) => {
            const match = String(ticketId || "").match(/(\d+)(?!.*\d)/);
            return match ? Number(match[1]) : -1;
        };
        return getFilteredRecords().filter((record) => {
            const requestDate = getDateFilterKey(record.RequestDate);
            if (state.filters.ticketStartDate && requestDate < state.filters.ticketStartDate) return false;
            if (state.filters.ticketEndDate && requestDate > state.filters.ticketEndDate) return false;
            if (state.filters.ticketService && String(record.RequestedService || "") !== state.filters.ticketService) return false;
            if (state.filters.ticketStatus === "active" && isCompletedTicket(record)) return false;
            if (state.filters.ticketStatus && state.filters.ticketStatus !== "active" && String(record.Status || "") !== state.filters.ticketStatus) return false;
            return true;
        }).sort((left, right) => {
            // Ticket IDs are generated sequentially; newest work should always appear first.
            const sequenceDifference = getTicketSequence(right.TicketID) - getTicketSequence(left.TicketID);
            if (sequenceDifference) return sequenceDifference;
            return String(right.RequestDate || "").localeCompare(String(left.RequestDate || ""));
        });
    }

    function renderTicketWorkspace() {
        const ticketServices = [...new Set(state.records.map((record) => String(record.RequestedService || "").trim()).filter(Boolean))].sort();
        const ticketStatuses = [...new Set(state.records.map((record) => String(record.Status || "").trim()).filter(Boolean))].sort();
        const visibleRecords = getVisibleTicketRecords();
        const queueCounts = {
            all: visibleRecords.length,
            open: visibleRecords.filter((record) => String(record.Status || "Open").toLowerCase() === "open").length,
            progress: visibleRecords.filter((record) => ["assigned", "in progress"].includes(String(record.Status || "").toLowerCase())).length,
            pending: visibleRecords.filter((record) => String(record.Status || "").toLowerCase() === "pending").length,
            completed: visibleRecords.filter(isCompletedTicket).length
        };

        const rowsMarkup = visibleRecords.map((record) => {
            const completed = isCompletedTicket(record);
            const isEquipment = String(record.RequestedService || "") === "Equipment Requisition";
            const assigned = String(record.AssignedTo || "").trim();
            const serviceIcon = isEquipment
                ? "fa-box-open"
                : String(record.RequestedService || "") === "Remote Support" ? "fa-desktop" : "fa-person-walking-arrow-right";
            const primaryAction = completed
                ? ""
                : isEquipment
                    ? `<button class="ticket-queue-card__primary" type="button" data-action="resolve-ticket" data-id="${UI.escapeHtml(record.TicketID)}"><i class="fa-solid fa-box-open"></i><span>Issue equipment</span></button>`
                    : `<button class="ticket-queue-card__primary" type="button" data-action="resolve-ticket" data-id="${UI.escapeHtml(record.TicketID)}"><i class="fa-solid fa-circle-check"></i><span>Resolve</span></button>`;
            return `
                <tr>
                    <td><span class="cell-data cell-data--id">${UI.escapeHtml(record.TicketID || "-")}</span></td>
                    <td><span class="ticket-table__service"><i class="fa-solid ${serviceIcon}"></i>${UI.escapeHtml(record.RequestedService || "IT Service")}</span></td>
                    <td><span class="cell-data cell-data--date">${UI.escapeHtml(formatDateDisplay(record.RequestDate))}</span></td>
                    <td><span class="cell-data cell-data--nowrap">${UI.escapeHtml(formatTimeDisplay(record.WorkStartedAt))}</span></td>
                    <td><span class="cell-data cell-data--nowrap">${UI.escapeHtml(formatTimeDisplay(record.WorkCompletedAt))}</span></td>
                    <td><span class="cell-data cell-data--title">${UI.escapeHtml(record.Subject || "No subject provided")}</span></td>
                    <td><span class="cell-data">${UI.escapeHtml(record.Requester || "-")}</span><small class="ticket-table__department">${UI.escapeHtml(record.Department || "-")}</small></td>
                    <td><span class="cell-data cell-data--wrap">${UI.escapeHtml(record.Location || "-")}</span></td>
                    <td><span class="cell-data">${UI.escapeHtml(assigned || "-")}</span></td>
                    <td><div class="ticket-table__status">${UI.badge(record.Status || "Open")}</div></td>
                    <td><div class="table-actions ticket-table__actions">
                        <button class="table-action" type="button" data-action="ticket-details" data-id="${UI.escapeHtml(record.TicketID)}" title="View ticket details"><i class="fa-regular fa-eye"></i></button>
                        ${!completed && !assigned ? `<button class="secondary-btn ticket-table__assign" type="button" data-action="assign-ticket" data-id="${UI.escapeHtml(record.TicketID)}" title="Assign to me"><i class="fa-solid fa-hand"></i></button>` : ""}
                        ${primaryAction}
                    </div></td>
                </tr>`;
        }).join("");

        document.getElementById("viewContainer").innerHTML = `
            <section class="ticket-workspace-summary ticket-workspace-summary--metrics-only" aria-label="Ticket summary">
                <div class="ticket-workspace-summary__metrics">
                    <span><small>Total</small><b>${queueCounts.all}</b></span>
                    <span><small>New</small><b>${queueCounts.open}</b></span>
                    <span><small>In Progress</small><b>${queueCounts.progress}</b></span>
                    <span><small>Pending</small><b>${queueCounts.pending}</b></span>
                    <span><small>Completed</small><b>${queueCounts.completed}</b></span>
                </div>
            </section>
            <section class="ticket-queue-panel">
                <div class="ticket-queue-panel__header">
                    <div><p class="section-card__eyebrow">WORK QUEUE</p></div>
                    <span>${visibleRecords.length} shown</span>
                </div>
                <div class="ticket-date-filter">
                    <label><span>Start date</span><input id="ticketStartDateFilter" type="date" value="${UI.escapeHtml(state.filters.ticketStartDate)}"></label>
                    <label><span>End date</span><input id="ticketEndDateFilter" type="date" value="${UI.escapeHtml(state.filters.ticketEndDate)}"></label>
                    <label><span>Service</span><select id="ticketServiceFilter"><option value="">All services</option>${ticketServices.map((service) => `<option value="${UI.escapeHtml(service)}" ${state.filters.ticketService === service ? "selected" : ""}>${UI.escapeHtml(service)}</option>`).join("")}</select></label>
                    <label><span>Status</span><select id="ticketStatusFilter"><option value="">All statuses</option><option value="active" ${state.filters.ticketStatus === "active" ? "selected" : ""}>Active tickets</option>${ticketStatuses.map((status) => `<option value="${UI.escapeHtml(status)}" ${state.filters.ticketStatus === status ? "selected" : ""}>${UI.escapeHtml(status)}</option>`).join("")}</select></label>
                    <button class="ghost-btn ticket-date-filter__clear" type="button" data-action="clear-ticket-dates" title="Clear date range"><i class="fa-solid fa-rotate-left"></i><span>Clear</span></button>
                </div>
                <div class="data-table-wrap ticket-queue-table-wrap">
                    <table class="data-table ticket-queue-table">
                        <thead><tr><th>Ticket ID</th><th>Service</th><th>Date</th><th>Start Time</th><th>End Time</th><th>Summary</th><th>Requester</th><th>Location</th><th>Performed By</th><th>Status</th><th>Action</th></tr></thead>
                        <tbody>${rowsMarkup || `<tr><td colspan="11">${UI.emptyState("No ticket found", "There are no tickets in this queue.")}</td></tr>`}</tbody>
                    </table>
                </div>
            </section>`;
    }

    function getLocalDateTimeInputValue(date = new Date()) {
        const offsetMs = date.getTimezoneOffset() * 60 * 1000;
        return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
    }

    async function openTicketDetailsModal(ticketId) {
        const ticket = state.records.find((record) => String(record.TicketID || "") === String(ticketId || ""));
        if (!ticket) {
            await UI.alert({ icon: "error", title: "Ticket not found", text: "Refresh the ticket queue and try again." });
            return;
        }
        const rows = [
            ["Requester", ticket.Requester],
            ["Department", ticket.Department],
            ["Contact", ticket.Contact],
            ["Location", ticket.Location],
            ["Service", ticket.RequestedService],
            ["Category", ticket.Category],
            ["Assigned to", ticket.AssignedTo || "Unassigned"],
            ["Requested date", formatDateDisplay(ticket.RequestDate)],
            ["Work started", formatDateDisplay(ticket.WorkStartedAt)],
            ["Completed", formatDateDisplay(ticket.WorkCompletedAt)]
        ].filter(([, value]) => value);
        await Swal.fire({
            title: ticket.TicketID || "Ticket details",
            showCloseButton: true,
            showConfirmButton: false,
            html: `<div class="ticket-detail-modal">
                <div class="ticket-detail-modal__headline"><h3>${UI.escapeHtml(ticket.Subject || "No subject provided")}</h3>${UI.badge(ticket.Status || "Open")}</div>
                ${ticket.Description ? `<p class="ticket-detail-modal__description">${UI.escapeHtml(ticket.Description)}</p>` : ""}
                <div class="ticket-detail-modal__grid">${rows.map(([label, value]) => `<div><span>${UI.escapeHtml(label)}</span><strong>${UI.escapeHtml(String(value || "-"))}</strong></div>`).join("")}</div>
                ${ticket.AttachmentUrl ? `<a class="ticket-detail-modal__attachment" href="${UI.escapeHtml(ticket.AttachmentUrl)}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-paperclip"></i>Open request photo</a>` : ""}
            </div>`
        });
    }

    async function assignTicketToCurrentUser(ticketId) {
        const ticket = state.records.find((record) => String(record.TicketID || "") === String(ticketId || ""));
        if (!ticket) {
            await UI.alert({ icon: "error", title: "Ticket not found", text: "Refresh the ticket queue and try again." });
            return;
        }
        const assignee = getOperatorName();
        const confirmation = await UI.confirm({
            title: "Assign this ticket to you?",
            text: `${ticket.TicketID} will be marked as In Progress under ${assignee}.`,
            confirmButtonText: "Assign to me"
        });
        if (!confirmation.isConfirmed) return;

        UI.loading("Assigning ticket", "Updating work ownership");
        try {
            const response = await ApiClient.request("saveRecord", {
                token: ApiClient.getSessionToken(),
                module: "tickets",
                record: {
                    ...ticket,
                    AssignedTo: assignee,
                    Status: "In Progress",
                    WorkStartedAt: ticket.WorkStartedAt || getLocalDateTimeInputValue()
                }
            });
            upsertStateRecord(response.data.record, "edit");
            Swal.close();
            renderTicketWorkspace();
            await UI.alert({ icon: "success", title: "Ticket assigned", text: `${ticket.TicketID} is now assigned to you.` });
        } catch (error) {
            Swal.close();
            await UI.alert({ icon: "error", title: "Unable to assign ticket", text: error.message || "Please try again." });
        }
    }

    async function openTicketResolveModal(ticketId) {
        const ticket = state.records.find((record) => String(record.TicketID || "") === String(ticketId || ""));
        if (!ticket) {
            await UI.alert({ icon: "error", title: "Ticket not found", text: "Refresh the ticket list and try again." });
            return;
        }

        const isEquipmentRequisition = String(ticket.RequestedService || "") === "Equipment Requisition";
        if (isEquipmentRequisition) {
            const confirmation = await UI.confirm({
                title: "Issue requested equipment?",
                text: `Issue ${ticket.RequestedQuantity || 0} unit(s) for ${ticket.TicketID}. Inventory will be deducted after approval.`,
                confirmButtonText: "Issue equipment"
            });
            if (!confirmation.isConfirmed) return;
            UI.loading("Issuing equipment", "Reducing inventory and closing ticket");
            try {
                const response = await ApiClient.request("resolveTicket", {
                    token: ApiClient.getSessionToken(),
                    ticketId,
                    resolutionNote: "Equipment issued by IT."
                });
                upsertStateRecord(response.data.record, "edit");
                Swal.close();
                renderTicketWorkspace();
                await UI.alert({ icon: "success", title: "Equipment issued", text: "Inventory was updated and the ticket is resolved." });
            } catch (error) {
                Swal.close();
                await UI.alert({ icon: "error", title: "Unable to issue equipment", text: error.message || "Please try again." });
            }
            return;
        }

        const isRemoteSupport = String(ticket.RequestedService || "") === "Remote Support";
        let hasSignature = false;
        const result = await Swal.fire({
            title: `${isRemoteSupport ? "Close" : "Resolve"} ${ticket.TicketID}`,
            html: `
                <div class="ticket-resolve-form">
                    <p class="ticket-resolve-form__summary">${UI.escapeHtml(ticket.Subject || "-")}</p>
                    ${isRemoteSupport ? `
                        <div class="ticket-remote-times">
                            <label><span>Start time <em>*</em></span><input id="ticketWorkStartedAt" type="datetime-local" value="${getLocalDateTimeInputValue()}"></label>
                            <label><span>End time <em>*</em></span><input id="ticketWorkCompletedAt" type="datetime-local" value="${getLocalDateTimeInputValue()}"></label>
                        </div>` : ""}
                    <label><span>Detail <small>(optional)</small></span><textarea id="ticketResolutionNote" placeholder="Work performed, test result or follow-up note"></textarea></label>
                    ${isRemoteSupport ? "" : `<label><span>Photo <small>(optional)</small></span><input id="ticketResolutionPhoto" type="file" accept="image/jpeg,image/png,image/webp" capture="environment"></label>
                    <div class="ticket-signature-field">
                        <div><span>Requester signature <em>*</em></span><button id="clearTicketSignature" type="button">Clear</button></div>
                        <canvas id="ticketSignatureCanvas" width="720" height="250" aria-label="Requester signature"></canvas>
                        <small>Ask the requester to sign in the box using a finger, stylus or mouse.</small>
                    </div>`}
                </div>`,
            width: "min(720px, calc(100vw - 28px))",
            showCancelButton: true,
            showCloseButton: true,
            confirmButtonText: isRemoteSupport ? "Close Ticket" : "Resolve Ticket",
            cancelButtonText: "Cancel",
            focusConfirm: false,
            didOpen: () => {
                if (isRemoteSupport) {
                    return;
                }
                const canvas = document.getElementById("ticketSignatureCanvas");
                const clearButton = document.getElementById("clearTicketSignature");
                const context = canvas.getContext("2d");
                context.strokeStyle = "#17314d";
                context.lineWidth = 3;
                context.lineCap = "round";
                let drawing = false;

                const pointFromEvent = (event) => {
                    const bounds = canvas.getBoundingClientRect();
                    return {
                        x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
                        y: (event.clientY - bounds.top) * (canvas.height / bounds.height)
                    };
                };
                const start = (event) => {
                    drawing = true;
                    const point = pointFromEvent(event);
                    context.beginPath();
                    context.moveTo(point.x, point.y);
                    hasSignature = true;
                    event.preventDefault();
                };
                const move = (event) => {
                    if (!drawing) return;
                    const point = pointFromEvent(event);
                    context.lineTo(point.x, point.y);
                    context.stroke();
                    event.preventDefault();
                };
                const stop = () => { drawing = false; };
                canvas.addEventListener("pointerdown", start);
                canvas.addEventListener("pointermove", move);
                canvas.addEventListener("pointerup", stop);
                canvas.addEventListener("pointerleave", stop);
                clearButton.addEventListener("click", () => {
                    context.clearRect(0, 0, canvas.width, canvas.height);
                    hasSignature = false;
                });
            },
            preConfirm: async () => {
                const resolutionNote = document.getElementById("ticketResolutionNote").value.trim();
                if (isRemoteSupport) {
                    const workStartedAt = document.getElementById("ticketWorkStartedAt").value;
                    const workCompletedAt = document.getElementById("ticketWorkCompletedAt").value;
                    if (!workStartedAt || !workCompletedAt) {
                        Swal.showValidationMessage("Start time and end time are required");
                        return false;
                    }
                    if (new Date(workCompletedAt).getTime() < new Date(workStartedAt).getTime()) {
                        Swal.showValidationMessage("End time must be after start time");
                        return false;
                    }
                    return { resolutionNote, workStartedAt, workCompletedAt, closeDirectly: true };
                }
                if (!hasSignature) {
                    Swal.showValidationMessage("Requester signature is required");
                    return false;
                }
                const canvas = document.getElementById("ticketSignatureCanvas");
                const photo = document.getElementById("ticketResolutionPhoto").files[0];
                if (photo && (!/^(image\/jpeg|image\/png|image\/webp)$/i.test(photo.type) || photo.size > 5 * 1024 * 1024)) {
                    Swal.showValidationMessage("Use a JPG, PNG or WEBP photo no larger than 5 MB");
                    return false;
                }
                const signatureDataUrl = canvas.toDataURL("image/png");
                const signatureBase64 = signatureDataUrl.split(",")[1];
                return {
                    resolutionNote,
                    signature: {
                        name: `${ticket.TicketID}-signature.png`,
                        type: "image/png",
                        size: Math.ceil(signatureBase64.length * 0.75),
                        base64: signatureBase64
                    },
                    photo: photo ? {
                        name: photo.name,
                        type: photo.type,
                        size: photo.size,
                        base64: await readKnowledgeFile(photo)
                    } : null
                };
            }
        });

        if (!result.isConfirmed || !result.value) {
            return;
        }

        UI.loading("Resolving ticket", "Saving signature and completion details");
        try {
            const response = await ApiClient.request("resolveTicket", {
                token: ApiClient.getSessionToken(),
                ticketId,
                ...result.value
            });
            upsertStateRecord(response.data.record, "edit");
            renderTicketWorkspace();
            Swal.close();
        } catch (error) {
            Swal.close();
            await UI.alert({ icon: "error", title: "Unable to resolve ticket", text: error.message || "Please try again." });
        }
    }

    function renderTable() {
        if (isKnowledgeModule()) {
            renderKnowledgeCenter();
            return;
        }
        if (isStockMovementModule()) {
            renderStockMovementWorkspace();
            return;
        }
        if (isTicketModule()) {
            renderTicketWorkspace();
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
        const createButton = canCreate && !isAccessRequestModule()
            ? `<button class="primary-btn" id="createRecordButton" title="Add record"><i class="fa-solid fa-plus"></i><span>${isAccessRequestModule() ? "New Request" : "Add Record"}</span></button>`
            : "";

        const accessRequestCards = isAccessRequestModule() ? `
            <section class="access-request-forms" aria-labelledby="accessRequestFormsTitle">
                <div class="access-request-forms__header">
                    <div>
                        <p class="section-card__eyebrow">Request Forms</p>
                        <h3 id="accessRequestFormsTitle">Select Access Request</h3>
                        <p>Choose the request type to start a new form.</p>
                    </div>
                </div>
                <div class="access-request-forms__grid">
                    ${accessRequestForms.map((form) => `
                        <button class="access-request-form-card access-request-form-card--${form.tone}" type="button" data-access-request-type="${UI.escapeHtml(form.type)}" title="Create ${UI.escapeHtml(form.label)} request">
                            <span class="access-request-form-card__icon"><i class="fa-solid ${form.icon}"></i></span>
                            <span><strong>${UI.escapeHtml(form.label)}</strong><small>${UI.escapeHtml(form.description)}</small></span>
                            <i class="fa-solid fa-arrow-right"></i>
                        </button>
                    `).join("")}
                </div>
            </section>` : "";

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
            ${accessRequestCards}
            <section class="table-panel">
                <div class="table-panel__header">
                    <div class="table-panel__header-copy">
                        ${isAccessRequestModule() ? "" : '<p class="section-card__eyebrow">Module Data</p>'}
                        <h3>${isAccessRequestModule() ? "My Access Requests" : "Records Table"}</h3>
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
        const rows = isTicketModule()
            ? getVisibleTicketRecords().map((record) => ({
                "Ticket ID": record.TicketID || "-",
                Service: record.RequestedService || "IT Service",
                Date: formatDateDisplay(record.RequestDate),
                "Start Time": formatTimeDisplay(record.WorkStartedAt),
                "End Time": formatTimeDisplay(record.WorkCompletedAt),
                Summary: record.Subject || "-",
                Requester: record.Requester || "-",
                Location: record.Location || "-",
                "Performed By": record.AssignedTo || "-",
                Status: record.Status || "Open"
            }))
            : state.records;
        if (format === "csv") {
            await UI.exportToCsv(fileName, rows);
        } else {
            await UI.exportToExcel(fileName, rows);
        }
        Swal.close();
    }

    async function importExcelFile(file) {
        const XLSX = await UI.loadSpreadsheetLibrary();

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
        await ApiClient.request("importRecords", {
            token: ApiClient.getSessionToken(),
            module: moduleKey,
            records: mappedRows
        });
        await loadModuleData();
        syncSidebarAlerts();
        renderHero();
        renderTable();
        Swal.close();
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
                return result;
            }
            upsertStateRecord(result.data && result.data.record ? result.data.record : record, mode);
            syncSidebarAlerts();
            renderHero();
            renderTable();
            Swal.close();
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

    function getTodayInputDate() {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().slice(0, 10);
    }

    async function openAccessRequestModal(requestType) {
        const user = state.session && state.session.user ? state.session.user : {};
        const departments = (window.APP_CONFIG.departments || []).map((department) => `<option value="${UI.escapeHtml(department)}" ${department === user.Department ? "selected" : ""}>${UI.escapeHtml(department)}</option>`).join("");
        const request = accessRequestForms.find((item) => item.type === requestType) || accessRequestForms[0];
        const result = await Swal.fire({
            title: request.label,
            html: `
                <div class="access-request-modal">
                    <div class="access-request-modal__type"><i class="fa-solid ${request.icon}"></i><span>${UI.escapeHtml(request.description)}</span></div>
                    <div class="modal-form">
                        <label class="modal-form__field"><span class="modal-form__label">Requester <em>*</em></span><input id="accessRequester" type="text" value="${UI.escapeHtml(user.FullName || user.Username || "")}"></label>
                        <label class="modal-form__field"><span class="modal-form__label">Department <em>*</em></span><select id="accessDepartment"><option value="">Select</option>${departments}</select></label>
                        ${request.options ? `<label class="modal-form__field"><span class="modal-form__label">Action <em>*</em></span><select id="accessRequestType">${request.options.map((option) => `<option value="${UI.escapeHtml(option)}">${UI.escapeHtml(option)}</option>`).join("")}</select></label>` : ""}
                        <label class="modal-form__field"><span class="modal-form__label">Target User <em>*</em></span><input id="accessTargetUser" type="text" placeholder="Name or username"></label>
                        <label class="modal-form__field"><span class="modal-form__label">System / Resource</span><input id="accessSystemName" type="text" placeholder="Folder, email group, ERP role, VPN profile"></label>
                        <label class="modal-form__field field--full"><span class="modal-form__label">Reason</span><textarea id="accessReason" placeholder="Provide the business reason for this request"></textarea></label>
                        <label class="modal-form__field field--full"><span class="modal-form__label">Remark</span><textarea id="accessRemark" placeholder="Optional note"></textarea></label>
                    </div>
                </div>`,
            width: "min(760px, calc(100vw - 32px))",
            customClass: { popup: "swal2-form-popup" },
            showCancelButton: true,
            showCloseButton: true,
            confirmButtonText: "Submit Request",
            preConfirm: () => {
                const requester = document.getElementById("accessRequester").value.trim();
                const department = document.getElementById("accessDepartment").value.trim();
                const targetUser = document.getElementById("accessTargetUser").value.trim();
                if (!requester || !department || !targetUser) {
                    Swal.showValidationMessage("Requester, department and target user are required.");
                    return false;
                }
                return {
                    RequestDate: getTodayInputDate(),
                    Requester: requester,
                    Department: department,
                    RequestType: request.options ? document.getElementById("accessRequestType").value : request.type,
                    TargetUser: targetUser,
                    SystemName: document.getElementById("accessSystemName").value.trim(),
                    Reason: document.getElementById("accessReason").value.trim(),
                    Remark: document.getElementById("accessRemark").value.trim(),
                    Status: "Pending Approval"
                };
            }
        });

        if (result.isConfirmed && result.value) {
            await saveRecord("create", result.value);
        }
    }

    async function openRecordModal(mode, recordId = "") {
        if (isKnowledgeModule()) {
            await openKnowledgeModal(mode, recordId);
            return;
        }
        if (isAccessRequestModule() && mode === "create") {
            await openAccessRequestModal("AD Account");
            return;
        }
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

    function readKnowledgeFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = String(reader.result || "");
                resolve(dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl);
            };
            reader.onerror = () => reject(new Error("Unable to read selected file"));
            reader.readAsDataURL(file);
        });
    }

    async function openKnowledgeModal(mode, recordId = "") {
        const existing = recordId ? state.records.find((item) => item.DocumentID === recordId) || {} : {};
        const categoryOptions = state.knowledgeCategories.map((item) => `<option value="${UI.escapeHtml(item)}" ${existing.Category === item ? "selected" : ""}>${UI.escapeHtml(item)}</option>`).join("");
        const typeOptions = ((getFieldConfig("DocumentType") || {}).options || []).map((item) => `<option value="${UI.escapeHtml(item)}" ${existing.DocumentType === item ? "selected" : ""}>${UI.escapeHtml(item)}</option>`).join("");
        const statusOptions = ((getFieldConfig("Status") || {}).options || []).map((item) => `<option value="${UI.escapeHtml(item)}" ${(existing.Status || "Draft") === item ? "selected" : ""}>${UI.escapeHtml(item)}</option>`).join("");
        const result = await Swal.fire({
            title: mode === "create" ? "Add Knowledge" : "Edit Knowledge",
            width: "min(860px, calc(100vw - 32px))",
            customClass: { popup: "swal2-form-popup" },
            showCancelButton: true,
            showCloseButton: true,
            confirmButtonText: mode === "create" ? "Save Knowledge" : "Update Knowledge",
            html: `
                <div class="knowledge-form">
                    <div class="knowledge-form__intro"><i class="fa-solid fa-cloud-arrow-up"></i><span>Upload a supported file or paste an existing Google Drive link.</span></div>
                    <label><span>Knowledge Category <em>*</em></span><select data-knowledge-field="Category"><option value="">Select category</option>${categoryOptions}</select></label>
                    <label class="knowledge-form__full"><span>Title <em>*</em></span><input data-knowledge-field="Title" value="${UI.escapeHtml(existing.Title || "")}" placeholder="Example: Firewall backup and restore procedure"></label>
                    <label class="knowledge-form__full"><span>Upload File</span><input type="file" data-knowledge-file accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg"><small>PDF, DOCX, XLSX, PPTX, PNG, JPG or JPEG. Maximum 10 MB.</small></label>
                    <label class="knowledge-form__full"><span>Google Drive Link</span><input type="url" data-knowledge-field="LinkURL" value="${UI.escapeHtml(existing.LinkURL || "")}" placeholder="https://drive.google.com/... "><small>Use this when the file already exists in Google Drive.</small></label>
                    <label class="knowledge-form__full"><span>Description</span><textarea data-knowledge-field="Remark" placeholder="Explain when and how this knowledge should be used.">${UI.escapeHtml(existing.Remark || "")}</textarea></label>
                    <details class="knowledge-form__details knowledge-form__full">
                        <summary>Additional details <span>Optional</span></summary>
                        <div class="knowledge-form__details-grid">
                            <label><span>Document Type</span><select data-knowledge-field="DocumentType"><option value="">Select type</option>${typeOptions}</select></label>
                            <label><span>Owner Department</span><select data-knowledge-field="OwnerDepartment"><option value="IT" ${(existing.OwnerDepartment || "IT") === "IT" ? "selected" : ""}>IT</option><option value="Production" ${existing.OwnerDepartment === "Production" ? "selected" : ""}>Production</option><option value="Quality" ${existing.OwnerDepartment === "Quality" ? "selected" : ""}>Quality</option><option value="Finance" ${existing.OwnerDepartment === "Finance" ? "selected" : ""}>Finance</option><option value="HR" ${existing.OwnerDepartment === "HR" ? "selected" : ""}>HR</option><option value="Warehouse" ${existing.OwnerDepartment === "Warehouse" ? "selected" : ""}>Warehouse</option></select></label>
                            <label><span>Review Date</span><input type="date" data-knowledge-field="ReviewDate" value="${UI.escapeHtml(String(existing.ReviewDate || "").slice(0, 10))}"></label>
                            <label><span>Status</span><select data-knowledge-field="Status">${statusOptions}</select></label>
                            <label><span>Version</span><input data-knowledge-field="Version" value="${UI.escapeHtml(existing.Version || "1")}" placeholder="1"></label>
                            <label><span>Keywords</span><input data-knowledge-field="Keywords" value="${UI.escapeHtml(existing.Keywords || "")}" placeholder="Example: firewall, backup, recovery, VPN"></label>
                        </div>
                    </details>
                </div>`,
            preConfirm: () => {
                const values = { ...existing };
                document.querySelectorAll("[data-knowledge-field]").forEach((field) => {
                    values[field.getAttribute("data-knowledge-field")] = field.value.trim();
                });
                const file = document.querySelector("[data-knowledge-file]").files[0];
                if (!values.Category || !values.Title) {
                    Swal.showValidationMessage("Knowledge Category and Title are required.");
                    return false;
                }
                if (file && file.size > 10 * 1024 * 1024) {
                    Swal.showValidationMessage("The selected file must not exceed 10 MB.");
                    return false;
                }
                if (values.Status !== "Draft" && !file && !values.LinkURL) {
                    Swal.showValidationMessage("Upload a file or provide a Google Drive link before publishing.");
                    return false;
                }
                return { values, file };
            }
        });
        if (!result.isConfirmed || !result.value) {
            return;
        }

        const confirmation = await UI.confirm({
            title: mode === "create" ? "Save this knowledge?" : "Update this knowledge?",
            text: "The document metadata and selected file will be saved.",
            confirmButtonText: mode === "create" ? "Save" : "Update"
        });
        if (!confirmation.isConfirmed) {
            return;
        }

        UI.loading(mode === "create" ? "Saving knowledge" : "Updating knowledge", "Uploading file and saving document details");
        try {
            const file = result.value.file;
            const filePayload = file ? {
                name: file.name,
                type: file.type,
                size: file.size,
                base64: await readKnowledgeFile(file)
            } : null;
            const response = await ApiClient.request("saveKnowledgeDocument", {
                token: ApiClient.getSessionToken(),
                mode,
                record: result.value.values,
                file: filePayload
            });
            upsertStateRecord(response.data.record, mode);
            Swal.close();
            renderTable();
        } catch (error) {
            Swal.close();
            await UI.alert({ icon: "error", title: "Unable to save knowledge", text: error.message || "Unexpected error" });
        }
    }

    async function openKnowledgePreview(recordId) {
        const record = state.records.find((item) => item.DocumentID === recordId);
        if (!record || !record.LinkURL) {
            await UI.alert({ icon: "info", title: "Preview unavailable", text: "No document file or link has been attached." });
            return;
        }
        const previewUrl = record.DriveFileId
            ? `https://drive.google.com/file/d/${encodeURIComponent(record.DriveFileId)}/preview`
            : record.LinkURL;
        await Swal.fire({
            title: record.Title || "Document Preview",
            width: "min(1100px, calc(100vw - 32px))",
            showCloseButton: true,
            showConfirmButton: true,
            confirmButtonText: "Open document",
            html: `<div class="knowledge-preview"><iframe src="${UI.escapeHtml(previewUrl)}" title="${UI.escapeHtml(record.Title || "Document preview")}" loading="lazy"></iframe></div>`,
            preConfirm: () => {
                window.open(record.LinkURL, "_blank", "noopener");
            }
        });
    }

    async function addKnowledgeCategory() {
        const result = await Swal.fire({
            title: "Add knowledge category",
            input: "text",
            inputLabel: "Category name",
            inputPlaceholder: "Example: Security Operations",
            showCancelButton: true,
            confirmButtonText: "Add category",
            inputValidator(value) {
                return String(value || "").trim() ? undefined : "Please enter a category name.";
            }
        });
        if (!result.isConfirmed) {
            return;
        }

        UI.loading("Adding category", "Saving knowledge category");
        try {
            const response = await ApiClient.request("createKnowledgeCategory", {
                token: ApiClient.getSessionToken(),
                name: String(result.value || "").trim()
            });
            state.knowledgeCategories = response.data.categories || state.knowledgeCategories;
            const categoryField = getFieldConfig("Category");
            if (categoryField) {
                categoryField.options = state.knowledgeCategories;
            }
            Swal.close();
            renderTable();
        } catch (error) {
            Swal.close();
            await UI.alert({ icon: "error", title: "Unable to add category", text: error.message || "Unexpected error" });
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
            return;
        }
        state.records = state.records.filter((item) => item[moduleConfig.idField] !== recordId);
        syncSidebarAlerts();
        renderHero();
        renderTable();
        Swal.close();
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
            if (event.target.closest("#showMyJobsButton")) {
                state.ticketJobsVisible = true;
                renderTable();
                return;
            }

            if (event.target.closest("#hideMyJobsButton")) {
                state.ticketJobsVisible = false;
                renderTable();
                return;
            }

            if (event.target.closest('[data-action="clear-ticket-dates"]')) {
                state.filters.ticketStartDate = "";
                state.filters.ticketEndDate = "";
                state.filters.ticketService = "";
                state.filters.ticketStatus = "";
                renderTicketWorkspace();
                return;
            }

            const movementTabButton = event.target.closest("[data-movement-tab]");
            if (movementTabButton) {
                state.movementTab = movementTabButton.getAttribute("data-movement-tab") || "outbound";
                state.page = 1;
                renderHero();
                renderTable();
                return;
            }

            const knowledgeCategoryButton = event.target.closest("[data-knowledge-category]");
            if (knowledgeCategoryButton) {
                state.filters.knowledgeCategory = knowledgeCategoryButton.getAttribute("data-knowledge-category") || "all";
                state.page = 1;
                renderTable();
                return;
            }

            const submitMovementButton = event.target.closest("[data-submit-movement]");
            if (submitMovementButton || event.target.closest("#submitMovementButton")) {
                const movementTab = submitMovementButton
                    ? (submitMovementButton.getAttribute("data-submit-movement") || "outbound")
                    : state.movementTab;
                const draft = getMovementDraft(movementTab);
                const selectedItem = getStockItemById(draft.ItemID);
                const quantity = Number(draft.Quantity || 0);
                const movementRecord = {
                    ...draft,
                    MovementType: getMovementTypeFromTab(movementTab),
                    MovementDate: (movementTab === "inbound" || movementTab === "outbound") ? getTodayInputValue() : draft.MovementDate,
                    PerformedBy: (movementTab === "inbound" || movementTab === "outbound")
                        ? getOperatorName()
                        : draft.PerformedBy,
                    ReferenceNo: (movementTab === "inbound" || movementTab === "outbound") ? "" : draft.ReferenceNo
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

                if (movementTab === "outbound" && quantity > Number(selectedItem.Quantity || 0)) {
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
                state.movementDrafts[movementTab] = getDefaultMovementDraft(movementTab);
                renderHero();
                renderTable();
                return;
            }

            if (event.target.closest("#addKnowledgeCategoryButton")) {
                await addKnowledgeCategory();
                return;
            }

            const accessRequestButton = event.target.closest("[data-access-request-type]");
            if (accessRequestButton) {
                await openAccessRequestModal(accessRequestButton.getAttribute("data-access-request-type"));
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
                } else if (action === "preview") {
                    await openKnowledgePreview(id);
                } else if (action === "ticket-details") {
                    await openTicketDetailsModal(id);
                } else if (action === "assign-ticket") {
                    await assignTicketToCurrentUser(id);
                } else if (action === "resolve-ticket") {
                    await openTicketResolveModal(id);
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

        document.getElementById("viewContainer").addEventListener("change", async (event) => {
            if (["ticketStartDateFilter", "ticketEndDateFilter", "ticketServiceFilter", "ticketStatusFilter"].includes(event.target.id)) {
                state.filters.ticketStartDate = document.getElementById("ticketStartDateFilter").value;
                state.filters.ticketEndDate = document.getElementById("ticketEndDateFilter").value;
                state.filters.ticketService = document.getElementById("ticketServiceFilter").value;
                state.filters.ticketStatus = document.getElementById("ticketStatusFilter").value;
                if (state.filters.ticketStartDate && state.filters.ticketEndDate && state.filters.ticketEndDate < state.filters.ticketStartDate) {
                    await UI.alert({ icon: "warning", title: "Invalid date range", text: "End date must be the same as or after start date." });
                    state.filters.ticketEndDate = "";
                }
                renderTicketWorkspace();
                return;
            }

            const movementPanel = event.target.closest("[data-movement-panel]");
            const movementTab = movementPanel
                ? (movementPanel.getAttribute("data-movement-panel") || "outbound")
                : state.movementTab;
            if (event.target.matches("[data-movement-item-search]")) {
                const stockItem = findStockItemBySearchLabel(event.target.value);
                state.movementDrafts[movementTab] = {
                    ...getMovementDraft(movementTab),
                    ItemID: stockItem ? stockItem.ItemID : "",
                    ItemSearch: event.target.value
                };
                renderTable();
                return;
            }

            const movementField = event.target.getAttribute("data-movement-field");
            if (movementField) {
                const nextDraft = {
                    ...getMovementDraft(movementTab),
                    [movementField]: event.target.value
                };
                state.movementDrafts[movementTab] = nextDraft;
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

            if (event.target.id === "knowledgeTypeFilter") {
                state.filters.knowledgeType = event.target.value;
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
            const movementPanel = event.target.closest("[data-movement-panel]");
            const movementTab = movementPanel
                ? (movementPanel.getAttribute("data-movement-panel") || "outbound")
                : state.movementTab;
            if (event.target.matches("[data-movement-item-search]")) {
                const stockItem = findStockItemBySearchLabel(event.target.value);
                state.movementDrafts[movementTab] = {
                    ...getMovementDraft(movementTab),
                    ItemID: stockItem ? stockItem.ItemID : "",
                    ItemSearch: event.target.value
                };
                return;
            }

            const movementField = event.target.getAttribute("data-movement-field");
            if (!movementField) {
                return;
            }

            state.movementDrafts[movementTab] = {
                ...getMovementDraft(movementTab),
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
            onImport: isTicketModule() ? null : async () => {
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
            if (await AppShell.handleSessionError(error)) {
                return;
            }
            UI.alert({
                icon: "error",
                title: "Module failed",
                text: error.message || "Unexpected error"
            });
        }
    }

    bootstrap();
})();
