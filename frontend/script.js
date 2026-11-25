"use strict";

document.documentElement.classList.add("js");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const REELRADAR_URL = "https://d3de825ujm36t1.cloudfront.net/";
const GITHUB_URL = "https://github.com/muvhulawamuthula";
const EMAIL = "mutulamuvhulawa@gmail.com";

/* =========================================================================
   Live telemetry: exactly ONE call to the counter (each call increments it).
   CloudFront adds x-amz-cf-pop, which same-origin JS can read, so we can show
   the visitor the edge location that served them.
   ========================================================================= */
const telemetry = (async () => {
  const started = performance.now();
  try {
    const res = await fetch("/api/visitorCounter", { cache: "no-store" });
    const rtt = Math.round(performance.now() - started);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { ok: true, count: data.count, rtt, pop: res.headers.get("x-amz-cf-pop") || null };
  } catch (err) {
    console.warn("Visitor counter unavailable:", err);
    return { ok: false, count: null, rtt: null, pop: null };
  }
})();

// Turns "JNB51-P3" into "JNB51 · Johannesburg".
const POP_CITIES = {
  JNB: "Johannesburg", CPT: "Cape Town", LHR: "London", LON: "London", FRA: "Frankfurt", AMS: "Amsterdam",
  CDG: "Paris", DUB: "Dublin", MAD: "Madrid", MXP: "Milan", ARN: "Stockholm", IAD: "Virginia", JFK: "New York",
  EWR: "New Jersey", ORD: "Chicago", DFW: "Dallas", ATL: "Atlanta", MIA: "Miami", SFO: "San Francisco",
  LAX: "Los Angeles", SEA: "Seattle", YTO: "Toronto", YUL: "Montreal", GRU: "São Paulo", BOM: "Mumbai",
  DEL: "New Delhi", BLR: "Bengaluru", SIN: "Singapore", NRT: "Tokyo", HKG: "Hong Kong", ICN: "Seoul",
  SYD: "Sydney", MEL: "Melbourne", DXB: "Dubai", NBO: "Nairobi", LOS: "Lagos", CAI: "Cairo", TLV: "Tel Aviv",
  BAH: "Bahrain", FJR: "Fujairah", WAW: "Warsaw", VIE: "Vienna", ZRH: "Zurich", HEL: "Helsinki",
};
const popCode = (pop) => (pop ? pop.split("-")[0] : null);
const popCity = (pop) => (pop ? POP_CITIES[pop.slice(0, 3)] || null : null);
const popLabel = (pop) => {
  if (!pop) return "CloudFront";
  const city = popCity(pop);
  return city ? `${popCode(pop)} · ${city}` : popCode(pop);
};

function animateNumber(el, to) {
  if (reducedMotion || !Number.isFinite(to)) { el.textContent = Number(to).toLocaleString(); return; }
  const dur = 1200, t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString();
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

telemetry.then((t) => {
  $$('[data-tel="count"]').forEach((el) => {
    if (t.ok) { animateNumber(el, Number(t.count)); el.classList.add("ok"); } else el.textContent = "offline";
  });
  $$('[data-tel="rtt"]').forEach((el) => { el.textContent = t.rtt != null ? `${t.rtt} ms` : "—"; });
  $$('[data-tel="pop"]').forEach((el) => { el.textContent = t.pop ? popLabel(t.pop) : (el.tagName === "B" ? "CloudFront" : "—"); });
  const archPop = $("#arch-pop");
  if (archPop) archPop.textContent = t.pop ? `you → ${popCode(t.pop)}` : "global edge";
});

/* =========================================================================
   Small UI behaviours
   ========================================================================= */
$("#year").textContent = new Date().getFullYear();

const nav = $(".nav");
const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 10);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// Highlight the nav link for the section in view.
const navLinks = $$(".nav nav a");
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    navLinks.forEach((a) => a.classList.toggle("is-current", a.getAttribute("href") === `#${e.target.id}`));
  });
}, { rootMargin: "-45% 0px -50% 0px" });
["work", "architecture", "stack", "contact"].forEach((id) => { const s = document.getElementById(id); if (s) sectionObserver.observe(s); });

// Reveal on scroll.
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); revealObserver.unobserve(e.target); } });
}, { threshold: 0.12 });
$$(".reveal").forEach((el) => revealObserver.observe(el));

