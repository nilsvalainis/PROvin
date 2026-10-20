// ==UserScript==
// @name         PROVIN VIN un Tirgus dati auto-fill
// @namespace    https://github.com/nilsvalainis/PROvin
// @version      1.25.0
// @description  Admin MENU VIN auto-fill. VIN SCAN cilnes atver jau aizpildītu meklēšanu. Izsoļu arhīva HTML (stat.vin, bid.cars, bidfax, poctra, checkcar.vin, plc.auction, CARFAX.eu) un Zviedrijas reģistrs (biluppgifter, Transportstyrelsen, car.info) nosūta adminam. stat.vin, bid.cars, BidFax, checkcar.vin, plc.auction, CARFAX.eu, Poctra, epolicija.lt, biluppgifter.se un NICB ielādē no jūsu pārlūka (GM_xmlhttpRequest), jo servera IP ir bloķēti. Pēc apstiprināta CarVertical pirkuma iziet checkout soļus; 3-D Secure paliek operatoram.
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
// @match        https://auchistory.com/*
// @match        https://www.auchistory.com/*
// @match        https://www.carfax.eu/*
// @match        https://carfax.eu/*
// @match        https://en.cebia.com/*
// @match        https://www.cebia.com/*
// @match        https://cebia.com/*
// @match        https://www.auto.vin/*
// @match        https://auto.vin/*
// @match        https://plc.auction/*
// @match        https://www.plc.auction/*
// @match        https://www.epolicija.lt/*
// @match        https://epolicija.lt/*
// @match        https://www.nicb.org/*
// @match        https://nicb.org/*
// @match        https://bidfax.info/*
// @match        https://www.bidfax.info/*
// @match        https://poctra.com/*
// @match        https://www.poctra.com/*
// @match        https://e.csdd.lv/*
// @match        https://eteenindus.mnt.ee/*
// @match        https://lkf.ee/*
// @match        https://www.nummerplade.net/*
// @match        https://nummerplade.net/*
// @match        https://ovi.rdw.nl/*
// @match        https://opendata.rdw.nl/*
// @match        https://www.vegvesen.no/*
// @match        https://vegvesen.no/*
// @match        https://biluppgifter.se/*
// @match        https://fu-regnr.transportstyrelsen.se/*
// @match        https://carinfo.se/*
// @match        https://www.carinfo.se/*
// @match        https://www.regitra.lt/*
// @match        https://www.traficom.fi/*
// @match        https://www.nhtsa.gov/*
// @match        https://www.tjekbil.dk/*
// @match        https://tjekbil.dk/*
// @match        https://findsynsrapport.esyn.dk/*
// @match        https://app.digitalservicebog.dk/*
// @match        https://public.car-pass.be/*
// @match        https://www.gov.uk/check-vehicle-recall*
// @match        https://gov.uk/check-vehicle-recall*
// @match        https://www.bmwusa.com/*
// @match        https://www.bmw.com/*
// @match        https://www.mbusa.com/*
// @match        https://www.mercedes-benz.com/*
// @match        https://www.volvocars.com/*
// @match        https://www.toyota.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @connect      tirgusdati.lv
// @connect      adify.lv
// @connect      stat.vin
// @connect      www.stat.vin
// @connect      bid.cars
// @connect      www.bid.cars
// @connect      bidfax.info
// @connect      www.bidfax.info
// @connect      checkcar.vin
// @connect      www.checkcar.vin
// @connect      plc.auction
// @connect      www.plc.auction
// @connect      www.carfax.eu
// @connect      carfax.eu
// @connect      poctra.com
// @connect      www.poctra.com
// @connect      www.epolicija.lt
// @connect      epolicija.lt
// @connect      biluppgifter.se
// @connect      www.biluppgifter.se
// @connect      www.nicb.org
// @connect      nicb.org
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const SCRIPT_VERSION = "1.25.0";
  const host = window.location.hostname.replace(/^www\./, "");
  const params = new URLSearchParams(window.location.search);
  const path = window.location.pathname || "";
  function stampUserscriptVersion() {
    try {
      if (document.documentElement.getAttribute("data-provin-userscript") !== SCRIPT_VERSION) {
        document.documentElement.setAttribute("data-provin-userscript", SCRIPT_VERSION);
      }
    } catch {
      /* ignore */
    }
  }
  stampUserscriptVersion();
  if (path.includes("/admin")) {
    /* React 19 noņem visus <html> atribūtus, kad saknes singletonu iegūst no jauna; tad admin rāda „nav aktīvs”. */
    try {
      new MutationObserver(stampUserscriptVersion).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-provin-userscript"],
      });
    } catch {
      /* ignore */
    }
    document.addEventListener("provin-userscript-ping", function () {
      stampUserscriptVersion();
      try {
        document.dispatchEvent(new CustomEvent("provin-userscript-pong", { detail: SCRIPT_VERSION }));
      } catch {
        /* ignore */
      }
    });
    try {
      document.dispatchEvent(new CustomEvent("provin-userscript-pong", { detail: SCRIPT_VERSION }));
    } catch {
      /* ignore */
    }
  }

  const GM_PENDING_VIN = "provin_pending_vin";
  const GM_PENDING_URL = "provin_pending_url";
  const GM_CC_PROBE = "provin_cc_photo_probe";
  const GM_CC_RESULT = "provin_cc_photo_result";
  const GM_SCAN_JOB = "provin_scan_job";
  const GM_SCAN_RESULT = "provin_scan_result";
  const GM_SE_IMPORT = "provin_se_import";
  const GM_CV_PURCHASE = "provin_cv_purchase";
  const GM_CV_PURCHASE_VIN = "provin_cv_purchase_vin";
  const GM_CV_PURCHASE_RESULT = "provin_cv_purchase_result";

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
        try {
          if ((a.dataset.provinCarverticalPurchase || "").trim() === "1") {
            GM_setValue(GM_CV_PURCHASE, "1");
            if (vin) GM_setValue(GM_CV_PURCHASE_VIN, vin);
            GM_deleteValue(GM_CV_PURCHASE_RESULT);
            try {
              window.__provinCvPurposeChosen = false;
            } catch {
              /* ignore */
            }
            let cvPolls = 0;
            const cvTimer = window.setInterval(() => {
              cvPolls += 1;
              let cvRaw = "";
              try {
                cvRaw = String(GM_getValue(GM_CV_PURCHASE_RESULT, "") || "");
              } catch {
                cvRaw = "";
              }
              if (cvRaw) {
                window.clearInterval(cvTimer);
                try {
                  const cvData = JSON.parse(cvRaw);
                  document.dispatchEvent(new CustomEvent("provin-vin-scan-result", { detail: cvData }));
                  GM_deleteValue(GM_CV_PURCHASE_RESULT);
                } catch {
                  /* ignore */
                }
                return;
              }
              if (cvPolls > 160) window.clearInterval(cvTimer);
            }, 500);
          } else if (vin || /carvertical\.com/i.test(a.href || "")) {
            GM_deleteValue(GM_CV_PURCHASE);
            GM_deleteValue(GM_CV_PURCHASE_VIN);
          }
        } catch (e) {
          console.warn("PROVIN admin: CarVertical pirkuma karogs", e);
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
    function gmXhr() {
      return typeof GM_xmlhttpRequest === "function"
        ? GM_xmlhttpRequest
        : typeof GM !== "undefined" && GM && typeof GM.xmlHttpRequest === "function"
          ? GM.xmlHttpRequest.bind(GM)
          : null;
    }

    const STAT_VIN_HTML_MAX = 900000;
    const browserFetched = Object.create(null);
    const browserFetchTries = Object.create(null);
    const BROWSER_FETCH_MAX_TRIES = 3;
    const BROWSER_FETCH_URL = {
      stat_vin: function (vin) {
        return "https://stat.vin/cars/" + encodeURIComponent(vin);
      },
      bid_cars: function (vin) {
        return "https://bid.cars/en/search?q=" + encodeURIComponent(vin);
      },
      bidfax: function (vin) {
        return "https://bidfax.info/?s=" + encodeURIComponent(vin);
      },
      checkcar_vin: function (vin) {
        return "https://checkcar.vin/report/check/" + encodeURIComponent(vin);
      },
      plc_auction: function (vin) {
        return "https://plc.auction/?vin=" + encodeURIComponent(vin);
      },
      carfax_eu: function (vin) {
        return "https://www.carfax.eu/preview-page?vin=" + encodeURIComponent(vin);
      },
      poctra: function (vin) {
        return "https://poctra.com/search?q=" + encodeURIComponent(vin);
      },
      lt_itpr: function (vin) {
        return "https://www.epolicija.lt/itpr_paieska/transportas_lt.php?knr=" + encodeURIComponent(vin);
      },
      biluppgifter: function (vin) {
        return "https://biluppgifter.se/" + encodeURIComponent(vin);
      },
      nicb: function (vin) {
        return "https://www.nicb.org/vincheck?vin=" + encodeURIComponent(vin);
      },
    };
    const BROWSER_FETCH_LABEL = {
      stat_vin: "stat.vin",
      bid_cars: "bid.cars",
      bidfax: "BidFax",
      checkcar_vin: "checkcar.vin",
      plc_auction: "plc.auction",
      carfax_eu: "CARFAX.eu",
      poctra: "Poctra",
      lt_itpr: "epolicija.lt",
      biluppgifter: "biluppgifter.se",
      nicb: "NICB",
    };

    function publishBrowserHtml(id, vin, pageUrl, httpStatus, html, summary) {
      document.dispatchEvent(
        new CustomEvent("provin-vin-scan-result", {
          detail: {
            id: id,
            vin: vin,
            status: "unknown",
            summary: summary || "",
            html: html,
            pageUrl: pageUrl,
            finalUrl: pageUrl,
            httpStatus: httpStatus,
            at: Date.now(),
          },
        }),
      );
    }

    function htmlLooksLikeChallenge(html) {
      return /just a moment|performing security verification|security verification|checking your browser|verify you are human|cf-browser-verification|access blocked/i.test(
        html,
      );
    }

    function limitBrowserHtml(id, html) {
      if (html.length <= STAT_VIN_HTML_MAX) return html;
      if (id !== "stat_vin") return html.slice(0, STAT_VIN_HTML_MAX);
      const nextMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>[\s\S]*?<\/script>/i);
      const next = nextMatch ? nextMatch[0].slice(0, 400000) : "";
      const room = STAT_VIN_HTML_MAX - next.length;
      return (html.slice(0, Math.max(0, room)) + next).slice(0, STAT_VIN_HTML_MAX);
    }

    function fetchBlockedSourceInBrowser(id, token) {
      const specUrl = BROWSER_FETCH_URL[id];
      if (!specUrl) return;
      const raw = String(token || "");
      const key = id + ":" + raw;
      if (!raw || browserFetched[key]) return;
      const vin = raw.split(":")[0].replace(/[\s-]/g, "").toUpperCase();
      if (!/^[A-HJ-NPR-Z0-9]{11,17}$/.test(vin)) return;
      const xhr = gmXhr();
      if (!xhr) return;
      const tries = browserFetchTries[key] || 0;
      if (tries >= BROWSER_FETCH_MAX_TRIES) return;
      browserFetchTries[key] = tries + 1;
      browserFetched[key] = 1;
      const pageUrl = specUrl(vin);
      const label = BROWSER_FETCH_LABEL[id] || id;
      function retryLater() {
        delete browserFetched[key];
        window.setTimeout(function () {
          fetchBlockedSourceInBrowser(id, token);
        }, 1200 * browserFetchTries[key]);
      }
      xhr({
        method: "GET",
        url: pageUrl,
        timeout: 25000,
        anonymous: false,
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9,lv;q=0.6",
        },
        onload: function (res) {
          const html = limitBrowserHtml(id, String(res.responseText || ""));
          const text = html.replace(/<[^>]+>/g, " ");
          const finalUrl = String(res.finalUrl || pageUrl);
          const hasVin = text.toUpperCase().indexOf(vin) !== -1;
          const limited =
            res.status === 429 ||
            (/too many requests|rate limit(?:ed)?|try again later/i.test(text) && !hasVin);
          const challenge = (htmlLooksLikeChallenge(html) || (res.status === 403 && !hasVin)) && !limited;
          if (challenge && browserFetchTries[key] < BROWSER_FETCH_MAX_TRIES) {
            retryLater();
            return;
          }
          publishBrowserHtml(
            id,
            vin,
            finalUrl,
            res.status,
            html,
            limited ? label + ": pieprasījumu limits" : "",
          );
        },
        onerror: function () {
          if (browserFetchTries[key] < BROWSER_FETCH_MAX_TRIES) retryLater();
          else delete browserFetched[key];
        },
        ontimeout: function () {
          if (browserFetchTries[key] < BROWSER_FETCH_MAX_TRIES) retryLater();
          else delete browserFetched[key];
        },
      });
    }

    function fetchStatVinInBrowser(token) {
      fetchBlockedSourceInBrowser("stat_vin", token);
    }

    function readBrowserFetchRequest() {
      const el = document.querySelector("[data-provin-browser-fetch], [data-provin-stat-vin-fetch]");
      if (!el) return { token: "", ids: [] };
      const token = String(el.getAttribute("data-provin-browser-fetch") || el.getAttribute("data-provin-stat-vin-fetch") || "");
      const rawIds = String(el.getAttribute("data-provin-browser-fetch-ids") || "");
      let ids = rawIds
        .split(",")
        .map(function (item) {
          return item.trim();
        })
        .filter(Boolean);
      if (!ids.length && el.getAttribute("data-provin-stat-vin-fetch")) ids = ["stat_vin"];
      return { token: token, ids: ids };
    }

    function runBrowserFetches(token, ids) {
      const list = ids && ids.length ? ids : [];
      for (let i = 0; i < list.length; i += 1) fetchBlockedSourceInBrowser(list[i], token);
    }

    function watchStatVinBrowserFetch() {
      const run = function () {
        const pending = readBrowserFetchRequest();
        runBrowserFetches(pending.token, pending.ids);
      };
      let queued = false;
      const schedule = function () {
        if (queued) return;
        queued = true;
        window.setTimeout(function () {
          queued = false;
          run();
        }, 50);
      };
      /* childList: pasūtījuma kartīte pēc SPA pārejas ievieto jaunu <span>, nevis maina atribūtu. */
      const obs = new MutationObserver(schedule);
      obs.observe(document.documentElement, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["data-provin-stat-vin-fetch", "data-provin-browser-fetch", "data-provin-browser-fetch-ids"],
      });
      window.setInterval(run, 5000);
      document.addEventListener("provin-stat-vin-fetch", function (ev) {
        const detail = ev && ev.detail ? ev.detail : {};
        const vin = String(detail.vin || "");
        const at = String(detail.at || "");
        fetchStatVinInBrowser(at ? vin + ":" + at : vin);
      });
      document.addEventListener("provin-browser-fetch", function (ev) {
        const detail = ev && ev.detail ? ev.detail : {};
        const vin = String(detail.vin || "");
        const at = String(detail.at || "");
        const ids = Array.isArray(detail.ids) ? detail.ids.map(function (id) { return String(id); }) : [];
        runBrowserFetches(at ? vin + ":" + at : vin, ids);
      });
      run();
    }

    watchStatVinBrowserFetch();
    pollSwedishImport();
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

  function vinFromDeepPath() {
    const patterns = [
      /\/cars\/([A-HJ-NPR-Z0-9]{11,17})/i,
      /\/search\/([A-HJ-NPR-Z0-9]{11,17})/i,
      /\/vin\/(?:[A-Z]{1,3}\/)?([A-HJ-NPR-Z0-9]{11,17})/i,
      /\/([A-HJ-NPR-Z0-9]{17})(?:\/|$)/i,
    ];
    for (const re of patterns) {
      const m = path.match(re);
      if (m) return String(m[1]).toUpperCase();
    }
    return "";
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
      const vinRaw =
        params.get("identifier") ||
        params.get("vin") ||
        params.get("q") ||
        params.get("knr") ||
        params.get("s") ||
        params.get("chassisNumber") ||
        params.get("understellsnummer");
      if (vinRaw && String(vinRaw).trim()) {
        vin = String(vinRaw)
          .replace(/[\s-]/g, "")
          .toUpperCase();
      }
    }
    if (!vin) vin = vinFromAutodnaPath();
    if (!vin) vin = vinFromCheckcarPath();
    if (!vin) vin = vinFromDeepPath();
    return vin;
  }

  function peekCarVerticalPurchaseVin() {
    try {
      const g = GM_getValue(GM_CV_PURCHASE_VIN, "");
      if (g && String(g).trim()) {
        return String(g)
          .replace(/[\s-]/g, "")
          .toUpperCase();
      }
    } catch {
      /* ignore */
    }
    return "";
  }

  function carVerticalPurchaseFlagSet() {
    try {
      if (String(GM_getValue(GM_CV_PURCHASE, "") || "") === "1") return true;
    } catch {
      /* ignore */
    }
    try {
      return new URLSearchParams(window.location.search).get("provin_purchase") === "1";
    } catch {
      return false;
    }
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
    const SCAN_URLS = {
      stat_vin: "https://stat.vin/cars/" + v,
      bid_cars: "https://bid.cars/en/search?q=" + v,
      auchistory: "https://auchistory.com/?s=" + v,
      carfax_eu: "https://www.carfax.eu/preview-page?vin=" + v,
      checkcar_vin: "https://checkcar.vin/report/check/" + v,
      plc_auction: "https://plc.auction/?vin=" + v,
      lt_itpr: "https://www.epolicija.lt/itpr_paieska/transportas_lt.php?knr=" + v,
      nicb: "https://www.nicb.org/vincheck?vin=" + v,
      bidfax: "https://bidfax.info/?s=" + v,
      poctra: "https://poctra.com/search?q=" + v,
      csdd: "https://e.csdd.lv/tadati/?vin=" + v,
      mnt_ee: "https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf?vin=" + v,
      lkf_ee: "https://lkf.ee/et/kahjukontroll?vin=" + v,
      carinfo: "https://www.car.info/en-se/vin/S/" + v,
      nummerplade: "https://www.nummerplade.net/stelnummer/" + String(vin || "").toLowerCase() + ".html",
      rdw: "https://ovi.rdw.nl/",
      vegvesen: "https://www.vegvesen.no/kjoretoy/kjop-og-salg/kjoretoyopplysninger/?understellsnummer=" + v,
      biluppgifter: "https://biluppgifter.se/" + v,
      regitra: "https://www.regitra.lt/paslaugos/transporto-priemones/pasitikrinkite-ar-transporto-priemone-neturi-apribojimu/",
      traficom: "https://www.traficom.fi/fi/autoilijat/ajoneuvon-osto-ja-myynti/tarkista-ajoneuvon-tiedot",
      tjekbil: "https://www.tjekbil.dk/?vin=" + v,
      esyn: "https://findsynsrapport.esyn.dk/?chassisNumber=" + v,
      dsb: "https://app.digitalservicebog.dk/search?vin=" + v + "&country=eu",
      carpass: "https://public.car-pass.be/recalls?vin=" + v,
      nhtsa_recalls: "https://www.nhtsa.gov/recalls?vin=" + v,
      recall_vw: "https://www.gov.uk/check-vehicle-recall?vin=" + v,
      recall_bmw: "https://www.bmwusa.com/recall.html?vin=" + v,
      recall_mercedes: "https://www.mbusa.com/en/recall?vin=" + v,
      recall_volvo: "https://www.volvocars.com/intl/support/car/recalls?vin=" + v,
      recall_toyota: "https://www.toyota.com/recall/?vin=" + v,
    };
    return SCAN_URLS[id] || "";
  }

  function scanIdForHost(name) {
    if (name === "stat.vin" || name.endsWith(".stat.vin")) return "stat_vin";
    if (name.endsWith("bid.cars")) return "bid_cars";
    if (name.endsWith("auchistory.com")) return "auchistory";
    if (name.endsWith("carfax.eu")) return "carfax_eu";
    if (name.endsWith("checkcar.vin")) return "checkcar_vin";
    if (name.endsWith("plc.auction")) return "plc_auction";
    if (name.endsWith("epolicija.lt")) return "lt_itpr";
    if (name.endsWith("nicb.org")) return "nicb";
    if (name.endsWith("bidfax.info")) return "bidfax";
    if (name.endsWith("poctra.com")) return "poctra";
    if (name.endsWith("e.csdd.lv")) return "csdd";
    if (name.endsWith("mnt.ee")) return "mnt_ee";
    if (name.endsWith("lkf.ee")) return "lkf_ee";
    if (name.endsWith("car.info") || name === "carinfo.se" || name.endsWith(".carinfo.se")) return "carinfo";
    if (name.endsWith("nummerplade.net")) return "nummerplade";
    if (name.endsWith("rdw.nl")) return "rdw";
    if (name.endsWith("vegvesen.no")) return "vegvesen";
    if (name.endsWith("biluppgifter.se")) return "biluppgifter";
    if (name === "fu-regnr.transportstyrelsen.se") return "transportstyrelsen";
    if (name.endsWith("regitra.lt")) return "regitra";
    if (name.endsWith("traficom.fi")) return "traficom";
    if (name.endsWith("tjekbil.dk")) return "tjekbil";
    if (name.endsWith("esyn.dk")) return "esyn";
    if (name.endsWith("digitalservicebog.dk")) return "dsb";
    if (name.endsWith("car-pass.be")) return "carpass";
    if (name.endsWith("nhtsa.gov")) return "nhtsa_recalls";
    if (name === "gov.uk" && String(path || "").indexOf("/check-vehicle-recall") === 0) return "recall_vw";
    if (name.endsWith("bmwusa.com") || name.endsWith("bmw.com")) return "recall_bmw";
    if (name.endsWith("mbusa.com") || name.endsWith("mercedes-benz.com")) return "recall_mercedes";
    if (name.endsWith("volvocars.com")) return "recall_volvo";
    if (name.endsWith("toyota.com")) return "recall_toyota";
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
      if (/too many requests|rate limit(?:ed)?|try again later/i.test(text) && !hasVin) {
        return { status: "unknown", summary: "stat.vin: pieprasījumu limits" };
      }
      if (!hasVin) {
        if (/page not found|car not found|car-not-found|no vehicle|nothing found|no results|no similar cars|were not found|no data found|no sale history|sale history\s*\(\s*0\s*\)/i.test(text)) {
          return { status: "none", summary: "Nav izsoles ieraksta" };
        }
        return null;
      }
      if (/auction|sold|sale date|odometer|mileage|lot|bid|copart|iaai/i.test(text)) {
        const venue = /iaai/i.test(text) ? "IAAI" : /copart/i.test(text) ? "Copart" : "";
        const year = /((?:19|20)\d{2})/.exec(text);
        const photos = /(\d+)\s*(?:photos?|images?|pictures?|foto)/i.exec(text);
        const head = [venue, year && year[1] ? year[1] : ""].filter(Boolean).join(" ");
        const bits = [head, photos && Number(photos[1]) > 0 ? photos[1] + " foto" : ""].filter(Boolean);
        return { status: "found", summary: bits.length ? bits.join(", ") : "Ir izsoles ieraksts" };
      }
      return null;
    }
    if (id === "bid_cars") {
      if (/no results|0 vehicles|nothing found|no cars found/i.test(text)) return { status: "none", summary: "Nav izsoles arhīvā" };
      if (hasVin && /lot|bid|sold|auction|mileage/i.test(text)) return { status: "found", summary: "Ir izsoles ieraksts" };
      return null;
    }
    if (id === "auchistory") {
      if (/no (auction )?records|vehicle not found|nothing found|it seems we can['\u2019]t find what you['\u2019]re looking for/i.test(text)) return { status: "none", summary: "Nav izsoles vēstures" };
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
    if (id === "checkcar_vin") {
      const photoCount = /(\d+)\s*(photos?|images?|pictures?|foto)/i.exec(text);
      const n = photoCount ? Number(photoCount[1]) : NaN;
      if (isFinite(n) && n > 0) return { status: "found", summary: n + " foto" };
      if (/no photos?( available)?|0 photos?|photos? not (available|found)|no images?|couldn.t find|didn.t find|vehicle not found|not found|no report|report not found|no records/i.test(text)) {
        return { status: "none", summary: "Atskaitē nav foto" };
      }
      if (hasVin && /photo|image|gallery|auction|mileage|odometer|lot|vehicle history|\breport\b/i.test(text)) {
        return { status: "found", summary: "Ir vēstures atskaite" };
      }
      return null;
    }
    if (id === "plc_auction") {
      if (/sorry,\s*could not find what you were looking for/i.test(text)) {
        return { status: "none", summary: "Nav ierakstu" };
      }
      const titleMatch = /([A-Za-z][A-Za-z0-9 ./-]*?,\s*\d{4}\s*\(\s*LOT\s*[№N#:]+\s*[^)]+\))/i.exec(text);
      if (!titleMatch) return null;
      const title = titleMatch[1].replace(/\s+/g, " ").trim();
      const location = (text.match(/Location:\s*([^\n]+)/i) || [])[1] || "";
      const saleDate = (text.match(/Sale date:\s*([^\n]+)/i) || text.match(/Updated:\s*(\d{4}-\d{2}-\d{2})/i) || [])[1] || "";
      const winningBid =
        (text.match(/Winning bid:\s*([^\n]+)/i) ||
          text.match(/Final bid:\s*([^\n]+)/i) ||
          text.match(/Sold for:\s*([^\n]+)/i) ||
          text.match(/Buy Now price[^0-9]{0,20}([0-9 \u00a0]+USD)/i) ||
          [])[1] || "";
      const bits = [title, location.replace(/\s+/g, " ").trim(), String(saleDate).trim(), String(winningBid).replace(/\s+/g, " ").trim()].filter(Boolean);
      return { status: "found", summary: bits.join(" · ") };
    }
    if (id === "lt_itpr") {
      if (/lapa netika atrasta|lapa nav atrasta|page not found|404 not found|šāda lapa neeksistē/i.test(text)) {
        return { status: "unknown", summary: "Publiskā lapa nav pieejama" };
      }
      if (/duomenų nerasta|įrašų nėra|įrašų nerasta|nerasta įrašų|pagal (jūsų )?nurodytus|neieškoma|nav meklēšanā|nav šajā sarakstā|sarakstā nav|transportlīdzeklis nav meklēšanā/i.test(text)) {
        return { status: "none", summary: "Nav meklēšanā" };
      }
      if (/paieškos priežast|paiešką paskelb|ieškoma transporto priemon|pavogt|vagyst|meklēšanā izsludin|izsludināts meklēšanā|\bnozagts\b|stolen vehicle|wanted vehicle/i.test(text)) {
        const reason =
          (text.match(/paieškos priežast(?:is)?:?\s*([^\n.]{3,80})/i) ||
            text.match(/meklēšanas iemesls:?\s*([^\n.]{3,80})/i) ||
            [])[1] || "";
        const extra = String(reason).replace(/\s+/g, " ").trim();
        return { status: "found", summary: extra ? "Meklēšanā. " + extra : "Meklēšanā" };
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

  const ARCHIVE_HTML_IDS = {
    stat_vin: 1,
    bid_cars: 1,
    bidfax: 1,
    poctra: 1,
    checkcar_vin: 1,
    plc_auction: 1,
    carfax_eu: 1,
    nicb: 1,
    lt_itpr: 1,
    biluppgifter: 1,
    carinfo: 1,
  };
  const ARCHIVE_HTML_MAX = 900000;

  function pageHtmlForImport() {
    let html = "";
    try {
      html = document.documentElement ? document.documentElement.outerHTML : "";
    } catch (e) {
      html = "";
    }
    if (!html || html.length <= ARCHIVE_HTML_MAX) return html;
    const nextMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>[\s\S]*?<\/script>/i);
    const next = nextMatch ? nextMatch[0].slice(0, 400000) : "";
    const room = ARCHIVE_HTML_MAX - next.length;
    return (html.slice(0, Math.max(0, room)) + next).slice(0, ARCHIVE_HTML_MAX);
  }

  function withArchiveHtml(payload) {
    if (!payload || !ARCHIVE_HTML_IDS[payload.id]) return payload;
    return Object.assign({}, payload, {
      html: pageHtmlForImport(),
      pageUrl: String(location.href || "").slice(0, 500),
    });
  }

  function publishScan(payload) {
    if (window.__provinScanPublished) return;
    window.__provinScanPublished = true;
    const body = withArchiveHtml(Object.assign({ detail: "", at: Date.now() }, payload));
    try {
      GM_setValue(GM_SCAN_RESULT, JSON.stringify(body));
    } catch (e) {
      console.warn("PROVIN skenēšana", e);
    }
    showProvinBadge((body && body.summary) || payload.summary || payload.status || "");
  }

  function swedishPageId() {
    const name = host;
    const p = path || "/";
    if (name === "biluppgifter.se" || name.endsWith(".biluppgifter.se")) {
      if (/^\/fordon\/[^/]+/i.test(p)) return "biluppgifter";
      if (/\/[A-HJ-NPR-Z0-9]{17}(?:\/|$)/i.test(p)) return "biluppgifter";
      return "";
    }
    if (name === "fu-regnr.transportstyrelsen.se") return "transportstyrelsen";
    if (name === "car.info" || name.endsWith(".car.info") || name === "carinfo.se" || name.endsWith(".carinfo.se")) {
      if (/\/vin\/[A-HJ-NPR-Z0-9]{11,17}/i.test(p)) return "carinfo";
      if (/\/(?:en-se|sv-se)\/[^/]+\/[^/]+/i.test(p)) return "carinfo";
      if (/\/(?:fordon|vehicle|bil)\/[^/]+/i.test(p)) return "carinfo";
      return "";
    }
    return "";
  }

  function swedishTextReady(text) {
    if (isScanChallenge(text)) return false;
    const vehicle = /chassinummer|registreringsnummer|fabrikat|märke|marke|handelsbeteckning|modellår|fordonsår|besiktning|fordonsstatus|mätarställning|vehicle info|mileage/i.test(
      text,
    );
    if (/bankid|logga in|cloudflare|just a moment/i.test(text) && !vehicle) return false;
    if (vehicle) return true;
    if (/hittades inte|ingen träff|inga uppgifter|finns inte|not found|no vehicle/i.test(text)) return true;
    return false;
  }

  function watchSwedishImport() {
    const id = swedishPageId();
    if (!id || activeScanOnThisHost()) return;
    if (window.__provinSeWatch) return;
    window.__provinSeWatch = true;
    const started = Date.now();
    const timer = window.setInterval(function () {
      if (Date.now() - started > 180000) {
        window.clearInterval(timer);
        return;
      }
      const text = document.body ? document.body.innerText || "" : "";
      if (!swedishTextReady(text)) return;
      window.clearInterval(timer);
      const html = pageHtmlForImport();
      if (!html || html.length < 40) return;
      try {
        GM_setValue(
          GM_SE_IMPORT,
          JSON.stringify({
            id: id,
            html: html,
            pageUrl: String(location.href || "").slice(0, 500),
            at: Date.now(),
          }),
        );
      } catch (e) {
        console.warn("PROVIN Zviedrija", e);
        return;
      }
      showProvinBadge("Zviedrijas dati nosūtīti uz PROVIN");
    }, 800);
  }

  function pollSwedishImport() {
    if (!/\/admin\/orders\//.test(path)) return;
    if (window.__provinSePoll) return;
    window.__provinSePoll = true;
    const started = Date.now();
    const timer = window.setInterval(function () {
      if (Date.now() - started > 180000) {
        window.clearInterval(timer);
        window.__provinSePoll = false;
        return;
      }
      const marker = document.querySelector("[data-provin-order-vin]");
      if (!marker) return;
      let raw = "";
      try {
        raw = String(GM_getValue(GM_SE_IMPORT, "") || "");
      } catch {
        raw = "";
      }
      if (!raw) return;
      let data = null;
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }
      if (!data || !data.id || !data.html) return;
      if (Date.now() - Number(data.at || 0) > 180000) {
        try {
          GM_deleteValue(GM_SE_IMPORT);
        } catch {
          /* ignore */
        }
        return;
      }
      const orderVin = String(marker.getAttribute("data-provin-order-vin") || "")
        .replace(/[\s-]/g, "")
        .toUpperCase();
      if (orderVin.length < 11) return;
      try {
        GM_deleteValue(GM_SE_IMPORT);
      } catch {
        /* ignore */
      }
      document.dispatchEvent(
        new CustomEvent("provin-vin-scan-result", {
          detail: {
            id: String(data.id),
            vin: orderVin,
            status: "found",
            summary: "",
            html: String(data.html),
            pageUrl: String(data.pageUrl || ""),
            at: Date.now(),
          },
        }),
      );
    }, 700);
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

  function findPoliceWantedInput() {
    const knr = document.querySelector("input[name='knr'], input#knr");
    if (knr && isVisible(knr) && !knr.disabled) return knr;
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
      if (/vin|chassis|kebul|kėbul|sasij|šasij|identifikav|knr/.test(blob)) return el;
    }
    return findScanVinInput();
  }

  function findPlcSearchInput() {
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
      if (blob.includes("search") || blob.includes("vin") || blob.includes("find") || el.type === "search") return el;
    }
    for (const el of nodes) {
      if (!isVisible(el) || el.disabled) continue;
      if (el.type === "text" || el.type === "search" || !el.type) return el;
    }
    return null;
  }

  function extractPlcAuctionExtras() {
    const lotUrl = /\/auction\/lot\//i.test(location.pathname) ? location.href : "";
    const seen = new Set();
    let first = "";
    let count = 0;
    for (const img of document.querySelectorAll("img")) {
      const src = img.currentSrc || img.getAttribute("src") || img.getAttribute("data-src") || "";
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if (!src || src.indexOf("data:") === 0) continue;
      if (/logo|icon|flag|sprite|avatar|favicon/i.test(src)) continue;
      if ((w && w < 80) || (h && h < 80)) continue;
      const clean = String(src).toLowerCase();
      if (seen.has(clean)) continue;
      seen.add(clean);
      count += 1;
      if (!first) first = src;
    }
    return { lotUrl: lotUrl, photoUrl: first, photoCount: count };
  }

  function extractStatVinExtras() {
    const seen = new Set();
    let first = "";
    let count = 0;
    const auctions = [];
    for (const img of document.querySelectorAll("img")) {
      const src = img.currentSrc || img.getAttribute("src") || img.getAttribute("data-src") || "";
      if (!src || src.indexOf("data:") === 0) continue;
      if (/logo|icon|flag|sprite|avatar|favicon|pixel/i.test(src)) continue;
      if (!/copart|iaai|stat\.vin|cloudfront|auction|\.jpe?g|\.webp/i.test(src)) continue;
      const clean = String(src).toLowerCase();
      if (seen.has(clean)) continue;
      seen.add(clean);
      count += 1;
      if (!first) first = src;
    }
    const text = (document.body && document.body.innerText) || "";
    const venue = /iaai/i.test(text) ? "IAAI" : /copart/i.test(text) ? "Copart" : "";
    const lot = (text.match(/lot(?:\s*number)?[:\s#№]*([0-9]{5,10})/i) || [])[1] || "";
    const year = (text.match(/((?:19|20)\d{2})/) || [])[1] || "";
    if (venue || lot || count) {
      auctions.push({
        title: [venue, lot ? "lots " + lot : ""].filter(Boolean).join(" · "),
        date: year,
        venue: venue,
        photoUrl: first,
        photoCount: count || undefined,
      });
    }
    return { photoUrl: first, photoCount: count, auctions: auctions };
  }

  function clickSafeCheck() {
    const pay = /pirkt|buy|apmaks|checkout|pay\b|zamów|koupit|order|subscribe|pasūtīt/i;
    const want = /pārbaudi|pārbaudīt|check|verify|search|meklēt|sākt|ieškoti/i;
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
    if (id === "recall_vw") {
      publishScan({
        id: id,
        vin: probeVin,
        status: "browser_only",
        summary: "Lielbritānijas GOV.UK atsaukumu pārbaude pārlūkā",
        detail: "",
      });
      return;
    }
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
      const input =
        id === "plc_auction"
          ? findPlcSearchInput()
          : id === "lt_itpr"
            ? findPoliceWantedInput()
            : findScanVinInput();
      if (input) {
        const current = String(input.value || "")
          .replace(/[\s-]/g, "")
          .toUpperCase();
        if (current !== probeVin) setNativeValue(input, probeVin);
        filled = true;
      }
      const mayClick =
        blocker !== "captcha" &&
        (id === "bid_cars" ||
          id === "plc_auction" ||
          id === "lt_itpr" ||
          id === "nicb" ||
          id === "bidfax" ||
          id === "poctra");
      if (mayClick && filled && !clicked && ticks >= 3) {
        clicked = clickSafeCheck();
        if (!clicked && (id === "plc_auction" || id === "lt_itpr") && input && typeof input.form?.requestSubmit === "function") {
          input.form.requestSubmit();
          clicked = true;
        } else if (!clicked && (id === "plc_auction" || id === "lt_itpr") && input) {
          input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
          clicked = true;
        }
      }
      if (blocker === "captcha") showProvinBadge("Captcha: VIN SCAN risina serverī");
      else if (blocker === "cloudflare") showProvinBadge("Cloudflare: VIN SCAN risina serverī");
      const result = classifyBrowserProbe(id, text, probeVin);
      if (result) {
        window.clearInterval(timer);
        const extras =
          id === "plc_auction"
            ? extractPlcAuctionExtras()
            : id === "stat_vin"
              ? extractStatVinExtras()
              : { lotUrl: "", photoUrl: "", photoCount: 0, auctions: [] };
        publishScan({
          id: id,
          vin: probeVin,
          status: result.status,
          summary: result.summary,
          detail: "",
          photoUrl: extras.photoUrl,
          photoCount: extras.photoCount,
          openUrl: extras.lotUrl || "",
          auctions: extras.auctions || [],
        });
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
          ? { status: "unknown", summary: "Captcha palika lapā. VIN SCAN to risina serverī ar CapSolver" }
          : blocker === "cloudflare"
            ? { status: "unknown", summary: "Cloudflare palika lapā. VIN SCAN to risina serverī ar CapSolver" }
            : { status: "unknown", summary: "Avots neatbildēja laikā" };
        publishScan({ id: id, vin: probeVin, status: timedOut.status, summary: timedOut.summary, detail: "" });
      }
    }, 500);
  }

  let vin = peekPendingVin();
  if (!vin && host.endsWith("carvertical.com") && carVerticalPurchaseFlagSet()) {
    vin = peekCarVerticalPurchaseVin();
  }

  if (swedishPageId() && !activeScanOnThisHost()) watchSwedishImport();

  if (activeScanOnThisHost() && !(host.endsWith("carvertical.com") && carVerticalPurchaseFlagSet())) {
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
      'input[name="identifier"]',
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

  function carVerticalPurchaseConfirmed() {
    return carVerticalPurchaseFlagSet();
  }

  const CARVERTICAL_NEVER_CLICK_RE =
    /pievienot kart|add (a )?(new )?card|card number|kartes numur|new payment method|jaunu kart|enter card|\bcvv\b|\bcvc\b|subscribe|abon[eē]t|newsletter/i;
  const CARVERTICAL_3DS_PAGE_RE =
    /3-?d\s*secure|3ds\b|authenticate (your )?(card|payment)|verified by visa|mastercard identity|identity check|bankas (kods|apstiprin)|one-time (pass|code)|enter (the )?(sms |otp |security )?code|acs\./i;
  const CARVERTICAL_CHECKOUT_HUMAN_STOP_LV =
    "CarVertical: bankas 3-D Secure vai kartes apstiprinājums. Apstipriniet šajā cilnē. Skripts tālāk nespiedīs";
  const CARVERTICAL_PURPOSE_SURVEY_RE =
    /for what purpose|what (will you|do you) use this report|what.?s your goal|goal with this (vehicle )?history|k[aā]d[eē][ļl].{0,20}vēlies pārbaudīt|vēlies pārbaudīt|k[aā]p[eē]c (j[uū]s )?(p[eē]rc|vajag)|m[eē]r[kķ]im|purpose .{0,40}report|why (are you buying|do you need)/i;
  const CARVERTICAL_PURPOSE_PREFERRED_RE =
    /buying a (used )?(car|vehicle)|buy(ing)? a (used )?(car|vehicle)|i['’]?m buying|want to buy|p[eē]rku auto|es pērku transportlīdzekli|pērku transportlīdzekli|ieg[aā]d[aā]jos|used car purchase/i;
  const CARVERTICAL_PURPOSE_DEALER_RE =
    /professional|dealer|workshop|business use|i'?m a (dealer|professional)|komersant|d[iī]ler|profesion|autod[iī]ler|fleet/i;
  const CARVERTICAL_PURPOSE_AVOID_RE =
    /other\b|cits\b|selling|p[aā]rdod|insurance|apdrošin/i;
  const CARVERTICAL_DISMISS_CLICK_RE =
    /no thanks|n[eē], paldies|skip\b|izlaist|maybe later|v[eē]l[aā]k|not now|nav tagad|continue without|turpin[aā]t bez|no, skip|close\b|aizv[eē]rt|reject|noraid[iī]t|accept all|piekrist vis|allow (all|cookies)|pieņem(t)? vis/i;
  const CARVERTICAL_CONTINUE_CLICK_RE =
    /continue|turp[īi][nņ]āt|turpin[aā]t|next\b|n[aā]kamais|n[aā]kamo|proceed|confirm\b|apstiprin[aā]t/i;
  const CARVERTICAL_EXPLICIT_SAVED_PAY_RE =
    /pay with (credits?|balance|wallet|saved)|use (your )?(credits?|balance|wallet)|izmantot (kred[iī]t|atlikum)|maks[aā]t ar (kred[iī]t|atlikum|saglab)/i;
  const CARVERTICAL_SAVED_PAY_CLICK_RE =
    /pay with (credits?|balance|wallet|saved)|use (your )?(credits?|balance|wallet)|izmantot (kred[iī]t|atlikum)|maks[aā]t ar (kred[iī]t|atlikum|saglab)|complete (purchase|payment|order)|pay now|maks[aā]t|\bpay\b|checkout|buy now|pirkt tagad|confirm (and )?pay|place order/i;
  const CARVERTICAL_START_REPORT_CLICK_RE =
    /sākt pārbaudi|pārbaudīt transportlīdzekli|pārbaudīt vin|pārbaudi vin|check vehicle|check vin|verify vin|ģenerēt jaunu atskaiti|generate new report|pārbaudi šo transportlīdzekli|check this vehicle/i;
  const CARVERTICAL_BUY_REPORT_CLICK_RE =
    /pirkt|buy report|get report|full report|pērc par|buy for\b|saņemt atskaiti/i;
  const CARVERTICAL_BUY_ONE_REPORT_RE =
    /pirkt\s+1\s+atskait|buy\s+1\s+report|pirkt atskaiti(?: tūlīt)?(?!s)|buy report(?: now)?(?!s)/i;
  const CARVERTICAL_CHECK_PRICING_RE =
    /pārbaudīt cenu|check pricing|skatīt cenu|see pric(e|ing)|view pric(e|ing)/i;
  const CARVERTICAL_BUY_FORWARD_RE = /pērc par|perc par|buy for\b|saņemt atskaiti|get the report/i;
  const CARVERTICAL_VIN_CONFIRM_CLICK_RE =
    /ziņot un turpināt|report\s*(&|and)\s*proceed/i;
  const CARVERTICAL_START_AVOID_RE =
    /citu transport|other vehicle|bez vin|without a vin|without a reg|notīrīt ievad|clear input|pamanīji kļūdu|pirkt atskaites\b|buy reports\b/i;
  const CARVERTICAL_MULTI_PACK_CLICK_AVOID_RE =
    /pirkt\s+[23]\b|pirkt\s+(div|trīs|two|three)\b|\b2\s+atskait|\b3\s+atskait|ietaup\s*%|save\s+\d+\s*%/i;
  const CARVERTICAL_COUNTRY_STAY_LV_RE =
    /palikt valstī|stay in [\p{L}]+|remain in [\p{L}]+/iu;
  const CARVERTICAL_PRICE_CARD_LABEL_RE = /^\s*€|^\s*\d+[,.]?\d*\s*€/;
  const CARVERTICAL_LABEL_MAX = 160;
  const CARVERTICAL_CTA_EXTRACT_RES = [
    CARVERTICAL_CHECK_PRICING_RE,
    CARVERTICAL_BUY_ONE_REPORT_RE,
    CARVERTICAL_BUY_FORWARD_RE,
    CARVERTICAL_VIN_CONFIRM_CLICK_RE,
    CARVERTICAL_COUNTRY_STAY_LV_RE,
    CARVERTICAL_PURPOSE_PREFERRED_RE,
    CARVERTICAL_PURPOSE_DEALER_RE,
    CARVERTICAL_CONTINUE_CLICK_RE,
    CARVERTICAL_EXPLICIT_SAVED_PAY_RE,
    CARVERTICAL_SAVED_PAY_CLICK_RE,
    CARVERTICAL_DISMISS_CLICK_RE,
    CARVERTICAL_START_REPORT_CLICK_RE,
    CARVERTICAL_BUY_REPORT_CLICK_RE,
  ];

  function rankCarVerticalPurposeLabel(label) {
    const t = String(label || "").trim();
    if (!t || t.length > CARVERTICAL_LABEL_MAX) return 0;
    if (
      CARVERTICAL_PURPOSE_AVOID_RE.test(t) &&
      !CARVERTICAL_PURPOSE_PREFERRED_RE.test(t) &&
      !CARVERTICAL_PURPOSE_DEALER_RE.test(t)
    ) {
      return 0;
    }
    if (CARVERTICAL_PURPOSE_PREFERRED_RE.test(t)) return 3;
    if (CARVERTICAL_PURPOSE_DEALER_RE.test(t)) return 2;
    return 0;
  }

  function pickCarVerticalPurposeLabel(labels) {
    let best = "";
    let bestRank = 0;
    for (let i = 0; i < labels.length; i += 1) {
      const rank = rankCarVerticalPurposeLabel(labels[i]);
      if (rank > bestRank) {
        best = String(labels[i] || "").trim();
        bestRank = rank;
      }
    }
    return bestRank >= 2 ? best : "";
  }

  function firstAllowedCarVerticalLabel(labels, re) {
    for (let i = 0; i < labels.length; i += 1) {
      const t = String(labels[i] || "").trim();
      if (!t || t.length > CARVERTICAL_LABEL_MAX) continue;
      if (CARVERTICAL_NEVER_CLICK_RE.test(t)) continue;
      if (CARVERTICAL_START_AVOID_RE.test(t)) continue;
      if (re.test(t)) return t;
    }
    return "";
  }

  function pickCarVerticalDismissLabel(labels) {
    const ranked = [
      /no thanks|n[eē], paldies|continue without|turpin[aā]t bez|maybe later|not now|nav tagad|no, skip/i,
      /skip\b|izlaist/i,
      /accept all|piekrist vis|allow (all|cookies)|pieņem(t)? vis/i,
      /close\b|aizv[eē]rt|reject|noraid[iī]t/i,
    ];
    for (let i = 0; i < ranked.length; i += 1) {
      const hit = firstAllowedCarVerticalLabel(labels, ranked[i]);
      if (hit) return hit;
    }
    return "";
  }

  function isCarVerticalStartReportLabel(label) {
    const t = String(label || "").trim();
    if (!t || CARVERTICAL_NEVER_CLICK_RE.test(t)) return false;
    if (CARVERTICAL_START_AVOID_RE.test(t)) return false;
    if (CARVERTICAL_PRICE_CARD_LABEL_RE.test(t)) return false;
    if (CARVERTICAL_CHECK_PRICING_RE.test(t)) return false;
    if (CARVERTICAL_MULTI_PACK_CLICK_AVOID_RE.test(t) && !CARVERTICAL_BUY_ONE_REPORT_RE.test(t)) return false;
    if (CARVERTICAL_SAVED_PAY_CLICK_RE.test(t) && /checkout|pay now|maksāt|complete/i.test(t)) return false;
    return CARVERTICAL_START_REPORT_CLICK_RE.test(t) || CARVERTICAL_BUY_REPORT_CLICK_RE.test(t);
  }

  function isCarVerticalClickablePurchaseLabel(label) {
    const t = String(label || "").trim();
    if (!t || t.length > CARVERTICAL_LABEL_MAX) return false;
    if (CARVERTICAL_NEVER_CLICK_RE.test(t)) return false;
    if (CARVERTICAL_START_AVOID_RE.test(t)) return false;
    if (CARVERTICAL_PRICE_CARD_LABEL_RE.test(t)) return false;
    if (CARVERTICAL_MULTI_PACK_CLICK_AVOID_RE.test(t) && !CARVERTICAL_BUY_ONE_REPORT_RE.test(t)) return false;
    return true;
  }

  function carVerticalLabelLooksLikeCta(label) {
    const t = String(label || "").trim();
    if (!isCarVerticalClickablePurchaseLabel(t)) return false;
    for (let i = 0; i < CARVERTICAL_CTA_EXTRACT_RES.length; i += 1) {
      if (CARVERTICAL_CTA_EXTRACT_RES[i].test(t)) return true;
    }
    return false;
  }

  function extractCarVerticalActionLabel(raw) {
    const text = String(raw || "");
    const compact = text.replace(/\s+/g, " ").trim();
    if (!compact) return "";
    const lines = text.split(/\n+/);
    const trimmedLines = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = String(lines[i] || "").replace(/\s+/g, " ").trim();
      if (line) trimmedLines.push(line);
      if (line.length <= CARVERTICAL_LABEL_MAX && carVerticalLabelLooksLikeCta(line)) return line;
    }
    if (compact.length <= CARVERTICAL_LABEL_MAX && carVerticalLabelLooksLikeCta(compact) && trimmedLines.length <= 1) {
      return compact;
    }
    for (let r = 0; r < CARVERTICAL_CTA_EXTRACT_RES.length; r += 1) {
      const hit = compact.match(CARVERTICAL_CTA_EXTRACT_RES[r]);
      if (!hit || !hit[0]) continue;
      const idx = compact.toLowerCase().indexOf(hit[0].toLowerCase());
      if (idx < 0) continue;
      let start = idx;
      let end = idx + hit[0].length;
      while (start > 0 && compact[start - 1] !== "." && end - start < 80) start -= 1;
      while (end < compact.length && compact[end] !== "." && end - start < 80) end += 1;
      const phrase = compact.slice(start, end).trim();
      if (phrase.length <= CARVERTICAL_LABEL_MAX && isCarVerticalClickablePurchaseLabel(phrase)) {
        return phrase;
      }
      if (hit[0].length <= CARVERTICAL_LABEL_MAX && isCarVerticalClickablePurchaseLabel(hit[0])) {
        return hit[0];
      }
    }
    return compact.length <= CARVERTICAL_LABEL_MAX ? compact : "";
  }

  function isCarVerticalBuyOneLabel(label) {
    const t = String(label || "").trim();
    if (!isCarVerticalClickablePurchaseLabel(t)) return false;
    return CARVERTICAL_BUY_ONE_REPORT_RE.test(t) || CARVERTICAL_BUY_FORWARD_RE.test(t);
  }

  function isCarVerticalCheckoutFlowPage(href) {
    const p = String(href || "").toLowerCase();
    return (
      /\/precheck\b/.test(p) ||
      /\/searching\b/.test(p) ||
      /\/pricing\b/.test(p) ||
      /\/checkout\b/.test(p) ||
      /\/auth\b/.test(p) ||
      /\/login\b/.test(p) ||
      /\/user\/reports\b/.test(p) ||
      /\/sign-?in\b/.test(p) ||
      /\/register\b/.test(p)
    );
  }

  function carVerticalPurchasedReportReady(input) {
    const href = String((input && input.href) || "");
    if (isCarVerticalCheckoutFlowPage(href)) return false;
    const t = String((input && input.pageText) || "");
    if (t.length < 200) return false;
    const vin = String((input && input.vin) || "")
      .replace(/[\s-]/g, "")
      .toUpperCase();
    const hasVin = vin.length >= 11 && t.toUpperCase().indexOf(vin) !== -1;
    if (/inform[aā]cija nav atrasta|no information found|couldn.t find any/i.test(t) && !hasVin) return false;
    if (!hasVin) return false;
    if (/\/user\/reports\b/i.test(href)) return false;
    return /odometer|nobraukum|mileage|full report|piln[aā] atskaite|vehicle history|negadījum|damage|report ready|your report/i.test(
      t,
    );
  }

  function classifyCarVerticalCheckoutStep(input) {
    if (!input || !input.purchaseConfirmed) {
      return { kind: "idle", label: "", log: "nav apstiprinājuma" };
    }
    const page = String(input.href || "") + " " + String(input.pageText || "");
    if (input.has3dsFrame || CARVERTICAL_3DS_PAGE_RE.test(page)) {
      return { kind: "stop_3ds", label: "", log: CARVERTICAL_CHECKOUT_HUMAN_STOP_LV };
    }
    const ignored = {};
    const ignoredList = input.ignoredLabels || [];
    for (let ig = 0; ig < ignoredList.length; ig += 1) {
      const key = String(ignoredList[ig] || "").trim();
      if (key) ignored[key] = 1;
    }
    const labels = (input.labels || [])
      .map(function (item) {
        return extractCarVerticalActionLabel(item) || String(item || "").trim();
      })
      .filter(function (item) {
        return item && !ignored[item];
      });
    const countryStay = firstAllowedCarVerticalLabel(labels, CARVERTICAL_COUNTRY_STAY_LV_RE);
    if (countryStay && /latvij|latvia/i.test(String(input.pageText || "") + " " + countryStay)) {
      return { kind: "country_stay", label: countryStay, log: "country_stay " + countryStay };
    }
    for (let bi = 0; bi < labels.length; bi += 1) {
      if (isCarVerticalBuyOneLabel(labels[bi])) {
        return { kind: "buy_one", label: labels[bi].trim(), log: "buy_one " + labels[bi].trim() };
      }
    }
    const checkPricing = firstAllowedCarVerticalLabel(labels, CARVERTICAL_CHECK_PRICING_RE);
    if (checkPricing) {
      return { kind: "check_pricing", label: checkPricing, log: "check_pricing " + checkPricing };
    }
    const purposeSurvey =
      CARVERTICAL_PURPOSE_SURVEY_RE.test(input.pageText || "") || /vēlies pārbaudīt/i.test(input.pageText || "");
    if (purposeSurvey) {
      if (!input.purposeOptionChosen) {
        const purpose = pickCarVerticalPurposeLabel(labels);
        if (purpose && rankCarVerticalPurposeLabel(purpose) >= 2) {
          return { kind: "purpose", label: purpose, log: "purpose " + purpose };
        }
      }
      const contAfterPurpose =
        firstAllowedCarVerticalLabel(labels, /^turp[īi][nņ]āt$/i) ||
        firstAllowedCarVerticalLabel(labels, CARVERTICAL_CONTINUE_CLICK_RE);
      if (contAfterPurpose) {
        return { kind: "continue", label: contAfterPurpose, log: "continue " + contAfterPurpose };
      }
    }
    const vinConfirm = firstAllowedCarVerticalLabel(labels, CARVERTICAL_VIN_CONFIRM_CLICK_RE);
    if (vinConfirm) {
      return { kind: "vin_confirm", label: vinConfirm, log: "vin_confirm " + vinConfirm };
    }
    const dismiss = pickCarVerticalDismissLabel(labels);
    if (dismiss) {
      return { kind: "dismiss", label: dismiss, log: "dismiss " + dismiss };
    }
    let startHit = "";
    for (let i = 0; i < labels.length; i += 1) {
      if (isCarVerticalStartReportLabel(labels[i])) {
        startHit = labels[i].trim();
        break;
      }
    }
    if (startHit) {
      return { kind: "start_report", label: startHit, log: "start_report " + startHit };
    }
    const explicitSaved = firstAllowedCarVerticalLabel(labels, CARVERTICAL_EXPLICIT_SAVED_PAY_RE);
    if (explicitSaved) {
      return { kind: "pay_saved", label: explicitSaved, log: "pay_saved " + explicitSaved };
    }
    const cont = firstAllowedCarVerticalLabel(labels, CARVERTICAL_CONTINUE_CLICK_RE);
    if (cont) {
      return { kind: "continue", label: cont, log: "continue " + cont };
    }
    if (input.hasNewCardField) {
      return { kind: "stop_3ds", label: "", log: CARVERTICAL_CHECKOUT_HUMAN_STOP_LV };
    }
    const savedPay = firstAllowedCarVerticalLabel(labels, CARVERTICAL_SAVED_PAY_CLICK_RE);
    if (savedPay) {
      return { kind: "pay_saved", label: savedPay, log: "pay_saved " + savedPay };
    }
    return { kind: "wait", label: "", log: "gaida nākamo soli" };
  }

  function carVerticalNodeRawText(el) {
    if (!el) return "";
    if (el.tagName === "INPUT" && el.type === "radio") {
      const lab = el.labels && el.labels[0];
      return String((lab && lab.textContent) || el.value || el.getAttribute("aria-label") || "");
    }
    return String(el.textContent || el.value || el.getAttribute("aria-label") || "");
  }

  function carVerticalNodeLabel(el) {
    const aria = el ? String(el.getAttribute("aria-label") || "") : "";
    return extractCarVerticalActionLabel(aria) || extractCarVerticalActionLabel(carVerticalNodeRawText(el));
  }

  function carVerticalHasVisible3dsFrame() {
    let frames = [];
    try {
      frames = Array.from(
        document.querySelectorAll(
          'iframe[src*="3ds"], iframe[src*="3d-secure"], iframe[src*="3dsecure"], iframe[src*="cardinal"], iframe[src*="acs."], iframe[title*="3-D"], iframe[title*="3D"]',
        ),
      );
    } catch {
      frames = [];
    }
    for (let i = 0; i < frames.length; i += 1) {
      if (isVisible(frames[i]) || frames[i].offsetParent !== null || (frames[i].getBoundingClientRect && frames[i].getBoundingClientRect().height > 0)) {
        return true;
      }
    }
    return frames.length > 0;
  }

  function carVerticalHasVisibleNewCardField() {
    let nodes = [];
    try {
      nodes = Array.from(
        document.querySelectorAll(
          'input[autocomplete="cc-number"], input[name*="cardNumber"], input[name*="card-number"], input[placeholder*="card number" i], input[placeholder*="kartes numur" i]',
        ),
      );
    } catch {
      nodes = [];
    }
    for (let i = 0; i < nodes.length; i += 1) {
      if (isVisible(nodes[i]) && !nodes[i].disabled) return true;
    }
    return false;
  }

  function collectCarVerticalClickables() {
    const nodes = Array.from(
      document.querySelectorAll(
        "button, [role='button'], [role='radio'], [role='option'], [role='menuitem'], a, label, input[type='submit'], input[type='button'], input[type='radio']",
      ),
    );
    const items = [];
    for (let i = 0; i < nodes.length; i += 1) {
      const el = nodes[i];
      if (!isVisible(el) || el.disabled) continue;
      if (el.tagName === "A") {
        const href = String(el.getAttribute("href") || "");
        if (/^https?:/i.test(href) && !/carvertical\.com/i.test(href)) continue;
      }
      const label = carVerticalNodeLabel(el);
      if (!label || label.length > CARVERTICAL_LABEL_MAX) continue;
      if (!isCarVerticalClickablePurchaseLabel(label)) continue;
      items.push({ el: el, label: label });
    }
    return items;
  }

  function advanceCarVerticalCheckout() {
    if (!carVerticalPurchaseConfirmed()) {
      return { kind: "idle", label: "", log: "nav apstiprinājuma" };
    }
    if (Date.now() - (window.__provinCvLastClickAt || 0) < 800) {
      return { kind: "wait", label: "", log: "pauze pēc klikšķa" };
    }
    const pageText = document.body ? document.body.innerText || "" : "";
    const items = collectCarVerticalClickables();
    const labels = items.map(function (item) {
      return item.label;
    });
    const skip = window.__provinCvSkipLabels || (window.__provinCvSkipLabels = {});
    const ignored = [];
    for (const key in skip) {
      if (Object.prototype.hasOwnProperty.call(skip, key) && skip[key] >= 6) ignored.push(key);
    }
    const decision = classifyCarVerticalCheckoutStep({
      purchaseConfirmed: true,
      pageText: pageText,
      labels: labels,
      href: location.href,
      has3dsFrame: carVerticalHasVisible3dsFrame(),
      hasNewCardField: carVerticalHasVisibleNewCardField(),
      purposeOptionChosen: Boolean(window.__provinCvPurposeChosen),
      ignoredLabels: ignored,
    });
    console.log("PROVIN CarVertical solis:", decision.kind, decision.label || decision.log);
    if (decision.kind === "purpose") {
      window.__provinCvPurposeChosen = true;
    }
    if (decision.kind === "stop_3ds") {
      window.__provinCvHumanStop = true;
      showProvinBadge(CARVERTICAL_CHECKOUT_HUMAN_STOP_LV);
      return decision;
    }
    window.__provinCvHumanStop = false;
    if (decision.kind === "wait" || decision.kind === "idle" || !decision.label) {
      return decision;
    }
    const hit =
      items.find(function (item) {
        return item.label === decision.label;
      }) ||
      items.find(function (item) {
        return item.label.indexOf(decision.label) !== -1;
      });
    if (!hit) {
      console.log("PROVIN CarVertical solis: poga vēl nav redzama", decision.label);
      return { kind: "wait", label: "", log: "poga nav redzama" };
    }
    try {
      if (hit.el instanceof HTMLInputElement && hit.el.type === "radio") {
        hit.el.checked = true;
        hit.el.dispatchEvent(new Event("input", { bubbles: true }));
        hit.el.dispatchEvent(new Event("change", { bubbles: true }));
      }
      hit.el.click();
      window.__provinCvLastClickAt = Date.now();
      skip[decision.label] = (skip[decision.label] || 0) + 1;
    } catch (e) {
      console.warn("PROVIN CarVertical solis kļūda", e);
    }
    return decision;
  }

  function clickCarVerticalCheck() {
    if (!carVerticalPurchaseConfirmed()) return;
    return advanceCarVerticalCheckout();
  }

  function carVerticalReportLooksReady(text, vin) {
    return carVerticalPurchasedReportReady({
      href: location.href,
      pageText: text,
      vin: vin,
    });
  }

  function publishCarVerticalPurchase(payload) {
    if (window.__provinCvPurchasePublished) return;
    window.__provinCvPurchasePublished = true;
    try {
      GM_setValue(GM_CV_PURCHASE_RESULT, JSON.stringify(payload));
      GM_deleteValue(GM_CV_PURCHASE);
      GM_deleteValue(GM_CV_PURCHASE_VIN);
    } catch (e) {
      console.warn("PROVIN CarVertical pirkums", e);
    }
    showProvinBadge(payload.summary || "CarVertical");
  }

  function watchCarVerticalPurchasedReport(vin) {
    if (!carVerticalPurchaseConfirmed()) return;
    if (window.__provinCvWatchTimer) return;
    window.__provinCvPurposeChosen = false;
    let ticks = 0;
    let last = "";
    let stable = 0;
    const timer = window.setInterval(() => {
      ticks += 1;
      const text = document.body ? document.body.innerText || "" : "";
      if (text === last) stable += 1;
      else {
        last = text;
        stable = 0;
      }
      const step = advanceCarVerticalCheckout();
      const ready = carVerticalReportLooksReady(text, vin);
      if (ready && stable >= 4) {
        window.clearInterval(timer);
        window.__provinCvWatchTimer = 0;
        publishCarVerticalPurchase({
          id: "carvertical_preview",
          vin: vin,
          status: "found",
          summary: "CarVertical atskaite nopirkta",
          detail: scanTextExcerpt(text, vin),
          openUrl: location.href,
          purchased: true,
        });
        return;
      }
      const humanStop = step.kind === "stop_3ds" || window.__provinCvHumanStop;
      const limit = humanStop ? 240 : 180;
      if (ticks > limit) {
        window.clearInterval(timer);
        window.__provinCvWatchTimer = 0;
        publishCarVerticalPurchase({
          id: "carvertical_preview",
          vin: vin,
          status: ready ? "found" : "unknown",
          summary: ready
            ? "CarVertical atskaite nopirkta"
            : humanStop
              ? CARVERTICAL_CHECKOUT_HUMAN_STOP_LV
              : "CarVertical pirkums sākts. Atskaite jāpārbauda cilnē",
          detail: scanTextExcerpt(text, vin),
          openUrl: location.href,
          purchased: true,
        });
      }
    }, 500);
    window.__provinCvWatchTimer = timer;
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
    /* car.info meklēšana ir JS overlay: form.requestSubmit ved uz 404 /search?q= */
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
        const classified = classifyBrowserProbe("checkcar_vin", text, probeVin);
        /* Admin panelim vajag tikai faktu, vai bildes ir. Pirmo foto pietiek. */
        if (count > 0 && stable >= 1) {
          console.log("PROVIN checkcar: ir foto");
          window.clearInterval(timer);
          publishCheckcarPhotos(probeVin, count, "");
        } else if (classified && classified.status === "found" && stable >= 4) {
          console.log("PROVIN checkcar: klasifikators saka found");
          window.clearInterval(timer);
          publishScan({
            id: "checkcar_vin",
            vin: probeVin,
            status: "found",
            summary: classified.summary,
            detail: "",
          });
        } else if (classified && classified.status === "none" && ticks >= 16 && stable >= 6) {
          console.log("PROVIN checkcar: klasifikators saka none");
          window.clearInterval(timer);
          publishCheckcarPhotos(probeVin, 0, "");
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

  function findGenericVinInput() {
    const selectors = [
      'input[name="vin"]',
      'input#vin',
      'textarea[name="vin"]',
      'input[name="chassisNumber"]',
      'input[name="understellsnummer"]',
      'input[name="knr"]',
      'input[name="stelnummer"]',
      'input[placeholder*="VIN" i]',
      'input[placeholder*="vin" i]',
    ];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && isVisible(el) && !el.disabled) return el;
      } catch {
        /* ignore */
      }
    }
    for (const el of document.querySelectorAll("input, textarea")) {
      if (!isVisible(el) || el.disabled || el.type === "password" || el.type === "hidden") continue;
      const blob = ((el.name || "") + " " + (el.id || "") + " " + (el.getAttribute("placeholder") || "") + " " + (el.getAttribute("aria-label") || "")).toLowerCase();
      if (blob.includes("vin") || blob.includes("chassis") || blob.includes("understell") || blob.includes("stelnummer")) return el;
    }
    return null;
  }

  function findGenericPlateInput() {
    const plate =
      params.get("registration") ||
      params.get("kenteken") ||
      params.get("plate") ||
      "";
    if (!plate) return null;
    const selectors = [
      'input[name="registration"]',
      'input[name="kenteken"]',
      'input[name="plate"]',
      'input[name="regNr"]',
      'input[placeholder*="reg" i]',
    ];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && isVisible(el) && !el.disabled) return { el: el, plate: String(plate).toUpperCase() };
      } catch {
        /* ignore */
      }
    }
    return null;
  }

  const isCV = host.endsWith("carvertical.com");
  const isAR = host.endsWith("auto-records.com");
  const isDNA = host.endsWith("autodna.lv") || host.endsWith("autodna.com");
  const isCTR = host.endsWith("checkthisreg.com");
  const isInfo = host.endsWith("car.info");
  const isCheckcar = host.endsWith("checkcar.vin");
  const isScanHost = Boolean(scanIdForHost(host));

  if (!isCV && !isAR && !isDNA && !isCTR && !isInfo && !isCheckcar && !isScanHost) return;

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
      const pending = String(vin || "")
        .replace(/[\s-]/g, "")
        .toUpperCase();
      if (carVerticalPurchaseConfirmed() && pending.length >= 11) {
        watchCarVerticalPurchasedReport(pending);
      }
      const el = findCarVerticalVinInput(elapsed1s);
      if (el && !el.disabled && !done) {
        done = true;
        window.clearInterval(interval);
        fillAndClear(el);
        window.setTimeout(function () {
          clickCarVerticalCheck();
        }, 400);
        return;
      }
      if (carVerticalPurchaseConfirmed() && elapsed1s && !el) {
        done = true;
        window.clearInterval(interval);
        clickCarVerticalCheck();
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
      return;
    }

    if (isScanHost) {
      const plateHit = findGenericPlateInput();
      if (plateHit) {
        const have = String(plateHit.el.value || "").replace(/[\s-]/g, "").toUpperCase();
        const want = String(plateHit.plate || "").replace(/[\s-]/g, "").toUpperCase();
        if (have !== want) setNativeValue(plateHit.el, plateHit.plate);
      }
      const el = findGenericVinInput();
      if (el && !el.disabled) {
        fillAndClear(el);
        done = true;
        window.clearInterval(interval);
      }
    }
  }, 250);
})();
