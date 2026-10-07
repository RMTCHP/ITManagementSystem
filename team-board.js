(() => {
    const state = { cards: [], members: [], totalActive: 0, query: "", filter: "all", session: null, busy: new Set() };
    const types = ["Update", "Task"];
    const statuses = ["To Do", "In Progress", "Done"];
    const escape = (value) => UI.escapeHtml(String(value ?? ""));
    const currentUserId = () => String(state.session?.user?.UserID || "");
    const isAdmin = () => String(state.session?.user?.Role || "").toLowerCase() === "admin";
    const canManage = (card) => isAdmin() || String(card.CreatedByID || "") === currentUserId();
    const canChangeStatus = (card) => card.Type === "Task" && (canManage(card) || String(card.AssigneeUserID || "") === currentUserId());
    const isUpdate = (card) => ["Update", "Announcement", "Note"].includes(String(card?.Type || ""));

    function dateLabel(value) {
        const date = String(value || "").slice(0, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}` : "";
    }

    function cardMarkup(card) {
        const id = escape(card.BoardID);
        const type = card.Type === "Task" ? "Task" : "Update";
        const managed = canManage(card);
        const assignLabel = card.AssigneeName ? `<span><i class="fa-regular fa-user"></i>${escape(card.AssigneeName)}</span>` : "";
        const dueLabel = card.DueDate ? `<span><i class="fa-regular fa-calendar"></i>${escape(dateLabel(card.DueDate))}</span>` : "";
        const statusOptions = statuses.map((status) => `<option value="${status}" ${card.Status === status ? "selected" : ""}>${status}</option>`).join("");
        return `<article class="team-card team-card--${type.toLowerCase()}">
            <div class="team-card__top"><span class="team-card__kind">${type === "Update" ? "Team update / Handover" : "Internal task"}</span>${String(card.IsPinned).toUpperCase() === "TRUE" ? `<span class="team-card__pin"><i class="fa-solid fa-thumbtack"></i> Pinned</span>` : ""}</div>
            <h3>${escape(card.Title)}</h3>
            <p class="team-card__body">${escape(card.Body || "No details added.")}</p>
            ${type === "Task" ? `<div class="team-card__status">${canChangeStatus(card) ? `<label>Status <select data-board-status="${id}">${statusOptions}</select></label>` : `<span class="team-status">${escape(card.Status)}</span>`}</div>` : ""}
            <div class="team-card__meta">${assignLabel}${dueLabel}<span><i class="fa-regular fa-user"></i>${escape(card.CreatedByName || "Unknown")}</span><span><i class="fa-regular fa-clock"></i>${escape(dateLabel(card.CreatedAt))}</span></div>
            <div class="team-card__actions"><button type="button" data-board-view="${id}"><i class="fa-regular fa-eye"></i> View</button>${managed ? `<button type="button" data-board-edit="${id}"><i class="fa-solid fa-pen"></i> Edit</button><button type="button" data-board-archive="${id}"><i class="fa-solid fa-box-archive"></i> Archive</button>` : ""}</div>
        </article>`;
    }

    function render() {
        const query = state.query.toLowerCase();
        const cards = state.cards.filter((card) => (state.filter === "all" || (state.filter === "Update" ? isUpdate(card) : card.Type === state.filter))
            && (!query || [card.Title, card.Body, card.AssigneeName, card.CreatedByName].some((value) => String(value || "").toLowerCase().includes(query))));
        const groups = [
            { type: "Update", label: "Team updates", icon: "fa-bullhorn" },
            { type: "Task", label: "Team tasks", icon: "fa-list-check" }
        ];
        document.getElementById("viewContainer").innerHTML = `<section class="team-board">
            <div class="team-board__toolbar"><div><p class="section-card__eyebrow">Shared workspace</p><h2>Team activity</h2><p>Share an update, hand over information or assign a task to a teammate.</p></div><button class="primary-btn" type="button" id="addBoardItem"><i class="fa-solid fa-plus"></i> Add item</button></div>
            <div class="team-board__filters"><button type="button" data-board-filter="all" class="${state.filter === "all" ? "is-active" : ""}">All</button>${groups.map((group) => `<button type="button" data-board-filter="${group.type}" class="${state.filter === group.type ? "is-active" : ""}">${group.label}</button>`).join("")}</div>
            ${state.totalActive > 250 ? `<p class="team-board__notice">Showing the latest 250 active items. Archive completed items to keep the board focused.</p>` : ""}
            <div class="team-board__columns">${groups.map((group) => {
                const groupCards = cards.filter((card) => group.type === "Update" ? isUpdate(card) : card.Type === group.type);
                return `<section class="team-board__column team-board__column--${group.type.toLowerCase()}"><header><span><i class="fa-solid ${group.icon}"></i>${group.label}</span><strong>${groupCards.length}</strong></header><div class="team-board__stack">${groupCards.map(cardMarkup).join("") || `<p class="team-board__empty">No items here yet.</p>`}</div></section>`;
            }).join("")}</div>
        </section>`;
    }

    async function loadBoard() {
        const response = await ApiClient.request("listTeamBoard", { token: ApiClient.getSessionToken() });
        state.cards = Array.isArray(response.data?.cards) ? response.data.cards : [];
        state.members = Array.isArray(response.data?.members) ? response.data.members : [];
        state.totalActive = Number(response.data?.totalActive || state.cards.length);
        render();
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
                <div id="boardTaskFields" class="team-board__form-row"><label>Assign to<select id="boardAssignee"><option value="">Unassigned</option>${memberOptions}</select></label><label>Due date<input id="boardDueDate" type="date" value="${escape(String(card?.DueDate || "").slice(0, 10))}"></label></div>
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
                    IsPinned: Type === "Update" && document.getElementById("boardPinned").checked ? "TRUE" : "FALSE" };
            }
        });
        if (!result.isConfirmed) return;
        UI.loading(editing ? "Saving changes" : "Posting to board", "Updating the team board");
        try {
            await ApiClient.request("saveTeamBoardCard", { token: ApiClient.getSessionToken(), record: result.value });
            await loadBoard();
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
            await ApiClient.request("setTeamBoardStatus", { token: ApiClient.getSessionToken(), boardId: card.BoardID, status });
            await loadBoard();
            Swal.close();
        } catch (error) {
            Swal.close();
            render();
            await UI.alert({ icon: "error", title: "Unable to update item", text: error.message || "Please try again." });
        } finally {
            state.busy.delete(card.BoardID);
        }
    }

    async function showCard(card) {
        await Swal.fire({ title: escape(card.Title), width: "min(720px, calc(100vw - 32px))", showCloseButton: true,
            confirmButtonText: "Close",
            html: `<div class="team-board__detail"><p>${escape(card.Body || "No details added.").replace(/\n/g, "<br>")}</p><dl><dt>Type</dt><dd>${card.Type === "Task" ? "Team task" : "Team update / Handover"}</dd>${card.Type === "Task" ? `<dt>Status</dt><dd>${escape(card.Status)}</dd><dt>Assigned to</dt><dd>${escape(card.AssigneeName || "Unassigned")}</dd><dt>Due date</dt><dd>${escape(dateLabel(card.DueDate) || "Not set")}</dd>` : ""}<dt>Posted by</dt><dd>${escape(card.CreatedByName)}</dd><dt>Posted at</dt><dd>${escape(card.CreatedAt)}</dd></dl></div>` });
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
            const filter = event.target.closest("[data-board-filter]");
            if (filter) { state.filter = filter.dataset.boardFilter; render(); return; }
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
        });
        view.addEventListener("change", async (event) => {
            const select = event.target.closest("[data-board-status]");
            if (!select) return;
            const card = state.cards.find((item) => item.BoardID === select.dataset.boardStatus);
            if (card && statuses.includes(select.value) && select.value !== card.Status) await setStatus(card, select.value);
        });
        try { await loadBoard(); }
        catch (error) {
            view.innerHTML = `<div class="team-board__loading">Unable to load team board. <button class="primary-btn" id="retryBoardLoad" type="button">Try again</button></div>`;
            document.getElementById("retryBoardLoad").addEventListener("click", () => loadBoard().catch((failure) => UI.alert({ icon: "error", title: "Board unavailable", text: failure.message })));
        }
    });
})();
