(function () {
    const topics = [
        { title: "Step-by-Step Guides", route: "step-by-step-guides.html", icon: "fa-list-check", tone: "blue", description: "Guided instructions for recurring IT work, from printer installation to GlobalProtect setup.", tags: ["Guides", "Procedures"] },
        { title: "Troubleshooting", route: "troubleshooting.html", icon: "fa-screwdriver-wrench", tone: "orange", description: "Choose a symptom and follow a structured diagnostic path to the likely resolution.", tags: ["Diagnostics", "Support"] },
        { title: "Training & Quiz", route: "training-quiz.html", icon: "fa-clipboard-question", tone: "violet", description: "Short learning modules and quizzes to build consistent IT knowledge across the team.", tags: ["Training", "Assessment"] },
        { title: "Interactive Lab", route: "interactive-lab.html", icon: "fa-laptop-code", tone: "teal", description: "Practice scenarios such as LAN cable standards, switch ports and common support tasks.", tags: ["Simulation", "Practice"] }
    ];
    let query = "";

    function render() {
        const matched = topics.filter((topic) => [topic.title, topic.description, ...topic.tags].join(" ").toLowerCase().includes(query));
        document.getElementById("viewContainer").innerHTML = `<section class="learning-hub">
            <div class="learning-hub__heading learning-hub__heading--compact"><div><p>LEARNING PATHS</p><h4>Learn, diagnose and practise</h4></div><span>${matched.length} topics</span></div>
            <div class="learning-hub__grid">${matched.map((topic) => `<a class="learning-topic learning-topic--${topic.tone}" href="${UI.escapeHtml(topic.route)}"><span class="learning-topic__icon"><i class="fa-solid ${topic.icon}"></i></span><div class="learning-topic__copy"><h5>${UI.escapeHtml(topic.title)}</h5><p>${UI.escapeHtml(topic.description)}</p></div><div class="learning-topic__footer"><span>${topic.tags.map((tag) => `<em>${UI.escapeHtml(tag)}</em>`).join("")}</span><small>Open <i class="fa-solid fa-arrow-right"></i></small></div></a>`).join("") || `<div class="learning-hub__empty">No learning topic matches your search.</div>`}</div>
            <footer class="learning-hub__note"><i class="fa-solid fa-circle-info"></i><span>Reference documents remain in <strong>Document Library</strong>. This hub is reserved for interactive and structured learning content.</span></footer>
        </section>`;
    }

    async function bootstrap() {
        const shell = await AppShell.init({
            currentView: "learningHub", title: "IT Learning Hub", eyebrow: "Knowledge Center", searchPlaceholder: "Search learning topics",
            onSearch(value) { query = String(value || "").trim().toLowerCase(); render(); },
            onRefresh() { render(); }
        });
        if (!shell) return;
        render();
    }
    bootstrap();
})();
