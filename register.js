(function () {
    const form = document.getElementById("registerForm");
    const departmentSelect = document.getElementById("department");
    const fullNameInput = document.getElementById("fullName");
    const usernameInput = document.getElementById("registerUsername");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("registerPassword");
    const confirmPasswordInput = document.getElementById("confirmPassword");
    const acceptPolicyCheckbox = document.getElementById("acceptPolicy");

    function getDepartmentOptions() {
        return (window.APP_CONFIG.modules.users.fields.find((field) => field.key === "Department") || {}).options || [];
    }

    function populateDepartments() {
        departmentSelect.innerHTML = [
            '<option value="">Select department</option>',
            ...getDepartmentOptions().map((department) => `<option value="${department}">${department}</option>`)
        ].join("");
    }

    function validateForm() {
        const fullName = fullNameInput.value.trim();
        const username = usernameInput.value.trim();
        const department = departmentSelect.value;
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();

        if (!fullName || !username || !department || !password || !confirmPassword) {
            throw new Error("Please complete all registration fields.");
        }

        if (!/^[A-Za-z0-9._-]{4,30}$/.test(username)) {
            throw new Error("Username must be 4-30 characters and use only letters, numbers, dot, underscore or hyphen.");
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error("Please enter a valid email address.");
        }

        if (password !== confirmPassword) {
            throw new Error("Password confirmation does not match.");
        }

        if (!acceptPolicyCheckbox.checked) {
            throw new Error("Please confirm internal use policy before registering.");
        }

        return {
            fullName,
            username,
            department,
            email,
            password
        };
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        try {
            const payload = validateForm();
            const confirmation = await UI.confirm({
                title: "Create new account?",
                text: "A standard User account will be created for this employee.",
                confirmButtonText: "Register"
            });

            if (!confirmation.isConfirmed) {
                return;
            }

            UI.loading("Creating account", "Saving user registration");
            const result = await ApiClient.request("register", payload);
            Swal.close();
            await UI.alert({
                icon: "success",
                title: "Registration successful",
                text: `Account ${result.data.user.Username} was created. You can login now.`
            });
            window.location.href = "index.html";
        } catch (error) {
            Swal.close();
            await UI.alert({
                icon: "error",
                title: "Registration failed",
                text: error.message || "Unable to create account"
            });
        }
    });

    populateDepartments();
})();
