(function () {
    const form = document.getElementById("ticketLoginForm");
    const usernameInput = document.getElementById("ticketLoginUsername");
    const passwordInput = document.getElementById("ticketLoginPassword");
    const ticketMobileAccessKey = "itms_ticket_mobile_access";

    async function verifyTicketAccess(token) {
        const result = await ApiClient.request("checkSession", { token });
        const data = result && result.data;
        const role = String(data && data.user && data.user.Role || "").trim().toLowerCase();
        if (!data || !data.valid || role !== "admin") {
            throw new Error("This workspace is available to IT Admin accounts only.");
        }
        return {
            token: data.token || token,
            expiresAt: data.expiresAt || "",
            user: data.user
        };
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!form.reportValidity()) {
            return;
        }

        const confirmation = await UI.confirm({
            title: "Login to Ticket Workspace?",
            text: "Your IT account will be validated before access is granted.",
            confirmButtonText: "Login"
        });
        if (!confirmation.isConfirmed) {
            return;
        }

        try {
            UI.loading("Signing in", "Validating your IT account");
            const result = await ApiClient.request("login", {
                username: usernameInput.value.trim(),
                password: passwordInput.value
            });
            const loginData = result && result.data ? result.data : result;
            const session = await verifyTicketAccess(loginData && loginData.token);
            ApiClient.saveSession(session);
            sessionStorage.setItem(ticketMobileAccessKey, "granted");
            Swal.close();
            window.location.replace("create-ticket.html");
        } catch (error) {
            Swal.close();
            ApiClient.clearSession();
            await UI.alert({ icon: "error", title: "Login failed", text: error.message || "Unable to sign in." });
        }
    });

})();