// Background glow follows the pointer; cards get a cursor spotlight.
if (!reducedMotion && window.matchMedia("(pointer: fine)").matches) {
  const glow = $(".bg-glow");
  let raf = 0;
  window.addEventListener("pointermove", (e) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      glow.style.setProperty("--mx", `${e.clientX}px`);
      glow.style.setProperty("--my", `${e.clientY}px`);
      raf = 0;
    });
  }, { passive: true });
}
$$(".card").forEach((card) => {
  card.addEventListener("pointermove", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--x", `${e.clientX - r.left}px`);
    card.style.setProperty("--y", `${e.clientY - r.top}px`);
  });
});

// Copy email.
const toast = $("#toast");
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 1800);
}
$("#copy-email").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(EMAIL); showToast("Email copied ✓"); }
  catch { showToast(EMAIL); }
});

/* =========================================================================
   Project filters
   ========================================================================= */
const cards = $$("#project-grid .card");
cards.forEach((c, i) => { $(".idx", c).textContent = String(i + 1).padStart(2, "0"); });
const chips = $$(".chip");
chips.forEach((chip) => {
  const f = chip.dataset.filter;
  $(".n", chip).textContent = f === "all" ? cards.length : cards.filter((c) => c.dataset.cat.split(" ").includes(f)).length;
  chip.addEventListener("click", () => applyFilter(f));
});
function applyFilter(f) {
  chips.forEach((c) => c.classList.toggle("is-active", c.dataset.filter === f));
  cards.forEach((c) => {
    c.hidden = !(f === "all" || c.dataset.cat.split(" ").includes(f));
    if (!c.hidden) c.classList.add("in");
  });
}

/* =========================================================================
   Interactive terminal
   ========================================================================= */
const termBody = $("#term-body");
const termForm = $("#term-form");
const termInput = $("#term-cmd");
const history = [];
let histIdx = 0;
let busy = false;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, reducedMotion ? 0 : ms));

function print(html, cls = "out") {
  const div = document.createElement("div");
  div.className = `line ${cls}`;
  div.innerHTML = html;
  termBody.appendChild(div);
  termBody.scrollTop = termBody.scrollHeight;
  return div;
}

async function typeCmd(text) {
  const line = print("", "cmd");
  if (reducedMotion) { line.textContent = text; return; }
  for (const ch of text) {
    line.textContent += ch;
    termBody.scrollTop = termBody.scrollHeight;
    await sleep(28 + Math.random() * 40);
  }
  await sleep(180);
}

const projectIndex = () => cards.map((c) => ({
  title: c.dataset.title,
  slug: c.dataset.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
  href: $("a.card-link", c)?.href || null,
  cat: $(".cat", c).textContent,
  el: c,
}));

