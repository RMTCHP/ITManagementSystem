(function () {
    const form = document.getElementById("userRequestForm");
    const choice = document.getElementById("userRequestChoice");
    const formCard = document.getElementById("userRequestFormCard");
    const formTitle = document.getElementById("userRequestFormTitle");
    const requestedServiceInput = document.getElementById("requestedService");
    const requesterLabel = document.getElementById("requesterLabel");
    const categoryField = document.getElementById("categoryField");
    const categoryInput = document.getElementById("category");
    const subjectField = document.getElementById("subjectField");
    const subjectInput = document.getElementById("subject");
    const equipmentItemField = document.getElementById("equipmentItemField");
    const equipmentItemSearch = document.getElementById("equipmentItemSearch");
    const equipmentItemInput = document.getElementById("equipmentItemId");
    const equipmentItemOptions = document.getElementById("equipmentItemOptions");
    const equipmentItemHint = document.getElementById("equipmentItemHint");
    const equipmentQuantityField = document.getElementById("equipmentQuantityField");
    const equipmentQuantityInput = document.getElementById("equipmentQuantity");
    const equipmentSignatureSection = document.getElementById("equipmentSignatureSection");
    const equipmentSignatureCanvas = document.getElementById("equipmentSignatureCanvas");
    const photoSection = document.getElementById("ticketPhotoSection");
    const photoInput = document.getElementById("ticketPhoto");
    const photoPreview = document.getElementById("photoPreview");
    const photoPreviewImage = document.getElementById("photoPreviewImage");
    const removePhotoButton = document.getElementById("removePhotoButton");
    const backButton = document.getElementById("backToRequestTypeButton");
    let equipmentItems = [];
    let hasEquipmentSignature = false;
    let selectedPhoto = null;
    let previewUrl = "";

    function escapeHtml(value) {
        return String(value || "").replace(/[&<>'"]/g, (character) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            "\"": "&quot;"
        })[character]);
    }

    function getClientId() {
        const key = "it-management-user-request-client-id";
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

    function renderEquipmentOptions(query = "") {
        const searchText = String(query).trim().toLowerCase();
        const matches = equipmentItems.filter((item) => [item.ItemName, item.Category, item.Unit]
            .join(" ").toLowerCase().includes(searchText));
        equipmentItemOptions.innerHTML = matches.length
            ? matches.map((item) => `
                <button class="public-ticket-combobox__option" type="button" role="option" data-item-id="${escapeHtml(item.ItemID)}">
                    <span><strong>${escapeHtml(item.ItemName)}</strong><small>${escapeHtml(item.Category || "รายการอุปกรณ์")}</small></span>
                    <b>${escapeHtml(item.Quantity)} ${escapeHtml(item.Unit || "ชิ้น")}</b>
                </button>`).join("")
            : '<div class="public-ticket-combobox__empty">ไม่พบรายการอุปกรณ์ที่พร้อมเบิก</div>';
        equipmentItemOptions.classList.remove("hidden");
    }

    async function loadEquipmentItems() {
        UI.loading("กำลังโหลดรายการอุปกรณ์", "กำลังค้นหารายการที่พร้อมเบิก");
        try {
            const result = await ApiClient.request("listPublicInventoryItems");
            equipmentItems = ((result.data && result.data.records) || [])
                .sort((left, right) => String(left.ItemName || "").localeCompare(String(right.ItemName || "")));
            equipmentItemSearch.disabled = false;
            equipmentItemHint.textContent = equipmentItems.length
                ? `มีรายการอุปกรณ์พร้อมเบิก ${equipmentItems.length} รายการ ค้นหาด้วยชื่ออุปกรณ์ได้`
                : "ขณะนี้ไม่มีรายการอุปกรณ์พร้อมเบิก";
            renderEquipmentOptions();
        } finally {
            Swal.close();
        }
    }

    function setupEquipmentSignature() {
        const context = equipmentSignatureCanvas.getContext("2d");
        const resizeCanvas = () => {
            const rect = equipmentSignatureCanvas.getBoundingClientRect();
            equipmentSignatureCanvas.width = Math.max(1, Math.floor(rect.width * window.devicePixelRatio));
            equipmentSignatureCanvas.height = Math.max(1, Math.floor(rect.height * window.devicePixelRatio));
            context.scale(window.devicePixelRatio, window.devicePixelRatio);
            context.lineWidth = 2;
            context.lineCap = "round";
            context.strokeStyle = "#17324d";
        };
        resizeCanvas();

        let isDrawing = false;
        let lastPoint;
        const getPoint = (event) => {
            const rect = equipmentSignatureCanvas.getBoundingClientRect();
            return { x: event.clientX - rect.left, y: event.clientY - rect.top };
        };
        equipmentSignatureCanvas.addEventListener("pointerdown", (event) => {
            isDrawing = true;
            lastPoint = getPoint(event);
            equipmentSignatureCanvas.setPointerCapture(event.pointerId);
        });
        equipmentSignatureCanvas.addEventListener("pointermove", (event) => {
            if (!isDrawing) return;
            const point = getPoint(event);
            context.beginPath();
            context.moveTo(lastPoint.x, lastPoint.y);
            context.lineTo(point.x, point.y);
            context.stroke();
            lastPoint = point;
            hasEquipmentSignature = true;
        });
        ["pointerup", "pointercancel", "pointerleave"].forEach((name) => {
            equipmentSignatureCanvas.addEventListener(name, () => { isDrawing = false; });
        });
        document.getElementById("clearEquipmentSignature").addEventListener("click", () => {
            context.clearRect(0, 0, equipmentSignatureCanvas.width, equipmentSignatureCanvas.height);
            hasEquipmentSignature = false;
        });
    }

    async function selectService(service) {
        const isEquipment = service === "Equipment Requisition";
        requestedServiceInput.value = service;
        formTitle.textContent = isEquipment ? "รายละเอียดการเบิกอุปกรณ์" : "รายละเอียดแจ้งปัญหาหน้างาน";
        requesterLabel.innerHTML = "ชื่อผู้แจ้ง <em>*</em>";
        categoryField.classList.toggle("hidden", isEquipment);
        categoryInput.disabled = isEquipment;
        categoryInput.required = !isEquipment;
        categoryInput.value = isEquipment ? "Equipment" : "";
        subjectField.classList.toggle("hidden", isEquipment);
        subjectInput.disabled = isEquipment;
        subjectInput.required = !isEquipment;
        subjectInput.value = "";
        equipmentItemField.classList.toggle("hidden", !isEquipment);
        equipmentQuantityField.classList.toggle("hidden", !isEquipment);
        equipmentSignatureSection.classList.toggle("hidden", !isEquipment);
        equipmentItemInput.disabled = !isEquipment;
        equipmentQuantityInput.disabled = !isEquipment;
        equipmentQuantityInput.required = isEquipment;
        photoSection.classList.toggle("hidden", isEquipment);
        if (isEquipment) clearSelectedPhoto();

        choice.classList.add("hidden");
        formCard.classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: "smooth" });
        if (isEquipment) {
            try {
                await loadEquipmentItems();
                setupEquipmentSignature();
            } catch (error) {
                await UI.alert({ icon: "error", title: "โหลดรายการอุปกรณ์ไม่สำเร็จ", text: error.message || "กรุณาลองใหม่อีกครั้ง" });
            }
        }
    }

    function resetToChoice() {
        form.reset();
        requestedServiceInput.value = "";
        categoryInput.disabled = false;
        categoryInput.required = true;
        subjectInput.disabled = false;
        subjectInput.required = true;
        equipmentItemInput.value = "";
        equipmentItemInput.disabled = true;
        equipmentItemSearch.value = "";
        equipmentItemSearch.disabled = true;
        equipmentQuantityInput.value = "";
        equipmentQuantityInput.disabled = true;
        equipmentQuantityInput.required = false;
        categoryField.classList.remove("hidden");
        subjectField.classList.remove("hidden");
        equipmentItemField.classList.add("hidden");
        equipmentQuantityField.classList.add("hidden");
        equipmentSignatureSection.classList.add("hidden");
        photoSection.classList.remove("hidden");
        equipmentItemOptions.classList.add("hidden");
        equipmentItemHint.textContent = "Search and select an available item.";
        hasEquipmentSignature = false;
        clearSelectedPhoto();
        formCard.classList.add("hidden");
        choice.classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const value = String(reader.result || "");
                resolve(value.includes(",") ? value.split(",")[1] : value);
            };
            reader.onerror = () => reject(new Error("ไม่สามารถอ่านรูปภาพที่เลือกได้"));
            reader.readAsDataURL(file);
        });
    }

    document.querySelectorAll("[data-requested-service]").forEach((button) => {
        button.addEventListener("click", () => selectService(button.dataset.requestedService));
    });

    backButton.addEventListener("click", resetToChoice);
    removePhotoButton.addEventListener("click", clearSelectedPhoto);

    photoInput.addEventListener("change", async () => {
        const file = photoInput.files && photoInput.files[0];
        clearSelectedPhoto();
        if (!file) return;
        if (!/^(image\/jpeg|image\/png|image\/webp)$/i.test(file.type) || file.size > 5 * 1024 * 1024) {
            await UI.alert({ icon: "warning", title: "รูปภาพไม่ถูกต้อง", text: "กรุณาใช้รูป JPG, PNG หรือ WEBP ขนาดไม่เกิน 5 MB" });
            return;
        }
        selectedPhoto = file;
        previewUrl = URL.createObjectURL(file);
        photoPreviewImage.src = previewUrl;
        photoPreview.classList.remove("hidden");
    });

    equipmentItemSearch.addEventListener("focus", () => {
        if (!equipmentItemSearch.disabled) renderEquipmentOptions(equipmentItemSearch.value);
    });
    equipmentItemSearch.addEventListener("input", () => {
        equipmentItemInput.value = "";
        equipmentItemHint.textContent = "เลือกรายการจากผลการค้นหาด้านล่าง";
        renderEquipmentOptions(equipmentItemSearch.value);
    });
    equipmentItemOptions.addEventListener("click", (event) => {
        const option = event.target.closest("[data-item-id]");
        if (!option) return;
        const item = equipmentItems.find((record) => String(record.ItemID) === option.dataset.itemId);
        if (!item) return;
        equipmentItemInput.value = item.ItemID;
        equipmentItemSearch.value = item.ItemName;
        equipmentItemHint.textContent = `คงเหลือ ${item.Quantity} ${item.Unit || "ชิ้น"}`;
        equipmentItemOptions.classList.add("hidden");
    });
    document.addEventListener("click", (event) => {
        if (!event.target.closest(".public-ticket-combobox")) equipmentItemOptions.classList.add("hidden");
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;

        const isEquipment = requestedServiceInput.value === "Equipment Requisition";
        if (isEquipment && (!equipmentItemInput.value || Number(equipmentQuantityInput.value) < 1)) {
            await UI.alert({ icon: "warning", title: "กรุณาเลือกรายการอุปกรณ์", text: "เลือกรายการอุปกรณ์และระบุจำนวนที่ต้องการเบิก" });
            return;
        }
        if (isEquipment && !hasEquipmentSignature) {
            await UI.alert({ icon: "warning", title: "กรุณาลงลายเซ็น", text: "ลงลายเซ็นผู้เบิกก่อนส่งคำขอ" });
            return;
        }

        const confirmation = await UI.confirm({
            title: "ยืนยันการส่งคำขอ?",
            text: "ระบบจะส่งคำขอให้ฝ่าย IT ดำเนินการ",
            confirmButtonText: "ส่งคำขอ"
        });
        if (!confirmation.isConfirmed) return;

        const values = new FormData(form);
        const payload = {
            requester: values.get("requester"),
            department: values.get("department"),
            contact: values.get("contact"),
            location: values.get("location"),
            category: values.get("category"),
            subject: isEquipment ? `Equipment requisition: ${equipmentItemSearch.value}` : values.get("subject"),
            requestedService: values.get("requestedService"),
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
                payload.requestSignature = {
                    name: "equipment-request-signature.png",
                    type: "image/png",
                    size: Math.ceil(signatureData.length * 0.75),
                    base64: signatureData.split(",")[1]
                };
            }
            UI.loading("กำลังส่งคำขอ", "ระบบกำลังส่งข้อมูลให้ฝ่าย IT");
            const result = await ApiClient.request("createUserRequest", payload);
            Swal.close();
            await UI.alert({ icon: "success", title: "ส่งคำขอเรียบร้อย", text: `เลขที่รายการ ${result.data.TicketID} ฝ่าย IT จะดำเนินการต่อไป` });
            resetToChoice();
        } catch (error) {
            Swal.close();
            await UI.alert({ icon: "error", title: "ไม่สามารถส่งคำขอได้", text: error.message || "กรุณาลองใหม่อีกครั้ง" });
        }
    });
})();
