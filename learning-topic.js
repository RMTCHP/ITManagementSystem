(function () {
    const key = document.body.dataset.learningTopic || "guides";
    const pages = {
        guides: { title: "Step-by-Step Guides", icon: "fa-list-check", tone: "blue", summary: "Structured procedures for common IT tasks, written to be followed one step at a time.", primary: "Guides will be organised here by topic, platform and task type.", examples: ["Install or troubleshoot a network printer", "Set up GlobalProtect VPN", "Request and configure a shared mailbox"] },
        troubleshooting: { title: "Troubleshooting", icon: "fa-screwdriver-wrench", tone: "orange", summary: "Diagnostic workflows that start with a symptom and guide the technician to the right next check.", primary: "Each workflow will branch by answer, so the team can resolve recurring problems consistently.", examples: ["Internet or Wi-Fi connection issues", "Printer unavailable or offline", "Windows sign-in and account access"] },
        training: { title: "Training & Quiz", icon: "fa-clipboard-question", tone: "violet", summary: "Short internal lessons and knowledge checks for onboarding and continuous IT skill development.", primary: "Training modules, quiz scores and completion history will be available in this workspace.", examples: ["IT service desk onboarding", "Information security awareness", "Network and asset-management basics"] },
        lab: { title: "Interactive Lab", icon: "fa-laptop-code", tone: "teal", summary: "Hands-on simulations that let the team practise technical decisions without affecting live systems.", primary: "Labs will provide visual scenarios and immediate feedback for practical IT skills.", examples: ["LAN cable colour-order practice", "Switch port selection", "Incident triage simulation"] }
    };
    const page = pages[key] || pages.guides;
    const labs = [
        { title: "LAN Cable Lab", route: "lan-cable-lab.html", newTab: true, icon: "fa-ethernet", action: "เรียงสีสาย T568A/T568B และเข้าหัว RJ45", outcome: "ตรวจลำดับสี พร้อมชี้เส้นที่ผิด" },
        { title: "Network Simulator", route: "netsim/app.html", newTab: true, icon: "fa-network-wired", action: "Build network topologies and configure hosts, routers and firewalls with Linux commands", outcome: "Simulate packets, routing, services and guided networking labs in the browser" },
        { title: "Network Troubleshooting Lab", icon: "fa-network-wired", action: "เลือกขั้นตอนตรวจเมื่อ PC เข้าเน็ตหรือ Share Drive ไม่ได้", outcome: "แสดงผลตรวจแต่ละขั้น และเฉลยสาเหตุ" },
        { title: "IP & Subnet Lab", icon: "fa-diagram-project", action: "กำหนด IP, Subnet Mask และ Gateway ให้เครื่องตัวอย่าง", outcome: "ตรวจว่าอยู่เครือข่ายเดียวกันและสื่อสารได้หรือไม่" },
        { title: "Service Desk Scenario", icon: "fa-headset", action: "รับ Ticket จำลอง เลือก Priority บันทึกวิธีแก้ และปิดงาน", outcome: "ให้คะแนนความครบถ้วนของการจัดการ Ticket" },
        { title: "Backup & Restore Lab", icon: "fa-database", action: "เลือกไฟล์/วันที่สำรอง และลำดับการกู้คืนจากเหตุการณ์จำลอง", outcome: "แสดงว่ากู้ข้อมูลที่ต้องการได้หรือไม่" },
        { title: "Security Awareness Lab", icon: "fa-shield-halved", action: "ตัดสินใจจากเหตุการณ์ เช่น อีเมลน่าสงสัยหรือคำขอสิทธิ์เข้าถึง", outcome: "ให้ผลตอบกลับพร้อมคำอธิบายแนวปฏิบัติที่ถูกต้อง" }
    ];

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
        const userChip = actions.querySelector(".user-chip");
        actions.insertBefore(button, userChip || null);
    }

    function render() {
        const labContent = key === "lab" ? `<div class="interactive-lab__heading"><div><p>SIMULATION CATALOG</p><h4>Choose a practical IT scenario</h4></div><div class="interactive-lab__heading-actions"><span>${labs.length} labs</span><a href="learning-hub.html"><i class="fa-solid fa-arrow-left"></i> Back</a></div></div><div class="interactive-lab__grid">${labs.map((lab) => lab.route ? `<a class="interactive-lab__card interactive-lab__card--link" href="${UI.escapeHtml(lab.route)}"${lab.newTab ? ' target="_blank" rel="noopener noreferrer"' : ""}><span class="interactive-lab__icon"><i class="fa-solid ${lab.icon}"></i></span><h5>${UI.escapeHtml(lab.title)}</h5><dl><div><dt>User activity</dt><dd>${UI.escapeHtml(lab.action)}</dd></div><div><dt>System feedback</dt><dd>${UI.escapeHtml(lab.outcome)}</dd></div></dl><span class="interactive-lab__status">Open lab <i class="fa-solid fa-arrow-right"></i></span></a>` : `<article class="interactive-lab__card"><span class="interactive-lab__icon"><i class="fa-solid ${lab.icon}"></i></span><h5>${UI.escapeHtml(lab.title)}</h5><dl><div><dt>User activity</dt><dd>${UI.escapeHtml(lab.action)}</dd></div><div><dt>System feedback</dt><dd>${UI.escapeHtml(lab.outcome)}</dd></div></dl><span class="interactive-lab__status"><i class="fa-regular fa-clock"></i> Lab coming next</span></article>`).join("")}</div>` : `<div class="learning-topic-page__body"><article class="learning-topic-page__card"><h4>Learning workspace</h4><p>${UI.escapeHtml(page.primary)}</p><div class="learning-topic-page__empty"><span><i class="fa-regular fa-folder-open"></i><br>Content will appear here as it is added.</span></div></article><aside class="learning-topic-page__card"><h4>Suggested first topics</h4><ul>${page.examples.map((item) => `<li>${UI.escapeHtml(item)}</li>`).join("")}</ul></aside></div>`;
        const hero = key === "lab" ? "" : `<header class="learning-topic-page__hero"><a class="learning-topic-page__back" href="learning-hub.html"><i class="fa-solid fa-arrow-left"></i> IT Learning Hub</a><span class="learning-topic-page__icon"><i class="fa-solid ${page.icon}"></i></span><h3>${UI.escapeHtml(page.title)}</h3><p>${UI.escapeHtml(page.summary)}</p></header>`;
        document.getElementById("viewContainer").innerHTML = `<section class="learning-topic-page learning-topic-page--${page.tone}">${hero}${labContent}</section>`;
    }

    async function bootstrap() {
        ensureExportButton();
        const shell = await AppShell.init({ currentView: "learningHub", title: page.title, eyebrow: "IT Learning Hub", searchPlaceholder: "Search learning topics", onRefresh: render });
        if (!shell) return;
        render();
    }
    bootstrap();
})();
