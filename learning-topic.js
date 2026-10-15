(function () {
    const key = document.body.dataset.learningTopic || "guides";
    const pages = {
        guides: { title: "Step-by-Step Guides", icon: "fa-list-check", tone: "blue", summary: "Follow guided procedures for common IT tasks.", primary: "Practical procedures will be organised by task, platform and verification checklist.", examples: ["Printer installation", "GlobalProtect VPN setup", "PC replacement"] },
        troubleshooting: { title: "Guided Troubleshooting", icon: "fa-screwdriver-wrench", tone: "orange", summary: "Diagnose real IT issues through structured decision paths.", primary: "Select a symptom, answer diagnostic questions, then follow the suggested action to resolution.", examples: ["Cannot connect to internet", "VPN connection failed", "Printer offline"] },
        training: { title: "Training & Assessment", icon: "fa-clipboard-question", tone: "violet", summary: "Build IT knowledge and validate skills through learning modules and quizzes.", primary: "Learning modules, short lessons and assessment results will be available in this workspace.", examples: ["Network fundamentals", "Cybersecurity awareness", "IT service desk training"] },
        lab: { title: "Interactive Lab", icon: "fa-laptop-code", tone: "teal", summary: "Practice IT skills through hands-on simulations and realistic scenarios." }
    };
    const labs = [
        { title: "LAN Cable Lab", route: "lan-cable-lab.html", newTab: true, icon: "fa-ethernet", description: "Practice RJ45 cable termination and T568A/T568B wiring.", difficulty: "Beginner", category: "Cabling", group: "network" },
        { title: "Network Simulator", route: "netsim/app.html", newTab: true, icon: "fa-network-wired", description: "Build network topologies, configure devices, and test connectivity.", difficulty: "Intermediate", category: "Network", group: "network" },
        { title: "Network Troubleshooting Lab", route: "labs/network-troubleshooting/", newTab: true, icon: "fa-wifi", description: "Investigate simulated network failures and restore connectivity.", difficulty: "Intermediate", category: "Troubleshooting", group: "network" },
        { title: "Service Desk Scenario", icon: "fa-headset", description: "Practice ticket handling, prioritization, escalation, and resolution.", difficulty: "Beginner", category: "Service Desk", group: "operations" },
        { title: "Backup & Restore Lab", icon: "fa-database", description: "Practice backup verification, restoration, and recovery procedures.", difficulty: "Intermediate", category: "Backup", group: "operations" },
        { title: "Security Awareness Lab", icon: "fa-shield-halved", description: "Practice recognising and responding to common security scenarios.", difficulty: "Beginner", category: "Security", group: "other" }
    ];
    const groupMeta = { network: "Network & Infrastructure", operations: "IT Operations", other: "Other Labs" };
    const page = pages[key] || pages.guides;
    let query = "";
    let groupFilter = "all";
    let levelFilter = "all";

    function ensureExportButton() {
        if (document.getElementById("exportButton")) return;
        const actions = document.querySelector(".topbar__actions");
        if (!actions) return;
        const button = document.createElement("button");
        button.className = "icon-btn";
        button.id = "exportButton";
        button.type = "button";
        button.setAttribute("aria-label", "Export");
        button.innerHTML = '<i class="fa-solid fa-file-export"></i>';
        actions.insertBefore(button, actions.querySelector(".user-chip") || null);
    }

    function labCard(lab) {
        const available = Boolean(lab.route);
        const open = available ? `<span class="interactive-lab__open">Open lab <i class="fa-solid fa-arrow-right"></i></span>` : `<span class="interactive-lab__coming"><i class="fa-regular fa-clock"></i> Coming soon</span>`;
        const content = `<span class="interactive-lab__icon"><i class="fa-solid ${lab.icon}"></i></span><div class="interactive-lab__card-copy"><h5>${UI.escapeHtml(lab.title)}</h5><p>${UI.escapeHtml(lab.description)}</p></div><div class="interactive-lab__badges"><span class="interactive-lab__badge interactive-lab__badge--level">${UI.escapeHtml(lab.difficulty)}</span><span class="interactive-lab__badge">${UI.escapeHtml(lab.category)}</span></div><div class="interactive-lab__availability ${available ? "is-available" : ""}"><i class="fa-solid ${available ? "fa-circle-check" : "fa-clock"}"></i>${available ? "Available" : "Coming soon"}</div>${open}`;
        return available ? `<a class="interactive-lab__card interactive-lab__card--link" href="${UI.escapeHtml(lab.route)}"${lab.newTab ? ' target="_blank" rel="noopener noreferrer"' : ""}>${content}</a>` : `<article class="interactive-lab__card">${content}</article>`;
    }

    function renderLabs() {
        const terms = query.toLowerCase();
        const matched = labs.filter((lab) => (groupFilter === "all" || lab.group === groupFilter) && (levelFilter === "all" || lab.difficulty.toLowerCase() === levelFilter) && [lab.title, lab.description, lab.category, lab.difficulty, groupMeta[lab.group]].join(" ").toLowerCase().includes(terms));
        const groups = Object.keys(groupMeta).map((group) => {
            const groupLabs = matched.filter((lab) => lab.group === group);
            return groupLabs.length ? `<section class="interactive-lab__group"><h5>${groupMeta[group]} <span>${groupLabs.length}</span></h5><div class="interactive-lab__grid">${groupLabs.map(labCard).join("")}</div></section>` : "";
        }).join("");
        return `<div class="interactive-lab__heading"><div><p>SIMULATION CATALOG</p><h4>Choose a practical IT scenario</h4></div><div class="interactive-lab__heading-actions"><span>${matched.length} of ${labs.length} labs</span><a href="learning-hub.html"><i class="fa-solid fa-arrow-left"></i> Back</a></div></div><div class="interactive-lab__filters"><div class="interactive-lab__filter-group" aria-label="Lab group">${[["all", "All Labs"], ["network", "Network & Infrastructure"], ["operations", "IT Operations"], ["other", "Other"]].map(([value, label]) => `<button type="button" data-lab-group="${value}" class="${groupFilter === value ? "is-active" : ""}">${label}</button>`).join("")}</div><label class="interactive-lab__level-filter">Difficulty <select id="labDifficulty"><option value="all">All Levels</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label></div><div class="interactive-lab__catalog">${groups || `<div class="learning-hub__empty">No labs match the selected filters.</div>`}</div>`;
    }

    function render() {
        const standardPage = key === "lab" ? "" : `<div class="learning-topic-page__body"><article class="learning-topic-page__card"><h4>Learning workspace</h4><p>${UI.escapeHtml(page.primary)}</p><div class="learning-topic-page__empty"><span><i class="fa-regular fa-folder-open"></i><br>Content will appear here as it is added.</span></div></article><aside class="learning-topic-page__card"><h4>Suggested first topics</h4><ul>${page.examples.map((item) => `<li>${UI.escapeHtml(item)}</li>`).join("")}</ul></aside></div>`;
        const hero = key === "lab" ? "" : `<header class="learning-topic-page__hero"><a class="learning-topic-page__back" href="learning-hub.html"><i class="fa-solid fa-arrow-left"></i> IT Learning Hub</a><span class="learning-topic-page__icon"><i class="fa-solid ${page.icon}"></i></span><h3>${UI.escapeHtml(page.title)}</h3><p>${UI.escapeHtml(page.summary)}</p></header>`;
        document.getElementById("viewContainer").innerHTML = `<section class="learning-topic-page learning-topic-page--${page.tone}">${hero}${key === "lab" ? renderLabs() : standardPage}</section>`;
        if (key === "lab") {
            document.querySelectorAll("[data-lab-group]").forEach((button) => button.addEventListener("click", () => { groupFilter = button.dataset.labGroup; render(); }));
            const select = document.getElementById("labDifficulty");
            select.value = levelFilter;
            select.addEventListener("change", () => { levelFilter = select.value; render(); });
        }
    }

    async function bootstrap() {
        ensureExportButton();
        document.title = `${page.title} | IT Learning Hub`;
        const shell = await AppShell.init({ currentView: "learningHub", title: page.title, eyebrow: "IT Learning Hub", searchPlaceholder: key === "lab" ? "Search labs" : "Search learning topics", onSearch(value) { query = String(value || "").trim().toLowerCase(); render(); }, onRefresh() { query = ""; groupFilter = "all"; levelFilter = "all"; render(); } });
        if (shell) render();
    }
    bootstrap();
})();
