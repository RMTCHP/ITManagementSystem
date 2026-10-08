(function () {
    const REPORTS = [
        { key: "workOrders", group: "Printable documents", title: "Computer Work Orders", icon: "fa-file-circle-check", tone: "blue", description: "Ticket work orders ready to view or save as PDF.", docType: "workOrders", accessKey: "tickets", columns: [["TicketID", "Ticket ID"], ["RequestDate", "Date"], ["Requester", "Requester"], ["Department", "Department"], ["RequestedService", "Service"], ["Subject", "Summary"], ["Status", "Status"]] },
        { key: "borrowingForms", group: "Printable documents", title: "Computer Borrowing & Return", icon: "fa-file-signature", tone: "teal", description: "Signed borrowing and return forms as PDF.", docType: "borrowingForms", accessKey: "assets", columns: [["BorrowingID", "Document ID"], ["BorrowedAt", "Borrowed"], ["AssetName", "Computer"], ["FixedAssetNo", "Asset tag"], ["Borrower", "Borrower"], ["BorrowerDepartment", "Department"], ["ReturnedAt", "Returned"], ["Status", "Status"]] },
        { key: "tickets", group: "Service Desk", title: "Ticket operations", icon: "fa-ticket", tone: "blue", description: "Requests, ownership and resolution status.", dateField: "RequestDate", dateLabel: "Request date", statusField: "Status", categoryField: "RequestedService", categoryLabel: "Service", columns: [["TicketID", "Ticket ID"], ["RequestDate", "Date"], ["Requester", "Requester"], ["Department", "Department"], ["RequestedService", "Service"], ["Priority", "Priority"], ["AssignedTo", "Assigned to"], ["Status", "Status"]] },
        { key: "accessRequests", group: "Service Desk", title: "Access requests", icon: "fa-user-shield", tone: "rose", description: "Approvals and account or permission requests.", dateField: "RequestDate", dateLabel: "Request date", statusField: "Status", categoryField: "RequestType", categoryLabel: "Request type", columns: [["RequestID", "Request ID"], ["RequestDate", "Date"], ["Requester", "Requester"], ["Department", "Department"], ["RequestType", "Type"], ["TargetUser", "Target user"], ["Status", "Status"], ["ApprovedBy", "Approved by"]] },
        { key: "assets", group: "Asset & Inventory", title: "Asset register", icon: "fa-laptop-file", tone: "orange", description: "Equipment identity, assigned user and recorded life.", dateField: "DateOfDepreciation", dateLabel: "Depreciation date", categoryField: "Group", categoryLabel: "Asset group", columns: [["FixedAssetNo", "Fixed asset tag"], ["Group", "Group"], ["AssetName", "Asset name"], ["SerialNumber", "Serial number"], ["DateOfDepreciation", "Depreciation date"], ["LifeTime", "Life time"], ["User", "User"], ["Location", "Location"]] },
        { key: "stockItems", group: "Asset & Inventory", title: "Inventory balance", icon: "fa-boxes-stacked", tone: "violet", description: "Current quantity and replenishment status.", statusField: "StockStatus", categoryField: "Category", categoryLabel: "Category", columns: [["ItemID", "Item ID"], ["ItemName", "Item"], ["Category", "Category"], ["Quantity", "Quantity"], ["MinimumStock", "Minimum"], ["StockStatus", "Stock status"], ["Location", "Location"]] },
        { key: "stockMovements", group: "Asset & Inventory", title: "Stock movements", icon: "fa-arrow-right-arrow-left", tone: "indigo", description: "Inbound, outbound and adjustment history.", dateField: "MovementDate", dateLabel: "Movement date", statusField: "MovementType", columns: [["MovementID", "Movement ID"], ["MovementDate", "Date"], ["MovementType", "Type"], ["ItemID", "Item ID"], ["Quantity", "Quantity"], ["ReferenceNo", "Reference"], ["PerformedBy", "Performed by"]] },
        { key: "licenses", group: "Renewal & Governance", title: "Software licenses", icon: "fa-id-card-clip", tone: "teal", description: "Allocation, expiry and vendor overview.", dateField: "ExpiryDate", dateLabel: "Expiry date", statusField: "Status", categoryField: "LicenseType", categoryLabel: "License type", columns: [["LicenseID", "License ID"], ["SoftwareName", "Software"], ["LicenseType", "Type"], ["TotalQty", "Total"], ["UsedQty", "Used"], ["ExpiryDate", "Expiry"], ["Vendor", "Vendor"], ["Status", "Status"]] },
        { key: "maintenanceAgreements", group: "Renewal & Governance", title: "MA & contracts", icon: "fa-file-signature", tone: "green", description: "Agreement end dates and renewal status.", dateField: "EndDate", dateLabel: "End date", statusField: "Status", categoryField: "Category", categoryLabel: "Category", columns: [["AgreementID", "Agreement ID"], ["AgreementName", "Agreement"], ["Vendor", "Vendor"], ["EndDate", "End date"], ["RenewalNoticeDays", "Notice days"], ["Owner", "Owner"], ["Status", "Status"]] },
        { key: "auditLogs", group: "Renewal & Governance", title: "Audit trail", icon: "fa-clipboard-list", tone: "slate", description: "Who changed what and when.", dateField: "Timestamp", dateLabel: "Event date", statusField: "Action", categoryField: "Module", categoryLabel: "Module", columns: [["Timestamp", "Date / time"], ["Action", "Action"], ["Module", "Module"], ["RecordID", "Record ID"], ["ActorName", "Actor"], ["Detail", "Detail"]] }
    ];
    const GROUPS = ["Printable documents", "Service Desk", "Asset & Inventory", "Renewal & Governance"];
    const PAGE_SIZE = 12;
    function currentMonthFilters() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const lastDay = String(new Date(year, now.getMonth() + 1, 0).getDate()).padStart(2, "0");
        return { query: "", from: `${year}-${month}-01`, to: `${year}-${month}-${lastDay}`, status: "", category: "" };
    }
    const emptyFilters = () => currentMonthFilters();
    const state = { session: null, tab: "detail", selected: "", catalogSearch: "", rows: {}, documents: {}, loadedAt: {}, summary: null, busy: false, error: "", page: 1, filters: emptyFilters() };
    const escape = (value) => UI.escapeHtml(value == null ? "" : String(value));
    const reportFor = (key) => REPORTS.find((report) => report.key === key);
    const accessibleReports = () => REPORTS.filter((report) => AppShell.canAccess(report.accessKey || report.key, state.session));

    function dateKey(value) {
        const input = String(value == null ? "" : value).trim();
        const iso = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
        const local = input.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
        return local ? `${local[3]}-${local[2]}-${local[1]}` : "";
    }

    function formatCell(key, value) {
        const raw = String(value == null ? "" : value);
        if (!/(?:Date|At|Timestamp)$/.test(key) && key !== "DateOfDepreciation") return raw;
        const date = dateKey(raw);
        if (!date) return raw;
        const time = raw.match(/[T ](\d{2}:\d{2})/);
        return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}${time ? ` ${time[1]}` : ""}`;
    }

    function filteredRows(report) {
        const f = state.filters;
        const query = f.query.trim().toLowerCase();
        return (state.rows[report.key] || []).filter((row) => {
            const date = report.dateField ? dateKey(row[report.dateField]) : "";
            if (f.from && (!date || date < f.from)) return false;
            if (f.to && (!date || date > f.to)) return false;
            if (f.status && String(row[report.statusField] || "") !== f.status) return false;
            if (f.category && String(row[report.categoryField] || "") !== f.category) return false;
            return !query || report.columns.some(([key]) => String(row[key] || "").toLowerCase().includes(query));
        }).sort((a, b) => report.dateField ? dateKey(b[report.dateField]).localeCompare(dateKey(a[report.dateField])) : 0);
    }

    function renderHeader() {
        return `<div class="reports-heading"><div><p class="reports-heading__eyebrow">GOVERNANCE & INSIGHT</p><h3>Reports</h3><p>Find the right records, review them, then export only what you need.</p></div><span class="reports-heading__privacy"><i class="fa-solid fa-shield-halved" aria-hidden="true"></i> Reports follow your module access</span></div>
            <div class="reports-tabs" role="tablist" aria-label="Report views"><button type="button" role="tab" aria-selected="${state.tab === "detail"}" class="${state.tab === "detail" ? "is-active" : ""}" data-reports-tab="detail"><i class="fa-solid fa-table-list" aria-hidden="true"></i> Detailed reports</button><button type="button" role="tab" aria-selected="${state.tab === "summary"}" class="${state.tab === "summary" ? "is-active" : ""}" data-reports-tab="summary"><i class="fa-solid fa-chart-pie" aria-hidden="true"></i> Executive summary</button></div>`;
    }

    function renderCatalog() {
        const available = accessibleReports().filter((report) => [report.title, report.description, report.group].join(" ").toLowerCase().includes(state.catalogSearch));
        const groups = GROUPS.map((group) => {
            const reports = available.filter((report) => report.group === group);
            return reports.length ? `<section class="reports-group"><h5>${escape(group)}</h5><div class="reports-catalog-grid">${reports.map((report) => `<button type="button" class="reports-catalog-card reports-tone--${report.tone}" data-open-report="${report.key}"><span class="reports-catalog-card__icon"><i class="fa-solid ${report.icon}" aria-hidden="true"></i></span><strong>${escape(report.title)}</strong><small>${escape(report.description)}</small><span class="reports-catalog-card__footer">OPEN REPORT <i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span></button>`).join("")}</div></section>` : "";
        }).join("");
        return `<div class="reports-catalog-intro"><div><h4>Choose a report</h4><p>Data loads only when you open a report.</p></div><span>${available.length} available</span></div>${groups || `<div class="reports-empty">No matching report. Try another search.</div>`}`;
    }

    function renderFilterForm(report) {
        const rows = state.rows[report.key] || [];
        const options = (field, selected) => `<option value="">All</option>${[...new Set(rows.map((row) => String(row[field] || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)).map((value) => `<option value="${escape(value)}" ${selected === value ? "selected" : ""}>${escape(value)}</option>`).join("")}`;
        return `<form id="reportFilterForm" class="reports-filter-form"><label class="reports-filter-form__search"><span>Search records</span><input name="query" type="search" value="${escape(state.filters.query)}" placeholder="Search visible report fields"></label>
            ${report.dateField ? `<label><span>${escape(report.dateLabel)} from</span><input name="from" type="date" value="${escape(state.filters.from)}"></label><label><span>To</span><input name="to" type="date" value="${escape(state.filters.to)}"></label>` : ""}
            ${report.statusField ? `<label><span>${report.statusField === "Action" || report.statusField === "MovementType" ? "Action / type" : "Status"}</span><select name="status">${options(report.statusField, state.filters.status)}</select></label>` : ""}
            ${report.categoryField ? `<label><span>${escape(report.categoryLabel)}</span><select name="category">${options(report.categoryField, state.filters.category)}</select></label>` : ""}
            <div class="reports-filter-form__actions"><button type="submit" class="primary-btn">Apply filters</button><button type="button" class="ghost-btn" data-report-clear>Clear</button></div></form>`;
    }

    function renderDocumentReport(report) {
        const result = state.documents[report.key];
        const rows = result ? result.records || [] : [];
        const total = result ? Number(result.total) || 0 : 0;
        const page = result ? Number(result.page) || 1 : 1;
        const pageSize = result ? Number(result.pageSize) || 15 : 15;
        const pages = Math.max(1, Math.ceil(total / pageSize));
        const isWorkOrder = report.docType === "workOrders";
        return `<section class="reports-workspace reports-tone--${report.tone}"><div class="reports-workspace__heading"><button type="button" class="reports-back" data-report-back><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> All reports</button><div class="reports-workspace__title"><span class="reports-catalog-card__icon"><i class="fa-solid ${report.icon}" aria-hidden="true"></i></span><div><h4>${escape(report.title)}</h4><p>${escape(report.description)}</p></div></div></div>
            <form id="documentReportFilterForm" class="reports-filter-form reports-filter-form--documents"><label class="reports-filter-form__search"><span>Search documents</span><input name="query" type="search" value="${escape(state.filters.query)}" placeholder="ID, computer, requester or borrower"></label><label><span>From</span><input name="from" type="date" value="${escape(state.filters.from)}"></label><label><span>To</span><input name="to" type="date" value="${escape(state.filters.to)}"></label>${isWorkOrder ? "" : `<label><span>Status</span><select name="status"><option value="">All statuses</option><option value="Borrowed" ${state.filters.status === "Borrowed" ? "selected" : ""}>Borrowed</option><option value="Returned" ${state.filters.status === "Returned" ? "selected" : ""}>Returned</option></select></label>`}<div class="reports-filter-form__actions"><button type="submit" class="primary-btn">Search</button><button type="button" class="ghost-btn" data-document-clear>Clear</button></div></form>
            ${state.busy ? `<div class="reports-state"><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i><strong>Loading documents</strong><span>Fetching one page of records</span></div>` : state.error ? `<div class="reports-state reports-state--error"><strong>Documents unavailable</strong><span>${escape(state.error)}</span><button type="button" class="secondary-btn" data-report-retry>Try again</button></div>` : `<div class="reports-result-bar"><div><strong>${total.toLocaleString("en-US")}</strong> documents <span>Newest first</span></div></div><div class="reports-table-wrap"><table class="reports-table"><thead><tr>${report.columns.map(([, label]) => `<th>${escape(label)}</th>`).join("")}<th>Document</th></tr></thead><tbody>${rows.length ? rows.map((row) => { const id = isWorkOrder ? row.TicketID : row.BorrowingID; return `<tr>${report.columns.map(([key]) => `<td>${escape(formatCell(key, row[key])) || "-"}</td>`).join("")}<td><button type="button" class="secondary-btn reports-document-open" data-document-open="${escape(id)}"><i class="fa-regular fa-file-pdf" aria-hidden="true"></i> View PDF</button></td></tr>`; }).join("") : `<tr><td colspan="${report.columns.length + 1}" class="reports-table__empty">No documents match these filters.</td></tr>`}</tbody></table></div><div class="reports-pagination"><span>Showing ${total ? (page - 1) * pageSize + 1 : 0}-${Math.min(page * pageSize, total)} of ${total}</span><div><button type="button" class="ghost-btn" data-document-page="prev" ${page <= 1 ? "disabled" : ""}>Previous</button><span>Page ${page} / ${pages}</span><button type="button" class="ghost-btn" data-document-page="next" ${page >= pages ? "disabled" : ""}>Next</button></div></div>`}</section>`;
    }

    function renderReport() {
        const report = reportFor(state.selected);
        if (!report || !AppShell.canAccess(report.accessKey || report.key, state.session)) return renderCatalog();
        if (report.docType) return renderDocumentReport(report);
        const rows = state.rows[report.key];
        const filtered = rows ? filteredRows(report) : [];
        const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        state.page = Math.min(state.page, pages);
        const visible = filtered.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
        return `<section class="reports-workspace reports-tone--${report.tone}"><div class="reports-workspace__heading"><button type="button" class="reports-back" data-report-back><i class="fa-solid fa-arrow-left" aria-hidden="true"></i> All reports</button><div class="reports-workspace__title"><span class="reports-catalog-card__icon"><i class="fa-solid ${report.icon}" aria-hidden="true"></i></span><div><h4>${escape(report.title)}</h4><p>${escape(report.description)}</p></div></div>${rows ? `<span class="reports-workspace__updated">Loaded ${escape(state.loadedAt[report.key] || "")}</span>` : ""}</div>
            ${state.busy ? `<div class="reports-state"><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i><strong>Loading ${escape(report.title)}</strong><span>Fetching this report only</span></div>` : state.error ? `<div class="reports-state reports-state--error"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><strong>Report unavailable</strong><span>${escape(state.error)}</span><button type="button" class="secondary-btn" data-report-retry>Try again</button></div>` : rows ? `${renderFilterForm(report)}<div class="reports-result-bar"><div><strong>${filtered.length.toLocaleString("en-US")}</strong> matching records <span>of ${rows.length.toLocaleString("en-US")} loaded</span></div><div class="reports-result-bar__actions"><button type="button" class="secondary-btn" data-report-export="csv" ${filtered.length ? "" : "disabled"}><i class="fa-solid fa-file-csv" aria-hidden="true"></i> CSV</button><button type="button" class="primary-btn" data-report-export="xlsx" ${filtered.length ? "" : "disabled"}><i class="fa-solid fa-file-excel" aria-hidden="true"></i> Excel</button></div></div><div class="reports-table-wrap"><table class="reports-table"><thead><tr>${report.columns.map(([, label]) => `<th>${escape(label)}</th>`).join("")}</tr></thead><tbody>${visible.length ? visible.map((row) => `<tr>${report.columns.map(([key]) => `<td>${escape(formatCell(key, row[key])) || "—"}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${report.columns.length}" class="reports-table__empty">No records match these filters.</td></tr>`}</tbody></table></div><div class="reports-pagination"><span>Showing ${filtered.length ? (state.page - 1) * PAGE_SIZE + 1 : 0}–${Math.min(state.page * PAGE_SIZE, filtered.length)} of ${filtered.length}</span><div><button type="button" class="ghost-btn" data-report-page="prev" ${state.page <= 1 ? "disabled" : ""}>Previous</button><span>Page ${state.page} / ${pages}</span><button type="button" class="ghost-btn" data-report-page="next" ${state.page >= pages ? "disabled" : ""}>Next</button></div></div>` : ""}</section>`;
    }

    function renderSummary() {
        if (state.busy) return `<div class="reports-state"><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i><strong>Loading current snapshot</strong><span>Preparing the operational summary</span></div>`;
        if (state.error) return `<div class="reports-state reports-state--error"><strong>Summary unavailable</strong><span>${escape(state.error)}</span><button type="button" class="secondary-btn" data-summary-retry>Try again</button></div>`;
        if (!state.summary) return "";
        const data = state.summary;
        const n = (value) => Math.max(0, Number(value) || 0).toLocaleString("en-US");
        const cards = [
            ...(AppShell.normalizeRole(state.session.user.Role) === "admin" ? [{ title: "Open tickets", value: n(data.openTickets), icon: "fa-ticket", tone: "blue" }] : []),
            { title: "Asset lifecycle", value: `${n(data.expiredAssets)} expired · ${n(data.expiringSoonAssets)} expiring`, icon: "fa-laptop-file", tone: "orange" },
            { title: "Inventory alerts", value: `${n(data.lowStock)} low · ${n(data.outOfStock)} out`, icon: "fa-boxes-stacked", tone: "violet" },
            { title: "MA & contracts", value: `${n(data.maintenanceExpiring)} expiring · ${n(data.maintenanceExpired)} expired`, icon: "fa-file-signature", tone: "green" },
            { title: "Access requests", value: n(data.pendingAccessRequests), icon: "fa-user-shield", tone: "rose" }
        ];
        return `<section class="reports-summary"><div class="reports-summary__heading"><div><p class="reports-heading__eyebrow">CURRENT SNAPSHOT</p><h4>Executive summary</h4><p>Current counts only. Select Detailed reports for historical records and exports.</p></div><span>Updated ${escape(formatCell("Timestamp", data.updatedAt || ""))}</span></div><div class="reports-summary__grid">${cards.map((card) => `<article class="reports-summary__card reports-tone--${card.tone}"><span class="reports-catalog-card__icon"><i class="fa-solid ${card.icon}" aria-hidden="true"></i></span><strong>${escape(card.title)}</strong><span>${escape(card.value)}</span></article>`).join("")}</div></section>`;
    }

    function renderPage() {
        document.getElementById("viewContainer").innerHTML = `<div class="reports-page">${renderHeader()}${state.tab === "summary" ? renderSummary() : state.selected ? renderReport() : renderCatalog()}</div>`;
    }

    async function loadDocumentReport(key, page) {
        const report = reportFor(key);
        if (!report || !report.docType || !AppShell.canAccess(report.accessKey, state.session)) return;
        state.selected = key;
        state.error = "";
        state.busy = true;
        renderPage();
        try {
            const result = await ApiClient.request("listReportDocuments", {
                token: ApiClient.getSessionToken(), type: report.docType,
                query: state.filters.query, from: state.filters.from, to: state.filters.to,
                status: state.filters.status, page: page || 1, pageSize: 15
            });
            state.documents[key] = result.data || { records: [], total: 0, page: 1, pageSize: 15 };
        } catch (error) {
            if (await AppShell.handleSessionError(error)) return;
            state.error = error.message || "Unable to load documents.";
        } finally {
            state.busy = false;
            renderPage();
        }
    }

    async function loadReport(key, force) {
        const report = reportFor(key);
        if (!report || !AppShell.canAccess(report.accessKey || key, state.session)) return;
        if (report.docType) return loadDocumentReport(key, 1);
        state.selected = key;
        state.error = "";
        state.page = 1;
        if (!force && state.rows[key]) { renderPage(); return; }
        state.busy = true;
        renderPage();
        try {
            const action = key === "tickets" ? "listTicketWorkspace" : "listRecords";
            const result = await ApiClient.request(action, {
                token: ApiClient.getSessionToken(),
                module: key,
                from: state.filters.from,
                to: state.filters.to,
                dateField: report.dateField || ""
            });
            state.rows[key] = result.data.records || [];
            state.loadedAt[key] = AppShell.currentTimestampLabel();
        } catch (error) {
            if (await AppShell.handleSessionError(error)) return;
            state.error = error.message || "Unable to load this report.";
        } finally {
            state.busy = false;
            renderPage();
        }
    }

    async function loadSummary(force) {
        if (!force && state.summary) { renderPage(); return; }
        state.error = "";
        state.busy = true;
        renderPage();
        try {
            const result = await ApiClient.request("dashboardOverview", { token: ApiClient.getSessionToken() });
            state.summary = result.data || {};
        } catch (error) {
            if (await AppShell.handleSessionError(error)) return;
            state.error = error.message || "Unable to load the summary.";
        } finally {
            state.busy = false;
            renderPage();
        }
    }

    function csvExport(fileName, rows) {
        const headers = Object.keys(rows[0] || {});
        const clean = (value) => {
            const text = String(value == null ? "" : value);
            const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
            return `"${safe.replace(/"/g, '""')}"`;
        };
        const lines = [headers.map(clean).join(","), ...rows.map((row) => headers.map((key) => clean(row[key])).join(","))];
        const url = URL.createObjectURL(new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `${fileName}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function exportSelected(format) {
        const report = reportFor(state.selected);
        if (!report || !state.rows[report.key]) return;
        const filtered = filteredRows(report);
        if (!filtered.length) return;
        const rows = filtered.map((record) => Object.fromEntries(report.columns.map(([key, label]) => {
            const value = formatCell(key, record[key]);
            return [label, /^[=+\-@\t\r]/.test(value) ? `'${value}` : value];
        })));
        const fileName = `${report.key}_${UI.buildTimestampForFileName()}`;
        try {
            if (format === "csv") csvExport(fileName, rows);
            else await UI.exportToExcel(fileName, rows);
        } catch (error) {
            await UI.alert({ icon: "error", title: "Export failed", text: error.message || "Unable to prepare the file." });
        }
    }

    function attachEvents() {
        const view = document.getElementById("viewContainer");
        view.addEventListener("click", async (event) => {
            const button = event.target.closest("button");
            if (!button || state.busy) return;
            if (button.dataset.reportsTab) {
                state.tab = button.dataset.reportsTab;
                state.error = "";
                renderPage();
                if (state.tab === "summary") await loadSummary(false);
            } else if (button.dataset.openReport) {
                state.filters = emptyFilters();
                await loadReport(button.dataset.openReport, false);
            } else if (button.hasAttribute("data-report-back")) {
                state.selected = ""; state.error = ""; renderPage();
            } else if (button.hasAttribute("data-report-retry")) {
                await loadReport(state.selected, true);
            } else if (button.hasAttribute("data-summary-retry")) {
                await loadSummary(true);
            } else if (button.hasAttribute("data-report-clear")) {
                state.filters = emptyFilters(); state.page = 1; await loadReport(state.selected, true);
            } else if (button.hasAttribute("data-document-clear")) {
                state.filters = emptyFilters();
                await loadDocumentReport(state.selected, 1);
            } else if (button.dataset.documentPage) {
                const current = state.documents[state.selected];
                const next = (Number(current && current.page) || 1) + (button.dataset.documentPage === "next" ? 1 : -1);
                await loadDocumentReport(state.selected, next);
            } else if (button.dataset.documentOpen) {
                const report = reportFor(state.selected);
                const isWorkOrder = report && report.docType === "workOrders";
                const file = isWorkOrder ? "tickets.html" : "assets.html";
                const action = isWorkOrder ? "print-ticket" : "print-borrowing";
                const parameter = isWorkOrder ? "ticketId" : "borrowingId";
                const url = `${file}?action=${action}&${parameter}=${encodeURIComponent(button.dataset.documentOpen)}`;
                window.open(url, "_blank", "noopener");
            } else if (button.dataset.reportExport) {
                await exportSelected(button.dataset.reportExport);
            } else if (button.dataset.reportPage) {
                state.page += button.dataset.reportPage === "next" ? 1 : -1; renderPage();
            }
        });
        view.addEventListener("submit", (event) => {
            if (event.target.id === "documentReportFilterForm") {
                event.preventDefault();
                const values = new FormData(event.target);
                const from = String(values.get("from") || "");
                const to = String(values.get("to") || "");
                if (from && to && from > to) {
                    UI.alert({ icon: "warning", title: "Invalid date range", text: "Start date must be on or before end date." });
                    return;
                }
                state.filters = { ...emptyFilters(), query: String(values.get("query") || ""), from, to, status: String(values.get("status") || "") };
                loadDocumentReport(state.selected, 1);
                return;
            }
            if (event.target.id !== "reportFilterForm") return;
            event.preventDefault();
            const values = new FormData(event.target);
            const from = String(values.get("from") || "");
            const to = String(values.get("to") || "");
            if (from && to && from > to) {
                UI.alert({ icon: "warning", title: "Invalid date range", text: "Start date must be on or before end date." });
                return;
            }
            state.filters = { query: String(values.get("query") || ""), from, to, status: String(values.get("status") || ""), category: String(values.get("category") || "") };
            state.page = 1;
            loadReport(state.selected, true);
        });
    }

    async function bootstrap() {
        const shell = await AppShell.init({
            currentView: "reports", title: "Reports", eyebrow: "Governance & Insight", searchPlaceholder: "Search report types",
            onSearch(value) { state.catalogSearch = String(value || "").toLowerCase(); if (state.tab === "detail" && !state.selected) renderPage(); },
            async onRefresh() {
                if (state.tab === "summary") await loadSummary(true);
                else if (state.selected) await loadReport(state.selected, true);
                else renderPage();
            },
            async onExport() {
                if (state.tab === "detail" && state.selected && !reportFor(state.selected).docType) await exportSelected("xlsx");
                else if (state.tab === "detail" && state.selected) await UI.alert({ title: "Open a document", text: "Select View PDF in the document table to print or save that form." });
                else await UI.alert({ title: "Choose a report", text: "Open a detailed report before exporting." });
            }
        });
        if (!shell) return;
        state.session = shell.session;
        renderPage();
        attachEvents();
    }

    bootstrap();
})();
