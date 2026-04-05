// ==UserScript==
// @name         PROVIN — VIN & Tirgus dati auto-fill
// @namespace    https://github.com/nilsvalainis/PROvin
// @version      1.3.0
// @description  Admin: GM_setValue no saitēm ar data-provin-handoff-*. Mērķi: GM_getValue / ?vin= / ?url=; React-friendly ievade.
// @match        http://localhost:*/admin*
// @match        http://127.0.0.1:*/admin*
// @match        https://provin.lv/admin*
// @match        https://www.provin.lv/admin*
// @match        https://*.vercel.app/admin*
// @match        https://www.carvertical.com/*
// @match        https://carvertical.com/*
// @match        https://www.auto-records.com/*
// @match        https://auto-records.com/*
// @match        https://tirgusdati.lv/*
// @match        https://www.tirgusdati.lv/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const host = window.location.hostname.replace(/^www\./, "");
  const params = new URLSearchParams(window.location.search);
  const path = window.location.pathname || "";

  const GM_PENDING_VIN = "provin_pending_vin";
  const GM_PENDING_URL = "provin_pending_url";

  /* ---------- Admin: saglabāt hand-off pirms jaunas cilnes ---------- */
  if (path.includes("/admin")) {
    document.addEventListener(
      "click",
      function (ev) {
        const t = ev.target;
        if (!t || typeof t.closest !== "function") return;
        const a = t.closest("a[href]");
        if (!a || !(a instanceof HTMLAnchorElement)) return;
        const href = a.getAttribute("href") || "";
        const vin = (a.dataset.provinHandoffVin || "").trim();
        if (vin && /carvertical\.com/i.test(href)) {
          try {
            GM_setValue(GM_PENDING_VIN, vin);
          } catch (e) {
            console.warn("PROVIN admin: GM_setValue VIN", e);
          }
        }
        const listingUrl = (a.dataset.provinHandoffListingUrl || "").trim();
        if (listingUrl && /tirgusdati\.lv/i.test(href)) {
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

  console.log("PROVIN skripts ielādēts: " + window.location.href);

  /**
   * Imitē reālu ievadi — apiet React 16+ _valueTracker.
   */
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
    /** 250 ms solis — pirmais ~2 s (8×) + turpinājums līdz lauks parādās */
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

  function consumePendingVin() {
    let vin = "";
    try {
      const g = GM_getValue(GM_PENDING_VIN, "");
      if (g && String(g).trim()) {
        vin = String(g)
          .replace(/[\s-]/g, "")
          .toUpperCase();
        GM_deleteValue(GM_PENDING_VIN);
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
        localStorage.removeItem("provin_pending_vin");
      }
    }
    if (!vin) {
      const vinRaw = params.get("vin");
      if (vinRaw && String(vinRaw).trim()) {
        vin = String(vinRaw)
          .replace(/[\s-]/g, "")
          .toUpperCase();
      }
    }
    return vin;
  }

  const vin = consumePendingVin();
  if (!vin) return;

  function findCarVerticalVinInput(extended) {
    const bySelector = [
      "#vin-input",
      'input[name="vin"]',
      'input[autocomplete="off"][name="vin"]',
      'input[placeholder*="VIN"]',
      'input[placeholder*="vin"]',
      "input[type=search]",
    ];
    for (const sel of bySelector) {
      try {
        const el = document.querySelector(sel);
        if (el && isVisible(el) && !el.disabled && el.tagName === "INPUT") return el;
      } catch {
        /* nederīgs selektors */
      }
    }
    for (const el of document.querySelectorAll("input[data-testid]")) {
      if (!isVisible(el) || el.disabled) continue;
      const t = (el.getAttribute("data-testid") || "").toLowerCase();
      if (t.includes("vin")) return el;
    }
    for (const el of document.querySelectorAll("input[aria-label]")) {
      if (!isVisible(el) || el.disabled) continue;
      const t = (el.getAttribute("aria-label") || "").toLowerCase();
      if (t.includes("vin")) return el;
    }
    if (extended) {
      for (const el of document.querySelectorAll('input[type="text"], input[type="search"]')) {
        if (!isVisible(el) || el.disabled) continue;
        const n = (el.name || "").toLowerCase();
        const id = (el.id || "").toLowerCase();
        const ph = (el.getAttribute("placeholder") || "").toLowerCase();
        if (n.includes("vin") || id.includes("vin") || ph.includes("vin")) return el;
      }
    }
    return null;
  }

  function primeCarVerticalInput(el) {
    try {
      el.focus();
      el.click();
    } catch {
      /* ignore */
    }
  }

  function clickCarVerticalCheck() {
    const buttons = Array.from(document.querySelectorAll("button, [role='button'], a[role='button']"));
    const byText = buttons.find((b) => {
      const t = (b.textContent || "").trim();
      return /pārbaudīt|check|verify|turpin|continue|search|meklēt/i.test(t);
    });
    if (byText) {
      byText.click();
      return;
    }
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

  const isCV = host.endsWith("carvertical.com");
  const isAR = host.endsWith("auto-records.com");

  if (!isCV && !isAR) return;

  let tries = 0;
  const maxTries = 120;
  let done = false;
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
        primeCarVerticalInput(el);
        window.setTimeout(() => {
          setNativeValue(el, vin);
          console.log("PROVIN CarVertical: aizpildīts VIN lauks", el);
          window.setTimeout(clickCarVerticalCheck, 400);
        }, 50);
      }
    } else if (isAR) {
      const el = findAutoRecordsVinInput();
      if (el && !el.disabled) {
        setNativeValue(el, vin);
        done = true;
        window.clearInterval(interval);
        console.log("PROVIN Auto-Records: aizpildīts VIN lauks", el);
      }
    }
  }, 250);
})();
