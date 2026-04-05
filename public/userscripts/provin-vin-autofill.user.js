// ==UserScript==
// @name         PROVIN — VIN & Tirgus dati auto-fill
// @namespace    https://github.com/nilsvalainis/PROvin
// @version      1.2.0
// @description  ?vin= (CarVertical, Auto-Records) un ?url= (tirgusdati.lv); React-friendly vērtība + MutationObserver.
// @match        https://www.carvertical.com/*
// @match        https://carvertical.com/*
// @match        https://www.auto-records.com/*
// @match        https://auto-records.com/*
// @match        https://tirgusdati.lv/*
// @match        https://www.tirgusdati.lv/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  console.log("PROVIN skripts ielādēts: " + window.location.href);

  const host = window.location.hostname.replace(/^www\./, "");
  const params = new URLSearchParams(window.location.search);

  /**
   * Imitē reālu ievadi — apiet React 16+ _valueTracker.
   * (EventInit nesatur `target`; target rodas dispatch laikā.)
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

  /* ---------- Tirgus dati: ?url= sludinājuma saite ---------- */
  if (host.endsWith("tirgusdati.lv")) {
    const urlParam = params.get("url");
    if (!urlParam || !String(urlParam).trim()) return;

    let decoded = String(urlParam);
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      /* jau dekodēts */
    }
    const text = decoded.trim();

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
    const maxTries = 120;
    const interval = window.setInterval(() => {
      tries += 1;
      tryFillTirgus();
      if (done || tries >= maxTries) {
        window.clearInterval(interval);
        if (tirgusObs) tirgusObs.disconnect();
      }
    }, 250);

    window.setTimeout(() => {
      if (tirgusObs) tirgusObs.disconnect();
    }, 60000);

    return;
  }

  /* ---------- VIN: CarVertical, Auto-Records ---------- */
  const vinRaw = params.get("vin");
  if (!vinRaw || !String(vinRaw).trim()) return;

  const vin = String(vinRaw)
    .replace(/[\s-]/g, "")
    .toUpperCase();

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
      if (el && !el.disabled) {
        setNativeValue(el, vin);
        done = true;
        window.clearInterval(interval);
        console.log("PROVIN CarVertical: aizpildīts VIN lauks", el);
        window.setTimeout(clickCarVerticalCheck, 400);
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
