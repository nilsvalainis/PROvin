/*!
 * PROVIN Business poga partnera vietnei. Dizains: docs/makets-business-poga/GALA-poga.md
 *
 * Ievietošana auto sludinājuma lapā:
 *   <div data-provin-business data-partner="ptr_..." data-vin="WAUZZZ..."></div>
 *   <script async src="https://www.provin.lv/embed/provin-business.js"></script>
 *
 * Neobligāti: data-plate (ja VIN nav), data-title, data-img, data-year, data-km, data-fuel, data-gear,
 * data-tone="light|dark", data-height (px), data-radius (px).
 * Poga ir Shadow DOM, tāpēc partnera CSS to nesabojā. Bez VIN un numurzīmes poga netiek rādīta.
 */
(function () {
  "use strict";
  var script = document.currentScript;
  var ORIGIN = "https://www.provin.lv";
  try {
    if (script && script.src) ORIGIN = new URL(script.src).origin;
  } catch (e) {}

  var CSS =
    ":host{all:initial;display:block}" +
    "a{all:unset;box-sizing:border-box;position:relative;overflow:hidden;display:flex;align-items:center;gap:14px;width:100%;cursor:pointer;" +
    "padding:0 16px 0 18px;font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased;" +
    "color:#0c0d10;background:linear-gradient(160deg,#fff 0%,#eceef2 100%);border:1px solid rgba(0,0,0,.12);" +
    "box-shadow:inset 0 1px 0 #fff,0 10px 24px -16px rgba(0,0,0,.35);transition:transform .15s ease,box-shadow .15s ease}" +
    "a:hover{box-shadow:inset 0 1px 0 #fff,0 14px 28px -16px rgba(0,0,0,.45)}" +
    "a:active{transform:translateY(1px)}" +
    "a:focus-visible{outline:2px solid #2563eb;outline-offset:2px}" +
    "a::after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(105deg,transparent 38%,rgba(255,255,255,.75) 48%,transparent 58%)}" +
    "span{position:relative;z-index:1}" +
    ".wm{flex:none;font-weight:800;font-size:24px;letter-spacing:-.035em;line-height:1;white-space:nowrap}" +
    ".wm b{font-weight:800;color:#2563eb}" +
    ".act{flex:1;min-width:0;font-size:13px;font-weight:600;line-height:1.25;text-wrap:balance;padding-left:14px;border-left:1px solid rgba(0,0,0,.14)}" +
    ".end{flex:none;display:flex;align-items:center;gap:8px}" +
    ".p{font-weight:800;font-size:17px;white-space:nowrap}" +
    "svg{display:block;width:20px;height:20px}" +
    "svg path{fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}" +
    "a.dark{color:#fff;background:linear-gradient(160deg,#2b2f38 0%,#1a1d23 100%);border-color:rgba(255,255,255,.14);" +
    "box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 14px 30px -18px rgba(0,0,0,.65)}" +
    "a.dark::after{background:linear-gradient(105deg,transparent 38%,rgba(255,255,255,.10) 48%,transparent 58%)}" +
    "a.dark .wm b{color:#5c9dff}" +
    "a.dark .act{border-left-color:rgba(255,255,255,.18)}" +
    /* Šaurai vietai: PROVIN un cena augšā, sauklis zem tiem */
    "a.compact{display:grid;grid-template-columns:1fr auto;grid-template-rows:auto auto;row-gap:6px;padding:12px 14px;height:auto!important}" +
    "a.compact .wm{grid-column:1;grid-row:1;font-size:21px}" +
    "a.compact .end{grid-column:2;grid-row:1}" +
    "a.compact .act{grid-column:1/-1;grid-row:2;padding-left:0;border-left:0}";

  var LABEL = "Pilnīgākā auto vēstures pārbaude Eiropā";

  function num(v, min, max, def) {
    var n = parseInt(v, 10);
    return isFinite(n) && n >= min && n <= max ? n : def;
  }

  function buildHref(d) {
    var partner = (d.partner || "").trim();
    if (!/^ptr_[a-f0-9]{16}$/.test(partner)) return "";
    var vin = (d.vin || "").replace(/\s+/g, "").toUpperCase();
    var plate = (d.plate || "").replace(/[\s-]+/g, "").toUpperCase();
    if (vin.length !== 17 && !plate) return "";
    var q = new URLSearchParams();
    if (vin.length === 17) q.set("vin", vin);
    else q.set("plate", plate);
    q.set("url", location.href.split("#")[0]);
    ["title", "img", "year", "km", "fuel", "gear"].forEach(function (k) {
      if (d[k]) q.set(k, String(d[k]).slice(0, 300));
    });
    return ORIGIN + "/b/p/" + partner + "?" + q.toString();
  }

  function mount(host) {
    if (host.__provinBusiness) return;
    var d = host.dataset;
    var href = buildHref(d);
    if (!href) return;
    host.__provinBusiness = true;

    var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;
    var style = document.createElement("style");
    style.textContent = CSS;
    var a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    /** Domēna pārbaudei PROVIN pusē vajag vismaz partnera origin, arī ja lapai ir stingrāka politika. */
    a.referrerPolicy = "strict-origin-when-cross-origin";
    a.setAttribute("aria-label", "PROVIN - " + LABEL + ", 69,99 €");
    if (d.tone === "dark") a.className = "dark";
    a.style.height = num(d.height, 40, 120, 60) + "px";
    a.style.borderRadius = num(d.radius, 0, 40, 0) + "px";
    a.innerHTML =
      '<span class="wm">PRO<b>VIN</b></span>' +
      '<span class="act">' + LABEL + "</span>" +
      '<span class="end"><span class="p">69,99 €</span>' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></span>';
    root.appendChild(style);
    root.appendChild(a);

    function fit() {
      var w = host.getBoundingClientRect().width;
      var compact = w > 0 && w < 400;
      a.classList.toggle("compact", compact);
    }
    fit();
    if (window.ResizeObserver) new ResizeObserver(fit).observe(host);
  }

  function ensureFont() {
    if (document.querySelector('link[data-provin-font]')) return;
    var l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Inter:wght@600;800&display=swap";
    l.setAttribute("data-provin-font", "");
    document.head.appendChild(l);
  }

  function run() {
    var hosts = document.querySelectorAll("[data-provin-business]");
    if (!hosts.length) return;
    ensureFont();
    for (var i = 0; i < hosts.length; i++) mount(hosts[i]);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
  /** Lapas, kas sludinājumu ielādē vēlāk (SPA). */
  if (window.MutationObserver) {
    var t;
    new MutationObserver(function () {
      clearTimeout(t);
      t = setTimeout(run, 200);
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
