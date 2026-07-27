(function () {
    const form = document.getElementById("loginForm");
    const rememberCheckbox = document.getElementById("rememberMe");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");

    function hasLikelyActiveSession(session) {
        if (!session || !session.token || !session.user) {
            return false;
        }

        if (!session.expiresAt) {
            return true;
        }

        const expiry = new Date(session.expiresAt);
        return !Number.isNaN(expiry.getTime()) && expiry.getTime() > Date.now();
    }

    async function bootstrap() {
        const remembered = localStorage.getItem("itms_remember_username");
        if (remembered) {
            usernameInput.value = remembered;
            rememberCheckbox.checked = true;
        }

        const savedSession = ApiClient.getSavedSession();
        if (hasLikelyActiveSession(savedSession)) {
            window.location.href = "dashboard.html";
            return;
        }

        if (savedSession && !hasLikelyActiveSession(savedSession)) {
            ApiClient.clearSession();
        }
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            UI.toast("warning", "Missing credentials", "Enter username and password.");
            return;
        }

        const confirmation = await UI.confirm({
            title: "Login to system?",
            text: "Your session will be validated before access is granted.",
            confirmButtonText: "Login"
        });

        if (!confirmation.isConfirmed) {
            return;
        }

        try {
            UI.loading("Signing in", "Validating your credentials");
            const result = await ApiClient.request("login", { username, password });
            ApiClient.saveSession(result.data);
            if (rememberCheckbox.checked) {
                localStorage.setItem("itms_remember_username", username);
            } else {
                localStorage.removeItem("itms_remember_username");
            }
            Swal.close();
            await UI.toast("success", "Login successful", `Welcome ${result.data.user.FullName}`);
            window.location.href = "dashboard.html";
        } catch (error) {
            Swal.close();
            await UI.alert({
                icon: "error",
                title: "Login failed",
                text: error.message || "Unable to sign in"
            });
        }
    });

    bootstrap();
})();
