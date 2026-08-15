(function () {
    const palette = window.APP_CONFIG.statusPalette;
    const priorityPalette = window.APP_CONFIG.priorityPalette;
    let spreadsheetLibraryPromise;

    function loading(title, text) {
        Swal.fire({
            title,
            text,
            allowEscapeKey: false,
            allowOutsideClick: false,
            showConfirmButton: false,
            showCloseButton: false,
            didOpen: () => Swal.showLoading()
        });
    }

    function confirm(options) {
        return Swal.fire({
            icon: options.icon || "question",
            title: options.title,
            text: options.text,
            showCancelButton: true,
            confirmButtonText: options.confirmButtonText || "Confirm",
            cancelButtonText: options.cancelButtonText || "Cancel",
            showCloseButton: true,
            reverseButtons: true
        });
    }

    function alert(options) {
        return Swal.fire({
            icon: options.icon || "info",
            title: options.title,
            text: options.text || "",
            showCloseButton: true
        });
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function badge(value, type) {
        if (!value) {
            return '<span class="badge badge--neutral">-</span>';
        }
        const tone = type === "priority" ? (priorityPalette[value] || "neutral") : (palette[value] || "neutral");
        return `<span class="badge badge--${tone}">${escapeHtml(value)}</span>`;
    }

    function loadSpreadsheetLibrary() {
        if (window.XLSX) {
            return Promise.resolve(window.XLSX);
        }
        if (spreadsheetLibraryPromise) {
            return spreadsheetLibraryPromise;
        }

        spreadsheetLibraryPromise = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
            script.async = true;
            script.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error("Excel library failed to load"));
            script.onerror = () => reject(new Error("Unable to load the Excel library"));
            document.head.appendChild(script);
        });
        return spreadsheetLibraryPromise;
    }

    async function exportToExcel(fileName, rows) {
        const XLSX = await loadSpreadsheetLibrary();
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
    }

    async function exportToCsv(fileName, rows) {
        const XLSX = await loadSpreadsheetLibrary();
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${fileName}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    function buildTimestampForFileName(date = new Date()) {
        const pad = (value) => String(value).padStart(2, "0");
        return [
            date.getFullYear(),
            pad(date.getMonth() + 1),
            pad(date.getDate())
        ].join("") + "_" + [
            pad(date.getHours()),
            pad(date.getMinutes()),
            pad(date.getSeconds())
        ].join("");
    }

    function emptyState(title, text) {
        return `
            <div class="empty-state">
                <i class="fa-regular fa-folder-open"></i>
                <h3>${escapeHtml(title)}</h3>
                <p>${escapeHtml(text)}</p>
            </div>
        `;
    }

    function normalizeDateInputValue(value) {
        if (value == null || value === "") {
            return "";
        }

        if (Object.prototype.toString.call(value) === "[object Date]" && !Number.isNaN(value.getTime())) {
            return value.toISOString().slice(0, 10);
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

        const parsed = new Date(raw.replace(" ", "T"));
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toISOString().slice(0, 10);
        }

        return raw;
    }

    function fieldMarkup(field, value) {
        const fieldClass = field.full ? "field--full" : "";
        const normalizedValue = field.type === "date" ? normalizeDateInputValue(value) : value;
        const safeValue = normalizedValue == null ? "" : normalizedValue;
        const hint = field.hint ? `<div class="form-hint">${escapeHtml(field.hint)}</div>` : "";
        const label = `<span class="modal-form__label">${escapeHtml(field.label)}${field.required ? ' <em>*</em>' : ""}</span>`;

        if (field.type === "select") {
            const options = (field.options || []).map((option) => {
                const selected = option === safeValue ? "selected" : "";
                return `<option value="${escapeHtml(option)}" ${selected}>${escapeHtml(option)}</option>`;
            }).join("");
            return `
                <label class="modal-form__field ${fieldClass}">
                    ${label}
                    <select data-field="${escapeHtml(field.key)}">
                        <option value="">Select</option>
                        ${options}
                    </select>
                    ${hint}
                </label>
            `;
        }

        if (field.type === "textarea") {
            return `
                <label class="modal-form__field ${fieldClass}">
                    ${label}
                    <textarea data-field="${escapeHtml(field.key)}">${escapeHtml(safeValue)}</textarea>
                    ${hint}
                </label>
            `;
        }

        const inputType = field.type === "number"
            ? "number"
            : field.type === "date"
                ? "date"
                : field.type === "datetime-local"
                    ? "datetime-local"
                    : field.type === "password"
                        ? "password"
                        : "text";
        const readonly = field.readonly ? "readonly" : "";
        return `
            <label class="modal-form__field ${fieldClass}">
                ${label}
                <input type="${inputType}" data-field="${escapeHtml(field.key)}" value="${escapeHtml(safeValue)}" ${readonly}>
                ${hint}
            </label>
        `;
    }

    async function openFormModal(module, initialValues = {}, mode = "create") {
        const html = `
            <div class="modal-form modal-form--${escapeHtml(module.key || "generic")}">
                ${module.fields.map((field) => fieldMarkup(field, initialValues[field.key])).join("")}
            </div>
        `;

        const result = await Swal.fire({
            title: mode === "create" ? `Create ${module.label}` : `Edit ${module.label}`,
            html,
            width: module.key === "assets" ? "min(860px, calc(100vw - 32px))" : "min(980px, calc(100vw - 32px))",
            customClass: {
                popup: "swal2-form-popup"
            },
            focusConfirm: false,
            showCancelButton: true,
            showCloseButton: true,
            confirmButtonText: mode === "create" ? "Save" : "Update",
            preConfirm: () => {
                const values = {};
                for (const field of module.fields) {
                    const element = document.querySelector(`[data-field="${field.key}"]`);
                    if (!element) {
                        continue;
                    }
                    const rawValue = element.value.trim();
                    if (field.required && !rawValue) {
                        Swal.showValidationMessage(`Please enter ${field.label}`);
                        return false;
                    }
                    values[field.key] = rawValue;
                }
                return values;
            }
        });

        return result;
    }

    window.UI = {
        loading,
        confirm,
        alert,
        badge,
        emptyState,
        exportToExcel,
        exportToCsv,
        loadSpreadsheetLibrary,
        buildTimestampForFileName,
        openFormModal,
        escapeHtml
    };
})();
