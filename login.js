(function () {
    const form = document.getElementById("loginForm");
    const rememberCheckbox = document.getElementById("rememberMe");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");

    function getPostLoginDestination() {
        const returnTo = new URL(window.location.href).searchParams.get("returnTo");
        const allowedPages = new Set([
            "create-ticket.html",
            ...Object.values(window.APP_CONFIG.pageRoutes || {})
        ]);
        return allowedPages.has(returnTo) ? returnTo : "dashboard.html";
    }

    async function bootstrap() {
        const remembered = localStorage.getItem("itms_remember_username");
        if (remembered) {
            usernameInput.value = remembered;
            rememberCheckbox.checked = true;
        }

        const savedSession = ApiClient.getSavedSession();
        if (ApiClient.hasLikelyActiveSession(savedSession)) {
            window.location.href = getPostLoginDestination();
            return;
        }

        if (savedSession && !ApiClient.hasLikelyActiveSession(savedSession)) {
            ApiClient.clearSession();
        }
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            await UI.alert({
                icon: "warning",
                title: "Missing credentials",
                text: "Enter username and password."
            });
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
            const session = await ApiClient.resolveLoginSession(result);

            ApiClient.saveSession(session);
            ApiClient.fireAndForget("recordLoginActivity", { token: session.token });
            if (rememberCheckbox.checked) {
                localStorage.setItem("itms_remember_username", username);
            } else {
                localStorage.removeItem("itms_remember_username");
            }
            Swal.close();
            window.location.replace(getPostLoginDestination());
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