const COMMANDS = {
  help: () => [
    '<span class="hl">available commands</span>',
    "  whoami       who is this",
    "  stack        what I build with",
    "  projects     list the portfolio",
    "  open &lt;name&gt;  open a project, e.g. <span class='hl2'>open reelradar</span>",
    "  telemetry    live numbers for your visit",
    "  ping         measure latency to the edge",
    "  contact      how to reach me",
    "  clear        clear the screen",
    '<span class="out">tip: press <span class="hl">⌘K</span> / <span class="hl">Ctrl K</span> anywhere for the command palette</span>',
  ].join("\n"),

  whoami: () => [
    '<span class="hl">Muvhulawa Muthula</span>, Solutions Development Engineer 🇿🇦',
    "Java 21 backends · payments (ISO 20022) · low latency · JVM performance",
    "Serverless AWS · infrastructure as code · applied AI",
  ].join("\n"),

  stack: () => [
    '<span class="hl2">lang</span>     Java 21 / 17 / 8 · TypeScript',
    '<span class="hl2">frame</span>    Spring Boot · Jakarta EE · Quarkus · JOSDK',
    '<span class="hl2">cloud</span>    AWS (Lambda, DynamoDB, CloudFront, ECS) · Azure · OCI',
    '<span class="hl2">iac</span>      AWS CDK · CloudFormation · Terraform · Kubernetes',
    '<span class="hl2">data</span>     PostgreSQL/PostGIS · MySQL · Redis · IBM MQ',
    '<span class="hl2">ai</span>       Claude API · langchain4j · RAG',
  ].join("\n"),

  projects: () => {
    const rows = [`<span class="hl">★ reelradar</span>  <span class="out">live → </span><a href="${REELRADAR_URL}" target="_blank" rel="noopener">${REELRADAR_URL.replace("https://", "")}</a>`];
    projectIndex().forEach((p) => rows.push(`  ${esc(p.slug.padEnd(30))} <span class="out">${esc(p.cat)}</span>`));
    rows.push('<span class="out">→ try </span><span class="hl2">open matching-engine</span>');
    return rows.join("\n");
  },

  open: (arg) => {
    const q = (arg || "").toLowerCase().trim();
    if (!q) return '<span class="warn">usage: open &lt;name&gt;</span>, see <span class="hl2">projects</span>';
    if ("reelradar".startsWith(q) || q.includes("reel")) {
      window.open(REELRADAR_URL, "_blank", "noopener");
      return `opening <span class="hl">ReelRadar</span> (live) ↗`;
    }
    if (q === "github") { window.open(GITHUB_URL, "_blank", "noopener"); return "opening GitHub ↗"; }
    const p = projectIndex().find((x) => x.slug.includes(q) || x.title.toLowerCase().includes(q));
    if (!p) return `<span class="err">no project matching "${esc(q)}"</span>`;
    if (p.href) { window.open(p.href, "_blank", "noopener"); return `opening <span class="hl">${esc(p.title)}</span> ↗`; }
    p.el.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
    return `<span class="hl">${esc(p.title)}</span> is a private repository. Demo on request.`;
  },

  telemetry: async () => {
    const t = await telemetry;
    if (!t.ok) return '<span class="warn">counter API unreachable (are you running locally?)</span>';
    return [
      `visitors   <span class="hl">${Number(t.count).toLocaleString()}</span>  <span class="out">(DynamoDB atomic ADD)</span>`,
      `edge       <span class="hl">${esc(t.pop || "unknown")}</span>${popCity(t.pop) ? `  <span class="out">(${popCity(t.pop)})</span>` : ""}`,
      `api rtt    <span class="hl">${t.rtt} ms</span>  <span class="out">(CloudFront → API Gateway → Lambda)</span>`,
    ].join("\n");
  },

  ping: async () => {
    const out = [];
    for (let i = 0; i < 3; i++) {
      const t0 = performance.now();
      try {
        const r = await fetch(`/?ping=${Date.now()}-${i}`, { method: "HEAD", cache: "no-store" });
        const ms = (performance.now() - t0).toFixed(1);
        out.push(`reply from ${esc(popCode(r.headers.get("x-amz-cf-pop")) || location.host)}: time=<span class="hl">${ms} ms</span>`);
      } catch {
        out.push('<span class="err">request timed out</span>');
      }
    }
    return out.join("\n");
  },

  contact: () => [
    `email   <a href="mailto:${EMAIL}">${EMAIL}</a>`,
    `github  <a href="${GITHUB_URL}" target="_blank" rel="noopener">github.com/muvhulawamuthula</a>`,
  ].join("\n"),

  ls: () => "about.md  projects/  stack.json  <span class='hl'>reelradar@live</span>",
  sudo: () => '<span class="warn">nice try. this incident will be reported to /dev/null</span>',
  clear: () => { termBody.innerHTML = ""; return null; },
};
COMMANDS["?"] = COMMANDS.help;
COMMANDS.reelradar = () => COMMANDS.open("reelradar");

async function run(raw, { echo = true } = {}) {
  const input = raw.trim();
  if (!input) return;
  if (echo) print(esc(input), "cmd");
  const [name, ...rest] = input.split(/\s+/);
  const fn = COMMANDS[name.toLowerCase()];
  if (!fn) { print(`<span class="err">command not found: ${esc(name)}</span>. Type <span class="hl2">help</span>`); return; }
  const result = await fn(rest.join(" "));
  if (result) print(result);
}

termForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy) return;
  const v = termInput.value;
  termInput.value = "";
  if (v.trim()) { history.push(v); histIdx = history.length; }
  await run(v);
});
termInput.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp" && history.length) { histIdx = Math.max(0, histIdx - 1); termInput.value = history[histIdx]; e.preventDefault(); }
  if (e.key === "ArrowDown" && history.length) { histIdx = Math.min(history.length, histIdx + 1); termInput.value = history[histIdx] || ""; e.preventDefault(); }
});
$("#terminal").addEventListener("click", (e) => { if (!e.target.closest("a")) termInput.focus({ preventScroll: true }); });

(async function boot() {
  busy = true;
  print('<span class="out">Last login: ' + new Date().toUTCString().replace("GMT", "UTC") + " on edge</span>");
  await sleep(400);
  await typeCmd("whoami");
  print(COMMANDS.whoami());
  await sleep(500);
  await typeCmd("curl -s /api/visitorCounter");
  print(await COMMANDS.telemetry());
  await sleep(500);
  await typeCmd("open reelradar --dry-run");
  print(`<span class="hl">★ ReelRadar</span> is live → <a href="${REELRADAR_URL}" target="_blank" rel="noopener">${REELRADAR_URL.replace("https://", "")}</a>`);
  await sleep(300);
  print('<span class="out">type </span><span class="hl2">help</span><span class="out"> to explore ↓</span>');
  busy = false;
})();

