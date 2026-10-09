(() => {
    const state = {
        cards: [], historyCards: null, quickLinks: null, members: [], totalActive: 0, query: "", filter: "all", session: null, busy: new Set(),
        view: "board", calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    };
    const types = ["Update", "Task"];
    const statuses = ["To Do", "In Progress", "Done"];
    const priorities = ["Normal", "High", "Urgent"];
    const priorityLabel = { Normal: "ปกติ", High: "สำคัญ", Urgent: "ด่วนมาก" };
    const taskPriority = (card) => priorities.includes(String(card?.Priority || "")) ? card.Priority : "Normal";
    const escape = (value) => UI.escapeHtml(String(value ?? ""));
    const currentUserId = () => String(state.session?.user?.UserID || "");
    const isAdmin = () => String(state.session?.user?.Role || "").toLowerCase() === "admin";
    const canManage = (card) => isAdmin() || String(card.CreatedByID || "") === currentUserId();
    const canChangeStatus = (card) => card.Type === "Task" && (canManage(card) || String(card.AssigneeUserID || "") === currentUserId());
    const canReply = (card) => card.Type === "Task" && card.Status !== "Archived" && Boolean(card.AssigneeUserID) && (canManage(card) || String(card.AssigneeUserID) === currentUserId());
    const isUpdate = (card) => ["Update", "Announcement", "Note"].includes(String(card?.Type || ""));
    const findKnownCard = (id) => state.cards.find((card) => String(card.BoardID) === String(id))
        || (state.historyCards || []).find((card) => String(card.BoardID) === String(id));

    function refreshAssignedTaskBadge() {
        const assignedTeamTasks = state.cards.filter((card) => card.Type === "Task"
            && String(card.AssigneeUserID || "") === currentUserId()
            && !["Done", "Archived"].includes(String(card.Status || ""))).length;
        AppShell.updateSidebarAlerts({ assignedTeamTasks });
    }

    function applySavedCard(card) {
        if (!card || !card.BoardID) return;
        const existingIndex = state.cards.findIndex((item) => String(item.BoardID) === String(card.BoardID));
        if (String(card.Status || "") === "Archived") {
            if (existingIndex !== -1) {
                state.cards.splice(existingIndex, 1);
                state.totalActive = Math.max(0, state.totalActive - 1);
            }
        } else if (existingIndex === -1) {
            state.cards.unshift(card);
            state.totalActive += 1;
        } else {
            state.cards.splice(existingIndex, 1, card);
        }
        if (Array.isArray(state.historyCards)) {
            const historyIndex = state.historyCards.findIndex((item) => String(item.BoardID) === String(card.BoardID));
            if (historyIndex === -1) state.historyCards.unshift(card);
            else state.historyCards.splice(historyIndex, 1, card);
        }
        refreshAssignedTaskBadge();
        render();
    }

    function dateLabel(value) {
        const date = String(value || "").slice(0, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}` : "";
    }

    function dateTimeLabel(value) {
        const raw = String(value || "").trim();
        if (!raw) return "";
        const parsed = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
        if (Number.isNaN(parsed.getTime())) return dateLabel(raw) || raw;
        return new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit", hour12: false
        }).format(parsed).replace(",", " ·");
    }

    function dueDateKey(value) {
        const date = String(value || "").slice(0, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
    }

    function calendarDateKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    function calendarMonthLabel(date) {
        return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
    }

    function renderCalendar() {
        const month = state.calendarMonth;
        const year = month.getFullYear();
        const monthIndex = month.getMonth();
        const firstDay = new Date(year, monthIndex, 1);
        const gridStart = new Date(year, monthIndex, 1 - ((firstDay.getDay() + 6) % 7));
        const tasksByDate = (state.historyCards || state.cards).filter((card) => card.Type === "Task" && dueDateKey(card.DueDate))
            .reduce((items, card) => {
                const key = dueDateKey(card.DueDate);
                (items[key] ||= []).push(card);
                return items;
            }, {});
        const days = Array.from({ length: 42 }, (_, index) => {
            const date = new Date(gridStart);
            date.setDate(gridStart.getDate() + index);
            const key = calendarDateKey(date);
            const tasks = tasksByDate[key] || [];
            return `<div class="team-board__calendar-day${date.getMonth() !== monthIndex ? " is-outside" : ""}${key === calendarDateKey(new Date()) ? " is-today" : ""}">
                <span class="team-board__calendar-date">${date.getDate()}</span>
                <div class="team-board__calendar-tasks">${tasks.slice(0, 3).map((card) => `<button type="button" class="team-board__calendar-task ${card.Status === "Archived" ? "team-board__calendar-task--archived" : `team-board__calendar-task--${taskPriority(card).toLowerCase()}`}" data-calendar-card="${escape(card.BoardID)}" title="${escape(card.Title)}${card.Status === "Archived" ? " (Archived)" : ""}">${escape(card.Title)}</button>`).join("")}${tasks.length > 3 ? `<span class="team-board__calendar-more">+${tasks.length - 3} more</span>` : ""}</div>
            </div>`;
        }).join("");
        return `<section class="team-board__calendar" aria-label="Team task due-date calendar">
            <div class="team-board__calendar-head"><button type="button" class="icon-btn" data-calendar-month="previous" aria-label="Previous month"><i class="fa-solid fa-chevron-left"></i></button><h3>${calendarMonthLabel(month)}</h3><button type="button" class="icon-btn" data-calendar-month="next" aria-label="Next month"><i class="fa-solid fa-chevron-right"></i></button></div>
            <p class="team-board__calendar-caption"><i class="fa-regular fa-calendar"></i> Due dates for all internal team tasks · Green = archived</p>
            <div class="team-board__calendar-weekdays"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
            <div class="team-board__calendar-grid">${days}</div>
        </section>`;
    }

    function cardMarkup(card) {
        const id = escape(card.BoardID);
        const type = card.Type === "Task" ? "Task" : "Update";
        const priority = type === "Task" ? taskPriority(card) : "";
        return `<article class="team-card team-card--compact team-card--${type.toLowerCase()}${priority ? ` team-card--${priority.toLowerCase()}` : ""}" data-board-open="${id}" role="button" tabindex="0" aria-label="Open ${type === "Task" ? "team task" : "team update"}: ${escape(card.Title)}">
            <h3>${escape(card.Title)}</h3>
            ${type === "Task" ? `<div class="team-card__summary"><p><span>Assigned to</span>${escape(card.AssigneeName || "Unassigned")}</p><p><span>Posted by</span>${escape(card.CreatedByName || "-")}</p><p><span>Post date</span>${escape(dateLabel(card.CreatedAt) || "-")}</p><p><span>Due date</span>${escape(dateLabel(card.DueDate) || "Not set")}</p></div>` : ""}
        </article>`;
    }

    function renderQuickLinks() {
        const query = state.query.toLowerCase();
        const links = (state.quickLinks || []).filter((link) => !query || [link.Title, link.Category, link.Remark, link.CredentialReference]
            .some((value) => String(value || "").toLowerCase().includes(query)));
        return `<section class="team-quick-links"><div class="team-quick-links__intro"><div><h3>IT Quick Links</h3><p>Approved shortcuts to systems, portals and operational tools used by the IT team.</p></div><span><i class="fa-solid fa-shield-halved"></i> Open links in a new tab</span></div>${links.length ? `<div class="team-quick-links__grid">${links.map((link) => `<article class="team-quick-link"><div class="team-quick-link__top"><span class="team-quick-link__icon"><i class="fa-solid fa-arrow-up-right-from-square"></i></span>${link.Category ? `<span class="team-quick-link__category">${escape(link.Category)}</span>` : ""}</div><h3>${escape(link.Title)}</h3><p>${escape(link.Remark || "No description added.")}</p>${link.CredentialReference ? `<div class="team-quick-link__access"><i class="fa-solid fa-key"></i><span>${escape(link.CredentialReference)}</span></div>` : ""}<div class="team-quick-link__actions"><button type="button" class="team-quick-link__open" data-quick-link-open="${escape(link.LinkID)}"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open</button>${isAdmin() ? `<button type="button" class="icon-btn" data-quick-link-edit="${escape(link.LinkID)}" aria-label="Edit link"><i class="fa-solid fa-pen"></i></button><button type="button" class="icon-btn team-quick-link__delete" data-quick-link-delete="${escape(link.LinkID)}" aria-label="Delete link"><i class="fa-solid fa-trash"></i></button>` : ""}</div></article>`).join("")}</div>` : `<p class="team-board__empty">No Quick Links yet${isAdmin() ? ". Select Add link to create the first one." : "."}</p>`}</section>`;
    }

    function render() {
        const query = state.query.toLowerCase();
        const cards = state.cards.filter((card) => !query || [card.Title, card.Body, card.AssigneeName, card.CreatedByName].some((value) => String(value || "").toLowerCase().includes(query)));
        const groups = [
            { type: "Update", label: "Team updates", icon: "fa-bullhorn" },
            { type: "Task", label: "Team tasks", icon: "fa-list-check" }
        ];
        document.getElementById("viewContainer").innerHTML = `<section class="team-board">
            <div class="team-board__toolbar"><div><p class="section-card__eyebrow">Shared workspace</p><h2>${state.view === "links" ? "IT Quick Links" : "Team activity"}</h2><p>${state.view === "links" ? "Approved shortcuts to systems and operational tools used by the IT team." : "Share an update, hand over information or assign a task to a teammate."}</p></div>${state.view === "links" ? (isAdmin() ? `<button class="primary-btn" type="button" id="addQuickLink"><i class="fa-solid fa-plus"></i> Add link</button>` : "") : `<button class="primary-btn" type="button" id="addBoardItem"><i class="fa-solid fa-plus"></i> Add item</button>`}</div>
            <div class="team-board__viewbar"><div class="team-board__view-toggle" role="group" aria-label="Board view"><button type="button" data-board-view-mode="board" class="${state.view === "board" ? "is-active" : ""}"><i class="fa-solid fa-grip"></i> Board</button><button type="button" data-board-view-mode="calendar" class="${state.view === "calendar" ? "is-active" : ""}"><i class="fa-regular fa-calendar-days"></i> Due-date calendar</button><button type="button" data-board-view-mode="links" class="${state.view === "links" ? "is-active" : ""}"><i class="fa-solid fa-link"></i> Quick Links</button></div>${state.view !== "links" ? `<button class="team-board__history-btn" type="button" data-team-board-history><i class="fa-solid fa-clock-rotate-left"></i> History</button>` : ""}</div>
            ${state.totalActive > 250 ? `<p class="team-board__notice">Showing the latest 250 active items. Archive completed items to keep the board focused.</p>` : ""}
            ${state.view === "calendar" ? renderCalendar() : state.view === "links" ? renderQuickLinks() : `<div class="team-board__columns">${groups.map((group) => {
                const groupCards = cards.filter((card) => group.type === "Update" ? isUpdate(card) : card.Type === group.type);
                return `<section class="team-board__column team-board__column--${group.type.toLowerCase()}"><header><span><i class="fa-solid ${group.icon}"></i>${group.label}</span><strong>${groupCards.length}</strong></header><div class="team-board__stack">${groupCards.map(cardMarkup).join("") || `<p class="team-board__empty">No items here yet.</p>`}</div></section>`;
            }).join("")}</div>`}
        </section>`;
    }

    async function loadBoard() {
        const response = await ApiClient.request("listTeamBoard", { token: ApiClient.getSessionToken() });
        state.cards = Array.isArray(response.data?.cards) ? response.data.cards : [];
        state.members = Array.isArray(response.data?.members) ? response.data.members : [];
        state.totalActive = Number(response.data?.totalActive || state.cards.length);
        refreshAssignedTaskBadge();
        render();
    }

    async function loadQuickLinks() {
        const response = await ApiClient.request("listTeamQuickLinks", { token: ApiClient.getSessionToken() });
        state.quickLinks = Array.isArray(response.data?.links) ? response.data.links : [];
    }

    async function openQuickLinkForm(link = null) {
        if (!isAdmin()) return;
        const result = await Swal.fire({
            title: link ? "Edit Quick Link" : "Add Quick Link", width: "min(680px, calc(100vw - 28px))",
            customClass: { popup: "team-board__modal" }, showCancelButton: true, showCloseButton: true,
            confirmButtonText: link ? "Save changes" : "Add link",
            html: `<div class="team-board__form"><label>Title<input id="quickLinkTitle" maxlength="120" value="${escape(link?.Title || "")}" placeholder="e.g. FortiGate Admin Portal"></label><label>URL<input id="quickLinkUrl" type="url" maxlength="2000" value="${escape(link?.URL || "")}" placeholder="https://example.com"></label><div class="team-board__form-row"><label>Category<input id="quickLinkCategory" maxlength="80" value="${escape(link?.Category || "")}" placeholder="e.g. Security"></label><label>Credential reference<input id="quickLinkCredential" maxlength="500" value="${escape(link?.CredentialReference || "")}" placeholder="e.g. Bitwarden: FortiGate Admin"></label></div><label>Remark / detail<textarea id="quickLinkRemark" maxlength="1500" rows="4" placeholder="Purpose, access instructions or owner. Do not enter passwords.">${escape(link?.Remark || "")}</textarea></label><p class="team-quick-link__security-note"><i class="fa-solid fa-shield-halved"></i> Do not store passwords here. Use a password manager and add its reference instead.</p></div>`,
            preConfirm: () => {
                const Title = document.getElementById("quickLinkTitle").value.trim();
                const URL = document.getElementById("quickLinkUrl").value.trim();
                if (!Title || !URL) { Swal.showValidationMessage("Enter both a title and URL."); return false; }
                if (!/^https?:\/\//i.test(URL)) { Swal.showValidationMessage("URL must start with http:// or https://"); return false; }
                return { LinkID: link?.LinkID || "", Title, URL, Category: document.getElementById("quickLinkCategory").value.trim(), CredentialReference: document.getElementById("quickLinkCredential").value.trim(), Remark: document.getElementById("quickLinkRemark").value.trim() };
            }
        });
        if (!result.isConfirmed) return;
        UI.loading(link ? "Saving Quick Link" : "Adding Quick Link", "Updating the shared link directory");
        try {
            const response = await ApiClient.request("saveTeamQuickLink", { token: ApiClient.getSessionToken(), record: result.value });
            const saved = response.data?.record;
            const links = state.quickLinks || [];
            const index = links.findIndex((item) => String(item.LinkID) === String(saved?.LinkID));
            if (index === -1) links.unshift(saved); else links.splice(index, 1, saved);
            state.quickLinks = links;
            Swal.close();
            render();
        } catch (error) {
            Swal.close();
            await UI.alert({ icon: "error", title: "Unable to save Quick Link", text: error.message || "Please try again." });
        }
    }

    async function deleteQuickLink(link) {
        if (!link || !isAdmin()) return;
        const answer = await UI.confirm({ title: "Delete this Quick Link?", text: link.Title, confirmButtonText: "Delete" });
        if (!answer.isConfirmed) return;
        UI.loading("Deleting Quick Link", "Removing it from the shared directory");
        try {
            await ApiClient.request("deleteTeamQuickLink", { token: ApiClient.getSessionToken(), linkId: link.LinkID });
            state.quickLinks = (state.quickLinks || []).filter((item) => String(item.LinkID) !== String(link.LinkID));
            Swal.close();
            render();
        } catch (error) {
            Swal.close();
            await UI.alert({ icon: "error", title: "Unable to delete Quick Link", text: error.message || "Please try again." });
        }
    }

    async function loadBoardHistoryCards() {
        const response = await ApiClient.request("listTeamBoardHistory", { token: ApiClient.getSessionToken() });
        state.historyCards = Array.isArray(response.data?.cards) ? response.data.cards : [];
        return state.historyCards;
    }

    async function openBoardHistory() {
        UI.loading("Loading history", "Fetching all team updates and tasks");
        let historyCards = [];
        try {
            historyCards = await loadBoardHistoryCards();
            Swal.close();
        } catch (error) {
            Swal.close();
            await UI.alert({ icon: "error", title: "Unable to load history", text: error.message || "Please try again." });
            return;
        }
        let selectedId = "";
        await Swal.fire({
            title: "Team Board History", width: "min(820px, calc(100vw - 24px))", showCloseButton: true,
            confirmButtonText: "Close", customClass: { popup: "team-board__modal" },
            html: `<div class="team-board__history"><p class="team-board__history-intro">${historyCards.length} items · Includes active and archived updates and tasks</p>${historyCards.length ? `<div class="team-board__history-list">${historyCards.map((card) => {
                const archived = card.Status === "Archived";
                const type = card.Type === "Task" ? "Task" : "Update";
                const status = type === "Task" ? (card.Status || "To Do") : (archived ? "Archived" : "Update");
                return `<button type="button" class="team-board__history-item${archived ? " is-archived" : ""}" data-history-card="${escape(card.BoardID)}"><span class="team-board__history-icon"><i class="fa-solid ${type === "Task" ? "fa-list-check" : "fa-bullhorn"}"></i></span><span class="team-board__history-main"><strong>${escape(card.Title)}</strong><small>${type === "Task" ? `Assigned to ${escape(card.AssigneeName || "Unassigned")}` : `Posted by ${escape(card.CreatedByName || "-")}`} · ${escape(dateTimeLabel(card.UpdatedAt || card.CreatedAt))}</small></span><span class="team-board__history-status${archived ? " is-archived" : ""}">${escape(status)}</span></button>`;
            }).join("")}</div>` : `<p class="team-board__activity-empty">No board history yet.</p>`}</div>`,
            didOpen: () => {
                Swal.getPopup()?.querySelectorAll("[data-history-card]").forEach((button) => {
                    button.addEventListener("click", () => { selectedId = button.dataset.historyCard; Swal.close(); });
                });
            }
        });
        const selected = historyCards.find((card) => String(card.BoardID) === String(selectedId));
        if (selected) await showCard(selected);
    }

    async function openCardForm(card = null) {
        const editing = Boolean(card);
        const memberOptions = state.members.map((member) => `<option value="${escape(member.userId)}" ${String(card?.AssigneeUserID || "") === member.userId ? "selected" : ""}>${escape(member.name)}</option>`).join("");
        const selectedType = card?.Type === "Task" ? "Task" : "Update";
        const result = await Swal.fire({
            title: editing ? "Edit board item" : "Add board item",
            width: "min(720px, calc(100vw - 32px))",
            customClass: { popup: "team-board__modal" },
            showCancelButton: true,
            showCloseButton: true,
            confirmButtonText: editing ? "Save changes" : "Post item",
            html: `<div class="team-board__form">
                <label>Type<select id="boardType">${types.map((type) => `<option value="${type}" ${selectedType === type ? "selected" : ""}>${type === "Task" ? "Team task" : "Team update / Handover"}</option>`).join("")}</select></label>
                <label>Title<input id="boardTitle" maxlength="120" value="${escape(card?.Title || "")}" placeholder="What should the team know?"></label>
                <label>Details<textarea id="boardBody" maxlength="3000" rows="5" placeholder="Add context, instructions or a handover note">${escape(card?.Body || "")}</textarea></label>
                <div id="boardTaskFields" class="team-board__task-fields"><div class="team-board__form-row"><label>Assign to<select id="boardAssignee"><option value="">Unassigned</option>${memberOptions}</select></label><label>Due date<input id="boardDueDate" type="date" value="${escape(String(card?.DueDate || "").slice(0, 10))}"></label></div><label>Priority<select id="boardPriority">${priorities.map((priority) => `<option value="${priority}" ${taskPriority(card) === priority ? "selected" : ""}>${priorityLabel[priority]} (${priority})</option>`).join("")}</select></label></div>
                <label id="boardPinField" class="team-board__checkbox"><input id="boardPinned" type="checkbox" ${String(card?.IsPinned || "").toUpperCase() === "TRUE" ? "checked" : ""}> Pin this update</label>
            </div>`,
            didOpen: () => {
                const type = document.getElementById("boardType");
                const sync = () => {
                    document.getElementById("boardTaskFields").hidden = type.value !== "Task";
                    document.getElementById("boardPinField").hidden = type.value !== "Update";
                };
                type.addEventListener("change", sync);
                sync();
            },
            preConfirm: () => {
                const Type = document.getElementById("boardType").value;
                const Title = document.getElementById("boardTitle").value.trim();
                if (!Title) { Swal.showValidationMessage("Enter a title."); return false; }
                return { BoardID: card?.BoardID || "", Type, Title,
                    Body: document.getElementById("boardBody").value.trim(),
                    AssigneeUserID: Type === "Task" ? document.getElementById("boardAssignee").value : "",
                    DueDate: Type === "Task" ? document.getElementById("boardDueDate").value : "",
                    Priority: Type === "Task" ? document.getElementById("boardPriority").value : "",
                    IsPinned: Type === "Update" && document.getElementById("boardPinned").checked ? "TRUE" : "FALSE" };
            }
        });
        if (!result.isConfirmed) return;
        UI.loading(editing ? "Saving changes" : "Posting to board", "Updating the team board");
        try {
            const saved = await ApiClient.request("saveTeamBoardCard", { token: ApiClient.getSessionToken(), record: result.value });
            applySavedCard(saved.data && saved.data.record);
            Swal.close();
        } catch (error) {
            Swal.close();
            await UI.alert({ icon: "error", title: "Unable to save item", text: error.message || "Please try again." });
        }
    }

    async function setStatus(card, status) {
        if (!card || state.busy.has(card.BoardID)) return;
        state.busy.add(card.BoardID);
        UI.loading(status === "Archived" ? "Archiving item" : "Updating task", "Saving the latest status");
        try {
            const saved = await ApiClient.request("setTeamBoardStatus", { token: ApiClient.getSessionToken(), boardId: card.BoardID, status });
            applySavedCard(saved.data && saved.data.record);
            Swal.close();
        } catch (error) {
            Swal.close();
            render();
            await UI.alert({ icon: "error", title: "Unable to update item", text: error.message || "Please try again." });
        } finally {
            state.busy.delete(card.BoardID);
        }
    }

    async function showCard(card, focusReply = false, knownReplies = null) {
        if (!card) return;
        let replies = knownReplies;
        let activities = [];
        UI.loading("Loading board item", "Fetching activity history");
        try {
            const requests = [ApiClient.request("listTeamBoardActivity", { token: ApiClient.getSessionToken(), boardId: card.BoardID })];
            if (card.Type === "Task" && !replies) requests.push(ApiClient.request("listTeamBoardReplies", { token: ApiClient.getSessionToken(), boardId: card.BoardID }));
            const results = await Promise.allSettled(requests);
            if (results[0].status === "fulfilled") activities = Array.isArray(results[0].value?.data?.activities) ? results[0].value.data.activities : [];
            if (card.Type === "Task" && !replies) {
                if (results[1]?.status !== "fulfilled") throw results[1]?.reason || new Error("Unable to load task conversation");
                replies = Array.isArray(results[1].value?.data?.replies) ? results[1].value.data.replies : [];
            }
        } catch (error) {
            Swal.close();
            await UI.alert({ icon: "error", title: "Unable to load item history", text: error.message || "Please try again." });
            return;
        }
        Swal.close();
        const allowReply = canReply(card);
        const managed = canManage(card);
        const replyMarkup = (replies || []).map((reply) => `<li class="team-board__reply"><div><strong>${escape(reply.CreatedByName || "Team member")}</strong><time>${escape(dateTimeLabel(reply.CreatedAt))}</time></div><p>${escape(reply.Body || "")}</p></li>`).join("");
        const activityLabels = { CREATED: "Created", EDITED: "Edited", ASSIGNED: "Assigned", UNASSIGNED: "Unassigned", STATUS_CHANGED: "Status changed", ARCHIVED: "Archived", REPLIED: "Replied" };
        const activityMarkup = activities.length ? `<ol class="team-board__activity-list">${activities.map((activity) => `<li><span class="team-board__activity-dot team-board__activity-dot--${String(activity.Action || "UPDATED").toLowerCase()}"></span><div><strong>${escape(activityLabels[activity.Action] || activity.Action || "Updated")}</strong><p>${escape(activity.Detail || "")}</p><small>${escape(activity.ActorName || "Team member")} · ${escape(dateTimeLabel(activity.CreatedAt))}</small></div></li>`).join("")}</ol>` : `<p class="team-board__activity-empty">No activity recorded yet.</p>`;
        let nextAction = "";
        const result = await Swal.fire({
            title: escape(card.Title), width: "min(760px, calc(100vw - 24px))", showCloseButton: true,
            customClass: { popup: "team-board__modal" },
            confirmButtonText: allowReply ? "Post reply" : "Close",
            showCancelButton: allowReply,
            cancelButtonText: "Close",
            html: `<div class="team-board__detail"><p>${escape(card.Body || "No details added.").replace(/\n/g, "<br>")}</p><dl><dt>Type</dt><dd>${card.Type === "Task" ? "Team task" : "Team update / Handover"}</dd>${card.Type === "Task" ? `<dt>Priority</dt><dd>${priorityLabel[taskPriority(card)]}</dd><dt>Status</dt><dd>${escape(card.Status)}</dd><dt>Assigned to</dt><dd>${escape(card.AssigneeName || "Unassigned")}</dd><dt>Due date</dt><dd>${escape(dateLabel(card.DueDate) || "Not set")}</dd>` : ""}<dt>Posted by</dt><dd>${escape(card.CreatedByName)}</dd><dt>Posted at</dt><dd>${escape(dateTimeLabel(card.CreatedAt))}</dd></dl><section class="team-board__activity"><h4>Activity history</h4>${activityMarkup}</section>${card.Type === "Task" ? `<section class="team-board__thread"><h4>Task conversation</h4><ol>${replyMarkup || `<li class="team-board__thread-empty">No replies yet.</li>`}</ol>${allowReply ? `<label for="boardReplyBody">Your reply</label><textarea id="boardReplyBody" rows="3" maxlength="2000" placeholder="Share progress, a question or a handover note"></textarea>` : ""}</section>` : ""}${managed && card.Status !== "Archived" ? `<div class="team-board__detail-actions"><button type="button" data-detail-edit>Edit</button><button type="button" data-detail-archive>Archive</button></div>` : ""}</div>`,
            didOpen: () => {
                if (focusReply) document.getElementById("boardReplyBody")?.focus();
                const popup = Swal.getPopup();
                popup?.querySelector("[data-detail-edit]")?.addEventListener("click", () => { nextAction = "edit"; Swal.close(); });
                popup?.querySelector("[data-detail-archive]")?.addEventListener("click", () => { nextAction = "archive"; Swal.close(); });
            },
            preConfirm: allowReply ? () => {
                const body = document.getElementById("boardReplyBody").value.trim();
                if (!body) { Swal.showValidationMessage("Enter a reply before posting."); return false; }
                return body;
            } : undefined
        });
        if (nextAction === "edit") return openCardForm(card);
        if (nextAction === "archive") {
            const answer = await UI.confirm({ title: "Archive this item?", text: card.Title, confirmButtonText: "Archive" });
            if (answer.isConfirmed) await setStatus(card, "Archived");
            return;
        }
        if (!allowReply || !result.isConfirmed || !result.value) return;
        UI.loading("Posting reply", "Saving your response to this task");
        try {
            const response = await ApiClient.request("addTeamBoardReply", {
                token: ApiClient.getSessionToken(), boardId: card.BoardID, body: result.value
            });
            Swal.close();
            await showCard(card, false, [...(replies || []), response.data.reply]);
        } catch (error) {
            Swal.close();
            await UI.alert({ icon: "error", title: "Unable to post reply", text: error.message || "Please try again." });
        }
    }

    document.addEventListener("DOMContentLoaded", async () => {
        const context = await AppShell.init({ currentView: "teamBoard", title: "IT Team Board", eyebrow: "TEAM WORKSPACE",
            searchPlaceholder: "Search team updates and tasks",
            onSearch: (value) => { state.query = value.trim(); render(); },
            onRefresh: () => loadBoard() });
        if (!context) return;
        state.session = context.session;
        const view = context.elements.viewContainer;
        view.innerHTML = `<div class="team-board__loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading team board...</div>`;
        view.addEventListener("click", async (event) => {
            if (event.target.closest("#addBoardItem")) return openCardForm();
            if (event.target.closest("#addQuickLink")) return openQuickLinkForm();
            if (event.target.closest("[data-team-board-history]")) return openBoardHistory();
            const quickLinkOpen = event.target.closest("[data-quick-link-open]");
            if (quickLinkOpen) {
                const link = (state.quickLinks || []).find((item) => String(item.LinkID) === String(quickLinkOpen.dataset.quickLinkOpen));
                if (link) { const opened = window.open(link.URL, "_blank", "noopener,noreferrer"); if (opened) opened.opener = null; }
                return;
            }
            const quickLinkEdit = event.target.closest("[data-quick-link-edit]");
            if (quickLinkEdit) return openQuickLinkForm((state.quickLinks || []).find((item) => String(item.LinkID) === String(quickLinkEdit.dataset.quickLinkEdit)));
            const quickLinkDelete = event.target.closest("[data-quick-link-delete]");
            if (quickLinkDelete) return deleteQuickLink((state.quickLinks || []).find((item) => String(item.LinkID) === String(quickLinkDelete.dataset.quickLinkDelete)));
            const viewMode = event.target.closest("[data-board-view-mode]");
            if (viewMode) {
                const nextView = viewMode.dataset.boardViewMode;
                if (nextView === "links" && !Array.isArray(state.quickLinks)) {
                    UI.loading("Loading Quick Links", "Fetching the shared IT link directory");
                    try { await loadQuickLinks(); }
                    catch (error) {
                        Swal.close();
                        await UI.alert({ icon: "error", title: "Unable to load Quick Links", text: error.message || "Please try again." });
                        return;
                    }
                    Swal.close();
                }
                if (nextView === "calendar" && !Array.isArray(state.historyCards)) {
                    UI.loading("Loading calendar", "Fetching archived team tasks");
                    try { await loadBoardHistoryCards(); }
                    catch (error) {
                        Swal.close();
                        await UI.alert({ icon: "error", title: "Unable to load calendar", text: error.message || "Please try again." });
                        return;
                    }
                    Swal.close();
                }
                state.view = nextView;
                render();
                return;
            }
            const calendarMonth = event.target.closest("[data-calendar-month]");
            if (calendarMonth) {
                const delta = calendarMonth.dataset.calendarMonth === "next" ? 1 : -1;
                state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() + delta, 1);
                render();
                return;
            }
            const calendarCard = event.target.closest("[data-calendar-card]");
            if (calendarCard) {
                const card = findKnownCard(calendarCard.dataset.calendarCard);
                if (card) await showCard(card);
                return;
            }
            const edit = event.target.closest("[data-board-edit]");
            if (edit) return openCardForm(state.cards.find((card) => card.BoardID === edit.dataset.boardEdit));
            const archive = event.target.closest("[data-board-archive]");
            if (archive) {
                const card = state.cards.find((item) => item.BoardID === archive.dataset.boardArchive);
                if (!card) return;
                const answer = await UI.confirm({ title: "Archive this item?", text: card.Title, confirmButtonText: "Archive" });
                if (answer.isConfirmed) await setStatus(card, "Archived");
                return;
            }
            const viewButton = event.target.closest("[data-board-view]");
            if (viewButton) {
                const card = state.cards.find((item) => item.BoardID === viewButton.dataset.boardView);
                if (card) await showCard(card);
            }
            const replyButton = event.target.closest("[data-board-reply]");
            if (replyButton) {
                const card = state.cards.find((item) => item.BoardID === replyButton.dataset.boardReply);
                if (card) await showCard(card, true);
            }
            const note = event.target.closest("[data-board-open]");
            if (note) {
                const card = state.cards.find((item) => item.BoardID === note.dataset.boardOpen);
                if (card) await showCard(card);
            }
        });
        view.addEventListener("change", async (event) => {
            const select = event.target.closest("[data-board-status]");
            if (!select) return;
            const card = state.cards.find((item) => item.BoardID === select.dataset.boardStatus);
            if (card && statuses.includes(select.value) && select.value !== card.Status) await setStatus(card, select.value);
        });
        view.addEventListener("keydown", async (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            const note = event.target.closest("[data-board-open]");
            if (!note) return;
            event.preventDefault();
            const card = state.cards.find((item) => item.BoardID === note.dataset.boardOpen);
            if (card) await showCard(card);
        });
        try { await loadBoard(); }
        catch (error) {
            view.innerHTML = `<div class="team-board__loading">Unable to load team board. <button class="primary-btn" id="retryBoardLoad" type="button">Try again</button></div>`;
            document.getElementById("retryBoardLoad").addEventListener("click", () => loadBoard().catch((failure) => UI.alert({ icon: "error", title: "Board unavailable", text: failure.message })));
        }
    });
})();
