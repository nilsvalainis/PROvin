// ==UserScript==
// @name         PROVIN — VIN & Tirgus dati auto-fill
// @namespace    https://github.com/nilsvalainis/PROvin
// @version      1.9.1
// @description  Admin MENU VIN auto-fill un ātrās pārbaudes zondes. car.info + checkcar.vin. AutoDNA arī atver CarVertical. Sludinājuma vēsture no tirgusdati.lv caur pārlūku.
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
// @match        https://stat.vin/*
// @match        https://www.stat.vin/*
// @match        https://bid.cars/*
// @match        https://www.bid.cars/*
// @match        https://vininspect.com/*
// @match        https://www.vininspect.com/*
// @match        https://auchistory.com/*
// @match        https://www.auchistory.com/*
// @match        https://www.carfax.eu/*
// @match        https://carfax.eu/*
// @match        https://en.cebia.com/*
// @match        https://www.cebia.com/*
// @match        https://cebia.com/*
// @match        https://www.auto.vin/*
// @match        https://auto.vin/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @connect      tirgusdati.lv
// @connect      adify.lv
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const SCRIPT_VERSION = "1.9.1";
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
  const GM_SCAN_JOB = "provin_scan_job";
  const GM_SCAN_RESULT = "provin_scan_result";

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

    document.addEventListener("provin-listing-history-request", function (ev) {
      const detail = ev && ev.detail ? ev.detail : {};
      const requestId = String(detail.requestId || "");
      const fetchUrl = String(detail.fetchUrl || "").trim();
      function reply(payload) {
        document.dispatchEvent(
          new CustomEvent("provin-listing-history-result", {
            detail: Object.assign({ requestId: requestId }, payload),
          }),
        );
      }
      if (!requestId || !fetchUrl) {
        reply({ ok: false, error: "bad_request" });
        return;
      }
      let parsed;
      try {
        parsed = new URL(fetchUrl);
      } catch {
        reply({ ok: false, error: "bad_url" });
        return;
      }
      const h = parsed.hostname.replace(/^www\./i, "").toLowerCase();
      if (h !== "tirgusdati.lv" && h !== "adify.lv") {
        reply({ ok: false, error: "host_not_allowed" });
        return;
      }
      const xhr =
        typeof GM_xmlhttpRequest === "function"
          ? GM_xmlhttpRequest
          : typeof GM !== "undefined" && GM && typeof GM.xmlHttpRequest === "function"
            ? GM.xmlHttpRequest.bind(GM)
            : null;
      if (!xhr) {
        reply({ ok: false, error: "no_gm_xhr" });
        return;
      }
      xhr({
        method: "GET",
        url: fetchUrl,
        timeout: 18000,
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "lv-LV,lv;q=0.9,en;q=0.7",
        },
        onload: function (res) {
          reply({
            ok: res.status >= 200 && res.status < 300,
            status: res.status,
            html: String(res.responseText || ""),
          });
        },
        onerror: function () {
          reply({ ok: false, error: "network" });
        },
        ontimeout: function () {
          reply({ ok: false, error: "timeout" });
        },
      });
    });

    document.addEventListener("provin-vin-scan-browser", function (ev) {
      const detail = ev && ev.detail ? ev.detail : {};
      const vin = String(detail.vin || "")
        .replace(/[\s-]/g, "")
        .toUpperCase();
      const sources = Array.isArray(detail.sources) ? detail.sources.map((id) => String(id)) : [];
      if (!vin || sources.length === 0) return;
      stopVinScanPoll();
      try {
        GM_setValue(GM_PENDING_VIN, vin);
        GM_deleteValue(GM_SCAN_RESULT);
        GM_setValue(
          GM_SCAN_JOB,
          JSON.stringify({ vin: vin, sources: sources, index: 0, startedAt: Date.now() }),
        );
      } catch (e) {
        console.warn("PROVIN admin: skenēšanas rinda", e);
        return;
      }
      pollVinScan();
    });
    pollVinScan();
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

  function readScanJob() {
    try {
      const raw = GM_getValue(GM_SCAN_JOB, "");
      if (!raw) return null;
      const job = JSON.parse(String(raw));
      if (!job || !Array.isArray(job.sources) || !job.vin) return null;
      return job;
    } catch {
      return null;
    }
  }

  function scanUrl(id, vin) {
    const v = encodeURIComponent(vin);
    const urls = {
      stat_vin: "https://stat.vin/cars/" + v,
      bid_cars: "https://bid.cars/en/search?q=" + v,
      vininspect: "https://vininspect.com/vin/" + v,
      auchistory: "https://auchistory.com/",
      carfax_eu: "https://www.carfax.eu/preview-page?vin=" + v,
      cebia: "https://en.cebia.com/",
      autodna_preview: "https://www.autodna.lv/vin/" + v,
      carvertical_preview: "https://www.carvertical.com/lv/user/reports",
      auto_vin: "https://www.auto.vin/en/checkout?vin=" + v,
      checkcar_vin: "https://checkcar.vin/report/check/" + v,
    };
    return urls[id] || "";
  }

  function scanIdForHost(name) {
    if (name === "stat.vin" || name.endsWith(".stat.vin")) return "stat_vin";
    if (name.endsWith("bid.cars")) return "bid_cars";
    if (name.endsWith("vininspect.com")) return "vininspect";
    if (name.endsWith("auchistory.com")) return "auchistory";
    if (name.endsWith("carfax.eu")) return "carfax_eu";
    if (name === "cebia.com" || name.endsWith(".cebia.com")) return "cebia";
    if (name.endsWith("autodna.lv") || name.endsWith("autodna.com")) return "autodna_preview";
    if (name.endsWith("carvertical.com")) return "carvertical_preview";
    if (name === "auto.vin" || name.endsWith(".auto.vin")) return "auto_vin";
    if (name.endsWith("checkcar.vin")) return "checkcar_vin";
    return "";
  }

  function activeScanOnThisHost() {
    const job = readScanJob();
    if (!job) return false;
    return job.sources[job.index] === scanIdForHost(host);
  }

  function isScanChallenge(text) {
    return /just a moment|security verification|checking your browser|verify you are human|attention required|cf-browser-verification/i.test(
      text,
    );
  }

  function scanBlocker(text) {
    if (isScanChallenge(text)) return "cloudflare";
    if (/recaptcha|hcaptcha|i['’]m not a robot|\bcaptcha\b/i.test(text)) return "captcha";
    return "";
  }

  function classifyBrowserProbe(id, text, vin) {
    if (isScanChallenge(text)) return null;
    const hasVin = text.toUpperCase().indexOf(vin) !== -1;
    if (id === "stat_vin") {
      if (!hasVin) {
        if (/not found|page not found|no vehicle|nothing found|no results|no similar cars|were not found/i.test(text)) {
          return { status: "none", summary: "Nav izsoles ieraksta" };
        }
        return null;
      }
      if (/auction|sold|sale date|odometer|mileage|lot|bid/i.test(text)) return { status: "found", summary: "Ir izsoles ieraksts" };
      return null;
    }
    if (id === "bid_cars") {
      if (/no results|0 vehicles|nothing found|no cars found/i.test(text)) return { status: "none", summary: "Nav izsoles arhīvā" };
      if (hasVin && /lot|bid|sold|auction|mileage/i.test(text)) return { status: "found", summary: "Ir izsoles ieraksts" };
      return null;
    }
    if (id === "vininspect") {
      if (/no records|couldn.t find|didn.t find|0 records/i.test(text)) return { status: "none", summary: "Nav vēstures ieraksta" };
      if (hasVin && /records found|vehicle history|we found \d+|full history/i.test(text)) {
        return { status: "found", summary: "Ir vēstures priekšskatījums" };
      }
      return null;
    }
    if (id === "auchistory") {
      if (/no (auction )?records|vehicle not found|nothing found/i.test(text)) return { status: "none", summary: "Nav izsoles vēstures" };
      if (hasVin && /damage|auction|sold for|\bbid\b/i.test(text)) return { status: "found", summary: "Ir izsoles vēsture" };
      return null;
    }
    if (id === "carfax_eu") {
      const found = /we found\s+(\d+)\s+record/i.exec(text);
      if (found) return { status: "found", summary: found[1] + " ieraksti CARFAX priekšskatījumā" };
      if (/no records found|couldn.t find any records|we didn.t find any/i.test(text)) {
        return { status: "none", summary: "CARFAX priekšskatījumā ierakstu nav" };
      }
      return null;
    }
    if (id === "cebia") {
      if (hasVin && /basic verification|z[aá]kladn[ií] ov[eě][rř]en[ií]|smart code/i.test(text)) {
        return { status: "found", summary: "Cebia priekšskatījums ir atvērts" };
      }
      return null;
    }
    if (id === "autodna_preview") {
      if (/nav atrast|dati nav pieejami|no data found|no records found|brak danych|nie znaleziono/i.test(text)) {
        return { status: "none", summary: "AutoDNA priekšskatījumā datu nav" };
      }
      const count = /(\d+)\s*(ierakst|rekord|records?)/i.exec(text);
      if (count) return { status: "found", summary: count[1] + " ieraksti AutoDNA priekšskatījumā. Pirkums paliek operatoram" };
      if (/pieejam[aā] inform[aā]cija|available data/i.test(text)) {
        return { status: "found", summary: "AutoDNA rāda priekšskatījumu. Pirkums paliek operatoram" };
      }
      return null;
    }
    if (id === "carvertical_preview") {
      if (/inform[aā]cija nav atrasta|no information found|couldn.t find any/i.test(text)) {
        return { status: "none", summary: "CarVertical priekšskatījumā datu nav" };
      }
      if (hasVin && /m[eē]s atrad[aā]m|we found|found information|atrad[aā]m datus/i.test(text)) {
        return { status: "found", summary: "CarVertical rāda priekšskatījumu. Pirkums paliek operatoram" };
      }
      return null;
    }
    if (id === "auto_vin") {
      if (/we correctly identified your vehicle/i.test(text)) {
        const name = /identified your vehicle\s+([^\n.]{3,80})/i.exec(text);
        const vehicle = name && name[1] ? name[1].trim() : "";
        return {
          status: "manual",
          summary: vehicle
            ? "Auto atpazīts: " + vehicle + ". Servisa ieraksti redzami pēc pirkuma"
            : "Auto atpazīts. Servisa ieraksti redzami pēc pirkuma",
        };
      }
      if (/couldn.t identify|unable to identify|invalid vin/i.test(text)) {
        return { status: "none", summary: "auto.vin šo VIN neatpazina" };
      }
      return null;
    }
    return null;
  }

  function scanTextExcerpt(text, vin) {
    const flat = String(text || "")
      .replace(/\s+/g, " ")
      .trim();
    const at = flat.toUpperCase().indexOf(vin);
    const start = at > 200 ? at - 200 : 0;
    const piece = flat.slice(start, start + 600);
    return (location.host + location.pathname + " | " + piece).slice(0, 700);
  }

  function showProvinBadge(message) {
    let badge = document.getElementById("provin-cc-photo-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "provin-cc-photo-badge";
      badge.style.cssText =
        "position:fixed;z-index:2147483647;right:16px;bottom:16px;background:#0f172a;color:#fff;padding:10px 14px;border-radius:12px;font:600 14px/1.3 system-ui,sans-serif";
      document.body.appendChild(badge);
    }
    badge.textContent = message;
  }

  function publishScan(payload) {
    if (window.__provinScanPublished) return;
    window.__provinScanPublished = true;
    try {
      GM_setValue(GM_SCAN_RESULT, JSON.stringify(Object.assign({ detail: "", at: Date.now() }, payload)));
    } catch (e) {
      console.warn("PROVIN skenēšana", e);
    }
    showProvinBadge(payload.summary || payload.status || "");
  }

  function advanceVinScan(job, result) {
    try {
      document.dispatchEvent(new CustomEvent("provin-vin-scan-result", { detail: result }));
    } catch {
      /* admin lapa nav šī cilne */
    }
    const next = Number(job.index || 0) + 1;
    if (next >= job.sources.length) {
      try {
        GM_deleteValue(GM_SCAN_JOB);
        GM_deleteValue(GM_SCAN_RESULT);
      } catch {
        /* ignore */
      }
      window.__provinScanPoll = false;
      return;
    }
    const updated = { vin: job.vin, sources: job.sources, index: next, startedAt: Date.now() };
    try {
      GM_deleteValue(GM_SCAN_RESULT);
      GM_setValue(GM_SCAN_JOB, JSON.stringify(updated));
    } catch {
      /* ignore */
    }
    const url = scanUrl(job.sources[next], job.vin);
    if (url) window.open(url, "provin-vin-scan");
  }

  function stopVinScanPoll() {
    if (window.__provinScanTimer) window.clearInterval(window.__provinScanTimer);
    window.__provinScanTimer = 0;
    window.__provinScanPoll = false;
  }

  function pollVinScan() {
    if (window.__provinScanPoll) return;
    const existing = readScanJob();
    if (!existing) return;
    if (Date.now() - Number(existing.startedAt || 0) > 180000) {
      try {
        GM_deleteValue(GM_SCAN_JOB);
      } catch {
        /* ignore */
      }
      return;
    }
    window.__provinScanPoll = true;
    const timer = window.setInterval(() => {
      window.__provinScanTimer = timer;
      const job = readScanJob();
      if (!job) {
        window.clearInterval(timer);
        window.__provinScanPoll = false;
        return;
      }
      let raw = "";
      try {
        raw = String(GM_getValue(GM_SCAN_RESULT, "") || "");
      } catch {
        raw = "";
      }
      if (raw) {
        let data = null;
        try {
          data = JSON.parse(raw);
        } catch {
          data = null;
        }
        if (data && data.id !== job.sources[job.index]) {
          try {
            GM_deleteValue(GM_SCAN_RESULT);
          } catch {
            /* ignore */
          }
        } else if (data && data.id === job.sources[job.index] && String(data.vin || "").toUpperCase() === String(job.vin).toUpperCase()) {
          window.clearInterval(timer);
          window.__provinScanPoll = false;
          advanceVinScan(job, data);
          const follow = readScanJob();
          if (follow) pollVinScan();
          return;
        }
      }
      if (Date.now() - Number(job.startedAt || 0) > 80000) {
        window.clearInterval(timer);
        window.__provinScanPoll = false;
        advanceVinScan(job, {
          id: job.sources[job.index],
          vin: job.vin,
          status: "unknown",
          summary: "Avots neatbildēja laikā",
          detail: "",
          at: Date.now(),
        });
        const follow = readScanJob();
        if (follow) pollVinScan();
      }
    }, 500);
  }

  function findScanVinInput() {
    const nodes = document.querySelectorAll("input, textarea");
    for (const el of nodes) {
      if (!isVisible(el) || el.disabled) continue;
      if (el.type === "password" || el.type === "hidden" || el.type === "email" || el.type === "checkbox") continue;
      const blob = (
        (el.name || "") +
        " " +
        (el.id || "") +
        " " +
        (el.getAttribute("placeholder") || "") +
        " " +
        (el.getAttribute("aria-label") || "")
      ).toLowerCase();
      if (blob.includes("vin") || blob.includes("chassis")) return el;
    }
    return null;
  }

  function clickSafeCheck() {
    const pay = /pirkt|buy|apmaks|checkout|pay\b|zamów|koupit|order|subscribe|pasūtīt/i;
    const want = /pārbaudi|pārbaudīt|check|verify|search|meklēt|sākt/i;
    const buttons = Array.from(document.querySelectorAll("button, [role='button'], input[type='submit']"));
    const hit = buttons.find((b) => {
      if (!isVisible(b) || b.disabled) return false;
      const t = ((b.textContent || b.value || "") + "").trim();
      if (!t || pay.test(t)) return false;
      return want.test(t);
    });
    if (hit) {
      hit.click();
      return true;
    }
    return false;
  }

  function watchBrowserProbe() {
    const job = readScanJob();
    if (!job) return;
    const id = job.sources[job.index];
    const probeVin = String(job.vin || "")
      .replace(/[\s-]/g, "")
      .toUpperCase();
    if (!id || probeVin.length < 11) return;
    if (id === "checkcar_vin") {
      if (!vinFromCheckcarPath()) {
        location.assign("https://checkcar.vin/report/check/" + encodeURIComponent(probeVin));
        return;
      }
      watchCheckcarPhotos(probeVin);
      return;
    }
    let ticks = 0;
    let filled = false;
    let clicked = false;
    let lastText = "";
    let stableTicks = 0;
    const timer = window.setInterval(() => {
      ticks += 1;
      const text = document.body ? document.body.innerText || "" : "";
      const blocker = scanBlocker(text);
      if (text === lastText) stableTicks += 1;
      else {
        lastText = text;
        stableTicks = 0;
      }
      const input = findScanVinInput();
      if (input) {
        const current = String(input.value || "")
          .replace(/[\s-]/g, "")
          .toUpperCase();
        if (current !== probeVin) setNativeValue(input, probeVin);
        filled = true;
      }
      const mayClick = blocker !== "captcha" && (id === "autodna_preview" || id === "carvertical_preview" || id === "vininspect" || id === "bid_cars");
      if (mayClick && filled && !clicked && ticks >= 3) {
        clicked = clickSafeCheck();
      }
      if (blocker === "captcha") showProvinBadge("Apstipriniet captcha");
      else if (blocker === "cloudflare") showProvinBadge("Apstipriniet Cloudflare");
      const result = classifyBrowserProbe(id, text, probeVin);
      if (result) {
        window.clearInterval(timer);
        publishScan({ id: id, vin: probeVin, status: result.status, summary: result.summary, detail: "" });
        return;
      }
      /* Lapa ir ielādēta un 8 s nemainās, bet neviens šablons nesakrīt: atdod fragmentu, nevis gaida 70 s. */
      if (!blocker && ticks >= 24 && stableTicks >= 16 && text.trim().length > 40) {
        window.clearInterval(timer);
        publishScan({ id: id, vin: probeVin, status: "unknown", summary: "Lapa nav atpazīta", detail: scanTextExcerpt(text, probeVin) });
        return;
      }
      if (ticks > 140) {
        window.clearInterval(timer);
        const timedOut = blocker === "captcha"
          ? { status: "manual", summary: "VIN aizpildīts. Captcha jāapstiprina šajā cilnē" }
          : blocker === "cloudflare"
            ? { status: "unknown", summary: "Cloudflare apturēja lapu" }
            : { status: "unknown", summary: "Avots neatbildēja laikā" };
        publishScan({ id: id, vin: probeVin, status: timedOut.status, summary: timedOut.summary, detail: "" });
      }
    }, 500);
  }

  const vin = peekPendingVin();

  if (activeScanOnThisHost()) {
    watchBrowserProbe();
    return;
  }

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
    const scanJob = readScanJob();
    if (scanJob && scanJob.sources[scanJob.index] === "checkcar_vin") {
      publishScan({
        id: "checkcar_vin",
        vin: probeVin,
        status: error ? "unknown" : count > 0 ? "found" : "none",
        summary: error ? error : count > 0 ? count + " foto" : "Atskaitē nav foto",
        detail: "",
      });
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
