(() => {
  // src/data/wiringStandards.js
  var wires = [
    { id: "wo", name: "White / Orange", short: "W/O", color: "#ed963d", stripe: true, pair: 0 },
    { id: "o", name: "Orange", short: "O", color: "#ed963d", pair: 0 },
    { id: "wg", name: "White / Green", short: "W/G", color: "#4eac78", stripe: true, pair: 1 },
    { id: "g", name: "Green", short: "G", color: "#4eac78", pair: 1 },
    { id: "wb", name: "White / Blue", short: "W/BL", color: "#51a5ed", stripe: true, pair: 2 },
    { id: "b", name: "Blue", short: "BL", color: "#51a5ed", pair: 2 },
    { id: "wbr", name: "White / Brown", short: "W/BR", color: "#ad7957", stripe: true, pair: 3 },
    { id: "br", name: "Brown", short: "BR", color: "#ad7957", pair: 3 }
  ];
  var standards = {
    T568B: ["wo", "o", "wg", "b", "wb", "g", "wbr", "br"],
    T568A: ["wg", "g", "wo", "b", "wb", "o", "wbr", "br"]
  };
  var wireById = (id) => wires.find((w) => w.id === id);

  // src/simulation/CableModel.js
  var CableModel = class {
    constructor(standard = "T568B", mode = "learn") {
      this.standard = standard;
      this.mode = mode;
      this.stage = 0;
      this.pairs = /* @__PURE__ */ new Set();
      this.slots = Array(8).fill(null);
      this.trimmed = false;
      this.inserted = false;
      this.crimped = false;
      this.loaded = false;
      this.connected = [false, false];
      this.fault = "none";
      this.mistakes = 0;
      this.startedAt = null;
      this.finishedAt = null;
    }
    start(now = Date.now()) {
      this.startedAt ?? (this.startedAt = now);
    }
    get elapsed() {
      return this.startedAt ? Math.floor(((this.finishedAt ?? Date.now()) - this.startedAt) / 1e3) : 0;
    }
    place(id, slot) {
      if (this.stage !== 2 || !wireById(id) || slot < 0 || slot > 7) return false;
      const old = this.slots.indexOf(id);
      const displaced = this.slots[slot];
      if (old !== -1) this.slots[old] = displaced;
      this.slots[slot] = id;
      return true;
    }
    advance() {
      const ready = [true, this.pairs.size === 4, this.slots.every(Boolean), this.trimmed, this.inserted, this.crimped, false][this.stage];
      if (ready) {
        this.stage++;
        return true;
      }
      return false;
    }
  };
  function evaluateCable(model2) {
    const reference = standards[model2.standard];
    const terminated = model2.trimmed && model2.inserted && model2.crimped;
    const rows = model2.slots.map((id, i) => ({ pin: i + 1, targets: terminated && id ? [reference.indexOf(id) + 1].filter((n) => n > 0) : [] }));
    if (model2.fault === "open") rows[2].targets = [];
    if (model2.fault === "short" && terminated) {
      const joined = [.../* @__PURE__ */ new Set([...rows[0].targets, ...rows[1].targets])].sort();
      rows[0].targets = [...joined];
      rows[1].targets = [...joined];
    }
    const mapping = rows.map((r) => r.targets.length === 1 ? r.targets[0] : null);
    const faults = [];
    if (rows.some((r) => !r.targets.length)) faults.push("Open circuit");
    if (rows.some((r) => r.targets.length > 1)) faults.push("Short circuit");
    const wrong = rows.filter((r) => r.targets.length !== 1 || r.targets[0] !== r.pin);
    if (mapping.every((v, i) => v === 8 - i)) faults.push("Reversed conductors");
    else if (mapping.join(",") === "3,6,1,4,5,2,7,8") faults.push("Crossed pairs (A/B crossover)");
    else if (wrong.some((r) => r.targets.length === 1 && r.targets[0] !== r.pin)) {
      const pairs = [[1, 2], [3, 6], [4, 5], [7, 8]];
      const reversed = pairs.some(([a, b]) => mapping[a - 1] === b && mapping[b - 1] === a);
      faults.push(reversed ? "Reversed pair" : "Miswire / crossed wires");
    }
    const correct = 8 - wrong.length;
    return { pass: wrong.length === 0 && terminated, rows, faults, correct, score: Math.max(0, Math.round(correct / wires.length * 100) - model2.mistakes * 2) };
  }

  // src/simulation/DragController.js
  var DragController = class {
    constructor(svg, handlers) {
      this.svg = svg;
      this.handlers = handlers;
      svg.addEventListener("pointerdown", (e) => this.down(e));
      svg.addEventListener("pointermove", (e) => this.move(e));
      svg.addEventListener("pointerup", (e) => this.end(e));
      svg.addEventListener("pointercancel", (e) => this.end(e, true));
      svg.addEventListener("lostpointercapture", (e) => {
        if (this.active) this.end(e, true);
      });
    }
    point(e) {
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(this.svg.getScreenCTM().inverse());
      return { x: p.x, y: p.y };
    }
    down(e) {
      if (this.active || e.button !== 0) return;
      const target = e.target.closest("[data-drag]");
      if (!target) return;
      const p = this.point(e);
      const data = { kind: target.dataset.drag, id: target.dataset.id, start: p, p, pointerId: e.pointerId };
      if (this.handlers.start(data) === false) return;
      this.active = data;
      this.svg.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
    move(e) {
      if (!this.active || e.pointerId !== this.active.pointerId) return;
      this.active.p = this.point(e);
      this.handlers.move(this.active);
    }
    end(e, cancel = false) {
      if (!this.active || e.pointerId !== this.active.pointerId) return;
      const a = this.active;
      this.active = null;
      a.p = this.point(e);
      this.handlers.end(a, cancel);
      if (this.svg.hasPointerCapture(e.pointerId)) this.svg.releasePointerCapture(e.pointerId);
    }
  };

  // src/simulation/WirePhysics.js
  function wirePath(x, y, originX = 477, originY = 430) {
    return `M ${originX} ${originY} C ${originX} ${originY - 105}, ${x} ${y + 100}, ${x} ${y}`;
  }
  function twistedPath(x, index, spread) {
    const phase = index % 2 ? Math.PI : 0;
    let d = `M ${477 + (index - 3.5) * 2} 435`;
    for (let n = 0; n <= 45; n++) {
      const t = n / 45, y = 430 - t * 210;
      const center = 477 + (x - 477) * Math.min(1, t * 2.5);
      d += ` L ${center + Math.sin(t * Math.PI * 8 + phase) * 11 * spread} ${y}`;
    }
    return d;
  }

  // src/components/Equipment.js
  var defs = `<defs>
 <linearGradient id="jacket" x1="0" x2="1"><stop stop-color="#174b78"/><stop offset=".27" stop-color="#397eb5"/><stop offset=".48" stop-color="#5e9cc9"/><stop offset=".7" stop-color="#2f6da0"/><stop offset="1" stop-color="#163c65"/></linearGradient>
 <linearGradient id="steel" x2=".8" y2="1"><stop stop-color="#d8e3eb"/><stop offset=".35" stop-color="#718397"/><stop offset=".5" stop-color="#c1cdd5"/><stop offset="1" stop-color="#394c60"/></linearGradient>
 <linearGradient id="rubber" x2="1" y2=".4"><stop stop-color="#263b4a"/><stop offset=".4" stop-color="#506574"/><stop offset="1" stop-color="#172934"/></linearGradient>
 <linearGradient id="gold"><stop stop-color="#86642f"/><stop offset=".5" stop-color="#f7d681"/><stop offset="1" stop-color="#b68b35"/></linearGradient>
 <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#83b1b8" stroke-opacity=".08"/></pattern>
 <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#000" flood-opacity=".35"/></filter>
 </defs>`;
  function tool(type, x, y, active = false, close = 0) {
    const common = `transform="translate(${x} ${y})" ${active ? `data-drag="tool" data-id="${type}"` : ""} class="equipment ${active ? "draggable" : ""}"`;
    if (type === "stripper") return `<g ${common}><title>Cable stripper \u2014 drag onto jacket and pull upward</title><g filter="url(#shadow)"><path d="M-32-48 Q-42-53-45-31 L-44 62 Q-43 83-20 80 L24 70 Q43 66 40 44 L34-36 Q33-53 14-53Z" fill="#d2aa4e" stroke="#f4d278" stroke-width="2"/><path d="M-25-32H20V5H-25Z" rx="6" fill="#182a36"/><path d="M-25-18H20" stroke="url(#steel)" stroke-width="9"/><circle cy="39" r="20" fill="#172b38" stroke="#a17b34" stroke-width="5"/><path d="M-32 4V22M31 4V22" stroke="#745a29" stroke-width="3"/><text y="-34" class="tool-label" text-anchor="middle">STRIP</text></g></g>`;
    return `<g ${common}><title>Wire cutter \u2014 sweep from left to right across cut line</title><g filter="url(#shadow)"><path d="M-6 10L-34-44L-29-65L0-32L29-65L34-44L6 10Z" fill="url(#steel)" stroke="#9fb0bd" stroke-width="2"/><g transform="rotate(${close * -14})"><path d="M-9 0Q-32 35-39 91" stroke="#17222c" stroke-width="23" fill="none"/><path d="M-9 0Q-32 35-39 91" stroke="#dc784b" stroke-width="16" fill="none" stroke-linecap="round"/></g><g transform="rotate(${close * 14})"><path d="M9 0Q32 35 39 91" stroke="#17222c" stroke-width="23" fill="none"/><path d="M9 0Q32 35 39 91" stroke="#dc784b" stroke-width="16" fill="none" stroke-linecap="round"/></g><circle r="11" fill="url(#steel)" stroke="#293e50" stroke-width="3"/><path d="M-5 0H5" stroke="#263b4a" stroke-width="2"/></g></g>`;
  }
  function connector(x, y, slots = [], crimped = false, drag = "", scale = 1) {
    return `<g transform="translate(${x} ${y}) scale(${scale})" ${drag ? `data-drag="${drag}"` : ""} class="${drag ? "draggable" : ""}"><title>RJ45 connector, contacts facing you</title><rect x="-61" y="-64" width="122" height="148" rx="9" fill="#bedee9" fill-opacity=".11" stroke="#b3d3dd" stroke-width="2"/><path d="M-45-64V-79H45V-64M-29 84V110H29V84" fill="#b4d5e1" fill-opacity=".13" stroke="#83a5b6" stroke-width="2"/>${Array.from({ length: 8 }, (_, i) => {
      const w = wireById(slots[i]);
      const px = -45 + i * 13;
      return `<rect x="${px - 5}" y="-48" width="10" height="114" rx="3" fill="#8cabb5" fill-opacity=".1" stroke="#a6c4cf" stroke-opacity=".25"/>${w ? `<path d="M${px} 78V-34" stroke="${w.color}" stroke-width="7"/>${w.stripe ? `<path d="M${px} 78V-34" stroke="#eaf0e9" stroke-width="7" stroke-dasharray="9 9"/>` : ""}` : ""}<rect x="${px - 4}" y="${crimped ? -48 : -59}" width="8" height="28" rx="2" fill="url(#gold)"/><text x="${px}" y="-87" class="pin-label" text-anchor="middle">${i + 1}</text>`;
    }).join("")}<path d="M-54 57V-53H-28M53-51V55" fill="none" stroke="#e1f5fc" stroke-opacity=".42" stroke-width="3"/><path d="M-47 67H47" stroke="#b9d6df" stroke-width="5" opacity=".4"/></g>`;
  }
  function crimper(x, y, progress = 0) {
    return `<g transform="translate(${x} ${y})" filter="url(#shadow)"><path d="M-87-65H78L96 28L46 83H-58L-96 25Z" fill="url(#steel)" stroke="#8396a8" stroke-width="3"/><rect x="-53" y="-39" width="106" height="78" rx="6" fill="#101d29" stroke="#43586a" stroke-width="7"/><path d="M-45-38H45V-22H-45Z" fill="#728593"/><text y="-49" text-anchor="middle" class="tool-label">8P8C \xB7 RATCHET</text><circle cx="-65" cy="38" r="10" fill="#3c5264"/><circle cx="65" cy="38" r="10" fill="#3c5264"/><g transform="rotate(${-progress * 18} -42 60)"><path d="M-42 60L-87 233" stroke="#111d28" stroke-width="44" stroke-linecap="round"/><path d="M-42 75L-87 233" stroke="#368da7" stroke-width="32" stroke-linecap="round"/></g><g data-drag="handle" class="draggable" transform="rotate(${progress * 18} 42 60)"><title>Hold or drag handle inward to crimp</title><path d="M42 60L87 233" stroke="#111d28" stroke-width="44" stroke-linecap="round"/><path d="M42 75L87 233" stroke="#368da7" stroke-width="32" stroke-linecap="round"/><path d="M63 135L84 215" stroke="#73c1ca" stroke-width="3"/></g></g>`;
  }
  function tester(x, title, connected, activePins = [], bad = false) {
    return `<g transform="translate(${x} 155)"><rect x="-90" y="-65" width="180" height="300" rx="20" fill="url(#rubber)" stroke="#6d8390" stroke-width="2" filter="url(#shadow)"/><rect x="-56" y="-67" width="112" height="58" rx="4" fill="#0a141e" stroke="${connected ? "#65d5b5" : "#9bafbb"}" stroke-width="3"/>${Array.from({ length: 8 }, (_, i) => `<path d="M${-37 + i * 11}-59V-38" stroke="url(#gold)" stroke-width="5"/>`).join("")}<text y="25" text-anchor="middle" class="device-name">${title}</text><text y="44" text-anchor="middle" class="device-sub">LAN CABLE TESTER</text>${Array.from({ length: 8 }, (_, i) => `<text x="-31" y="${77 + i * 19}" class="pin-label">${i + 1}</text><circle cx="13" cy="${73 + i * 19}" r="5" fill="${activePins.includes(i + 1) ? bad ? "#f3ad65" : "#6cf1bb" : "#172e32"}" stroke="#718b87" stroke-width="1" ${activePins.includes(i + 1) ? 'class="led-on"' : ""}/>`).join("")}<circle cx="60" cy="206" r="5" fill="#67c6b2"/><path d="M-72 216H-38M-72 222H-38" stroke="#162731" stroke-width="3"/></g>`;
  }

  // src/components/Workbench.js
  var slotX = (i) => 330 + i * 42;
  var home = (i) => ({ x: 300 + i * 50, y: 230 + i % 2 * 35 });
  var label = (x, y, text, cls = "bench-label") => `<text x="${x}" y="${y}" text-anchor="middle" class="${cls}">${text}</text>`;
  var Workbench = class {
    constructor(svg) {
      this.svg = svg;
    }
    render(m, v = {}) {
      const learn = m.mode === "learn", s = m.stage;
      let content = `<rect width="1000" height="650" rx="10" fill="#17343b"/><rect width="1000" height="650" fill="url(#grid)"/><path d="M25 65V25H65M935 25H975V65M25 585V625H65M935 625H975V585" fill="none" stroke="#658889" stroke-width="2"/>${label(100, 49, "ESD WORK MAT")}${label(880, 615, "CAT6 / UTP \xB7 23 AWG")}`;
      if (s < 5) {
        let offset = s === 4 ? v.offset ?? 0 : 0;
        content += `<g transform="translate(0 ${offset})">`;
        if (s > 0 || v.stripping) content += wires.map((w, i) => {
          const slot = m.slots.indexOf(w.id);
          let p = slot >= 0 ? { x: slotX(slot), y: m.trimmed ? 240 : 175 } : home(i);
          let d;
          if (s === 1 && !m.pairs.has(w.pair)) {
            p = { x: 340 + w.pair * 90 + (i % 2 ? 14 : -14), y: 220 };
            d = twistedPath(340 + w.pair * 90, i, 1);
          }
          if (v.wire?.id === w.id) {
            p = v.wire.p;
            d = null;
          }
          d ?? (d = wirePath(p.x, p.y, 477 + (i - 3.5) * 2, 435));
          return `<g ${s === 1 || s === 2 ? `data-drag="wire" data-id="${w.id}" class="draggable"` : ""}><title>${w.name}</title><path d="${d}" stroke="#0a2029" stroke-width="13" fill="none"/><path d="${d}" stroke="${w.color}" stroke-width="9" fill="none" stroke-linecap="round"/>${w.stripe ? `<path d="${d}" stroke="#f0eee4" stroke-width="9" stroke-dasharray="13 11" fill="none"/>` : ""}<path d="M${p.x} ${p.y}v-9" stroke="#d7a871" stroke-width="5"/><circle cx="${p.x}" cy="${p.y}" r="19" fill="transparent"/>${s < 3 ? label(p.x, p.y - 22, w.short, "wire-label") : ""}</g>`;
        }).join("");
        content += `<g ${s === 4 ? 'data-drag="cable" class="draggable"' : ""}><path d="M477 810V${s === 0 && !v.stripping ? 260 : 430}" stroke="#0d2637" stroke-width="56" fill="none"/><path d="M477 810V${s === 0 && !v.stripping ? 260 : 430}" stroke="url(#jacket)" stroke-width="48" fill="none"/><path d="M460 740V${s === 0 && !v.stripping ? 270 : 440}" stroke="#94c6e3" stroke-opacity=".23" stroke-width="3"/><text transform="translate(483 590) rotate(-90)" class="cable-print">CAT6 \xB7 UTP \xB7 250 MHz</text></g></g>`;
        if (s === 0) {
          if (learn) content += `<rect x="443" y="268" width="68" height="160" rx="7" class="target"/><path d="M477 401V294m-10 12 10-12 10 12" class="direction"/>${label(350, 340, "STRIP 25 mm")}`;
          content += `<path d="M451 420H503M451 275H503" stroke="#dbe4cf" stroke-width="2" stroke-dasharray="5 4"/>`;
          if (v.stripping) content += `<g class="sleeve-away"><rect x="453" y="265" width="48" height="165" rx="5" fill="url(#jacket)"/></g>`;
        }
        if (s === 2 || s === 3) {
          content += `<rect x="302" y="128" width="350" height="78" rx="10" fill="#0d252d" fill-opacity=".4" stroke="#54727b"/>`;
          content += Array.from({ length: 8 }, (_, i) => `<rect x="${slotX(i) - 15}" y="153" width="30" height="43" rx="4" fill="none" stroke="#83a9ac" stroke-dasharray="${m.slots[i] ? "0" : "3 4"}"/>${label(slotX(i), 145, i + 1, "pin-label")}`).join("");
          content += m.slots.map((id, i) => id ? `<circle cx="${slotX(i)}" cy="175" r="20" fill="transparent" ${s === 2 ? `data-drag="wire" data-id="${id}" class="draggable"` : ""}/>` : "").join("");
          if (s === 3) content += `<path d="M305 240H654" stroke="#f2c579" stroke-width="2" stroke-dasharray="7 6"/>${label(480, 105, "ALIGNMENT COMB \xB7 CONTACT VIEW")}${label(480, 280, "CUT LINE \xB7 SWEEP LEFT TO RIGHT")}`;
          if (s === 3 && m.trimmed) content += `<g class="offcuts">${m.slots.map((id, i) => {
            const w = wires.find((w2) => w2.id === id);
            return `<path d="M${slotX(i)} 175V234" stroke="${w.color}" stroke-width="9"/>${w.stripe ? `<path d="M${slotX(i)} 175V234" stroke="#f0eee4" stroke-width="9" stroke-dasharray="13 11"/>` : ""}`;
          }).join("")}</g>`;
        }
        if (s === 4) {
          content += `<g pointer-events="none"><path d="M310 60H644V210L515 300H439L310 210Z" fill="#b6e2ed" fill-opacity=".09" stroke="#a4cbd6" stroke-width="2"/><path d="M321 198V72H380M633 76V198" stroke="#e1f5fc" stroke-opacity=".4" stroke-width="3" fill="none"/>${Array.from({ length: 8 }, (_, i) => `<rect x="${slotX(i) - 10}" y="80" width="20" height="125" rx="4" fill="#cee9ef" fill-opacity=".04" stroke="#7ba6b2" stroke-opacity=".45"/><rect x="${slotX(i) - 7}" y="78" width="14" height="28" rx="2" fill="url(#gold)"/>${label(slotX(i), 49, i + 1, "pin-label")}`).join("")}<path d="M442 275H512" stroke="#a4cbd6" stroke-width="5" opacity=".5"/></g>`;
          if (learn) content += `${label(740, 360, "PUSH CABLE UP")}<path d="M570 420V330m-10 12 10-12 10 12" class="direction"/>`;
        }
        if (s === 0 || s === 3) {
          const type = s === 0 ? "stripper" : "cutter";
          content += `<rect x="750" y="80" width="165" height="255" rx="12" fill="#102831" stroke="#425e66"/>${label(832, 110, "TOOL TRAY")}`;
          content += tool(type, v.tool?.x ?? 832, v.tool?.y ?? 190, true, v.cutProgress ?? 0);
        }
      }
      if (s === 5) {
        const p = m.loaded ? { x: 680, y: 220 } : v.plug ?? { x: 340, y: 250 };
        content += `<path d="M${p.x} ${p.y + 75} C${p.x} 520 360 590 210 680" stroke="#102533" stroke-width="39" fill="none"/><path d="M${p.x} ${p.y + 75} C${p.x} 520 360 590 210 680" stroke="url(#jacket)" stroke-width="32" fill="none"/>`;
        content += crimper(680, 220, v.crimp ?? 0);
        content += connector(p.x, p.y, m.slots, m.crimped, m.loaded ? "" : "plug", 0.65);
        if (learn) content += m.loaded ? `${label(685, 535, "HOLD THE RIGHT HANDLE TO CRIMP")}` : `<rect x="631" y="174" width="98" height="94" rx="8" class="target"/>${label(480, 115, "DRAG THE PLUG INTO THE 8P8C DIE")}`;
        if (v.crimp > 0) content += `<rect x="585" y="570" width="190" height="6" rx="3" fill="#203b42"/><rect x="585" y="570" width="${190 * v.crimp}" height="6" rx="3" fill="#75d5be"/>`;
      }
      if (s === 6) {
        const a = m.connected[0] ? { x: 280, y: 130 } : v.testPlug?.id === "0" ? v.testPlug.p : { x: 310, y: 475 };
        const b = m.connected[1] ? { x: 720, y: 130 } : v.testPlug?.id === "1" ? v.testPlug.p : { x: 690, y: 475 };
        content += `<path d="M${a.x} ${a.y + 40}C${a.x} 650 ${b.x} 650 ${b.x} ${b.y + 40}" stroke="#102533" stroke-width="27" fill="none"/><path d="M${a.x} ${a.y + 40}C${a.x} 650 ${b.x} 650 ${b.x} ${b.y + 40}" stroke="url(#jacket)" stroke-width="21" fill="none"/>`;
        const row = v.result?.rows[v.led ?? -1];
        content += tester(280, "MASTER", m.connected[0], row ? [row.pin] : [], row && !(row.targets.length === 1 && row.targets[0] === row.pin));
        content += tester(720, "REMOTE", m.connected[1], row?.targets ?? [], row && !(row.targets.length === 1 && row.targets[0] === row.pin));
        content += `<g data-drag="testplug" data-id="0" class="draggable">${connector(a.x, a.y, m.slots, true, "", 0.55)}</g><g data-drag="testplug" data-id="1" class="draggable">${connector(b.x, b.y, standards[m.standard], true, "", 0.55)}</g>`;
        content += `${label(280, 425, "YOUR TERMINATION")}${label(720, 425, `${m.standard} REFERENCE END`)}`;
        if (v.running) content += label(500, 275, `SCANNING PIN ${(v.led ?? 0) + 1}`);
        else if (v.result) content += label(500, 275, v.result.pass ? "PASS" : "FAULT", "result-label");
        else content += label(500, 275, "CONNECT BOTH ENDS");
      }
      this.svg.innerHTML = defs + content;
    }
  };

  // src/data/trainingSteps.js
  var steps = [
    { title: "Strip the jacket", brief: "Expose the four twisted pairs", instruction: "Drag the stripper from the tool tray onto the marked jacket. Keep holding and pull upward along the cable to remove the sleeve.", tool: "Cable stripper", cue: "Engage at the bottom mark, then pull up 100 units." },
    { title: "Untwist the pairs", brief: "Separate all eight conductors", instruction: "Grab either wire tip in each twisted pair and pull it sideways. Separate all four pairs before arranging the conductors.", tool: "Your hands", cue: "Pull one tip at least 45 units sideways for each pair." },
    { title: "Arrange the wires", brief: "Build your eight-pin wire order", instruction: "Drag every wire tip into a numbered slot. Drop onto an occupied slot to swap wires. When satisfied, lock your arrangement.", tool: "Your hands", cue: "View: gold contacts facing you, latch on the back. Pins 1\u20138 run left to right." },
    { title: "Trim to length", brief: "Make a clean, even cut", instruction: "Drag the wire cutter to the left end of the cut line. Keep holding and sweep across all eight wires to the right.", tool: "Wire cutter", cue: "Follow the cut line from left to right without releasing." },
    { title: "Insert the connector", brief: "Seat the wires in all eight channels", instruction: "Grab the blue cable jacket and push upward into the clear RJ45 connector. The wire tips must reach the contacts.", tool: "RJ45 connector", cue: "Push the cable upward until it snaps into the connector." },
    { title: "Crimp the connector", brief: "Press the contacts into the wires", instruction: "Drag the connector into the crimper die. Then press and hold the lower handle, or drag it inward, to close the crimper.", tool: "RJ45 crimper", cue: "Seat the plug first. A full handle closure terminates all contacts." },
    { title: "Test your cable", brief: "Read the actual pin-to-pin connections", instruction: "Drag your plug into the MASTER port and the reference plug into REMOTE. Run the test and inspect the wiremap.", tool: "Cable tester", cue: "The reference end is factory-terminated to your selected standard." }
  ];

  // src/main.js
  document.querySelector("#app").innerHTML = `
  <header><a class="brand" href="./" aria-label="LAN Cable Lab home"><span class="brand-mark">\u25A5</span><span>LAN Cable Lab<small>INTERACTIVE NETWORK WORKSHOP</small></span></a>
  <div class="header-controls"><div class="segmented" aria-label="Training mode"><button id="learn" aria-pressed="true">Learning</button><button id="exam" aria-pressed="false">Exam mode</button></div><label class="standard-label">Standard <select id="standard"><option>T568B</option><option>T568A</option></select></label><button id="restart" class="secondary">\u21BB <span>Restart</span></button></div></header>
  <div class="breadcrumb">IT Knowledge Center <span>/</span> Interactive Lab <span>/</span> <strong>LAN Cable Lab</strong></div>
  <div class="intro"><div><div class="eyebrow">HANDS-ON LAB / 001</div><h1>A good connection starts here.</h1><p>Build it. Crimp it. Test it. Learn the craft of network cabling.</p></div><div class="session"><span class="status-dot"></span> LOCAL TRAINING SESSION</div></div>
  <main class="layout"><aside class="panel steps-panel"><div class="panel-heading">YOUR WORKFLOW <span id="step-count">01 / 07</span></div><div class="progress-track"><div id="progress"></div></div><ol id="steps"></ol><div class="session-card"><span class="eyebrow">SESSION DETAILS</span><dl><div><dt>Material</dt><dd>CAT6 \xB7 UTP</dd></div><div><dt>Connector</dt><dd>RJ45 / 8P8C</dd></div><div><dt>Target</dt><dd>Straight-through</dd></div></dl><p>Prepare one end. The other end is pre-terminated to the selected standard.</p></div></aside>
  <section class="workspace"><div class="workspace-top"><div><span class="live-dot"></span> WORKBENCH <span class="workspace-meta">01 \u2014 TERMINATION STATION</span></div><span id="stage-badge">STRIPPING</span></div>
  <div class="canvas-wrap"><svg id="bench" viewBox="0 0 1000 650" role="img" aria-label="Interactive cable workbench. Drag tools, wires and connectors to complete the active instruction."></svg></div>
  <div class="instruction"><span id="instruction-number">01</span><div><h2 id="instruction-title"></h2><p id="instruction-text"></p></div></div>
  <div class="action-row"><span id="gesture-hint"></span><button id="lock" class="primary" hidden>Lock arrangement \u2192</button><button id="test" class="primary" hidden>Run cable test \u2192</button></div>
  </section>
  <aside class="right-panel"><section class="panel"><div class="panel-heading">ON THE BENCH <span class="tiny-badge">4 TOOLS</span></div><div id="tools"></div></section>
  <section class="panel reference"><div class="panel-heading">PINOUT REFERENCE <span id="reference-standard">T568B</span></div><div id="reference"></div><p id="reference-note">Contacts facing you \xB7 latch behind<br>Read left to right, pins 1\u20138.</p></section>
  <section class="panel fault-panel"><div class="panel-heading">FAULT PRACTICE</div><label for="fault">Simulated cable damage</label><select id="fault"><option value="none">None \u2014 normal cable</option><option value="open">Open circuit at master pin 3</option><option value="short">Short between master pins 1 & 2</option></select><p>Optional damage is applied after termination. Wire-order faults come from your arrangement.</p></section></aside></main>
  <section class="feedback-bar" aria-live="polite"><span class="feedback-icon">i</span><p id="feedback">Welcome to the bench. Grab the stripper to get started.</p><div class="metrics"><span>TIME <strong id="timer">00:00</strong></span><span>MISTAKES <strong id="mistakes">0</strong></span></div></section>
  <section id="results" class="results panel" hidden aria-live="polite"></section>
  <footer><span>NETWORK FUNDAMENTALS <span class="footer-separator">/</span> Learn by doing.</span><span>Drag to interact <span class="footer-separator">\xB7</span> Mouse & touch supported</span></footer>
  <dialog id="reset-dialog"><h2>Start a fresh cable?</h2><p>Your current work and timer will be reset.</p><div><button id="cancel-reset" class="secondary">Keep working</button><button id="confirm-reset" class="primary">Start new session</button></div></dialog>`;
  var model = new CableModel();
  var visual = {};
  var busy = false;
  var generation = 0;
  var frame = 0;
  var holdFrame = 0;
  var pendingReset;
  var $ = (selector) => document.querySelector(selector);
  var bench = new Workbench($("#bench"));
  function feedback(message, error2 = false) {
    $("#feedback").textContent = message;
    $(".feedback-bar").classList.toggle("warning", error2);
  }
  function error(message) {
    model.mistakes++;
    $("#mistakes").textContent = model.mistakes;
    feedback(message, true);
  }
  function draw() {
    bench.render(model, visual);
  }
  function scheduleDraw() {
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      draw();
    });
  }
  function update() {
    const s = model.stage, step = steps[s];
    $("#steps").innerHTML = steps.map((t, i) => `<li class="${i < s ? "done" : i === s ? "current" : ""}" ${i === s ? 'aria-current="step"' : ""}><span class="step-index">${i < s ? "\u2713" : String(i + 1).padStart(2, "0")}</span><div><strong>${t.title}</strong><small>${t.brief}</small></div></li>`).join("");
    $("#step-count").textContent = `${String(s + 1).padStart(2, "0")} / 07`;
    $("#progress").style.width = `${s / 7 * 100}%`;
    $("#instruction-number").textContent = String(s + 1).padStart(2, "0");
    $("#instruction-title").textContent = step.title;
    $("#instruction-text").textContent = step.instruction;
    $("#gesture-hint").textContent = model.mode === "learn" ? step.cue : "Exam in progress \xB7 wiring hints are hidden.";
    $("#stage-badge").textContent = step.title.toUpperCase();
    $("#lock").hidden = s !== 2;
    $("#lock").disabled = !model.slots.every(Boolean) || busy;
    $("#test").hidden = s !== 6;
    $("#test").disabled = !model.connected.every(Boolean) || busy;
    $("#standard").disabled = model.startedAt !== null;
    $("#reference-standard").textContent = model.standard;
    $("#reference").innerHTML = model.mode === "learn" ? `<div class="pin-strip">${standards[model.standard].map((id, i) => {
      const w = wireById(id);
      return `<div><span>${i + 1}</span><i style="--wire:${w.color}" class="${w.stripe ? "striped" : ""}"></i></div>`;
    }).join("")}</div><ol class="wire-key">${standards[model.standard].map((id) => {
      const w = wireById(id);
      return `<li><i style="--wire:${w.color}" class="${w.stripe ? "striped" : ""}"></i>${w.name}</li>`;
    }).join("")}</ol>` : '<div class="exam-reference">REFERENCE HIDDEN<p>Work from memory.<br>Your result appears after testing.</p></div>';
    $("#reference-note").hidden = model.mode === "exam";
    $(".fault-panel").hidden = model.mode === "exam";
    $("#fault").disabled = busy || !!visual.result;
    $("#tools").innerHTML = [["01", "Cable stripper", "Expose the twisted pairs", 0], ["02", "Wire cutter", "Trim conductors evenly", 3], ["03", "RJ45 crimper", "Secure all eight contacts", 5], ["04", "Cable tester", "Verify electrical continuity", 6]].map(([n, title, desc, stage]) => `<div class="tool-card ${stage === s ? "active" : ""}"><span class="tool-number">${n}</span><div><strong>${title}</strong><small>${desc}</small></div>${stage === s ? '<span class="tool-active-dot"></span>' : ""}</div>`).join("");
    $("#learn").setAttribute("aria-pressed", model.mode === "learn");
    $("#exam").setAttribute("aria-pressed", model.mode === "exam");
    draw();
  }
  var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function next(message, delay = 350) {
    busy = true;
    const token = generation;
    feedback(message);
    update();
    await sleep(delay);
    if (token !== generation) return;
    model.advance();
    busy = false;
    visual = {};
    update();
  }
  function beginCrimp() {
    const start = performance.now(), token = generation;
    const tick = (now) => {
      if (token !== generation || !model.loaded || model.crimped) return;
      visual.crimp = Math.max(visual.crimp ?? 0, Math.min(1, (now - start) / 1400));
      draw();
      if (visual.crimp >= 1) finishCrimp();
      else holdFrame = requestAnimationFrame(tick);
    };
    holdFrame = requestAnimationFrame(tick);
  }
  function finishCrimp() {
    cancelAnimationFrame(holdFrame);
    if (model.crimped) return;
    model.crimped = true;
    visual.crimp = 1;
    draw();
    next("Crimp complete. All eight contacts are seated. Connect the cable to the tester.", 650);
  }
  new DragController($("#bench"), {
    start(a) {
      if (busy || visual.result) return false;
      const s = model.stage;
      const allowed = a.kind === "tool" && (s === 0 || s === 3) || a.kind === "wire" && (s === 1 || s === 2) || a.kind === "cable" && s === 4 || a.kind === "plug" && s === 5 && !model.loaded || a.kind === "handle" && s === 5 && model.loaded || a.kind === "testplug" && s === 6;
      if (!allowed) return false;
      model.start();
      $("#standard").disabled = true;
      if (a.kind === "tool") {
        visual.tool = a.p;
        a.engaged = false;
      }
      if (a.kind === "handle") beginCrimp();
      if (a.kind === "testplug") {
        model.connected[Number(a.id)] = false;
        visual.testPlug = { id: a.id, p: a.p };
        $("#test").disabled = true;
      }
      return true;
    },
    move(a) {
      if (busy || a.completed) return;
      const { x, y } = a.p;
      if (a.kind === "tool") {
        visual.tool = { x, y };
        if (model.stage === 0) {
          if (!a.engaged && Math.abs(x - 477) < 42 && y > 380 && y < 450) {
            a.engaged = true;
            a.engageY = y;
            feedback("Stripper engaged. Keep holding and pull upward.");
          }
          if (a.engaged && Math.abs(x - 477) > 65) {
            a.engaged = false;
            feedback("Keep the blade centered on the cable jacket.");
          }
          if (a.engaged && a.engageY - y > 105) {
            a.completed = true;
            visual.stripping = true;
            next("Jacket removed. Separate each twisted pair by dragging its wire tip sideways.", 650);
          }
        } else {
          const bladeY = y - 45;
          if (!a.engaged && x >= 280 && x <= 335 && Math.abs(bladeY - 240) < 32) {
            a.engaged = true;
            a.maxX = x;
            feedback("Cutting engaged. Sweep right across the entire bundle.");
          }
          if (a.engaged && Math.abs(bladeY - 240) > 45) {
            a.engaged = false;
            visual.cutProgress = 0;
          }
          if (a.engaged) {
            a.maxX = Math.max(a.maxX, x);
            visual.cutProgress = Math.min(1, (x - 305) / 350);
          }
          if (a.engaged && x >= 650) {
            a.completed = true;
            model.trimmed = true;
            visual.cutProgress = 1;
            next("A clean, even cut. Push the prepared cable into the transparent connector.", 650);
          }
        }
      }
      if (a.kind === "wire") visual.wire = { id: a.id, p: { x: Math.max(100, Math.min(900, x)), y: Math.max(85, Math.min(390, y)) } };
      if (a.kind === "cable") visual.offset = Math.max(-150, Math.min(0, y - a.start.y));
      if (a.kind === "plug") visual.plug = { x, y };
      if (a.kind === "testplug") visual.testPlug = { id: a.id, p: { x, y } };
      if (a.kind === "handle") {
        visual.crimp = Math.max(visual.crimp ?? 0, Math.min(1, (a.start.x - x) / 70));
        if (visual.crimp >= 1) finishCrimp();
      }
      scheduleDraw();
    },
    end(a, cancel) {
      cancelAnimationFrame(holdFrame);
      if (busy || a.completed) return;
      if (cancel) {
        visual = {};
        update();
        return;
      }
      const { x, y } = a.p;
      if (a.kind === "tool" && !a.completed) error(model.stage === 0 ? "Engage the stripper at the lower mark, then pull straight upward." : "Place the cutter jaws on the left cut mark, then sweep right across all wires.");
      if (a.kind === "wire") {
        const wire = wireById(a.id);
        if (model.stage === 1) {
          if (Math.abs(x - a.start.x) >= 45) {
            model.pairs.add(wire.pair);
            feedback(`${model.pairs.size} / 4 pairs separated.`);
            if (model.pairs.size === 4) next("All four pairs are untwisted. Arrange the eight conductors.");
          } else feedback("Pull the wire tip farther sideways to untwist its pair.");
        } else {
          const slot = Math.round((x - 330) / 42);
          if (slot >= 0 && slot < 8 && Math.abs(x - slotX(slot)) < 24 && y > 125 && y < 215) {
            model.place(a.id, slot);
            feedback(model.mode === "learn" ? standards[model.standard][slot] === a.id ? `${wire.name} placed in pin ${slot + 1}.` : `${wire.name} is in pin ${slot + 1}. Compare it with the reference; you can rearrange it.` : `Conductor placed in pin ${slot + 1}.`);
          } else error("Drop the wire tip inside one of the eight numbered slots.");
        }
      }
      if (a.kind === "cable") {
        if (y - a.start.y <= -140 && Math.abs(x - a.start.x) < 100) {
          model.inserted = true;
          visual.offset = -150;
          next("All conductors are seated. Drag the connector into the crimping die.", 600);
        } else error("Push the jacket straight up until the wire ends reach the contacts.");
      }
      if (a.kind === "plug") {
        if (Math.abs(x - 680) < 65 && Math.abs(y - 220) < 65) {
          model.loaded = true;
          feedback("Connector seated. Hold the right handle to complete the crimp.");
        } else error("Place the connector inside the rectangular 8P8C crimping die.");
      }
      if (a.kind === "handle" && !model.crimped) {
        visual.crimp = 0;
        feedback("Crimp not complete. Hold the handle until it closes fully.");
      }
      if (a.kind === "testplug") {
        const idx = Number(a.id), target = idx === 0 ? 280 : 720;
        if (Math.abs(x - target) < 65 && y > 80 && y < 185) {
          model.connected[idx] = true;
          feedback(model.connected.every(Boolean) ? "Both ends connected. Run the test to check all eight circuits." : `${idx === 0 ? "Master" : "Remote"} connected. Connect the other plug.`);
        } else error("Insert this plug into its matching tester port at the top of the unit.");
      }
      if (!busy) visual = {};
      update();
    }
  });
  $("#lock").addEventListener("click", () => {
    if (model.stage === 2 && model.slots.every(Boolean) && !busy) next("Arrangement locked without correction. Trim the conductors to length.");
  });
  $("#test").addEventListener("click", async () => {
    if (busy || !model.connected.every(Boolean)) return;
    const token = generation;
    busy = true;
    model.fault = $("#fault").value;
    const result = evaluateCable(model);
    visual = { result, running: true, led: 0 };
    update();
    feedback("Testing continuity. Watch the master and remote LED sequence.");
    for (let i = 0; i < 8; i++) {
      if (token !== generation) return;
      visual.led = i;
      draw();
      await sleep(550);
    }
    if (token !== generation) return;
    busy = false;
    visual.running = false;
    visual.led = -1;
    model.finishedAt = Date.now();
    showResults(result);
    update();
    $("#test").textContent = "Test again";
    $("#progress").style.width = "100%";
  });
  function showResults(result) {
    $("#results").hidden = false;
    $("#results").innerHTML = `<div class="result-heading"><div><div class="eyebrow">CABLE DIAGNOSTICS \xB7 ${model.standard}</div><h2 class="${result.pass ? "pass" : "fail"}">${result.pass ? "PASS \u2014 Straight-through connection" : "FAIL \u2014 " + result.faults.join(" \xB7 ")}</h2><p>${result.correct} of 8 circuits connect to the correct pin. ${model.fault !== "none" ? "Includes your selected simulated cable damage." : ""}</p></div><div class="score">${result.score}<small>/ 100 ${model.mode === "exam" ? "EXAM SCORE" : "PRACTICE SCORE"}</small></div></div><div class="wiremap">${result.rows.map((r) => `<div class="${r.targets.length === 1 && r.targets[0] === r.pin ? "correct" : "incorrect"}"><small>MASTER</small><strong>${r.pin}<span>\u2192</span>${r.targets.length ? r.targets.join(" + ") : "OPEN"}</strong><small>REMOTE</small></div>`).join("")}</div><p class="result-note">Time: ${formatTime(model.elapsed)} \xB7 Interaction mistakes: ${model.mistakes}. Score = correct circuits \xF7 8 \xD7 100, minus 2 per invalid drop (minimum 0). ${result.pass ? "" : "Restart to prepare a new cable and correct the fault."} This continuity model does not certify bandwidth, crosstalk, or real-world installation quality.</p><button id="retry" class="secondary">Prepare another cable \u2192</button>`;
    $("#retry").addEventListener("click", () => requestReset());
    feedback(result.pass ? "All eight circuits verified. Your cable is correctly terminated." : "Test complete. Inspect the actual pin mapping below.", !result.pass);
  }
  function formatTime(seconds) {
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }
  function reset(standard = model.standard, mode = model.mode) {
    generation++;
    cancelAnimationFrame(holdFrame);
    model = new CableModel(standard, mode);
    visual = {};
    busy = false;
    $("#standard").value = standard;
    $("#fault").value = "none";
    $("#results").hidden = true;
    $("#mistakes").textContent = "0";
    $("#timer").textContent = "00:00";
    $("#test").textContent = "Run cable test \u2192";
    feedback(mode === "exam" ? "Exam ready. Timer starts with your first interaction. Complete a straight-through cable." : "Welcome to the bench. Grab the stripper to get started.");
    update();
  }
  function requestReset(standard = model.standard, mode = model.mode) {
    if (!model.startedAt) {
      reset(standard, mode);
      return;
    }
    pendingReset = { standard, mode };
    $("#reset-dialog").showModal();
  }
  $("#restart").addEventListener("click", () => requestReset());
  $("#learn").addEventListener("click", () => {
    if (model.mode !== "learn") requestReset(model.standard, "learn");
  });
  $("#exam").addEventListener("click", () => {
    if (model.mode !== "exam") requestReset(model.standard, "exam");
  });
  $("#standard").addEventListener("change", (e) => requestReset(e.target.value));
  $("#cancel-reset").addEventListener("click", () => $("#reset-dialog").close());
  $("#confirm-reset").addEventListener("click", () => {
    $("#reset-dialog").close();
    reset(pendingReset.standard, pendingReset.mode);
  });
  setInterval(() => {
    $("#timer").textContent = formatTime(model.elapsed);
  }, 250);
  update();
})();
