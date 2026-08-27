(function () {
    const form = document.getElementById("publicTicketForm");
    const formGrid = form.querySelector(".public-ticket-form__grid");
    const photoInput = document.getElementById("ticketPhoto");
    const photoPreview = document.getElementById("photoPreview");
    const photoPreviewImage = document.getElementById("photoPreviewImage");
    const removePhotoButton = document.getElementById("removePhotoButton");
    const photoSection = document.getElementById("ticketPhotoSection");
    const serviceChoice = document.getElementById("ticketServiceChoice");
    const formCard = document.getElementById("ticketFormCard");
    const requestedServiceInput = document.getElementById("requestedService");
    const remoteStartedAtInput = document.getElementById("remoteStartedAt");
    const remoteEndedAtInput = document.getElementById("remoteEndedAt");
    const remoteSessionInfo = document.getElementById("remoteSessionInfo");
    const categoryInput = document.getElementById("category");
    const categoryField = categoryInput.closest("label");
    const requesterLabel = document.getElementById("requesterLabel");
    const subjectInput = document.getElementById("subject");
    const subjectField = subjectInput.closest("label");
    const equipmentItemField = document.getElementById("equipmentItemField");
    const equipmentItemInput = document.getElementById("equipmentItemId");
    const equipmentItemSearch = document.getElementById("equipmentItemSearch");
    const equipmentItemOptions = document.getElementById("equipmentItemOptions");
    const equipmentItemHint = document.getElementById("equipmentItemHint");
    const equipmentQuantityField = document.getElementById("equipmentQuantityField");
    const equipmentQuantityInput = document.getElementById("equipmentQuantity");
    const equipmentSignatureSection = document.getElementById("equipmentSignatureSection");
    const equipmentSignatureCanvas = document.getElementById("equipmentSignatureCanvas");
    const backToServiceButton = document.getElementById("backToServiceButton");
    const formTitle = document.getElementById("ticketFormTitle");
    const showMyJobsButton = document.getElementById("showMyJobsButton");
    const myJobOpenCount = document.getElementById("myJobOpenCount");
    const ticketJobsCard = document.getElementById("ticketJobsCard");
    const ticketJobList = document.getElementById("ticketJobList");
    const refreshMyJobsButton = document.getElementById("refreshMyJobsButton");
    const backToTicketButton = document.getElementById("backToTicketButton");
    const ticketUserActions = document.getElementById("ticketUserActions");
    const ticketProfile = document.getElementById("ticketProfile");
    const ticketProfileInitial = document.getElementById("ticketProfileInitial");
    const ticketLogoutButton = document.getElementById("ticketLogoutButton");
    let selectedPhoto = null;
    let previewUrl = "";
    let currentTicketJobs = [];
    let hasEquipmentSignature = false;
    let equipmentItems = [];

    const serviceLabels = {
        "On-site": "On-site support details",
        "Remote Support": "Remote support details",
        "Equipment Requisition": "Equipment requisition details"
    };

    function getLocalTimeValue(date = new Date()) {
        return [date.getHours(), date.getMinutes()]
            .map((value) => String(value).padStart(2, "0"))
            .join(":");
    }

    function getActiveSession() {
        const session = ApiClient.getSavedSession();
        if (!session || !session.token || !session.user) {
            return null;
        }
        if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
            return null;
        }
        return session;
    }

    function renderTicketProfile() {
        const session = getActiveSession();
        if (!session) {
            ticketUserActions.classList.add("hidden");
            return;
        }
        const user = session.user;
        const displayName = String(user.FullName || user.Username || "IT User").trim();
        ticketProfileInitial.textContent = displayName.charAt(0).toUpperCase() || "IT";
        ticketProfile.title = `${displayName} | ${user.Role || "Admin"}`;
        ticketUserActions.classList.remove("hidden");
    }

    async function loadEquipmentItems() {
        const session = getActiveSession();
        if (!session) throw new Error("Please login to the Ticket Workspace again.");
        UI.loading("Loading inventory", "Retrieving available equipment");
        try {
            const result = await ApiClient.request("listRecords", { token: session.token, module: "stockItems" });
            equipmentItems = ((result.data && result.data.records) || [])
                .filter((item) => Number(item.Quantity || 0) > 0)
                .sort((left, right) => String(left.ItemName || "").localeCompare(String(right.ItemName || "")));
            equipmentItemSearch.disabled = false;
            equipmentItemSearch.value = "";
            equipmentItemInput.value = "";
            equipmentItemHint.textContent = equipmentItems.length
                ? `${equipmentItems.length} available item${equipmentItems.length === 1 ? "" : "s"}. Search by name.`
                : "No inventory items are currently available.";
            renderEquipmentOptions();
        } finally {
            Swal.close();
        }
    }

    function renderEquipmentOptions(query = "") {
        const searchText = String(query || "").trim().toLowerCase();
        const matches = equipmentItems.filter((item) => [item.ItemName, item.Category, item.Unit]
            .join(" ")
            .toLowerCase()
            .includes(searchText));

        if (!matches.length) {
            equipmentItemOptions.innerHTML = '<div class="public-ticket-combobox__empty">No available inventory item found.</div>';
        } else {
            equipmentItemOptions.innerHTML = matches.map((item) => `
                <button class="public-ticket-combobox__option" type="button" role="option" data-item-id="${escapeHtml(item.ItemID)}">
                    <span>
                        <strong>${escapeHtml(item.ItemName)}</strong>
                        <small>${escapeHtml(item.Category || "Inventory item")}</small>
                    </span>
                    <b>${escapeHtml(item.Quantity)} ${escapeHtml(item.Unit || "unit")}</b>
                </button>
            `).join("");
        }
        equipmentItemOptions.classList.remove("hidden");
    }

    function setupEquipmentSignature() {
        const rect = equipmentSignatureCanvas.getBoundingClientRect();
        const context = equipmentSignatureCanvas.getContext("2d");
        equipmentSignatureCanvas.width = Math.max(1, Math.floor(rect.width * window.devicePixelRatio));
        equipmentSignatureCanvas.height = Math.max(1, Math.floor(rect.height * window.devicePixelRatio));
        context.scale(window.devicePixelRatio, window.devicePixelRatio);
        context.lineWidth = 2;
        context.lineCap = "round";
        context.strokeStyle = "#17324d";
        let drawing = false;
        let previous;
        const point = (event) => ({ x: event.clientX - rect.left, y: event.clientY - rect.top });
        equipmentSignatureCanvas.onpointerdown = (event) => { drawing = true; previous = point(event); equipmentSignatureCanvas.setPointerCapture(event.pointerId); };
        equipmentSignatureCanvas.onpointermove = (event) => {
            if (!drawing) return;
            const next = point(event);
            context.beginPath(); context.moveTo(previous.x, previous.y); context.lineTo(next.x, next.y); context.stroke();
            previous = next; hasEquipmentSignature = true;
        };
        equipmentSignatureCanvas.onpointerup = equipmentSignatureCanvas.onpointercancel = equipmentSignatureCanvas.onpointerleave = () => { drawing = false; };
        document.getElementById("clearEquipmentSignature").onclick = () => { context.clearRect(0, 0, equipmentSignatureCanvas.width, equipmentSignatureCanvas.height); hasEquipmentSignature = false; };
    }

    async function selectService(service) {
        requestedServiceInput.value = service;
        formTitle.textContent = serviceLabels[service] || "Issue details";
        const isEquipment = service === "Equipment Requisition";
        requesterLabel.innerHTML = isEquipment ? 'ชื่อผู้เบิก <em>*</em>' : 'ชื่อผู้แจ้ง <em>*</em>';
        categoryField.classList.toggle("hidden", isEquipment);
        categoryInput.required = !isEquipment;
        if (isEquipment) categoryInput.value = "Equipment";
        equipmentItemField.classList.toggle("hidden", !isEquipment);
        equipmentQuantityField.classList.toggle("hidden", !isEquipment);
        equipmentSignatureSection.classList.toggle("hidden", !isEquipment);
        equipmentItemInput.disabled = !isEquipment;
        equipmentItemSearch.disabled = !isEquipment;
        equipmentQuantityInput.disabled = !isEquipment;
        equipmentQuantityInput.required = isEquipment;
        if (isEquipment) {
            formGrid.append(equipmentItemField, equipmentQuantityField);
        }
        subjectField.classList.toggle("hidden", isEquipment);
        subjectInput.required = !isEquipment;
        subjectInput.disabled = isEquipment;
        if (isEquipment) subjectInput.value = "";
        photoSection.classList.toggle("hidden", service === "Remote Support" || isEquipment);
        remoteSessionInfo.classList.toggle("hidden", service !== "Remote Support");
        if (isEquipment) {
            clearSelectedPhoto();
        }
        if (service === "Remote Support") {
            clearSelectedPhoto();
            const startedAt = getLocalTimeValue();
            remoteStartedAtInput.value = startedAt;
            remoteEndedAtInput.value = startedAt;
        } else {
            remoteStartedAtInput.value = "";
            remoteEndedAtInput.value = "";
        }
        serviceChoice.classList.add("hidden");
        formCard.classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: "smooth" });
        if (isEquipment) {
            try {
                await loadEquipmentItems();
                setupEquipmentSignature();
            } catch (error) {
                await UI.alert({ icon: "error", title: "Unable to load inventory", text: error.message || "Please try again." });
            }
        }
    }

    function getClientId() {
        const key = "it-management-public-ticket-client-id";
        let clientId = localStorage.getItem(key);
        if (!clientId) {
            clientId = window.crypto && window.crypto.randomUUID
                ? window.crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            localStorage.setItem(key, clientId);
        }
        return clientId;
    }

    function clearSelectedPhoto() {
        selectedPhoto = null;
        photoInput.value = "";
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = "";
        }
        photoPreviewImage.removeAttribute("src");
        photoPreview.classList.add("hidden");
    }

    function escapeHtml(value) {
        return String(value || "").replace(/[&<>'"]/g, (character) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            "\"": "&quot;"
        })[character]);
    }

    function formatDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value || "-";
        }
        return new Intl.DateTimeFormat("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }).format(date);
    }

    function getTicketStatusClass(status) {
        const normalized = String(status || "Open").toLowerCase();
        if (normalized === "resolved" || normalized === "closed") {
            return "is-resolved";
        }
        if (normalized === "rejected") {
            return "is-rejected";
        }
        return "is-open";
    }

    function renderTicketJobs(records) {
        currentTicketJobs = records.filter((ticket) => !["resolved", "closed", "rejected"].includes(String(ticket.Status || "Open").toLowerCase()));
        if (!currentTicketJobs.length) {
            ticketJobList.innerHTML = '<div class="public-ticket-job-empty"><i class="fa-regular fa-folder-open"></i><strong>No ticket found</strong><span>Create a ticket to start work.</span></div>';
            return;
        }

        ticketJobList.innerHTML = currentTicketJobs.map((ticket) => {
            const isCompleted = ["resolved", "closed", "rejected"].includes(String(ticket.Status || "").toLowerCase());
            const canResolve = !isCompleted && String(ticket.RequestedService || "").toLowerCase() !== "remote support";
            const isEquipment = String(ticket.RequestedService || "").toLowerCase() === "equipment requisition";
            return `
            <article class="public-ticket-job">
                <div class="public-ticket-job__main">
                    <div class="public-ticket-job__meta"><strong>${escapeHtml(ticket.TicketID)}</strong><span>${escapeHtml(formatDate(ticket.RequestDate))}</span></div>
                    <h3>${escapeHtml(ticket.Subject || "Untitled ticket")}</h3>
                    <div class="public-ticket-job__details">
                        <span><i class="fa-solid fa-user"></i>${escapeHtml(ticket.Requester || "-")}</span>
                        <span><i class="fa-solid fa-briefcase"></i>${escapeHtml(ticket.Department || "-")}</span>
                        <span><i class="fa-solid fa-location-dot"></i>${escapeHtml(ticket.Location || "-")}</span>
                    </div>
                </div>
                <div class="public-ticket-job__side">
                    <span class="public-ticket-job__service">${escapeHtml(ticket.RequestedService || "IT Request")}</span>
                    <span class="public-ticket-job__status ${getTicketStatusClass(ticket.Status)}">${escapeHtml(ticket.Status || "Open")}</span>
                    ${canResolve ? `<button type="button" class="public-ticket-job__resolve" data-action="resolve-ticket" data-ticket-id="${escapeHtml(ticket.TicketID)}"><i class="fa-solid ${isEquipment ? "fa-box-open" : "fa-circle-check"}"></i><span>${isEquipment ? "Approve" : "Resolve"}</span></button>` : ""}
                </div>
            </article>
        `;
        }).join("");
    }

    async function loadMyJobs() {
        try {
            UI.loading("Loading My Job", "Retrieving the latest ticket list");
            const result = await ApiClient.request("listPublicTicketJobs");
            Swal.close();
            renderTicketJobs((result.data && result.data.records) || []);
        } catch (error) {
            Swal.close();
            ticketJobList.innerHTML = "";
            await UI.alert({ icon: "error", title: "Unable to load tickets", text: error.message || "Please try again." });
        }
    }

    async function loadMyJobCount() {
        try {
            const result = await ApiClient.request("getPublicTicketJobSummary");
            const openCount = Math.max(0, Number(result.data && result.data.openCount) || 0);
            myJobOpenCount.textContent = openCount > 99 ? "99+" : String(openCount);
            myJobOpenCount.classList.toggle("hidden", openCount === 0);
            showMyJobsButton.title = openCount ? `Open My Job (${openCount} active)` : "Open My Job";
        } catch (error) {
            myJobOpenCount.classList.add("hidden");
        }
    }

    async function showMyJobs() {
        serviceChoice.classList.add("hidden");
        formCard.classList.add("hidden");
        ticketJobsCard.classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: "smooth" });
        await loadMyJobs();
    }

    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const value = String(reader.result || "");
                resolve(value.includes(",") ? value.split(",")[1] : value);
            };
            reader.onerror = () => reject(new Error("Unable to read the selected photo"));
            reader.readAsDataURL(file);
        });
    }

    async function openTicketResolveModal(ticket) {
        const session = getActiveSession();
        if (!session) {
            await UI.alert({ icon: "warning", title: "Session expired", text: "Please login to the Ticket Workspace again." });
            window.location.replace("ticket-login.html");
            return;
        }

        if (String(ticket.RequestedService || "").toLowerCase() === "equipment requisition") {
            const approval = await UI.confirm({
                title: "Approve equipment issue?",
                text: `This will issue ${ticket.RequestedQuantity || 0} unit(s) of ${ticket.InventoryItemID || "the selected inventory item"} and reduce its stock.`,
                confirmButtonText: "Approve and issue"
            });
            if (!approval.isConfirmed) return;
            try {
                UI.loading("Approving equipment", "Recording the outbound stock movement");
                await ApiClient.request("resolveTicket", {
                    token: session.token,
                    ticketId: ticket.TicketID,
                    resolutionNote: "Equipment request approved and issued."
                });
                Swal.close();
                await UI.alert({ icon: "success", title: "Equipment issued", text: "Inventory has been updated and the ticket is resolved." });
                await Promise.all([loadMyJobs(), loadMyJobCount()]);
            } catch (error) {
                Swal.close();
                await UI.alert({ icon: "error", title: "Unable to approve equipment", text: error.message || "Please try again." });
            }
            return;
        }

        let signatureCanvas;
        let signatureContext;
        let hasSignature = false;

        const result = await Swal.fire({
            title: "Resolve Ticket",
            html: `
                <form class="ticket-resolve-form">
                    <p class="ticket-resolve-form__summary">${escapeHtml(ticket.TicketID)} - ${escapeHtml(ticket.Subject || "Untitled ticket")}</p>
                    <label>Resolution details <small>Optional</small><textarea id="ticketResolutionNote" maxlength="2000" placeholder="Work performed, parts used, or notes for follow-up"></textarea></label>
                    <label>Completion photo <small>Optional. JPG, PNG or WEBP up to 5 MB</small><input id="ticketResolutionPhoto" type="file" accept="image/jpeg,image/png,image/webp"></label>
                    <div class="ticket-signature-field">
                        <div><span>Requester signature</span><em>Required</em><button type="button" id="clearTicketSignature">Clear</button></div>
                        <canvas id="ticketSignatureCanvas" aria-label="Requester signature"></canvas>
                    </div>
                </form>`,
            width: "min(680px, calc(100vw - 28px))",
            showCancelButton: true,
            showCloseButton: true,
            confirmButtonText: "Resolve Ticket",
            cancelButtonText: "Cancel",
            focusConfirm: false,
            didOpen: () => {
                signatureCanvas = document.getElementById("ticketSignatureCanvas");
                signatureContext = signatureCanvas.getContext("2d");
                const resizeCanvas = () => {
                    const rect = signatureCanvas.getBoundingClientRect();
                    signatureCanvas.width = Math.max(1, Math.floor(rect.width * window.devicePixelRatio));
                    signatureCanvas.height = Math.max(1, Math.floor(rect.height * window.devicePixelRatio));
                    signatureContext.scale(window.devicePixelRatio, window.devicePixelRatio);
                    signatureContext.lineWidth = 2;
                    signatureContext.lineCap = "round";
                    signatureContext.strokeStyle = "#17324d";
                };
                resizeCanvas();

                let isDrawing = false;
                let lastPoint;
                const getPoint = (event) => {
                    const rect = signatureCanvas.getBoundingClientRect();
                    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
                };
                signatureCanvas.addEventListener("pointerdown", (event) => {
                    isDrawing = true;
                    lastPoint = getPoint(event);
                    signatureCanvas.setPointerCapture(event.pointerId);
                });
                signatureCanvas.addEventListener("pointermove", (event) => {
                    if (!isDrawing) return;
                    const point = getPoint(event);
                    signatureContext.beginPath();
                    signatureContext.moveTo(lastPoint.x, lastPoint.y);
                    signatureContext.lineTo(point.x, point.y);
                    signatureContext.stroke();
                    lastPoint = point;
                    hasSignature = true;
                });
                ["pointerup", "pointercancel", "pointerleave"].forEach((name) => {
                    signatureCanvas.addEventListener(name, () => { isDrawing = false; });
                });
                document.getElementById("clearTicketSignature").addEventListener("click", () => {
                    signatureContext.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
                    hasSignature = false;
                });
            },
            preConfirm: async () => {
                const photo = document.getElementById("ticketResolutionPhoto").files[0];
                if (!hasSignature) {
                    Swal.showValidationMessage("Requester signature is required before resolving this ticket.");
                    return false;
                }
                if (photo && (!/^(image\/jpeg|image\/png|image\/webp)$/i.test(photo.type) || photo.size > 5 * 1024 * 1024)) {
                    Swal.showValidationMessage("Use a JPG, PNG or WEBP photo no larger than 5 MB.");
                    return false;
                }
                return {
                    resolutionNote: document.getElementById("ticketResolutionNote").value.trim(),
                    signature: {
                        name: `${ticket.TicketID}-signature.png`,
                        type: "image/png",
                        size: Math.ceil(signatureCanvas.toDataURL("image/png").length * 0.75),
                        base64: signatureCanvas.toDataURL("image/png").split(",")[1]
                    },
                    photo: photo ? {
                        name: photo.name,
                        type: photo.type,
                        size: photo.size,
                        base64: await readFileAsBase64(photo)
                    } : null
                };
            }
        });

        if (!result.isConfirmed) return;

        try {
            UI.loading("Resolving ticket", "Saving the completion record");
            await ApiClient.request("resolveTicket", {
                token: session.token,
                ticketId: ticket.TicketID,
                ...result.value
            });
            Swal.close();
            await UI.alert({ icon: "success", title: "Ticket resolved", text: `${ticket.TicketID} has been closed successfully.` });
            await Promise.all([loadMyJobs(), loadMyJobCount()]);
        } catch (error) {
            Swal.close();
            await UI.alert({ icon: "error", title: "Unable to resolve ticket", text: error.message || "Please try again." });
        }
    }

    photoInput.addEventListener("change", async () => {
        const file = photoInput.files && photoInput.files[0];
        clearSelectedPhoto();
        if (!file) {
            return;
        }
        if (!/^(image\/jpeg|image\/png|image\/webp)$/i.test(file.type) || file.size > 5 * 1024 * 1024) {
            await UI.alert({ icon: "warning", title: "Invalid photo", text: "Use a JPG, PNG or WEBP photo no larger than 5 MB." });
            return;
        }
        selectedPhoto = file;
        previewUrl = URL.createObjectURL(file);
        photoPreviewImage.src = previewUrl;
        photoPreview.classList.remove("hidden");
    });

    removePhotoButton.addEventListener("click", clearSelectedPhoto);

    document.querySelectorAll("[data-requested-service]").forEach((button) => {
        button.addEventListener("click", () => selectService(button.dataset.requestedService));
    });

    equipmentItemSearch.addEventListener("focus", () => {
        if (!equipmentItemSearch.disabled) {
            renderEquipmentOptions(equipmentItemSearch.value);
        }
    });

    equipmentItemSearch.addEventListener("input", () => {
        equipmentItemInput.value = "";
        equipmentItemHint.textContent = "Select an item from the results below.";
        renderEquipmentOptions(equipmentItemSearch.value);
    });

    equipmentItemOptions.addEventListener("click", (event) => {
        const option = event.target.closest("[data-item-id]");
        if (!option) return;
        const item = equipmentItems.find((record) => String(record.ItemID) === option.dataset.itemId);
        if (!item) return;
        equipmentItemInput.value = item.ItemID;
        equipmentItemSearch.value = item.ItemName;
        equipmentItemHint.textContent = `Available: ${item.Quantity} ${item.Unit || "unit"}`;
        equipmentItemOptions.classList.add("hidden");
    });

    document.addEventListener("click", (event) => {
        if (!event.target.closest(".public-ticket-combobox")) {
            equipmentItemOptions.classList.add("hidden");
        }
    });

    backToServiceButton.addEventListener("click", () => {
        requestedServiceInput.value = "";
        categoryField.classList.remove("hidden");
        requesterLabel.innerHTML = 'ชื่อผู้แจ้ง <em>*</em>';
        categoryInput.required = true;
        categoryInput.value = "";
        equipmentItemField.classList.add("hidden");
        equipmentQuantityField.classList.add("hidden");
        equipmentSignatureSection.classList.add("hidden");
        equipmentItemInput.disabled = true;
        equipmentItemSearch.disabled = true;
        equipmentQuantityInput.disabled = true;
        equipmentQuantityInput.required = false;
        equipmentItemInput.value = "";
        equipmentItemSearch.value = "";
        equipmentItemOptions.classList.add("hidden");
        equipmentItemHint.textContent = "Search and select an available item.";
        equipmentQuantityInput.value = "";
        subjectField.classList.remove("hidden");
        subjectInput.required = true;
        subjectInput.disabled = false;
        hasEquipmentSignature = false;
        photoSection.classList.remove("hidden");
        remoteSessionInfo.classList.add("hidden");
        remoteStartedAtInput.value = "";
        remoteEndedAtInput.value = "";
        formCard.classList.add("hidden");
        serviceChoice.classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    showMyJobsButton.addEventListener("click", showMyJobs);
    refreshMyJobsButton.addEventListener("click", loadMyJobs);
    ticketJobList.addEventListener("click", (event) => {
        const resolveButton = event.target.closest('[data-action="resolve-ticket"]');
        if (!resolveButton) return;
        const ticket = currentTicketJobs.find((record) => record.TicketID === resolveButton.dataset.ticketId);
        if (ticket) openTicketResolveModal(ticket);
    });
    backToTicketButton.addEventListener("click", () => {
        ticketJobsCard.classList.add("hidden");
        serviceChoice.classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    ticketLogoutButton.addEventListener("click", async () => {
        const confirmation = await UI.confirm({
            title: "Logout from Ticket Workspace?",
            text: "You will need to login again before using Ticket on this mobile device.",
            confirmButtonText: "Logout"
        });
        if (!confirmation.isConfirmed) {
            return;
        }

        const session = getActiveSession();
        try {
            UI.loading("Logging out", "Closing your IT session");
            if (session) {
                await ApiClient.request("logout", { token: session.token });
            }
            ApiClient.clearSession();
            sessionStorage.removeItem("itms_ticket_mobile_access");
            Swal.close();
            await Swal.fire({ icon: "success", title: "Logged out", text: "Your IT session has been closed.", showConfirmButton: false, timer: 800, timerProgressBar: true });
            window.location.replace("ticket-login.html");
        } catch (error) {
            Swal.close();
            await UI.alert({ icon: "error", title: "Logout failed", text: error.message || "Please try again." });
        }
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!form.reportValidity()) {
            return;
        }

        const isEquipment = requestedServiceInput.value === "Equipment Requisition";
        const isRemoteSupport = requestedServiceInput.value === "Remote Support";
        if (isEquipment && (!equipmentItemInput.value || Number(equipmentQuantityInput.value) < 1)) {
            await UI.alert({ icon: "warning", title: "Inventory item required", text: "Select an inventory item and enter the requested quantity." });
            return;
        }
        if (isEquipment && !hasEquipmentSignature) {
            await UI.alert({ icon: "warning", title: "Signature required", text: "Requester signature is required for an equipment requisition." });
            return;
        }
        if (isRemoteSupport && (!remoteStartedAtInput.value || !remoteEndedAtInput.value)) {
            await UI.alert({ icon: "warning", title: "Time required", text: "Select both start time and end time for Remote Support." });
            return;
        }
        if (isRemoteSupport && remoteEndedAtInput.value < remoteStartedAtInput.value) {
            await UI.alert({ icon: "warning", title: "Invalid end time", text: "End time must be the same as or after start time." });
            return;
        }

        const confirmation = await UI.confirm({
            title: "Submit this ticket?",
            text: "IT will receive your issue and contact you using the details provided.",
            confirmButtonText: "Submit"
        });
        if (!confirmation.isConfirmed) {
            return;
        }

        const values = new FormData(form);
        const payload = {
            requester: values.get("requester"),
            department: values.get("department"),
            contact: values.get("contact"),
            location: values.get("location"),
            category: values.get("category"),
            subject: isEquipment
                ? `Equipment requisition: ${equipmentItemSearch.value}`
                : values.get("subject"),
            requestedService: values.get("requestedService"),
            remoteStartedAt: values.get("remoteStartedAt"),
            remoteEndedAt: values.get("remoteEndedAt"),
            inventoryItemId: values.get("equipmentItemId"),
            requestedQuantity: values.get("equipmentQuantity"),
            website: values.get("website"),
            clientId: getClientId()
        };

        try {
            if (selectedPhoto) {
                payload.file = {
                    name: selectedPhoto.name,
                    type: selectedPhoto.type,
                    size: selectedPhoto.size,
                    base64: await readFileAsBase64(selectedPhoto)
                };
            }
            if (isEquipment) {
                const signatureData = equipmentSignatureCanvas.toDataURL("image/png");
                payload.requestSignature = { name: "equipment-request-signature.png", type: "image/png", size: Math.ceil(signatureData.length * 0.75), base64: signatureData.split(",")[1] };
            }
            UI.loading("Submitting ticket", "Sending your issue to IT");
            const result = await ApiClient.request("createPublicTicket", payload);
            Swal.close();
            await UI.alert({
                icon: "success",
                title: "Ticket submitted",
                text: `Your Ticket ID is ${result.data.TicketID}. Please keep this ID for follow-up.`
            });
            form.reset();
            clearSelectedPhoto();
            formCard.classList.add("hidden");
            ticketJobsCard.classList.add("hidden");
            serviceChoice.classList.remove("hidden");
            loadMyJobCount();
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (error) {
            Swal.close();
            await UI.alert({ icon: "error", title: "Unable to submit ticket", text: error.message || "Please try again." });
        }
    });

    (window.ITMS_TICKET_AUTH_READY || Promise.resolve()).then(() => {
        renderTicketProfile();
        return loadMyJobCount();
    });
})();
