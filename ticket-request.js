(function () {
    const choice = document.getElementById("requestChoice");
    const computer = document.getElementById("computerSearch");
    const results = document.getElementById("computerResults");
    const input = document.getElementById("computerSearchInput");
    const session = ApiClient.getSession();
    if (!session || !session.token) { window.location.replace("ticket-login.html"); return; }
    document.querySelectorAll("[data-request]").forEach((button) => button.addEventListener("click", () => {
        if (button.dataset.request === "email") { window.location.href = "create-ticket.html"; return; }
        choice.classList.add("hidden"); computer.classList.remove("hidden"); input.focus();
    }));
    document.getElementById("backButton").addEventListener("click", () => { computer.classList.add("hidden"); choice.classList.remove("hidden"); results.innerHTML = ""; });
    document.getElementById("computerSearchForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
            UI.loading("Searching computers", "Looking up matching assets");
            const response = await ApiClient.request("searchAssets", { token: session.token, query: input.value.trim() });
            const matches = (response.data && response.data.records) || [];
            Swal.close();
            results.innerHTML = matches.length ? matches.map((asset) => `<div class="result"><div><strong>${UI.escapeHtml(asset.AssetName || asset.AssetID)}</strong><small>${UI.escapeHtml(asset.FixedAssetNo || "-")} · ${UI.escapeHtml(asset.SerialNumber || "-")}</small></div><button type="button" data-asset-id="${UI.escapeHtml(asset.AssetID)}">Borrow / Return</button></div>`).join("") : "<p class=\"intro\">No computer found.</p>";
        } catch (error) { Swal.close(); UI.alert({ icon: "error", title: "Search failed", text: error.message || "Unable to search assets." }); }
    });
    results.addEventListener("click", (event) => { const button = event.target.closest("[data-asset-id]"); if (button) window.location.href = `assets.html?action=asset-borrowing&assetId=${encodeURIComponent(button.dataset.assetId)}`; });
})();
