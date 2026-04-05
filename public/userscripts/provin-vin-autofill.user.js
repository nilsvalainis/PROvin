// ==UserScript==
// @name         PROVIN — VIN auto-fill (CarVertical, Auto-Records)
// @namespace    https://github.com/nilsvalainis/PROvin
// @version      1.0.0
// @description  Nolasa ?vin= no URL un aizpilda VIN laukus; paredzēts kopā ar PROVIN admin saitēm.
// @match        https://www.carvertical.com/*
// @match        https://carvertical.com/*
// @match        https://www.auto-records.com/*
// @match        https://auto-records.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const vinRaw = new URLSearchParams(window.location.search).get("vin");
  if (!vinRaw || !String(vinRaw).trim()) return;

  const vin = String(vinRaw)
    .replace(/[\s-]/g, "")
    .toUpperCase();

  /** React / Vue kontrolētiem inputiem — iestāda native vērtību. */
  function setInputValue(el, value) {
    try {
      const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
      if (proto && proto.set) {
        proto.set.call(el, value);
      } else {
        el.value = value;
      }
    } catch {
      el.value = value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    try {
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertFromPaste" }));
    } catch {
      /* vecāki pārlūki */
    }
  }

  function findCarVerticalVinInput() {
    return (
      document.querySelector("#vin-input") ||
      document.querySelector('input[name="vin"]') ||
      document.querySelector('input[autocomplete="off"][name="vin"]')
    );
  }

  function clickCarVerticalCheck() {
    const buttons = Array.from(document.querySelectorAll("button, [role='button'], a[role='button']"));
    const byText = buttons.find((b) => {
      const t = (b.textContent || "").trim();
      return /pārbaudīt|check|verify|turpin|continue|search/i.test(t);
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

  const host = window.location.hostname.replace(/^www\./, "");
  const isCV = host.endsWith("carvertical.com");
  const isAR = host.endsWith("auto-records.com");

  if (!isCV && !isAR) return;

  let tries = 0;
  const maxTries = 80;
  let done = false;
  const interval = window.setInterval(() => {
    tries += 1;
    if (done || tries >= maxTries) {
      window.clearInterval(interval);
      return;
    }
    if (isCV) {
      const el = findCarVerticalVinInput();
      if (el && !el.disabled) {
        setInputValue(el, vin);
        done = true;
        window.clearInterval(interval);
        window.setTimeout(clickCarVerticalCheck, 400);
      }
    } else if (isAR) {
      const el = findAutoRecordsVinInput();
      if (el && !el.disabled) {
        setInputValue(el, vin);
        done = true;
        window.clearInterval(interval);
      }
    }
  }, 250);
})();
