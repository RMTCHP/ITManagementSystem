(function () {
    const form = document.getElementById("ticketLoginForm");
    const usernameInput = document.getElementById("ticketLoginUsername");
    const passwordInput = document.getElementById("ticketLoginPassword");
    const rememberCheckbox = document.getElementById("ticketRememberMe");
    const userQrCodeButton = document.getElementById("userQrCodeButton");
    const ticketMobileAccessKey = "itms_ticket_mobile_access";

    function bootstrap() {
        const remembered = localStorage.getItem("itms_remember_username");
        if (remembered) {
            usernameInput.value = remembered;
            rememberCheckbox.checked = true;
        }

        const savedSession = ApiClient.getSavedSession();
        if (ApiClient.hasLikelyActiveSession(savedSession)) {
            if (String(savedSession.user.Role || "").trim().toLowerCase() === "admin") {
                sessionStorage.setItem(ticketMobileAccessKey, "granted");
                window.location.replace("create-ticket.html");
            }
            return;
        }
        if (savedSession) {
            ApiClient.clearSession();
        }
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();
        if (!username || !password) {
            await UI.alert({ icon: "warning", title: "Missing credentials", text: "Enter username and password." });
            return;
        }

        const confirmation = await UI.confirm({
            title: "Login to Ticket Workspace?",
            text: "Your session will be validated before access is granted.",
            confirmButtonText: "Login"
        });
        if (!confirmation.isConfirmed) {
            return;
        }

        try {
            UI.loading("Signing in", "Validating your credentials");
            const result = await ApiClient.request("login", { username, password });
            const session = await ApiClient.resolveLoginSession(result);
            const role = String(session.user.Role || "").trim().toLowerCase();
            if (role !== "admin") {
                ApiClient.fireAndForget("logout", { token: session.token });
                throw new Error("This workspace is available to IT Admin accounts only.");
            }
            ApiClient.saveSession(session);
            ApiClient.fireAndForget("recordLoginActivity", { token: session.token });
            if (rememberCheckbox.checked) {
                localStorage.setItem("itms_remember_username", username);
            } else {
                localStorage.removeItem("itms_remember_username");
            }
            sessionStorage.setItem(ticketMobileAccessKey, "granted");
            Swal.close();
            window.location.replace("create-ticket.html");
        } catch (error) {
            Swal.close();
            await UI.alert({ icon: "error", title: "Login failed", text: error.message || "Unable to sign in." });
        }
    });

    userQrCodeButton.addEventListener("click", () => {
        Swal.fire({
            title: "User Request QR Code",
            html: '<img class="ticket-login-qr-image" src="assets/Userlink.png" alt="User Request QR Code">',
            showConfirmButton: true,
            confirmButtonText: "Close",
            customClass: {
                popup: "ticket-login-qr-modal"
            }
        });
    });

    bootstrap();
})();
