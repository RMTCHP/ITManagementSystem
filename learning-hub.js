(function () {
    const topics = [
        { title: "Step-by-Step Guides", route: "step-by-step-guides.html", icon: "fa-list-check", tone: "blue", description: "Follow guided procedures for common IT tasks.", tags: ["Guides", "Procedures"] },
        { title: "Guided Troubleshooting", route: "troubleshooting.html", icon: "fa-screwdriver-wrench", tone: "orange", description: "Diagnose IT issues using structured troubleshooting workflows.", tags: ["Diagnostics", "Support"] },
        { title: "Training & Assessment", route: "training-quiz.html", icon: "fa-clipboard-question", tone: "violet", description: "Learn IT concepts and validate knowledge through assessments.", tags: ["Learning", "Assessment"] },
        { title: "Interactive Lab", route: "interactive-lab.html", icon: "fa-laptop-code", tone: "teal", description: "Practice IT skills through interactive simulations.", tags: ["Simulation", "Practice"] }
    ];
    let query = "";

    function render() {
        const matched = topics.filter((topic) => [topic.title, topic.description, ...topic.tags].join(" ").toLowerCase().includes(query));
        document.getElementById("viewContainer").innerHTML = `<section class="learning-hub">
            <div class="learning-hub__heading learning-hub__heading--compact"><div><p>LEARNING PATHS</p><h4>Learn, diagnose and practise</h4></div><span>${matched.length} categories</span></div>
            <div class="learning-hub__grid">${matched.map((topic) => `<a class="learning-topic learning-topic--${topic.tone}" href="${UI.escapeHtml(topic.route)}"><span class="learning-topic__icon"><i class="fa-solid ${topic.icon}"></i></span><div class="learning-topic__copy"><h5>${UI.escapeHtml(topic.title)}</h5><p>${UI.escapeHtml(topic.description)}</p></div><div class="learning-topic__footer"><span>${topic.tags.map((tag) => `<em>${UI.escapeHtml(tag)}</em>`).join("")}</span><small>Open <i class="fa-solid fa-arrow-right"></i></small></div></a>`).join("") || `<div class="learning-hub__empty">No learning category matches your search.</div>`}</div>
            <footer class="learning-hub__note"><i class="fa-solid fa-circle-info"></i><span>SOPs, work instructions and reference documents remain in <strong>Document Library</strong>. This hub is for guided learning, assessment and hands-on practice.</span></footer>
        </section>`;
    }

    async function bootstrap() {
        const shell = await AppShell.init({
            currentView: "learningHub", title: "IT Learning Hub", eyebrow: "Knowledge Center", searchPlaceholder: "Search learning categories",
            onSearch(value) { query = String(value || "").trim().toLowerCase(); render(); },
            onRefresh() { query = ""; render(); }
        });
        if (shell) render();
    }
    bootstrap();
})();
