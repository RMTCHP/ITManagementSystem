(function () {
    const form = document.getElementById("ticketLoginForm");
    const usernameInput = document.getElementById("ticketLoginUsername");
    const passwordInput = document.getElementById("ticketLoginPassword");
    const userQrCodeButton = document.getElementById("userQrCodeButton");
    const ticketMobileAccessKey = "itms_ticket_mobile_access";

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
            const role = String(loginData && loginData.user && loginData.user.Role || "").trim().toLowerCase();
            if (!loginData || !loginData.token || !loginData.user || role !== "admin") {
                throw new Error("This workspace is available to IT Admin accounts only.");
            }
            const session = {
                token: loginData.token,
                expiresAt: loginData.expiresAt || "",
                user: loginData.user
            };
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

})();
