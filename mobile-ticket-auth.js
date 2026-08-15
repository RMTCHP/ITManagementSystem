(function () {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const ticketMobileAccessKey = "itms_ticket_mobile_access";

    function clearPendingState() {
        document.documentElement.classList.remove("mobile-ticket-auth-pending");
    }

    function redirectToLogin() {
        window.location.replace(new URL("ticket-login.html", window.location.href).toString());
    }

    window.ITMS_TICKET_AUTH_READY = (async function () {
        if (!isMobile) {
            clearPendingState();
            return;
        }

        if (sessionStorage.getItem(ticketMobileAccessKey) !== "granted") {
            redirectToLogin();
            return;
        }

        const session = ApiClient.getSavedSession();
        if (!session || !session.token) {
            redirectToLogin();
            return;
        }

        try {
            UI.loading("Checking IT access", "Validating your mobile session");
            const result = await ApiClient.request("checkSession", { token: session.token });
            const data = result && result.data;
            const role = String(data && data.user && data.user.Role || "").trim().toLowerCase();
            Swal.close();

            if (!data || !data.valid || role !== "admin") {
                ApiClient.clearSession();
                sessionStorage.removeItem(ticketMobileAccessKey);
                redirectToLogin();
                return;
            }

            clearPendingState();
        } catch (error) {
            Swal.close();
            ApiClient.clearSession();
            sessionStorage.removeItem(ticketMobileAccessKey);
            redirectToLogin();
        }
    })();
})();