/* =========================================================================
   Command palette (⌘K / Ctrl+K / "/")
   ========================================================================= */
const palette = $("#palette");
const pInput = $("#palette-input");
const pList = $("#palette-list");
let pItems = [];
let pSel = 0;

const ACTIONS = [
  { label: "Open ReelRadar (live site)", hint: "live", run: () => window.open(REELRADAR_URL, "_blank", "noopener") },
  { label: "Go to: Featured work", hint: "section", run: () => goto("#work") },
  { label: "Go to: Projects", hint: "section", run: () => goto("#projects") },
  { label: "Go to: Architecture", hint: "section", run: () => goto("#architecture") },
  { label: "Go to: Principles", hint: "section", run: () => goto("#principles") },
  { label: "Go to: Stack", hint: "section", run: () => goto("#stack") },
  { label: "Go to: Contact", hint: "section", run: () => goto("#contact") },
  { label: "Copy email address", hint: "action", run: () => $("#copy-email").click() },
  { label: "Open GitHub profile", hint: "link", run: () => window.open(GITHUB_URL, "_blank", "noopener") },
  ...["fintech", "perf", "cloud", "ai", "product"].map((f) => ({
    label: `Filter projects: ${$(`.chip[data-filter="${f}"]`).childNodes[0].textContent.trim()}`,
    hint: "filter",
    run: () => { applyFilter(f); goto("#projects"); },
  })),
  ...projectIndex().map((p) => ({
    label: p.title,
    hint: p.href ? "repo ↗" : "private",
    run: () => (p.href ? window.open(p.href, "_blank", "noopener") : (goto("#projects"), setTimeout(() => p.el.scrollIntoView({ block: "center" }), 400))),
  })),
];

function goto(hash) { $(hash)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" }); }

// Simple subsequence fuzzy match with a score.
function fuzzy(q, s) {
  q = q.toLowerCase(); s = s.toLowerCase();
  if (!q) return 1;
  if (s.includes(q)) return 100 - s.indexOf(q);
  let i = 0, score = 0;
  for (const ch of s) { if (ch === q[i]) { i++; score++; } }
  return i === q.length ? score : 0;
}

function renderPalette() {
  const q = pInput.value.trim();
  pItems = ACTIONS.map((a) => ({ a, s: fuzzy(q, a.label) })).filter((x) => x.s > 0).sort((x, y) => y.s - x.s).map((x) => x.a);
  pSel = Math.min(pSel, Math.max(0, pItems.length - 1));
  pList.innerHTML = pItems.length
    ? pItems.map((a, i) => `<li role="option" id="po-${i}" data-i="${i}" aria-selected="${i === pSel}"><span>${esc(a.label)}</span><small>${esc(a.hint)}</small></li>`).join("")
    : '<li class="empty">No matches</li>';
  pInput.setAttribute("aria-activedescendant", pItems.length ? `po-${pSel}` : "");
  $(`#po-${pSel}`)?.scrollIntoView({ block: "nearest" });
}

function openPalette() {
  if (palette.open) return;
  pInput.value = ""; pSel = 0; renderPalette();
  palette.showModal();
  pInput.focus();
}
function choose(i) {
  const a = pItems[i];
  if (!a) return;
  palette.close();
  a.run();
}

$("#open-palette").addEventListener("click", openPalette);
pInput.addEventListener("input", () => { pSel = 0; renderPalette(); });
pInput.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") { pSel = (pSel + 1) % Math.max(1, pItems.length); renderPalette(); e.preventDefault(); }
  else if (e.key === "ArrowUp") { pSel = (pSel - 1 + pItems.length) % Math.max(1, pItems.length); renderPalette(); e.preventDefault(); }
  else if (e.key === "Enter") { e.preventDefault(); choose(pSel); }
});
pList.addEventListener("click", (e) => { const li = e.target.closest("li[data-i]"); if (li) choose(Number(li.dataset.i)); });
pList.addEventListener("mousemove", (e) => {
  const li = e.target.closest("li[data-i]");
  if (li && Number(li.dataset.i) !== pSel) { pSel = Number(li.dataset.i); renderPalette(); }
});
palette.addEventListener("click", (e) => { if (e.target === palette) palette.close(); });

document.addEventListener("keydown", (e) => {
  const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName);
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); palette.open ? palette.close() : openPalette(); }
  else if (e.key === "/" && !typing && !palette.open) { e.preventDefault(); openPalette(); }
});
