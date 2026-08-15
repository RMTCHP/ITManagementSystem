(function () {
    const form = document.getElementById("publicTicketForm");
    const photoInput = document.getElementById("ticketPhoto");
    const photoPreview = document.getElementById("photoPreview");
    const photoPreviewImage = document.getElementById("photoPreviewImage");
    const removePhotoButton = document.getElementById("removePhotoButton");
    const photoSection = document.getElementById("ticketPhotoSection");
    const serviceChoice = document.getElementById("ticketServiceChoice");
    const formCard = document.getElementById("ticketFormCard");
    const requestedServiceInput = document.getElementById("requestedService");
    const remoteStartedAtInput = document.getElementById("remoteStartedAt");
    const remoteSessionInfo = document.getElementById("remoteSessionInfo");
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

    function selectService(service) {
        requestedServiceInput.value = service;
        formTitle.textContent = serviceLabels[service] || "Issue details";
        photoSection.classList.toggle("hidden", service === "Remote Support");
        remoteSessionInfo.classList.toggle("hidden", service !== "Remote Support");
        if (service === "Remote Support") {
            clearSelectedPhoto();
            const startedAt = getLocalTimeValue();
            remoteStartedAtInput.value = startedAt;
        } else {
            remoteStartedAtInput.value = "";
        }
        serviceChoice.classList.add("hidden");
        formCard.classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: "smooth" });
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
        if (!records.length) {
            ticketJobList.innerHTML = '<div class="public-ticket-job-empty"><i class="fa-regular fa-folder-open"></i><strong>No ticket found</strong><span>Create a ticket to start work.</span></div>';
            return;
        }

        ticketJobList.innerHTML = records.map((ticket) => `
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
                </div>
            </article>
        `).join("");
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

    backToServiceButton.addEventListener("click", () => {
        requestedServiceInput.value = "";
        photoSection.classList.remove("hidden");
        remoteSessionInfo.classList.add("hidden");
        remoteStartedAtInput.value = "";
        formCard.classList.add("hidden");
        serviceChoice.classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: "smooth" });
    });

    showMyJobsButton.addEventListener("click", showMyJobs);
    refreshMyJobsButton.addEventListener("click", loadMyJobs);
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
            subject: values.get("subject"),
            requestedService: values.get("requestedService"),
            remoteStartedAt: values.get("remoteStartedAt"),
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
