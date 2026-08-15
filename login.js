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
            window.location.href = getPostLoginDestination();
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
            let session = result && result.data && result.data.user
                ? result.data
                : (result && result.user ? result : null);
            const loginData = result && result.data ? result.data : result;
            if ((!session || !session.user) && loginData && loginData.token) {
                const checkedSession = await ApiClient.request("checkSession", { token: loginData.token });
                if (checkedSession.data && checkedSession.data.valid && checkedSession.data.user) {
                    session = {
                        token: checkedSession.data.token || loginData.token,
                        expiresAt: checkedSession.data.expiresAt || loginData.expiresAt,
                        user: checkedSession.data.user
                    };
                }
            }
            if (!session || !session.token || !session.user) {
                throw new Error("Login response is incomplete. Confirm that the latest code.gs has been deployed.");
            }

            ApiClient.saveSession(session);
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
