/* ==========================================================================
   ICML 2026 poster website — interactions
   No dependencies. Everything is progressive: the page reads fine without JS.
   ========================================================================== */
(() => {
  "use strict";

  /* ------------------------------------------------------------------------
     DATA — edit here.
     Means are the values printed on the poster. The ± spreads were read off
     the poster figures by eye, so they are only used to draw the whiskers.
     Once you have the exact spreads, put them in and set SHOW_SPREAD_NUMBERS
     to true so tooltips and tables print "mean ± spread".
     ------------------------------------------------------------------------ */
  const SHOW_SPREAD_NUMBERS = false;

  const VARIANTS = [
    { id: "dt",  name: "DT",       full: "Decision Transformer", hex: "#2c86b0", shape: "diamond",
      desc: "Baseline: the action head sees only the hidden state h<sub>t</sub>. No belief is predicted." },
    { id: "par", name: "Parallel", full: "Parallel Two-Head",    hex: "#c08a2a", shape: "triangle",
      desc: "The belief is predicted from h<sub>t</sub> as an auxiliary task, but the action head does not use it." },
    { id: "cpl", name: "Coupled",  full: "Coupled Two-Head",     hex: "#1f8f5f", shape: "circle", proposed: true,
      desc: "Proposed: the action head is conditioned on both h<sub>t</sub> and the predicted belief <span class=\"bhat\">b</span><sub>t</sub>." },
    { id: "str", name: "Strict",   full: "Strict Bottleneck",    hex: "#a8323f", shape: "square",
      desc: "The action head sees only the predicted belief <span class=\"bhat\">b</span><sub>t</sub>: a strict information bottleneck." },
  ];
  const V = Object.fromEntries(VARIANTS.map((v) => [v.id, v]));

  // Offline results (standard test set): [mean, spread]
  const OFFLINE = {
    mse:  { label: "Val. action MSE", better: "lower",  dp: 3,
            values: { dt: [0.021, 0.006], par: [0.020, 0.005], cpl: [0.017, 0.004], str: [0.024, 0.007] } },
    rcr:  { label: "RCR", better: "higher", dp: 2,
            values: { dt: [0.72, 0.11], par: [0.73, 0.10], cpl: [0.78, 0.09], str: [0.69, 0.12] } },
    viol: { label: "Boundary violations", better: "lower", dp: 1,
            values: { dt: [8.4, 2.7], par: [8.0, 2.5], cpl: [6.3, 2.1], str: [9.1, 3.0] } },
  };

  // Online belief correction (shifted test set, gamma-ray noise doubled): RCR [mean, spread]
  // null spread = not readable from the figure (whisker not drawn).
  const ONLINE = {
    p: [0, 0.05, 0.10, 0.20],
    series: {
      cpl: [[0.66, 0.09], [0.69, 0.08], [0.72, 0.08], [0.75, null]],
      str: [[0.58, 0.11], [0.64, 0.10], [0.70, 0.09], [0.76, 0.08]],
      dt:  [[0.61, 0.10], null, null, null], // no belief, so nothing to correct
    },
  };
  const ONLINE_ORDER = ["cpl", "str", "dt"];

  /* ------------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------------ */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fmt = (v, dp) => v.toFixed(dp);
  const valText = (mean, sd, dp) =>
    SHOW_SPREAD_NUMBERS && sd != null ? `${fmt(mean, dp)} ± ${fmt(sd, dp)}` : fmt(mean, dp);

  function shape(kind, cx, cy, r) {
    switch (kind) {
      case "square": { const s = r * 0.88; return `<rect x="${cx - s}" y="${cy - s}" width="${2 * s}" height="${2 * s}" rx="1.5"/>`; }
      case "diamond": { const d = r * 1.22; return `<path d="M${cx},${cy - d}L${cx + d},${cy}L${cx},${cy + d}L${cx - d},${cy}Z"/>`; }
      case "triangle": { const t = r * 1.22; return `<path d="M${cx},${cy - t}L${cx + t},${cy + t * 0.78}L${cx - t},${cy + t * 0.78}Z"/>`; }
      default: return `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
    }
  }
  const swatch = (v, size = 12) =>
    `<svg viewBox="0 0 12 12" width="${size}" height="${size}" aria-hidden="true"><g fill="${v.hex}">${shape(v.shape, 6, 6, 4.6)}</g></svg>`;

  function niceTicks(lo, hi, count) {
    const raw = (hi - lo) / count;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / pow;
    const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * pow;
    const out = [];
    for (let v = Math.floor(lo / step) * step; v <= hi + step * 0.999; v += step) out.push(+v.toFixed(10));
    if (out[out.length - 1] < hi) out.push(+(out[out.length - 1] + step).toFixed(10));
    return out;
  }

  const toastEl = $("#toast");
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("on"), 1800);
  }
  async function copyText(text, msg = "Copied") {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) { /* ignore */ }
      ta.remove();
    }
    toast(msg);
  }

  // Tooltip
  const tip = $("#tip");
  function showTip(html, evt) {
    tip.innerHTML = html;
    tip.classList.add("on");
    moveTip(evt);
  }
  function moveTip(evt) {
    if (!evt) return;
    const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
    let x = evt.clientX + pad, y = evt.clientY + pad;
    if (x + w > window.innerWidth - 8) x = evt.clientX - w - pad;
    if (y + h > window.innerHeight - 8) y = evt.clientY - h - pad;
    tip.style.left = Math.max(8, x) + "px";
    tip.style.top = Math.max(8, y) + "px";
  }
  const hideTip = () => tip.classList.remove("on");

  /* ------------------------------------------------------------------------
     Shared state: the selected variant links §3 and §4
     ------------------------------------------------------------------------ */
  const state = { selected: "cpl", hover: null, pIdx: 0, hidden: new Set() };
  const listeners = [];
  const onChange = (fn) => listeners.push(fn);
  function setSelected(id) {
    if (!V[id]) return;
    state.selected = id;
    listeners.forEach((fn) => fn("selected"));
  }
  function setHover(id) {
    if (state.hover === id) return;
    state.hover = id;
    applyHover();
  }

  /* ------------------------------------------------------------------------
     Navigation: progress bar, current section, reveal on scroll
     ------------------------------------------------------------------------ */
  const bar = $(".progress i");
  function onScroll() {
    const h = document.documentElement;
    const max = h.scrollHeight - h.clientHeight;
    bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + "%";
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const navLinks = $$(".toc a");
  if ("IntersectionObserver" in window) {
    const secObs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        navLinks.forEach((a) => a.classList.toggle("is-current", a.dataset.sec === e.target.id));
        // keep the current pill visible in the (horizontally scrollable) nav,
        // without scrolling the page itself
        const cur = navLinks.find((a) => a.dataset.sec === e.target.id);
        const strip = cur && cur.parentElement;
        if (strip && strip.scrollWidth > strip.clientWidth) {
          const l = cur.offsetLeft - strip.offsetLeft, r = l + cur.offsetWidth;
          if (l < strip.scrollLeft) strip.scrollLeft = l - 8;
          else if (r > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = r - strip.clientWidth + 8;
        }
      });
    }, { rootMargin: "-35% 0px -60% 0px" });
    $$(".sec, .bridge").forEach((s) => secObs.observe(s));

    const revObs = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); revObs.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    $$(".reveal").forEach((el) => revObs.observe(el));
  } else {
    $$(".reveal").forEach((el) => el.classList.add("in"));
  }

  /* ------------------------------------------------------------------------
     Dialogs: poster lightbox + BibTeX
     ------------------------------------------------------------------------ */
  $$("[data-open]").forEach((btn) => btn.addEventListener("click", () => {
    const dlg = document.getElementById(btn.dataset.open);
    if (!dlg) return;
    const lazy = $("img[data-src]", dlg);
    if (lazy) { lazy.src = lazy.dataset.src; lazy.removeAttribute("data-src"); }
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  }));
  $$("dialog").forEach((dlg) => {
    $$("[data-close]", dlg).forEach((b) => b.addEventListener("click", () => dlg.close()));
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  });
  const posterView = $("#posterView");
  posterView.addEventListener("click", (e) => {
    const zoomed = posterView.classList.toggle("zoomed");
    if (zoomed) {
      const img = $("img", posterView);
      const r = img.getBoundingClientRect();
      const fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
      requestAnimationFrame(() => {
        posterView.scrollLeft = fx * img.scrollWidth - posterView.clientWidth / 2;
        posterView.scrollTop = fy * img.scrollHeight - posterView.clientHeight / 2;
      });
    }
  });
  $("#copyBib").addEventListener("click", () => copyText($("#bibtex").textContent, "BibTeX copied"));

  // Copy buttons on references
  $$("#refs li").forEach((li) => {
    const text = li.textContent.trim();
    const b = document.createElement("button");
    b.type = "button"; b.className = "copy-ref"; b.textContent = "copy";
    b.setAttribute("aria-label", "Copy reference");
    b.addEventListener("click", () => copyText(text, "Reference copied"));
    li.append(" ", b);
  });

  /* ------------------------------------------------------------------------
     §2 Formulation: link the tuple symbols and the chevrons
     ------------------------------------------------------------------------ */
  const chevWrap = $("#chevrons");
  const fEls = $$(".f-el");
  const chevItems = $$(".chev-item");
  let pinnedK = null;
  function focusK(k) {
    chevWrap.classList.toggle("has-focus", !!k);
    chevItems.forEach((it) => it.classList.toggle("is-on", it.dataset.k === k));
    fEls.forEach((el) => el.classList.toggle("is-on", el.dataset.k === k));
  }
  function bindK(el, k) {
    el.addEventListener("mouseenter", () => focusK(k));
    el.addEventListener("mouseleave", () => focusK(pinnedK));
    el.addEventListener("focus", () => focusK(k));
    el.addEventListener("blur", () => focusK(pinnedK));
    el.addEventListener("click", () => { pinnedK = pinnedK === k ? null : k; focusK(pinnedK); });
  }
  fEls.forEach((el) => bindK(el, el.dataset.k));
  chevItems.forEach((it) => bindK($(".chev", it), it.dataset.k));

  /* ------------------------------------------------------------------------
     §3 Architecture diagram
     ------------------------------------------------------------------------ */
  const arch = $("#arch");
  const NS = "http://www.w3.org/2000/svg";
  (function buildTokens() {
    const types = ["R", "S", "a"], subs = ["t−2", "t−1", "t"];
    const fills = ["#cfcfc4", "#aeb9cc", "#a6a6a6"];
    let tok = "", emb = "", links = "";
    for (let i = 0; i < 9; i++) {
      const x = 180 + 70 * i, k = i % 3, step = Math.floor(i / 3);
      tok += `<circle cx="${x}" cy="234" r="17" fill="#eae3d9" stroke="#b9b0a4"/>` +
        `<text x="${x}" y="240" text-anchor="middle" font-size="18">${types[k]}</text>` +
        `<text x="${x + 19}" y="257" font-size="12">${subs[step]}</text>` +
        `<line x1="${x}" y1="252" x2="${x}" y2="268" stroke="#4a4542" stroke-width="1.2" marker-end="url(#ah)"/>`;
      emb += `<rect x="${x - 35}" y="272" width="70" height="20" fill="${fills[k]}" stroke="#fff" stroke-width="1"/>`;
      links += `<line x1="${x}" y1="292" x2="${x}" y2="310"/>`;
    }
    $("#tokenRow").innerHTML = tok;
    $("#embedRow").innerHTML = emb;
    $("#embedLinks").innerHTML = links;
  })();

  const bh = '<span class="bhat">b</span><sub>t</sub>';
  const PARTS = {
    dataset: ["Sequence Dataset", "Offline trajectories, stored step by step as (state<sub>t</sub>, action<sub>t</sub>, return_to_go<sub>t</sub>, state<sub>t+1</sub>, done). Training uses only this fixed dataset."],
    tokens: ["Input tokens", "Each time step contributes three tokens: return-to-go <i>R</i>, state <i>S</i> and action <i>a</i>. The model reads a window of recent steps (t−2, t−1, t)."],
    embed: ["Embedding + positional encoder", "Each token is embedded and tagged with its time step, so the encoder knows what each token is and when it happened."],
    encoder: ["Shared Sequence Encoder", "One transformer encoder shared by both heads: the same representation of the trajectory serves belief estimation and control."],
    hidden: ["h<sub>t</sub>: Hidden State", "The encoder output at the current step. It is rich, but implicit: the geology cannot be read off it directly."],
    "belief-head": ["Belief Head (structured belief)", "Predicts a physically meaningful belief: the distances to the reservoir boundaries."],
    "belief-out": [bh + ": Belief Readout", "An explicit, interpretable estimate of the hidden state. Because it is explicit, it can be inspected, and corrected at deployment."],
    "action-head": ["Action Head", ""],
    "action-out": ["a<sub>t</sub>: Model Output", "The steering command issued during drilling."],
    "belief-loss": ["Belief Loss", "Compares " + bh + " with the ground-truth boundary distances from the simulator."],
    "action-loss": ["Action Loss", "Compares a<sub>t</sub> with the action recorded in the offline dataset."],
    "total-loss": ["Total Loss", ""],
  };
  const ACTION_HEAD = {
    dt: "Conditioned on h<sub>t</sub> only. This is the plain Decision Transformer: no belief exists.",
    par: "Conditioned on h<sub>t</sub> only. A belief is predicted alongside, but the action never sees it.",
    cpl: "Conditioned on h<sub>t</sub> + " + bh + ": the latent context and the structured belief together.",
    str: "Conditioned on " + bh + " only. Everything the action knows has to pass through the compact belief.",
  };
  const TOTAL = {
    dt: "Only the action is supervised: L = L<sub>action</sub>.",
    other: "Both heads are trained jointly: L = L<sub>action</sub> + λ<sub>b</sub> · L<sub>belief</sub>, where λ<sub>b</sub> weights the belief term.",
  };
  // What each variant switches off (hidden) or fades (computed, not used by the action)
  const VARIANT_ARCH = {
    dt:  { off: ["belief-head", "belief-out", "belief-loss"], offEdges: ["h-b", "bh-b", "b-bl", "bl-t", "b-a"], faded: [] },
    par: { off: [], offEdges: [], faded: ["b-a"] },
    cpl: { off: [], offEdges: [], faded: [] },
    str: { off: [], offEdges: [], faded: ["h-a"] },
  };
  const SUB = {
    dt: 'Conditioned on h<tspan font-size="9" dy="3">t</tspan>',
    par: 'Conditioned on h<tspan font-size="9" dy="3">t</tspan><tspan dy="-3"> only</tspan>',
    cpl: 'Conditioned on h<tspan font-size="9" dy="3">t</tspan><tspan dy="-3"> + b̂</tspan><tspan font-size="9" dy="3">t</tspan>',
    str: 'Conditioned on b̂<tspan font-size="9" dy="3">t</tspan><tspan dy="-3"> only</tspan>',
  };
  const TOTAL_SVG = {
    dt: 'L = L<tspan font-size="9" dy="3">action</tspan>',
    other: 'L = L<tspan font-size="9" dy="3">action</tspan><tspan dy="-3"> + λ</tspan><tspan font-size="9" dy="3">b</tspan><tspan dy="-3"> · L</tspan><tspan font-size="9" dy="3">belief</tspan>',
  };

  const partEls = $$(".part", arch);
  const edgeEls = $$(".edge", arch);
  const archInfo = $("#archInfo");
  const defaultInfo = archInfo.innerHTML;
  let pinnedPart = null;

  function partText(id) {
    const [title, body] = PARTS[id];
    if (id === "action-head") return [title, ACTION_HEAD[state.selected]];
    if (id === "total-loss") return [title, state.selected === "dt" ? TOTAL.dt : TOTAL.other];
    return [title, body];
  }
  function showPart(id) {
    partEls.forEach((p) => p.classList.toggle("is-active", p.dataset.part === id));
    arch.classList.toggle("has-active", !!id);
    if (!id) { archInfo.innerHTML = defaultInfo; return; }
    const [t, b] = partText(id);
    archInfo.innerHTML = `<strong>${t}</strong>${b}`;
  }
  partEls.forEach((p) => {
    const id = p.dataset.part;
    p.addEventListener("mouseenter", () => { if (!flowTimer) showPart(id); });
    p.addEventListener("mouseleave", () => { if (!flowTimer) showPart(pinnedPart); });
    p.addEventListener("focus", () => { if (!flowTimer) showPart(id); });
    const toggle = () => { stopFlow(); pinnedPart = pinnedPart === id ? null : id; showPart(pinnedPart); };
    p.addEventListener("click", toggle);
    p.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
  });
  arch.addEventListener("mouseleave", () => { if (!flowTimer) showPart(pinnedPart); });

  function applyVariantToArch() {
    const cfg = VARIANT_ARCH[state.selected];
    partEls.forEach((p) => {
      const off = cfg.off.includes(p.dataset.part);
      p.classList.toggle("is-off", off);
      p.setAttribute("tabindex", off ? "-1" : "0");
      p.setAttribute("aria-hidden", off ? "true" : "false");
    });
    edgeEls.forEach((e) => {
      e.classList.toggle("is-off", cfg.offEdges.includes(e.dataset.e));
      e.classList.toggle("is-faded", cfg.faded.includes(e.dataset.e));
    });
    $("#actSub").innerHTML = SUB[state.selected];
    $("#totalF").innerHTML = state.selected === "dt" ? TOTAL_SVG.dt : TOTAL_SVG.other;
    const v = V[state.selected];
    const pill = $("#archVariantPill");
    pill.style.setProperty("--c", v.hex);
    $("span", pill).textContent = v.full;
    if (pinnedPart && cfg.off.includes(pinnedPart)) pinnedPart = null;
    if (!flowTimer) showPart(pinnedPart);
  }

  // Forward-pass animation
  const FLOW = [
    { parts: ["dataset"] },
    { parts: ["tokens"] },
    { parts: ["embed"] },
    { parts: ["encoder"] },
    { parts: ["hidden"], edges: ["enc-h"] },
    { parts: ["belief-head"], edges: ["h-b"] },
    { parts: ["belief-out"], edges: ["bh-b"] },
    { parts: ["action-head"], edges: ["h-a", "b-a"] },
    { parts: ["action-out"], edges: ["ah-a"] },
    { parts: ["belief-loss", "action-loss"], edges: ["b-bl", "a-al"] },
    { parts: ["total-loss"], edges: ["bl-t", "al-t"] },
  ];
  let flowTimer = null;
  const playBtn = $("#playFlow");
  function stopFlow() {
    if (!flowTimer) return;
    clearTimeout(flowTimer); flowTimer = null;
    edgeEls.forEach((e) => e.classList.remove("is-flow"));
    $("span", playBtn).textContent = "Play forward pass";
    showPart(pinnedPart);
  }
  function runFlow() {
    const cfg = VARIANT_ARCH[state.selected];
    const steps = FLOW.map((s) => ({
      parts: s.parts.filter((p) => !cfg.off.includes(p)),
      edges: (s.edges || []).filter((e) => !cfg.offEdges.includes(e) && !cfg.faded.includes(e)),
    })).filter((s) => s.parts.length);
    let i = 0;
    pinnedPart = null;
    $("span", playBtn).textContent = "Stop";
    const tick = () => {
      if (i >= steps.length) { flowTimer = null; stopFlow(); return; }
      const s = steps[i++];
      partEls.forEach((p) => p.classList.toggle("is-active", s.parts.includes(p.dataset.part)));
      arch.classList.add("has-active");
      edgeEls.forEach((e) => e.classList.toggle("is-flow", s.edges.includes(e.dataset.e)));
      const texts = s.parts.map(partText);
      archInfo.innerHTML = `<strong>Step ${i} of ${steps.length} · ${texts.map((t) => t[0]).join(" + ")}</strong>${texts.map((t) => t[1]).join(" ")}`;
      flowTimer = setTimeout(tick, reduceMotion ? 2600 : 1700);
    };
    tick();
  }
  playBtn.addEventListener("click", () => (flowTimer ? stopFlow() : runFlow()));

  /* ------------------------------------------------------------------------
     §3 Variant cards (the four small multiples)
     ------------------------------------------------------------------------ */
  function arrowLine(x1, y1, x2, y2, color) {
    const a = Math.atan2(y2 - y1, x2 - x1), L = 8, W = 4.5;
    const bx = x2 - L * Math.cos(a), by = y2 - L * Math.sin(a);
    const p1 = [bx + W * Math.sin(a), by - W * Math.cos(a)], p2 = [bx - W * Math.sin(a), by + W * Math.cos(a)];
    return `<line x1="${x1}" y1="${y1}" x2="${bx}" y2="${by}" stroke="${color}" stroke-width="2"/>` +
      `<path d="M${x2},${y2}L${p1[0]},${p1[1]}L${p2[0]},${p2[1]}Z" fill="${color}"/>`;
  }
  function miniSVG(id) {
    const hOn = id !== "str", bExists = id !== "dt", bOn = id === "cpl" || id === "str";
    const h = `<g opacity="${hOn ? 1 : 0.35}"><rect x="18" y="8" width="72" height="32" rx="7" fill="#eef2f4" stroke="#9fb0b8" stroke-width="1.5"/>` +
      `<text x="50" y="29" text-anchor="middle" font-size="15" font-weight="700" font-style="italic" fill="#3e3935">h<tspan font-size="10" dy="3">t</tspan></text></g>`;
    const b = bExists
      ? `<g opacity="${bOn ? 1 : 0.4}"><rect x="110" y="8" width="72" height="32" rx="7" fill="${bOn ? "#6fae85" : "#cfe3d6"}" stroke="${bOn ? "#3f7f57" : "#a9cbb5"}" stroke-width="1.5"/>` +
        `<text x="142" y="29" text-anchor="middle" font-size="15" font-weight="700" font-style="italic" fill="${bOn ? "#fff" : "#6f9a7f"}">b<tspan font-size="10" dy="3">t</tspan></text>` +
        `<text x="141" y="18" text-anchor="middle" font-size="10" font-weight="700" fill="${bOn ? "#fff" : "#6f9a7f"}">^</text></g>`
      : `<text x="146" y="29" text-anchor="middle" font-size="12.5" font-style="italic" fill="#8a837c">no belief</text>`;
    const ah = (hOn ? arrowLine(54, 40, 86, 78, "#7f98a3") : "") + (bOn ? arrowLine(146, 40, 114, 78, "#2f6e47") : "");
    return `<svg viewBox="0 0 200 118" aria-hidden="true">${h}${b}${ah}` +
      `<rect x="40" y="80" width="120" height="32" rx="7" fill="#fff" stroke="#b0484a" stroke-width="2"/>` +
      `<text x="100" y="101" text-anchor="middle" font-size="13.5" font-weight="700" fill="#3e3935">Action head</text></svg>`;
  }
  const grid = $("#variantGrid");
  grid.innerHTML = VARIANTS.map((v) => {
    const [l1, l2] = v.full.split(/ (?=[^ ]+$)/);
    return `<button type="button" class="vcard ${v.id}" data-v="${v.id}" aria-pressed="false">` +
      `<h4>${l1}<br>${l2}</h4>${miniSVG(v.id)}<span class="proposed">${v.proposed ? "proposed" : ""}</span></button>`;
  }).join("");
  $$(".vcard", grid).forEach((c) => {
    c.addEventListener("click", () => setSelected(c.dataset.v));
    c.addEventListener("mouseenter", () => setHover(c.dataset.v));
    c.addEventListener("mouseleave", () => setHover(null));
  });

  function renderVariantDetail() {
    const v = V[state.selected];
    $$(".vcard", grid).forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.v === v.id)));
    const s = (k) => fmt(OFFLINE[k].values[v.id][0], OFFLINE[k].dp);
    const best = (k) => bestOf(k) === v.id ? " · best" : "";
    $("#vdetail").innerHTML =
      `<div><p class="vname">${swatch(v, 12)} ${v.full}${v.proposed ? " (proposed)" : ""}</p><p>${v.desc}</p>` +
      `<p style="margin-top:6px"><a href="#results">See it in the results ↓</a></p></div>` +
      `<div class="vstats">` +
      `<div class="vstat"><b>${s("mse")}</b><span>Val. MSE ↓${best("mse")}</span></div>` +
      `<div class="vstat"><b>${s("rcr")}</b><span>RCR ↑${best("rcr")}</span></div>` +
      `<div class="vstat"><b>${s("viol")}</b><span>Violations ↓${best("viol")}</span></div></div>`;
  }

  /* ------------------------------------------------------------------------
     The loop (bridge between §2 and §3): Gather → Analyse → Decide.
     The centre of the circle plays a schematic geosteering scene in sync.
     ------------------------------------------------------------------------ */
  const STEP_MS = 3000;
  const STEPS = [
    { name: "Gather Data", angle: -90,
      text: "While drilling, sensors near the bit return noisy, indirect measurements of the formation, such as gamma-ray logs: the observations <i>Ω</i>.",
      map: `<strong>In the formulation</strong>Observations <i>Ω</i>, produced from the hidden geology by the observation model <i>O</i>. <button type="button" class="goto" data-goto="form:Ω">Show in §2 →</button>` },
    { name: "Analyse Data", angle: 150,
      text: "The measurements update the belief about the hidden geology: the distances to the reservoir boundaries (" + bh + "). In the circle, the green band tightens.",
      map: `<strong>In the model</strong>The belief head reads ${bh} out of the shared hidden state. <button type="button" class="goto" data-goto="arch:belief-head">Show in §3 →</button>` },
    { name: "Make a Decision", angle: 30,
      text: "A steering command a<sub>t</sub> is issued. The well bends towards the middle of the believed reservoir and drills into new, uncertain ground, and the loop repeats.",
      map: `<strong>In the model</strong>The action head outputs a<sub>t</sub>. Correcting ${bh} at deployment improves exactly this step. <button type="button" class="goto" data-goto="arch:action-head">Show in §3 →</button> · <button type="button" class="goto" data-goto="sec:correction">See §4 →</button>` },
  ];
  const cycle = $("#cycle");
  const R = 138, C = 200, GAP = 31;
  const pt = (deg) => [C + R * Math.cos((deg * Math.PI) / 180), C + R * Math.sin((deg * Math.PI) / 180)];
  const arcs = $$(".arc", cycle);
  STEPS.forEach((st, i) => {
    const next = STEPS[(i + 1) % 3];
    let a0 = st.angle - GAP, a1 = next.angle + GAP;
    if (a1 > a0) a1 -= 360; // always travel counter-clockwise on screen
    const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
    arcs[i].setAttribute("d", `M${x0.toFixed(1)},${y0.toFixed(1)} A${R},${R} 0 ${a0 - a1 > 180 ? 1 : 0} 0 ${x1.toFixed(1)},${y1.toFixed(1)}`);
    arcs[i].setAttribute("marker-end", "url(#cyah2)");
    const [bx, by] = pt(st.angle);
    const btn = $(`.cstep[data-step="${i}"]`, cycle);
    btn.style.left = (bx / 400) * 100 + "%";
    btn.style.top = (by / 400) * 100 + "%";
  });

  // Schematic scene: a well drilled through a wavy reservoir, steered on a belief.
  const Scene = (() => {
    const el = (id) => document.getElementById(id);
    const P = {
      resv: el("sResv"), tru: el("sTrue"), band: el("sBand"), est: el("sEst"), well: el("sWell"),
      pulse: $$("#sPulse circle"), steer: el("sSteer"), head: el("sSteerHead"), bit: el("sBit"), bitX: el("sBitX"),
    };
    const top = (x) => 176 + 17 * Math.sin(x / 41) + 7 * Math.sin(x / 17 + 1);
    const bot = (x) => top(x) + 48 + 8 * Math.sin(x / 29 + 2);
    const BIT = 160, LOOK = 96, SPEED = 12, X0 = 92, X1 = 308;
    let seed = 11;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const s = { x: 0, y: 0, slope: 0, desired: 0, hist: [], bT: 9, bB: -8, tT: 0, tB: 0, sig: 10, drifting: false };
    s.y = (top(0) + bot(0)) / 2;
    const estT = (x) => top(x) + s.bT, estB = (x) => bot(x) + s.bB;
    const ease = (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt));
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

    function onPhase(i) {
      if (i === 2) { // decide from the current belief: aim for the middle of the believed reservoir
        const tx = s.x + LOOK;
        s.desired = clamp(((estT(tx) + estB(tx)) / 2 - s.y) / LOOK, -0.6, 0.6);
      }
      if (i !== 2) s.drifting = false;
    }
    function step(dt, phase, t) {
      s.x += SPEED * dt;
      s.y += s.slope * SPEED * dt;
      s.hist.push([s.x, s.y]);
      while (s.hist.length > 2 && s.hist[1][0] < s.x - (BIT - X0) - 6) s.hist.shift();
      if (phase === 1) {
        s.bT = ease(s.bT, 0, 1.6, dt); s.bB = ease(s.bB, 0, 1.6, dt); s.sig = ease(s.sig, 2.5, 1.6, dt);
      } else if (phase === 2) {
        s.slope = ease(s.slope, s.desired, 2.2, dt);
        if (t > STEP_MS * 0.45) { // drilling on into ground we have not measured yet
          if (!s.drifting) { s.drifting = true; s.tT = (rand() * 2 - 1) * 13; s.tB = (rand() * 2 - 1) * 13; }
          s.bT = ease(s.bT, s.tT, 1.1, dt); s.bB = ease(s.bB, s.tB, 1.1, dt); s.sig = ease(s.sig, 10, 1.1, dt);
        }
      }
    }
    function snap(i) { // reduced motion: jump straight to the end state of a phase
      if (i === 1) { s.bT = 0; s.bB = 0; s.sig = 2.5; }
      if (i === 2) s.slope = s.desired;
    }
    const wx = (px) => s.x + (px - BIT);
    const fwd = (f, a, b) => { let d = ""; for (let p = a; p <= b + 0.01; p += 4) d += (d ? "L" : "M") + p.toFixed(1) + "," + f(wx(p)).toFixed(1); return d; };
    const back = (f, a, b) => { let d = ""; for (let p = b; p >= a - 0.01; p -= 4) d += "L" + p.toFixed(1) + "," + f(wx(p)).toFixed(1); return d; };
    function render(phase, t) {
      P.resv.setAttribute("d", fwd(top, X0, X1) + back(bot, X0, X1) + "Z");
      P.tru.setAttribute("d", fwd(top, X0, X1) + fwd(bot, X0, X1));
      const g = s.sig;
      P.band.setAttribute("d",
        fwd((x) => estT(x) - g, BIT, X1) + back((x) => estT(x) + g, BIT, X1) + "Z" +
        fwd((x) => estB(x) - g, BIT, X1) + back((x) => estB(x) + g, BIT, X1) + "Z");
      P.est.setAttribute("d", fwd(estT, BIT, X1) + fwd(estB, BIT, X1));
      P.well.setAttribute("d", s.hist.map(([x, y], k) => (k ? "L" : "M") + (BIT + x - s.x).toFixed(1) + "," + y.toFixed(1)).join(""));
      P.bit.setAttribute("transform", `translate(${BIT} ${s.y.toFixed(1)})`);
      P.bitX.setAttribute("transform", `rotate(${((s.x * 14) % 360).toFixed(1)})`); // the bit turns as it drills
      P.pulse.forEach((c, k) => {
        const u = ((t / 1150) + k * 0.5) % 1;
        c.setAttribute("cx", BIT); c.setAttribute("cy", s.y.toFixed(1));
        c.setAttribute("r", (5 + 30 * u).toFixed(1));
        c.setAttribute("opacity", phase === 0 ? ((1 - u) * 0.9).toFixed(2) : "0");
      });
      if (phase === 2) {
        const a = Math.atan(s.desired), L = 26, x2 = BIT + L * Math.cos(a), y2 = s.y + L * Math.sin(a);
        const hx = x2 + 7 * Math.cos(a), hy = y2 + 7 * Math.sin(a), nx = -Math.sin(a) * 4.5, ny = Math.cos(a) * 4.5;
        P.steer.setAttribute("d", `M${BIT + 6 * Math.cos(a)},${s.y + 6 * Math.sin(a)}L${x2},${y2}`);
        P.head.setAttribute("d", `M${hx},${hy}L${x2 + nx},${y2 + ny}L${x2 - nx},${y2 - ny}Z`);
      } else { P.steer.setAttribute("d", ""); P.head.setAttribute("d", ""); }
    }
    function warmup(loops) {
      for (let l = 0; l < loops; l++) for (let i = 0; i < 3; i++) {
        onPhase(i);
        for (let t = 0; t < STEP_MS; t += 33) step(0.033, i, t);
      }
    }
    return { onPhase, step, snap, render, warmup };
  })();

  let cycIdx = 0, cycVisible = false, phaseT = 0, boost = 0, raf = 0, last = 0, entered = false;
  const halo = $("#cycHalo"), prog = $("#arcProg"), comet = $("#arcComet"), liveBadge = $("#liveBadge");
  // A dot travels along the arrow towards the next step, filling it like a timer.
  function updateProgress(running) {
    cycle.classList.toggle("is-playing", running);
    const arc = arcs[cycIdx];
    const p = running ? Math.min(1, phaseT / STEP_MS) : 0;
    prog.setAttribute("d", arc.getAttribute("d"));
    prog.style.strokeDashoffset = String(1 - p);
    const q = arc.getPointAtLength(p * arc.getTotalLength());
    comet.setAttribute("cx", q.x.toFixed(1));
    comet.setAttribute("cy", q.y.toFixed(1));
  }
  const cycToggle = $("#cycleToggle");
  let cycPlaying = !reduceMotion;
  function showStep(i) {
    cycIdx = i; phaseT = 0;
    Scene.onPhase(i);
    $$(".cstep", cycle).forEach((b, j) => {
      b.classList.toggle("is-on", j === i);
      b.setAttribute("aria-pressed", String(j === i));
    });
    if (cycPlaying || boost > 0) { // ripple around the ring on every step change
      halo.classList.toggle("ping", false);
      halo.getBoundingClientRect();
      halo.classList.toggle("ping", true);
    }
    $("#cycleDetail").innerHTML = `<strong>${i + 1}. ${STEPS[i].name}</strong>${STEPS[i].text}`;
    $("#cycleMap").innerHTML = STEPS[i].map;
  }
  function frame(ts) {
    const dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
    last = ts;
    phaseT += dt * 1000;
    if (!cycPlaying) boost -= dt * 1000;
    if (cycPlaying && phaseT >= STEP_MS) showStep((cycIdx + 1) % 3);
    Scene.step(dt, cycIdx, phaseT);
    Scene.render(cycIdx, phaseT);
    const running = cycVisible && (cycPlaying || boost > 0);
    updateProgress(running);
    if (running) raf = requestAnimationFrame(frame);
    else { raf = 0; last = 0; }
  }
  function kick() {
    if (!raf && cycVisible && (cycPlaying || boost > 0)) { last = 0; raf = requestAnimationFrame(frame); }
  }
  function setCycPlaying(on) {
    cycPlaying = on;
    cycToggle.innerHTML = on
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>Pause'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>Play';
    liveBadge.classList.toggle("is-paused", !on);
    if (!on && !(boost > 0)) updateProgress(false);
    cycToggle.setAttribute("aria-pressed", String(on));
    kick();
  }
  $$(".cstep", cycle).forEach((b) => b.addEventListener("click", () => {
    setCycPlaying(false);
    showStep(+b.dataset.step);
    if (reduceMotion) { Scene.snap(cycIdx); Scene.render(cycIdx, 500); }
    else { boost = STEP_MS; kick(); }
  }));
  cycToggle.addEventListener("click", () => setCycPlaying(!cycPlaying));
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((es) => {
      const e = es[0];
      cycVisible = e.isIntersecting;
      if (!entered && e.intersectionRatio >= 0.3) {
        // first time it is really on screen: spin in and start again from step 1
        entered = true;
        cycle.classList.add("entered");
        showStep(0);
      }
      kick();
    }, { threshold: [0, 0.3] }).observe(cycle);
  } else { cycVisible = true; entered = true; cycle.classList.add("entered"); }

  // Links from the loop into §2 / §3 / §4
  function goTo(target) {
    const [kind, id] = target.split(":");
    const behavior = reduceMotion ? "auto" : "smooth";
    if (kind === "form") {
      pinnedK = id; focusK(id);
      $("#chevrons").scrollIntoView({ behavior, block: "center" });
    } else if (kind === "arch") {
      if (VARIANT_ARCH[state.selected].off.includes(id)) setSelected("cpl");
      stopFlow(); pinnedPart = id; showPart(id);
      arch.scrollIntoView({ behavior, block: "center" });
    } else {
      document.getElementById(id).scrollIntoView({ behavior, block: "start" });
    }
  }
  $("#cycleMap").addEventListener("click", (e) => {
    const b = e.target.closest("[data-goto]");
    if (b) goTo(b.dataset.goto);
  });

  Scene.warmup(2);
  showStep(0);
  Scene.render(0, 400);
  setCycPlaying(cycPlaying);

  /* ------------------------------------------------------------------------
     §4 Results: highlight chips
     ------------------------------------------------------------------------ */
  function bestOf(key) {
    const m = OFFLINE[key];
    return VARIANTS.reduce((b, v) => {
      const x = m.values[v.id][0], y = m.values[b][0];
      return (m.better === "lower" ? x < y : x > y) ? v.id : b;
    }, VARIANTS[0].id);
  }

  const filterRow = $("#filterRow");
  filterRow.insertAdjacentHTML("beforeend", VARIANTS.map((v) =>
    `<button type="button" class="vchip" data-v="${v.id}" aria-pressed="false">${swatch(v)}${v.name}</button>`).join(""));
  $$(".vchip", filterRow).forEach((b) => {
    b.addEventListener("click", () => setSelected(b.dataset.v));
    b.addEventListener("mouseenter", () => setHover(b.dataset.v));
    b.addEventListener("mouseleave", () => setHover(null));
    b.addEventListener("focus", () => setHover(b.dataset.v));
    b.addEventListener("blur", () => setHover(null));
  });

  function applyHover() {
    const id = state.hover;
    $$(".chart").forEach((c) => {
      const has = id && $(`.series[data-v="${id}"]`, c);
      c.classList.toggle("dim", !!has);
      $$(".series", c).forEach((s) => s.classList.toggle("is-hot", s.dataset.v === id));
    });
  }

  /* ------------------------------------------------------------------------
     §4 Dot-and-whisker charts
     ------------------------------------------------------------------------ */
  function renderDot(el) {
    const key = el.dataset.metric, m = OFFLINE[key];
    const W = Math.max(240, Math.round(el.clientWidth));
    const rowH = 42, padT = 16, padB = 30, padL = 70, padR = 14;
    const H = padT + rowH * VARIANTS.length + padB;
    const vals = VARIANTS.map((v) => m.values[v.id]);
    const lo = Math.min(...vals.map(([a, s]) => a - s)), hi = Math.max(...vals.map(([a, s]) => a + s));
    const tk = niceTicks(lo, hi, W < 380 ? 4 : 5), d0 = tk[0], d1 = tk[tk.length - 1];
    const x = (v) => padL + ((v - d0) / (d1 - d0)) * (W - padL - padR);
    const best = bestOf(key);
    const tdp = key === "viol" ? 0 : key === "mse" ? 3 : 2;

    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${m.label}, ${m.better} is better. ` +
      VARIANTS.map((v) => `${v.full}: ${fmt(m.values[v.id][0], m.dp)}`).join("; ") + `">`;
    s += `<g class="grid">${tk.map((t) => `<line x1="${x(t)}" x2="${x(t)}" y1="${padT - 6}" y2="${H - padB + 4}"/>`).join("")}</g>`;
    s += `<g class="tick">${tk.map((t) => `<text x="${x(t)}" y="${H - padB + 20}" text-anchor="middle">${t.toFixed(tdp)}</text>`).join("")}</g>`;
    VARIANTS.forEach((v, i) => {
      const [mean, sd] = m.values[v.id];
      const y = padT + rowH * (i + 0.5);
      const sel = state.selected === v.id;
      if (sel) s += `<rect class="sel-band" x="2" y="${y - rowH / 2 + 3}" width="${W - 4}" height="${rowH - 6}" rx="8"/>`;
      s += `<g class="series" data-v="${v.id}">`;
      s += `<text class="row-label${sel ? " is-sel" : ""}" x="${padL - 12}" y="${y + 4.5}" text-anchor="end">${v.name}</text>`;
      s += `<g stroke="${v.hex}" stroke-width="2" stroke-linecap="round">` +
        `<line x1="${x(mean - sd)}" x2="${x(mean + sd)}" y1="${y}" y2="${y}"/>` +
        `<line x1="${x(mean - sd)}" x2="${x(mean - sd)}" y1="${y - 5}" y2="${y + 5}"/>` +
        `<line x1="${x(mean + sd)}" x2="${x(mean + sd)}" y1="${y - 5}" y2="${y + 5}"/></g>`;
      s += `<g fill="${v.hex}" stroke="#fff" stroke-width="2">${shape(v.shape, x(mean), y, v.id === "cpl" ? 7.5 : 6.5)}</g>`;
      s += `<text class="val" x="${x(mean)}" y="${y - 12}" text-anchor="middle"${v.id === best ? ' font-weight="700"' : ""}>${fmt(mean, m.dp)}` +
        `${v.id === best ? '<tspan class="best" dx="5">BEST</tspan>' : ""}</text>`;
      s += `<rect class="hit" data-v="${v.id}" x="0" y="${y - rowH / 2}" width="${W}" height="${rowH}" fill="transparent" style="cursor:pointer"/>`;
      s += `</g>`;
    });
    s += `</svg>`;
    el.innerHTML = s;

    $$(".hit", el).forEach((h) => {
      const v = V[h.dataset.v];
      const [mean, sd] = m.values[v.id];
      const html = `<b><span class="sw" style="background:${v.hex}"></span>${v.full}</b><br>${m.label}: ${valText(mean, sd, m.dp)}` +
        `<br><span style="opacity:.75">${m.better === "lower" ? "Lower" : "Higher"} is better${v.id === best ? " · best of 4" : ""}</span>`;
      h.addEventListener("pointerenter", (e) => { setHover(v.id); showTip(html, e); });
      h.addEventListener("pointermove", moveTip);
      h.addEventListener("pointerleave", () => { setHover(null); hideTip(); });
      h.addEventListener("click", () => setSelected(v.id));
    });
  }

  /* ------------------------------------------------------------------------
     §4 Online belief correction chart
     ------------------------------------------------------------------------ */
  const corrEl = $("#chart-corr");
  const legend = $("#corrLegend");
  const ONLINE_LABEL = { cpl: "Coupled", str: "Strict", dt: "DT (no belief)" };
  legend.innerHTML = ONLINE_ORDER.map((id) =>
    `<button type="button" class="vchip" data-v="${id}" aria-pressed="true">${swatch(V[id])}${ONLINE_LABEL[id]}</button>`).join("");
  $$(".vchip", legend).forEach((b) => b.addEventListener("click", () => {
    const id = b.dataset.v;
    if (state.hidden.has(id)) state.hidden.delete(id); else state.hidden.add(id);
    b.setAttribute("aria-pressed", String(!state.hidden.has(id)));
    b.classList.toggle("is-hidden", state.hidden.has(id));
    renderCorr();
  }));

  function renderCorr() {
    const W = Math.max(270, Math.round(corrEl.clientWidth));
    const H = W < 460 ? 270 : 310;
    const M = { l: 50, r: W < 420 ? 64 : 78, t: 30, b: 44 };
    const px0 = W < 460 ? -0.032 : -0.016, px1 = 0.212, y0 = 0.45, y1 = 0.9;
    const x = (p) => M.l + ((p - px0) / (px1 - px0)) * (W - M.l - M.r);
    const y = (v) => M.t + (1 - (v - y0) / (y1 - y0)) * (H - M.t - M.b);
    const dodge = { cpl: -4, str: 4, dt: -11 };
    const P = ONLINE.p;

    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Reservoir contact ratio versus belief correction rate. Coupled rises from 0.66 to 0.75, Strict from 0.58 to 0.76 and overtakes Coupled between p = 0.10 and 0.20. DT without belief: 0.61 at p = 0.">`;
    const yt = [0.5, 0.6, 0.7, 0.8, 0.9];
    s += `<g class="grid">${yt.map((t) => `<line x1="${M.l}" x2="${W - M.r + 8}" y1="${y(t)}" y2="${y(t)}"/>`).join("")}</g>`;
    s += `<g class="tick">${yt.map((t) => `<text x="${M.l - 8}" y="${y(t) + 4}" text-anchor="end">${t.toFixed(2)}</text>`).join("")}`;
    s += P.map((p) => `<text x="${x(p)}" y="${H - M.b + 18}" text-anchor="middle">${p.toFixed(2)}</text>`).join("") + `</g>`;
    s += `<text class="axis-label" x="${(M.l + W - M.r) / 2}" y="${H - 6}" text-anchor="middle">Belief correction rate p</text>`;
    s += `<text class="axis-label" transform="translate(13 ${(M.t + H - M.b) / 2}) rotate(-90)" text-anchor="middle">RCR →</text>`;

    // selected-p guide
    const gx = x(P[state.pIdx]);
    s += `<line x1="${gx}" x2="${gx}" y1="${M.t - 8}" y2="${H - M.b}" stroke="#3e3935" stroke-width="1" stroke-dasharray="3 4" opacity=".6"/>`;

    // crossover annotation (Strict overtakes Coupled between p=0.10 and 0.20)
    if (!state.hidden.has("cpl") && !state.hidden.has("str")) {
      const c = ONLINE.series.cpl, st = ONLINE.series.str;
      const d0 = st[2][0] - c[2][0], d1 = st[3][0] - c[3][0];
      const f = d0 / (d0 - d1);
      const pc = P[2] + f * (P[3] - P[2]);
      const vc = c[2][0] + f * (c[3][0] - c[2][0]);
      const cx = x(pc), cy = y(vc);
      s += `<g class="annot"><line x1="${cx}" y1="${cy - 8}" x2="${cx}" y2="${y(0.865)}" stroke="#3e3935" stroke-width="1" stroke-dasharray="2 3"/>` +
        `<circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="#3e3935" stroke-width="1.2"/>` +
        `<text x="${cx}" y="${y(0.865) - 6}" text-anchor="middle" font-size="12.5" font-weight="700" fill="#3e3935">Strict overtakes</text></g>`;
    }

    ONLINE_ORDER.forEach((id) => {
      if (state.hidden.has(id)) return;
      const v = V[id], pts = ONLINE.series[id];
      const sel = state.selected === id;
      s += `<g class="series" data-v="${id}">`;
      const line = pts.map((d, i) => d && `${x(P[i]) + dodge[id]},${y(d[0])}`).filter(Boolean);
      if (line.length > 1) s += `<polyline points="${line.join(" ")}" fill="none" stroke="${v.hex}" stroke-width="${sel ? 3 : 2}" stroke-linejoin="round"/>`;
      pts.forEach((d, i) => {
        if (!d) return;
        const [mean, sd] = d, cx = x(P[i]) + dodge[id];
        if (sd != null) {
          s += `<g stroke="${v.hex}" stroke-width="1.4" opacity=".75"><line x1="${cx}" x2="${cx}" y1="${y(mean - sd)}" y2="${y(mean + sd)}"/>` +
            `<line x1="${cx - 4}" x2="${cx + 4}" y1="${y(mean - sd)}" y2="${y(mean - sd)}"/><line x1="${cx - 4}" x2="${cx + 4}" y1="${y(mean + sd)}" y2="${y(mean + sd)}"/></g>`;
        }
        const on = i === state.pIdx;
        s += `<g fill="${v.hex}" stroke="${on ? "#3e3935" : "#fff"}" stroke-width="2">${shape(v.shape, cx, y(mean), on ? 7 : 5.5)}</g>`;
      });
      // direct labels
      const last = pts.map((d, i) => d && [i, d]).filter(Boolean).pop();
      if (id === "dt") {
        s += `<text x="${x(0) + dodge.dt}" y="${y(pts[0][0] - pts[0][1]) + 15}" text-anchor="middle" font-size="12" fill="#5e5751">DT</text>`;
      } else {
        const ly = y(last[1][0]) + (id === "str" ? -7 : 13);
        s += `<text x="${x(P[last[0]]) + 12}" y="${ly}" font-size="12.5" font-weight="${sel ? 700 : 500}" fill="#3e3935">${ONLINE_LABEL[id]}</text>`;
      }
      s += `</g>`;
    });
    // hover capture
    s += `<rect class="overlay" x="${M.l}" y="${M.t - 10}" width="${W - M.l - M.r + 10}" height="${H - M.t - M.b + 10}" fill="transparent"/>`;
    s += `</svg>`;
    corrEl.innerHTML = s;

    const ov = $(".overlay", corrEl);
    const nearest = (e) => {
      const r = corrEl.querySelector("svg").getBoundingClientRect();
      const mx = ((e.clientX - r.left) / r.width) * W;
      let bi = 0;
      P.forEach((p, i) => { if (Math.abs(x(p) - mx) < Math.abs(x(P[bi]) - mx)) bi = i; });
      return bi;
    };
    ov.addEventListener("pointermove", (e) => {
      const i = nearest(e);
      if (i !== state.pIdx) setP(i);
      showTip(corrTip(i), e);
    });
    ov.addEventListener("pointerleave", hideTip);
    ov.addEventListener("click", (e) => setP(nearest(e)));
    applyHover();
  }

  function corrTip(i) {
    const p = ONLINE.p[i];
    const rows = ONLINE_ORDER.filter((id) => !state.hidden.has(id)).map((id) => {
      const d = ONLINE.series[id][i], v = V[id];
      return `<span class="sw" style="background:${v.hex}"></span>${ONLINE_LABEL[id]}: ${d ? valText(d[0], d[1], 2) : "n/a"}`;
    });
    return `<b>p = ${p.toFixed(2)}</b><br>${rows.join("<br>")}`;
  }

  const slider = $("#pSlider");
  const readout = $("#readout");
  function renderReadout() {
    const i = state.pIdx, p = ONLINE.p[i];
    const c = ONLINE.series.cpl[i], st = ONLINE.series.str[i], dt = ONLINE.series.dt[i];
    const diff = st[0] - c[0];
    const leader = diff > 0 ? "Strict" : "Coupled";
    const gap = Math.abs(diff).toFixed(2);
    readout.innerHTML =
      `<div><span>${swatch(V.cpl, 10)} Coupled RCR</span><b>${valText(c[0], c[1], 2)}</b></div>` +
      `<div><span>${swatch(V.str, 10)} Strict RCR</span><b>${valText(st[0], st[1], 2)}</b></div>` +
      `<div><span>At p = ${p.toFixed(2)}</span><b>${leader} +${gap}</b>` +
      `<span class="lead-tag">${dt ? `DT (no belief): ${fmt(dt[0], 2)}` : diff > 0 ? "Strict has overtaken" : "Coupled still leads"}</span></div>`;
    slider.value = String(i);
    slider.setAttribute("aria-valuetext", `p = ${p.toFixed(2)}`);
  }
  function setP(i) {
    state.pIdx = i;
    renderCorr();
    renderReadout();
  }
  slider.addEventListener("input", () => { stopPPlay(); setP(+slider.value); });

  let pTimer = null;
  const pPlay = $("#pPlay");
  function stopPPlay() {
    clearTimeout(pTimer); pTimer = null;
    $("span", pPlay).textContent = "Play";
  }
  pPlay.addEventListener("click", () => {
    if (pTimer) { stopPPlay(); return; }
    $("span", pPlay).textContent = "Stop";
    let i = 0;
    const step = () => {
      setP(i);
      if (++i < ONLINE.p.length) pTimer = setTimeout(step, 1200);
      else pTimer = setTimeout(stopPPlay, 600);
    };
    step();
  });

  /* ------------------------------------------------------------------------
     §4 Data tables (accessible view of both figures)
     ------------------------------------------------------------------------ */
  (function tables() {
    const spreadNote = SHOW_SPREAD_NUMBERS ? "mean ± spread" : "mean";
    let h = `<table><caption>Offline results, standard test set (${spreadNote})</caption><thead><tr><th>Variant</th>` +
      Object.values(OFFLINE).map((m) => `<th>${m.label} ${m.better === "lower" ? "↓" : "↑"}</th>`).join("") + `</tr></thead><tbody>`;
    VARIANTS.forEach((v) => {
      h += `<tr><td>${v.full}</td>` + Object.entries(OFFLINE).map(([k, m]) => {
        const [a, s] = m.values[v.id];
        const b = bestOf(k) === v.id;
        return `<td>${b ? "<b>" : ""}${valText(a, s, m.dp)}${b ? "</b>" : ""}</td>`;
      }).join("") + `</tr>`;
    });
    h += `</tbody></table>`;
    h += `<table><caption>Online belief correction, shifted test set: RCR ↑ (${spreadNote})</caption><thead><tr><th>Correction rate p</th>` +
      ONLINE_ORDER.map((id) => `<th>${ONLINE_LABEL[id]}</th>`).join("") + `</tr></thead><tbody>`;
    ONLINE.p.forEach((p, i) => {
      h += `<tr><td>${p.toFixed(2)}</td>` + ONLINE_ORDER.map((id) => {
        const d = ONLINE.series[id][i];
        return `<td>${d ? valText(d[0], d[1], 2) : "–"}</td>`;
      }).join("") + `</tr>`;
    });
    h += `</tbody></table>`;
    $("#tables").innerHTML = h;
  })();

  /* ------------------------------------------------------------------------
     §5 Discussion: which design wins, offline vs online
     ------------------------------------------------------------------------ */
  const VERDICT = {
    offline: {
      tiles: [
        { id: "cpl", big: fmt(OFFLINE.rcr.values.cpl[0], 2), small: `RCR · ${fmt(OFFLINE.viol.values.cpl[0], 1)} violations · MSE ${fmt(OFFLINE.mse.values.cpl[0], 3)}`, win: true },
        { id: "str", big: fmt(OFFLINE.rcr.values.str[0], 2), small: `RCR · ${fmt(OFFLINE.viol.values.str[0], 1)} violations · MSE ${fmt(OFFLINE.mse.values.str[0], 3)}` },
      ],
      note: "Standard test set, no correction. Coupled keeps both the latent context h<sub>t</sub> and the structured belief; Strict must act from the compact belief alone.",
    },
    online: {
      tiles: [
        { id: "cpl", big: fmt(ONLINE.series.cpl[3][0], 2), small: `RCR at p = 0.20 · up from ${fmt(ONLINE.series.cpl[0][0], 2)} (+${fmt(ONLINE.series.cpl[3][0] - ONLINE.series.cpl[0][0], 2)})` },
        { id: "str", big: fmt(ONLINE.series.str[3][0], 2), small: `RCR at p = 0.20 · up from ${fmt(ONLINE.series.str[0][0], 2)} (+${fmt(ONLINE.series.str[3][0] - ONLINE.series.str[0][0], 2)})`, win: true },
      ],
      note: "Shifted test set (gamma-ray noise doubled), beliefs corrected at deployment. Strict’s action depends entirely on the belief, so each correction feeds straight into steering. <a href=\"#correction\">See the curve ↑</a>",
    },
  };
  function renderVerdict(setting) {
    const d = VERDICT[setting];
    $$(".seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.setting === setting)));
    $("#verdictBody").innerHTML = d.tiles.map((t) => {
      const v = V[t.id];
      // the badge sits next to the (short) number, in the normal flow, so it can never cover the name
      return `<div class="tile${t.win ? " win" : ""}">` +
        `<div class="tname">${swatch(v)}<span class="nm">${v.full}</span></div>` +
        `<div class="big">${t.big}${t.win ? '<span class="crown">Wins</span>' : ""}</div>` +
        `<div class="small">${t.small}</div></div>`;
    }).join("");
    $("#verdictNote").innerHTML = d.note;
  }
  $$(".seg button").forEach((b) => b.addEventListener("click", () => renderVerdict(b.dataset.setting)));
  renderVerdict("offline");

  /* ------------------------------------------------------------------------
     Wire-up + responsive re-render
     ------------------------------------------------------------------------ */
  const dotEls = $$(".chart[data-metric]");
  function renderCharts() {
    dotEls.forEach(renderDot);
    renderCorr();
    applyHover();
  }
  function syncSelected() {
    applyVariantToArch();
    renderVariantDetail();
    $$(".vchip", filterRow).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === state.selected)));
    renderCharts();
  }
  onChange(syncSelected);
  syncSelected();
  renderReadout();

  // Hover from the variant cards also previews the variant in the charts only.
  let rafId = 0;
  const ro = "ResizeObserver" in window ? new ResizeObserver(() => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(renderCharts);
  }) : null;
  if (ro) { dotEls.forEach((el) => ro.observe(el)); ro.observe(corrEl); }
  else window.addEventListener("resize", () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(renderCharts); });

  // Re-render once web fonts are in (label widths change)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(renderCharts);
})();
