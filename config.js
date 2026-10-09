window.APP_CONFIG = {
    appName: "IT Asset Management & Request Job System",
    projectProfile: "Enterprise Clean",
    webAppUrl: "https://script.google.com/macros/s/AKfycbwE3yJ8iC177KNNQIRE8fkSYFdw69DV4SyK2FQ3MxKjO4Z6laJm7gRbUcH-yF9h58Y/exec",
    sessionStorageKey: "itms_session",
    sessionHours: 12,
    pageRoutes: {
        dashboard: "dashboard.html",
        teamBoard: "team-board.html",
        assets: "assets.html",
        tickets: "tickets.html",
        accessRequests: "access-management.html",
        stockItems: "inventory.html",
        stockMovements: "stock-movements.html",
        licenses: "licenses.html",
        maintenanceAgreements: "ma-renewal.html",
        documents: "document-center.html",
        reports: "reports.html",
        users: "administration.html",
        auditLogs: "audit-log.html"
    },
    roles: ["Admin", "User"],
    departments: ["IT", "Production", "Quality", "Finance", "HR", "Warehouse"],
    statusPalette: {
        Active: "success",
        Available: "success",
        Approved: "success",
        Resolved: "success",
        Closed: "neutral",
        Open: "info",
        Assigned: "info",
        "In Progress": "info",
        Pending: "warning",
        "Pending Approval": "warning",
        Repair: "warning",
        "Low Stock": "warning",
        Expiring: "warning",
        "Renewal In Progress": "info",
        Renewed: "neutral",
        Inbound: "success",
        Outbound: "danger",
        Adjustment: "info",
        Normal: "success",
        Expired: "danger",
        Cancelled: "neutral",
        Unknown: "neutral",
        Rejected: "danger",
        Broken: "danger",
        Disabled: "danger",
        Inactive: "danger"
    },
    priorityPalette: {
        Low: "neutral",
        Medium: "info",
        High: "warning",
        Critical: "danger"
    },
    menu: [
        { group: "Overview", items: [
            { key: "dashboard", label: "Dashboard", icon: "fa-chart-pie", description: "Summary and quick actions" },
            { key: "teamBoard", label: "IT Team Board", icon: "fa-note-sticky", description: "Team updates, handovers and tasks" }
        ] },
        { group: "Asset & Inventory", items: [
            { key: "assets", label: "Asset Management", icon: "fa-laptop-file", description: "Asset register and lifecycle" },
            { key: "licenses", label: "License Management", icon: "fa-id-card-clip", description: "Software license tracking" },
            { key: "stockItems", label: "Inventory", icon: "fa-boxes-stacked", description: "Stock and movements" },
            { key: "stockMovements", label: "Stock Movement", icon: "fa-arrow-right-arrow-left", description: "Inbound, outbound and adjustment logs" },
            { key: "maintenanceAgreements", label: "MA & Renewal", icon: "fa-file-signature", description: "Maintenance contracts and renewal alerts" }
        ]},
        { group: "IT Service Desk", items: [
            { key: "tickets", label: "Tickets & Requests", icon: "fa-screwdriver-wrench", description: "IT incidents and service requests" },
            { key: "accessRequests", label: "Access Requests", icon: "fa-user-shield", description: "Account and permission requests" }
        ]},
        { group: "Knowledge Center", items: [
            { key: "documents", label: "IT Knowledge Center", icon: "fa-book-open", description: "IT guides, standards and operational knowledge" }
        ]},
        { group: "Governance", items: [
            { key: "reports", label: "Reports", icon: "fa-chart-column", description: "Exports and audit views" },
            { key: "users", label: "Administration", icon: "fa-gear", description: "Users and audit logs" },
            { key: "auditLogs", label: "Audit Log", icon: "fa-clipboard-list", description: "Read-only traceability" }
        ]}
    ],
    dashboardMetrics: [
        { key: "totalAssets", label: "Total Assets", icon: "fa-laptop-file" },
        { key: "expiredAssets", label: "Expired Assets", icon: "fa-triangle-exclamation" },
        { key: "expiringSoonAssets", label: "Expiring Soon", icon: "fa-hourglass-half" },
        { key: "openTickets", label: "Open Tickets", icon: "fa-ticket" },
        { key: "pendingApproval", label: "Pending Approval", icon: "fa-user-clock" },
        { key: "lowStock", label: "Low Stock", icon: "fa-box-open" },
        { key: "outOfStock", label: "Out of Stock", icon: "fa-ban" }
    ],
    modules: {
        teamBoard: {
            key: "teamBoard",
            label: "IT Team Board",
            icon: "fa-note-sticky",
            roles: ["Admin", "User"],
            permissions: { create: ["Admin", "User"], edit: ["Admin", "User"] }
        },
        assets: {
            key: "assets",
            label: "Asset Management",
            icon: "fa-laptop-file",
            idField: "AssetID",
            roles: ["Admin", "User"],
            permissions: { create: ["Admin"], edit: ["Admin"], delete: ["Admin"] },
            listFields: ["FixedAssetNo", "Group", "AssetName", "SerialNumber", "DateOfDepreciation", "LifeTime", "AssetAge", "AssetLifeStatus", "AmountBaht", "User", "Location"],
            fields: [
                { key: "AssetID", label: "IT Asset No.", type: "text", readonly: true, hint: "Auto generated by system" },
                { key: "FixedAssetNo", label: "Fixed Assets No.", type: "text" },
                { key: "Group", label: "Group", type: "select", options: ["Computer", "Software", "Office Equiment"] },
                { key: "AssetName", label: "Asset Name", type: "text", required: true },
                { key: "SerialNumber", label: "Serial Number", type: "text", hint: "Device serial number, especially for computers and notebooks." },
                { key: "CPU", label: "CPU", type: "text", hint: "Computer specification; reused for the same Asset Name." },
                { key: "Storage", label: "Storage", type: "text", hint: "Example: 512 GB SSD" },
                { key: "RAM", label: "RAM", type: "text", hint: "Example: 16 GB" },
                { key: "DateOfDepreciation", label: "Date of Depreciation", type: "date" },
                { key: "PONo", label: "PO No.", type: "text" },
                { key: "Quantity", label: "Quantity", type: "number", required: true },
                { key: "LifeTime", label: "Life Time", type: "text" },
                { key: "AmountBaht", label: "Amount (Baht)", type: "number" },
                { key: "User", label: "User", type: "text" },
                { key: "Location", label: "Location", type: "text" },
                { key: "Remark", label: "Remark", type: "textarea", full: true }
            ]
        },
        tickets: {
            key: "tickets",
            label: "Ticket Workspace",
            icon: "fa-screwdriver-wrench",
            idField: "TicketID",
            statusField: "Status",
            roles: ["Admin"],
            permissions: { create: ["Admin"], edit: ["Admin"], delete: ["Admin"] },
            listFields: ["TicketID", "RequestDate", "Requester", "Department", "RequestedService", "Category", "Priority", "ServiceMethod", "AssignedTo", "Status"],
            fields: [
                { key: "TicketID", label: "Ticket ID", type: "text", readonly: true, hint: "Auto generated by system" },
                { key: "RequestDate", label: "Request Date", type: "date", readonly: true, hint: "Set by system" },
                { key: "Requester", label: "Requester", type: "text", required: true },
                { key: "Department", label: "Department", type: "select", options: ["IT", "Production", "Quality", "Finance", "HR", "Warehouse"] },
                { key: "Location", label: "Location / Issue Point", type: "text", full: true },
                { key: "RequestedService", label: "Requested Service", type: "select", options: ["On-site", "Remote Support", "Equipment Requisition"] },
                { key: "Category", label: "Category", type: "select", options: ["Software Installation", "Hardware Request", "Printer Request", "Network Request", "Email Request", "ERP / D365 Request", "New User Request", "Resignation User Request", "Other"] },
                { key: "Priority", label: "Priority", type: "select", options: ["Low", "Medium", "High", "Critical"] },
                { key: "Subject", label: "Subject", type: "text", required: true, full: true },
                { key: "Description", label: "Description", type: "textarea", full: true },
                { key: "AssignedTo", label: "Assigned To", type: "text" },
                { key: "ServiceMethod", label: "Service Method", type: "select", options: ["On-site", "Remote Support", "Phone Guidance"] },
                { key: "WorkStartedAt", label: "Work Started At", type: "datetime-local" },
                { key: "WorkCompletedAt", label: "Work Completed At", type: "datetime-local" },
                { key: "Status", label: "Status", type: "select", options: ["Open", "Assigned", "In Progress", "Pending", "Resolved", "Closed", "Rejected"] },
                { key: "DueDate", label: "Due Date", type: "date" },
                { key: "ResolvedDate", label: "Resolved Date", type: "date" },
                { key: "ResolutionNote", label: "Resolution Note", type: "textarea", full: true },
                { key: "Remark", label: "Internal Note", type: "textarea", full: true }
            ]
        },
        accessRequests: {
            key: "accessRequests",
            label: "Access Requests",
            icon: "fa-user-shield",
            idField: "RequestID",
            statusField: "Status",
            roles: ["Admin", "User"],
            permissions: { create: ["Admin", "User"], edit: ["Admin"], delete: ["Admin"] },
            listFields: ["RequestID", "RequestDate", "Requester", "Department", "RequestType", "TargetUser", "Status", "ApprovedBy", "UpdatedAt"],
            fields: [
                { key: "RequestID", label: "Request ID", type: "text", readonly: true, hint: "Auto generated by system" },
                { key: "RequestDate", label: "Request Date", type: "date", readonly: true, hint: "Set by system" },
                { key: "Requester", label: "Requester", type: "text", required: true },
                { key: "Department", label: "Department", type: "select", options: ["IT", "Production", "Quality", "Finance", "HR", "Warehouse"] },
                { key: "RequestType", label: "Request Type", type: "select", options: ["Create AD User", "Disable AD User", "Password Reset", "Shared Folder Permission", "Email Group", "ERP / D365 Permission", "VPN Permission"] },
                { key: "TargetUser", label: "Target User", type: "text", required: true },
                { key: "SystemName", label: "System / Resource", type: "text" },
                { key: "Reason", label: "Reason", type: "textarea", full: true },
                { key: "Status", label: "Status", type: "select", options: ["Pending Approval", "Approved", "Rejected", "In Progress", "Closed"] },
                { key: "ApprovedBy", label: "Approved By", type: "text" },
                { key: "Remark", label: "Remark", type: "textarea", full: true }
            ]
        },
        stockItems: {
            key: "stockItems",
            label: "Inventory",
            icon: "fa-boxes-stacked",
            idField: "ItemID",
            statusField: "StockStatus",
            roles: ["Admin", "User"],
            permissions: { create: ["Admin"], edit: ["Admin"], delete: ["Admin"] },
            listFields: ["ItemName", "Description", "Quantity", "MinimumStock", "StockStatus"],
            fields: [
                { key: "ItemName", label: "Item Name", type: "text", required: true },
                { key: "Description", label: "Description", type: "textarea", full: true },
                { key: "Quantity", label: "Quantity", type: "number", required: true },
                { key: "MinimumStock", label: "Minimum Stock", type: "number", required: true }
            ]
        },
        stockMovements: {
            key: "stockMovements",
            label: "Stock Movement",
            icon: "fa-arrow-right-arrow-left",
            idField: "MovementID",
            statusField: "MovementType",
            roles: ["Admin", "User"],
            permissions: { create: ["Admin"], edit: ["Admin"], delete: ["Admin"] },
            listFields: ["MovementID", "MovementDate", "ItemID", "MovementType", "Quantity", "ReferenceNo", "PerformedBy", "Remark"],
            fields: [
                { key: "MovementID", label: "Movement ID", type: "text", required: true },
                { key: "MovementDate", label: "Movement Date", type: "date", required: true },
                { key: "ItemID", label: "Item ID", type: "text", required: true },
                { key: "MovementType", label: "Movement Type", type: "select", options: ["Inbound", "Outbound", "Adjustment"] },
                { key: "Quantity", label: "Quantity", type: "number", required: true },
                { key: "ReferenceNo", label: "Reference No", type: "text" },
                { key: "PerformedBy", label: "Performed By", type: "text" },
                { key: "Remark", label: "Remark", type: "textarea", full: true }
            ]
        },
        licenses: {
            key: "licenses",
            label: "License Inventory",
            icon: "fa-id-card-clip",
            idField: "LicenseID",
            statusField: "Status",
            roles: ["Admin", "User"],
            permissions: { create: ["Admin"], edit: ["Admin"], delete: ["Admin"] },
            listFields: ["LicenseID", "SoftwareName", "LicenseType", "TotalQty", "UsedQty", "ExpiryDate", "AssignedUser", "Status"],
            fields: [
                { key: "LicenseID", label: "License ID", type: "text", required: true },
                { key: "SoftwareName", label: "Software Name", type: "text", required: true },
                { key: "LicenseType", label: "License Type", type: "select", options: ["Per User", "Per Device", "Subscription", "Concurrent"] },
                { key: "TotalQty", label: "Total Quantity", type: "number", required: true },
                { key: "UsedQty", label: "Used Quantity", type: "number", required: true },
                { key: "ExpiryDate", label: "Expiry Date", type: "date" },
                { key: "Vendor", label: "Vendor", type: "text" },
                { key: "AssignedUser", label: "Assigned User", type: "text" },
                { key: "Status", label: "Status", type: "select", options: ["Active", "Expiring", "Expired"] },
                { key: "Remark", label: "Remark", type: "textarea", full: true }
            ]
        },
        maintenanceAgreements: {
            key: "maintenanceAgreements",
            label: "MA & Renewal",
            icon: "fa-file-signature",
            idField: "AgreementID",
            statusField: "Status",
            roles: ["Admin", "User"],
            permissions: { create: ["Admin"], edit: ["Admin"], delete: ["Admin"] },
            listFields: ["AgreementID", "AgreementName", "Category", "CoveredAsset", "Vendor", "EndDate", "RenewalNoticeDays", "Owner", "Status"],
            fields: [
                { key: "AgreementID", label: "Agreement ID", type: "text", readonly: true, hint: "Auto generated by system" },
                { key: "AgreementName", label: "Agreement / Service Name", type: "text", required: true, full: true },
                { key: "Category", label: "Category", type: "select", options: ["Server Maintenance", "Firewall / Network Security", "Internet / WAN", "Software Support", "Hardware Warranty", "Backup / DR", "Other"] },
                { key: "CoveredAsset", label: "Covered Asset / Service", type: "text", required: true },
                { key: "Vendor", label: "Vendor / Provider", type: "text", required: true },
                { key: "ContractNo", label: "Contract No.", type: "text" },
                { key: "StartDate", label: "Start Date", type: "date", required: true },
                { key: "EndDate", label: "End Date", type: "date", required: true },
                { key: "RenewalNoticeDays", label: "Notify Before Expiry (Days)", type: "number", required: true, default: "60", hint: "Recommended: 90, 60 or 30 days" },
                { key: "AmountBaht", label: "Contract Value (Baht)", type: "number" },
                { key: "Owner", label: "Owner / Responsible", type: "text", required: true },
                { key: "Status", label: "Status", type: "select", default: "Active", options: ["Active", "Renewal In Progress", "Expiring", "Expired", "Renewed", "Cancelled"] },
                { key: "DocumentURL", label: "Contract Document Link", type: "url", full: true },
                { key: "Remark", label: "Remark", type: "textarea", full: true }
            ]
        },
        documents: {
            key: "documents",
            label: "IT Knowledge Center",
            icon: "fa-book-open",
            idField: "DocumentID",
            statusField: "Status",
            roles: ["Admin", "User"],
            permissions: { create: ["Admin"], edit: ["Admin"], delete: ["Admin"] },
            listFields: ["DocumentID", "Category", "DocumentType", "Title", "OwnerDepartment", "ReviewDate", "Version", "Status"],
            fields: [
                { key: "DocumentID", label: "Document ID", type: "text", readonly: true, hint: "Auto generated by system" },
                { key: "Category", label: "Knowledge Category", type: "select", required: true, options: ["Network Diagram", "Server Guide", "IP Plan", "Backup & Recovery", "Configuration", "Troubleshooting", "IT Operations", "Vendor & License", "Other"] },
                { key: "DocumentType", label: "Document Type", type: "select", options: ["SOP", "WI", "Policy", "Runbook", "Manual", "Troubleshooting Guide", "Template", "Vendor Contract", "Maintenance Agreement"] },
                { key: "Title", label: "Title", type: "text", required: true, full: true },
                { key: "OwnerDepartment", label: "Owner Department", type: "select", options: ["IT", "Production", "Quality", "Finance", "HR", "Warehouse"] },
                { key: "ReviewDate", label: "Review Date", type: "date" },
                { key: "LinkURL", label: "Document Link", type: "text", full: true },
                { key: "Status", label: "Status", type: "select", options: ["Draft", "Active", "Review Required", "Archived"] },
                { key: "Remark", label: "Description", type: "textarea", full: true },
                { key: "Keywords", label: "Keywords", type: "text", full: true }
            ]
        },
        users: {
            key: "users",
            label: "User Management",
            icon: "fa-users-gear",
            idField: "UserID",
            statusField: "Status",
            roles: ["Admin", "User"],
            permissions: { create: ["Admin"], edit: ["Admin"], delete: ["Admin"] },
            listFields: ["UserID", "Username", "FullName", "Department", "Role", "Status", "Email", "LastLogin"],
            fields: [
                { key: "Username", label: "Username", type: "text", required: true },
                { key: "FullName", label: "Full Name", type: "text", required: true },
                { key: "Role", label: "Role", type: "select", options: ["Admin", "User"] },
                { key: "Password", label: "Password", type: "password", hint: "Only required when creating or resetting password." }
            ]
        },
        auditLogs: {
            key: "auditLogs",
            label: "Audit Log",
            icon: "fa-clipboard-list",
            idField: "LogID",
            statusField: "Action",
            roles: ["Admin", "User"],
            permissions: { create: [], edit: [], delete: [] },
            listFields: ["LogID", "Timestamp", "Action", "Module", "RecordID", "ActorName", "ActorRole", "Detail"],
            fields: []
        }
    }
};
