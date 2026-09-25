// ==UserScript==
// @name         PROVIN — VIN & Tirgus dati auto-fill
// @namespace    https://github.com/nilsvalainis/PROvin
// @version      1.7.4
// @description  Admin MENU VIN auto-fill. car.info + checkcar.vin. AutoDNA arī atver CarVertical.
// @updateURL    https://www.provin.lv/userscripts/provin-vin-autofill.user.js
// @downloadURL  https://www.provin.lv/userscripts/provin-vin-autofill.user.js
// @match        http://localhost:*/admin*
// @match        http://127.0.0.1:*/admin*
// @match        https://provin.lv/admin*
// @match        https://www.provin.lv/admin*
// @match        https://*.vercel.app/admin*
// @match        https://www.carvertical.com/*
// @match        https://carvertical.com/*
// @match        https://www.auto-records.com/*
// @match        https://auto-records.com/*
// @match        https://www.autodna.lv/*
// @match        https://autodna.lv/*
// @match        https://www.autodna.com/*
// @match        https://autodna.com/*
// @match        https://www.checkthisreg.com/*
// @match        https://checkthisreg.com/*
// @match        https://www.car.info/*
// @match        https://car.info/*
// @match        https://checkcar.vin/*
// @match        https://www.checkcar.vin/*
// @match        https://tirgusdati.lv/*
// @match        https://www.tirgusdati.lv/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_setClipboard
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const SCRIPT_VERSION = "1.7.4";
  const host = window.location.hostname.replace(/^www\./, "");
  const params = new URLSearchParams(window.location.search);
  const path = window.location.pathname || "";
  try {
    document.documentElement.setAttribute("data-provin-userscript", SCRIPT_VERSION);
  } catch {
    /* ignore */
  }

  const GM_PENDING_VIN = "provin_pending_vin";
  const GM_PENDING_URL = "provin_pending_url";
  const GM_CC_PROBE = "provin_cc_photo_probe";
  const GM_CC_RESULT = "provin_cc_photo_result";

  /* ---------- Admin: saglabāt hand-off pirms jaunas cilnes ---------- */
  if (path.includes("/admin")) {
    document.addEventListener(
      "click",
      function (ev) {
        const t = ev.target;
        if (!t || typeof t.closest !== "function") return;
        const probeEl = t.closest("[data-provin-cc-photo-probe]");
        if (probeEl instanceof HTMLElement) {
          const probeVin = (probeEl.dataset.provinHandoffVin || "").trim();
          console.log("PROVIN admin: CC foto poga nospiesta, VIN =", probeVin);
          try {
            if (probeVin) GM_setValue(GM_PENDING_VIN, probeVin);
            GM_setValue(GM_CC_PROBE, probeVin);
            GM_deleteValue(GM_CC_RESULT);
          } catch (e) {
            console.warn("PROVIN admin: CC foto", e);
          }
          let polls = 0;
          const timer = window.setInterval(() => {
            polls += 1;
            let raw = "";
            try {
              raw = String(GM_getValue(GM_CC_RESULT, "") || "");
            } catch {
              raw = "";
            }
            if (raw) {
              window.clearInterval(timer);
              console.log("PROVIN admin: CC foto atbilde saņemta", raw);
              try {
                const data = JSON.parse(raw);
                document.dispatchEvent(new CustomEvent("provin-cc-photo", { detail: data }));
                GM_deleteValue(GM_CC_RESULT);
              } catch {
                /* ignore */
              }
              return;
            }
            if (polls > 130) {
              window.clearInterval(timer);
              console.warn("PROVIN admin: CC foto atbilde nesagaidīta");
            }
          }, 500);
        }
        const a = t.closest("a[href]");
        if (!a || !(a instanceof HTMLAnchorElement)) return;
        const vin = (a.dataset.provinHandoffVin || "").trim();
        if (vin) {
          try {
            GM_setValue(GM_PENDING_VIN, vin);
          } catch (e) {
            console.warn("PROVIN admin: GM_setValue VIN", e);
          }
        }
        const listingUrl = (a.dataset.provinHandoffListingUrl || "").trim();
        if (listingUrl && /tirgusdati\.lv/i.test(a.getAttribute("href") || "")) {
          try {
            GM_setValue(GM_PENDING_URL, listingUrl);
          } catch (e) {
            console.warn("PROVIN admin: GM_setValue URL", e);
          }
        }
      },
      true,
    );
    return;
  }

  console.log("PROVIN skripts (v" + SCRIPT_VERSION + ") ielādēts: " + window.location.href);

  if (host.endsWith("checkcar.vin") && document.body) {
    const boot = document.createElement("div");
    boot.id = "provin-cc-photo-badge";
    boot.textContent = "PROVIN " + SCRIPT_VERSION;
    boot.style.cssText =
      "position:fixed;z-index:2147483647;right:16px;bottom:16px;background:#0f172a;color:#fff;padding:10px 14px;border-radius:12px;font:600 14px/1.3 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)";
    document.body.appendChild(boot);
  }

  function setNativeValue(element, value) {
    if (!element || (element.tagName !== "INPUT" && element.tagName !== "TEXTAREA")) return;
    const lastValue = element.value;
    element.value = value;
    const event = new Event("input", { bubbles: true });
    const tracker = element._valueTracker;
    if (tracker && typeof tracker.setValue === "function") {
      tracker.setValue(lastValue);
    }
    element.dispatchEvent(event);
    element.dispatchEvent(new Event("change", { bubbles: true }));
    try {
      element.dispatchEvent(
        new InputEvent("input", { bubbles: true, data: value, inputType: "insertFromPaste" }),
      );
    } catch {
      /* vecāki pārlūki */
    }
  }

  function isVisible(el) {
    if (!el || !(el instanceof HTMLElement)) return false;
    const st = window.getComputedStyle(el);
    if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function clickByText(pattern) {
    const buttons = Array.from(document.querySelectorAll("button, [role='button'], a[role='button'], input[type='submit']"));
    const byText = buttons.find((b) => {
      if (!isVisible(b) || b.disabled) return false;
      const t = ((b.textContent || b.value || "") + "").trim();
      return pattern.test(t);
    });
    if (byText) {
      byText.click();
      return true;
    }
    return false;
  }

  function consumePendingUrl() {
    let text = "";
    try {
      const g = GM_getValue(GM_PENDING_URL, "");
      if (g && String(g).trim()) {
        text = String(g).trim();
        GM_deleteValue(GM_PENDING_URL);
      }
    } catch {
      /* ignore */
    }
    if (!text) {
      const ls = localStorage.getItem("provin_pending_url");
      if (ls && ls.trim()) {
        text = ls.trim();
        localStorage.removeItem("provin_pending_url");
      }
    }
    if (!text) {
      const urlParam = params.get("url");
      if (urlParam && String(urlParam).trim()) {
        text = String(urlParam);
        try {
          text = decodeURIComponent(text);
        } catch {
          /* jau dekodēts */
        }
        text = text.trim();
      }
    }
    return text;
  }

  /* ---------- Tirgus dati: GM / localStorage / ?url= ---------- */
  if (host.endsWith("tirgusdati.lv")) {
    const text = consumePendingUrl();
    if (!text) return;

    function findTirgusListingUrlInput() {
      const list = document.querySelectorAll("input");
      for (const el of list) {
        if (!isVisible(el) || el.disabled) continue;
        const ph = (el.getAttribute("placeholder") || "").toLowerCase();
        if (ph.includes("ievadi") && ph.includes("sludinājuma") && ph.includes("adresi")) return el;
        if (ph.includes("sludinājuma") && ph.includes("adresi")) return el;
        if (ph.includes("ievadi") && ph.includes("sludinājuma")) return el;
        if (ph.includes("ievadi")) return el;
      }
      const byClass =
        document.querySelector(".listing-url-input") ||
        document.querySelector("#listing_url") ||
        document.querySelector('input[name="listing_url"]') ||
        document.querySelector('input[name="url"]');
      if (byClass && isVisible(byClass) && !byClass.disabled) return byClass;

      const forms = document.querySelectorAll("form");
      for (const form of forms) {
        const inp = form.querySelector('input[type="text"]:not([readonly])');
        if (inp && isVisible(inp) && !inp.disabled) return inp;
      }
      return null;
    }

    let done = false;
    let tirgusObs = null;
    function tryFillTirgus() {
      if (done) return;
      const el = findTirgusListingUrlInput();
      if (el && !el.disabled) {
        setNativeValue(el, text);
        done = true;
        if (tirgusObs) tirgusObs.disconnect();
        console.log("PROVIN Tirgus dati: aizpildīts lauks", el);
      }
    }

    tryFillTirgus();

    tirgusObs = new MutationObserver(() => {
      tryFillTirgus();
    });
    tirgusObs.observe(document.documentElement, { childList: true, subtree: true });

    let tries = 0;
    const interval = window.setInterval(() => {
      tries += 1;
      tryFillTirgus();
      if (done || tries >= 140) {
        window.clearInterval(interval);
        if (tirgusObs) tirgusObs.disconnect();
      }
    }, 250);

    window.setTimeout(() => {
      if (tirgusObs) tirgusObs.disconnect();
    }, 60000);

    return;
  }

  function vinFromAutodnaPath() {
    const m = path.match(/\/vin\/([A-HJ-NPR-Z0-9]{11,17})/i);
    return m ? String(m[1]).toUpperCase() : "";
  }

  function vinFromCheckcarPath() {
    const m = path.match(/\/report\/check\/([A-HJ-NPR-Z0-9]{11,17})/i);
    return m ? String(m[1]).toUpperCase() : "";
  }

  function peekPendingVin() {
    let vin = "";
    try {
      const g = GM_getValue(GM_PENDING_VIN, "");
      if (g && String(g).trim()) {
        vin = String(g)
          .replace(/[\s-]/g, "")
          .toUpperCase();
      }
    } catch {
      /* ignore */
    }
    if (!vin) {
      const ls = localStorage.getItem("provin_pending_vin");
      if (ls && ls.trim()) {
        vin = String(ls)
          .replace(/[\s-]/g, "")
          .toUpperCase();
      }
    }
    if (!vin) {
      const vinRaw = params.get("vin") || params.get("q");
      if (vinRaw && String(vinRaw).trim()) {
        vin = String(vinRaw)
          .replace(/[\s-]/g, "")
          .toUpperCase();
      }
    }
    if (!vin) vin = vinFromAutodnaPath();
    if (!vin) vin = vinFromCheckcarPath();
    return vin;
  }

  function clearPendingVin() {
    try {
      GM_deleteValue(GM_PENDING_VIN);
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem("provin_pending_vin");
    } catch {
      /* ignore */
    }
  }

  const vin = peekPendingVin();
  if (!vin) return;

  function fieldAlreadyHasVin(el) {
    return String(el.value || "")
      .replace(/[\s-]/g, "")
      .toUpperCase() === vin;
  }

  function fillAndClear(el) {
    if (!fieldAlreadyHasVin(el)) {
      try {
        el.focus();
        el.click();
      } catch {
        /* ignore */
      }
      setNativeValue(el, vin);
    }
    clearPendingVin();
    console.log("PROVIN: aizpildīts VIN lauks", el);
  }

  function findCarVerticalVinInput(extended) {
    const nodes = document.querySelectorAll("input, textarea");
    const bySelector = [
      "#vin-input",
      'input[name="vin"]',
      'textarea[name="vin"]',
      'input[placeholder*="VIN"]',
      'textarea[placeholder*="VIN"]',
      'input[placeholder*="vin"]',
      'textarea[placeholder*="vin"]',
      "input[type=search]",
    ];
    for (const sel of bySelector) {
      try {
        const el = document.querySelector(sel);
        if (el && isVisible(el) && !el.disabled) return el;
      } catch {
        /* nederīgs selektors */
      }
    }
    for (const el of nodes) {
      if (!isVisible(el) || el.disabled) continue;
      const t = (
        (el.getAttribute("data-testid") || "") +
        " " +
        (el.getAttribute("aria-label") || "") +
        " " +
        (el.getAttribute("placeholder") || "")
      ).toLowerCase();
      if (t.includes("vin")) return el;
    }
    if (extended) {
      for (const el of document.querySelectorAll('input[type="text"], input[type="search"], textarea')) {
        if (!isVisible(el) || el.disabled) continue;
        const n = (el.name || "").toLowerCase();
        const id = (el.id || "").toLowerCase();
        const ph = (el.getAttribute("placeholder") || "").toLowerCase();
        if (n.includes("vin") || id.includes("vin") || ph.includes("vin") || ph.includes("numur")) return el;
      }
    }
    return null;
  }

  function clickCarVerticalCheck() {
    if (clickByText(/sākt pārbaudi|pārbaudīt|pārbaudi|check|verify|turpin|continue|search|meklēt/i)) return;
    const submit = document.querySelector('form button[type="submit"], button[type="submit"]');
    submit?.click();
  }

  function findAutoRecordsVinInput() {
    const list = document.querySelectorAll("input");
    for (const el of list) {
      if (!isVisible(el) || el.disabled) continue;
      const ph = (el.getAttribute("placeholder") || "").toLowerCase();
      if (ph.includes("full 17") && ph.includes("vin")) return el;
      if (ph.includes("17 digit") && ph.includes("vin")) return el;
    }
    return (
      document.querySelector("#vin_number") ||
      document.querySelector(".vin-input") ||
      document.querySelector('input[name="vin"]') ||
      document.querySelector('input[name="vin_number"]')
    );
  }

  function findAutodnaVinInput() {
    const list = document.querySelectorAll("input, textarea");
    for (const el of list) {
      if (!isVisible(el) || el.disabled || el.type === "password" || el.type === "email") continue;
      const ph = (el.getAttribute("placeholder") || "").toLowerCase();
      const n = (el.name || "").toLowerCase();
      const id = (el.id || "").toLowerCase();
      if (ph.includes("ievadi vin") || ph.includes("ieavadi vin")) return el;
      if (ph.includes("vin") && !ph.includes("e-past")) return el;
      if (n === "vin" || id.includes("vin")) return el;
    }
    return null;
  }

  function autodnaLoginModalOpen() {
    const title = Array.from(document.querySelectorAll("h1, h2, h3, div, span")).find((el) => {
      if (!isVisible(el)) return false;
      return /^(ienākt|log in|login)$/i.test((el.textContent || "").trim());
    });
    const pass = document.querySelector('input[type="password"]');
    return Boolean(title && pass && isVisible(pass));
  }

  function tryAutodnaLogin() {
    let email = "";
    let password = "";
    try {
      email = String(GM_getValue("provin_autodna_email", "") || "").trim();
      password = String(GM_getValue("provin_autodna_password", "") || "");
    } catch {
      /* ignore */
    }
    if (!email || !password) return false;
    const inputs = Array.from(document.querySelectorAll("input")).filter((el) => isVisible(el) && !el.disabled);
    const emailEl = inputs.find((el) => {
      const ph = (el.getAttribute("placeholder") || "").toLowerCase();
      return el.type === "email" || ph.includes("e-past") || ph.includes("email");
    });
    const passEl = inputs.find((el) => el.type === "password");
    if (!emailEl || !passEl) return false;
    setNativeValue(emailEl, email);
    setNativeValue(passEl, password);
    const boxes = Array.from(document.querySelectorAll('input[type="checkbox"]')).filter(isVisible);
    for (const box of boxes) {
      if (!box.checked) box.click();
    }
    window.setTimeout(() => {
      clickByText(/^(ienākt|log in|login)$/i);
    }, 120);
    return true;
  }

  function clickAutodnaCheck() {
    clickByText(/pārbaudi vin|pārbaudīt vin|check vin|pārbaudi/i);
  }

  function clickCheckThisRegVinTab() {
    const candidates = document.querySelectorAll("button, [role='tab'], a, label, span, div");
    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const t = (el.textContent || "").trim();
      if (/^VIN$/i.test(t)) {
        el.click();
        return true;
      }
    }
    return false;
  }

  function findCheckThisRegVinInput() {
    const list = document.querySelectorAll("input, textarea");
    for (const el of list) {
      if (!isVisible(el) || el.disabled) continue;
      const ph = (el.getAttribute("placeholder") || "").toLowerCase();
      const n = (el.name || "").toLowerCase();
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      if (ph.includes("registration") || n.includes("reg") || aria.includes("registration")) continue;
      if (ph.includes("vin") || n.includes("vin") || aria.includes("vin")) return el;
    }
    return null;
  }

  function clickCheckThisRegSubmit() {
    clickByText(/get report|check my car|pārbaudīt/i);
  }

  function findCarinfoSearchInput() {
    const preferred = document.querySelector(
      'form.nav_search input.searchfield, input.searchfield[name="query"], input[name="query"][role="searchbox"]',
    );
    if (preferred && isVisible(preferred) && !preferred.disabled) return preferred;
    const list = document.querySelectorAll("input");
    for (const el of list) {
      if (!isVisible(el) || el.disabled || el.type === "password" || el.type === "hidden") continue;
      const ph = (el.getAttribute("placeholder") || "").toLowerCase();
      const n = (el.name || "").toLowerCase();
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      const cls = (el.className || "").toLowerCase();
      if (n === "query" || cls.includes("searchfield")) return el;
      if (n === "q" || el.type === "search") return el;
      if (ph.includes("search") || ph.includes("vin") || ph.includes("licence") || ph.includes("license")) return el;
      if (aria.includes("search") || aria.includes("vin")) return el;
    }
    return document.querySelector('input[name="query"], input[name="q"], input[type="search"]');
  }

  function pressEnter(el) {
    try {
      el.focus();
    } catch {
      /* ignore */
    }
    const opts = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
    el.dispatchEvent(new KeyboardEvent("keydown", opts));
    el.dispatchEvent(new KeyboardEvent("keypress", opts));
    el.dispatchEvent(new KeyboardEvent("keyup", opts));
    /* car.info meklēšana ir JS overlay — form.requestSubmit ved uz 404 /search?q= */
  }

  function clickCarinfoSearchIcon() {
    const icon = document.querySelector("form.nav_search .form_search_common_icon");
    if (icon && isVisible(icon)) {
      icon.click();
      return true;
    }
    return false;
  }

  function clickCarinfoReadMore() {
    const nodes = Array.from(document.querySelectorAll("button, a, [role='button']"));
    const btn = nodes.find((b) => isVisible(b) && /^read more$/i.test((b.textContent || "").trim()));
    if (!btn) return false;
    btn.click();
    return true;
  }

  function carinfoHasVehicleInfo() {
    const t = document.body.innerText || "";
    return /vehicle info|mileage/i.test(t) && /\d[\d\s.,]{2,}\s+km/i.test(t);
  }

  function copyCarinfoPageText() {
    const text = (document.body.innerText || "").replace(/[ \t]+/g, " ").trim();
    if (text.length < 80) return false;
    try {
      if (typeof GM_setClipboard === "function") GM_setClipboard(text);
    } catch {
      /* ignore */
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      navigator.clipboard.writeText(text).catch(() => undefined);
    }
    console.log("PROVIN car.info: lapas teksts nokopēts starpliktuvē");
    return true;
  }

  function rememberCheckcarPhoto(seen, src) {
    const clean = String(src || "").trim().toLowerCase();
    if (!clean || clean.startsWith("data:")) return false;
    if (/logo|icon|flag|sprite|avatar|payment|visa|mastercard|favicon/.test(clean)) return false;
    if (seen.has(clean)) return false;
    seen.add(clean);
    return true;
  }

  function countCheckcarPhotos() {
    const seen = new Set();
    let count = 0;
    for (const img of document.querySelectorAll("img")) {
      const src =
        img.currentSrc || img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || "";
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if ((w && w < 80) || (h && h < 80)) continue;
      if (rememberCheckcarPhoto(seen, src)) count += 1;
    }
    for (const el of document.querySelectorAll("[style*='background']")) {
      const style = el.getAttribute("style") || "";
      const match = style.match(/url\((['"]?)(https?:[^)'"]+)/i);
      if (match && rememberCheckcarPhoto(seen, match[2])) count += 1;
    }
    return count;
  }

  function publishCheckcarPhotos(probeVin, count, error) {
    try {
      GM_setValue(
        GM_CC_RESULT,
        JSON.stringify({ vin: probeVin, count, error: error || "", at: Date.now() }),
      );
      GM_deleteValue(GM_CC_PROBE);
    } catch (e) {
      console.warn("PROVIN checkcar", e);
    }
    let badge = document.getElementById("provin-cc-photo-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "provin-cc-photo-badge";
      badge.style.cssText =
        "position:fixed;z-index:2147483647;right:16px;bottom:16px;background:#0f172a;color:#fff;padding:10px 14px;border-radius:12px;font:600 14px/1.3 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)";
      document.body.appendChild(badge);
    }
    badge.textContent = error ? error : count > 0 ? "Ir foto" : "Nav foto";
  }

  function watchCheckcarPhotos(probeVin) {
    let last = -1;
    let stable = 0;
    let ticks = 0;
    const timer = window.setInterval(() => {
      ticks += 1;
      const text = document.body.innerText || "";
      const challenge = /security verification|just a moment/i.test(text);
      const ready = !challenge && text.toUpperCase().includes(probeVin);
      const count = ready ? countCheckcarPhotos() : 0;
      if (ready) {
        if (count === last) stable += 1;
        else {
          last = count;
          stable = 0;
        }
        /* Admin panelim vajag tikai faktu, vai bildes ir. Pirmo foto pietiek. */
        if (count > 0 && stable >= 1) {
          console.log("PROVIN checkcar: ir foto");
          window.clearInterval(timer);
          publishCheckcarPhotos(probeVin, count, "");
        } else if (count === 0 && ticks >= 24 && stable >= 8) {
          console.log("PROVIN checkcar: atskaitē nav fotogrāfiju");
          window.clearInterval(timer);
          publishCheckcarPhotos(probeVin, 0, "");
        }
      }
      if (ticks > 90) {
        console.log("PROVIN checkcar: laiks izbeidzies gaidot atskaiti", { ready, last });
        window.clearInterval(timer);
        publishCheckcarPhotos(probeVin, Math.max(last, 0), ready ? "" : "Nav atbildes");
      }
    }, 500);
  }

  const isCV = host.endsWith("carvertical.com");
  const isAR = host.endsWith("auto-records.com");
  const isDNA = host.endsWith("autodna.lv") || host.endsWith("autodna.com");
  const isCTR = host.endsWith("checkthisreg.com");
  const isInfo = host.endsWith("car.info");
  const isCheckcar = host.endsWith("checkcar.vin");

  if (!isCV && !isAR && !isDNA && !isCTR && !isInfo && !isCheckcar) return;

  let tries = 0;
  const maxTries = 220;
  let done = false;
  let ctrTabClicked = false;
  let dnaLoginAttempted = false;
  let infoFilled = false;
  let infoSubmitted = false;
  let infoReadMore = false;
  let infoCopied = false;

  const interval = window.setInterval(() => {
    tries += 1;
    if (done || tries >= maxTries) {
      window.clearInterval(interval);
      return;
    }
    const elapsed1s = tries >= 4;

    if (isCV) {
      const el = findCarVerticalVinInput(elapsed1s);
      if (el && !el.disabled && !done) {
        done = true;
        window.clearInterval(interval);
        fillAndClear(el);
        window.setTimeout(clickCarVerticalCheck, 400);
      }
      return;
    }

    if (isAR) {
      const el = findAutoRecordsVinInput();
      if (el && !el.disabled) {
        fillAndClear(el);
        done = true;
        window.clearInterval(interval);
      }
      return;
    }

    if (isDNA) {
      if (autodnaLoginModalOpen()) {
        if (!dnaLoginAttempted) {
          dnaLoginAttempted = true;
          tryAutodnaLogin();
        }
        return;
      }
      const el = findAutodnaVinInput();
      if (el && !el.disabled && !done) {
        done = true;
        window.clearInterval(interval);
        fillAndClear(el);
        window.setTimeout(clickAutodnaCheck, 350);
      }
      return;
    }

    if (isCTR) {
      if (!ctrTabClicked) {
        ctrTabClicked = clickCheckThisRegVinTab();
      }
      const el = findCheckThisRegVinInput();
      if (el && !el.disabled && !done) {
        done = true;
        window.clearInterval(interval);
        fillAndClear(el);
        window.setTimeout(clickCheckThisRegSubmit, 400);
      }
      return;
    }

    if (isInfo) {
      if (carinfoHasVehicleInfo()) {
        if (!infoReadMore && clickCarinfoReadMore()) infoReadMore = true;
        if (!infoCopied) {
          if (copyCarinfoPageText()) {
            infoCopied = true;
            done = true;
            window.clearInterval(interval);
          }
        }
        return;
      }
      const el = findCarinfoSearchInput();
      if (el && !el.disabled && !infoFilled) {
        fillAndClear(el);
        infoFilled = true;
      }
      if (infoFilled && !infoSubmitted) {
        const searchEl = el || findCarinfoSearchInput();
        if (searchEl) {
          pressEnter(searchEl);
          clickCarinfoSearchIcon();
          infoSubmitted = true;
        }
      }
      if (!infoReadMore && clickCarinfoReadMore()) infoReadMore = true;
      return;
    }

    if (isCheckcar) {
      if (done) return;
      const pathVin = vinFromCheckcarPath();
      let probeStored = "";
      try {
        probeStored = String(GM_getValue(GM_CC_PROBE, "") || "");
      } catch {
        probeStored = "";
      }
      const probeVin = (pathVin || probeStored || vin || "").replace(/[\s-]/g, "").toUpperCase();
      if (!pathVin) {
        if (probeVin.length < 11) return;
        done = true;
        window.clearInterval(interval);
        console.log("PROVIN checkcar: atveru atskaiti", probeVin);
        location.assign("https://checkcar.vin/report/check/" + encodeURIComponent(probeVin));
        return;
      }
      done = true;
      window.clearInterval(interval);
      console.log("PROVIN checkcar: skaitu fotogrāfijas", probeVin);
      watchCheckcarPhotos(probeVin);
    }
  }, 250);
})();
