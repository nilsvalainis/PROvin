// ==UserScript==
// @name         PROVIN VIN un Tirgus dati auto-fill
// @namespace    https://github.com/nilsvalainis/PROvin
// @version      1.28.1
// @description  Admin MENU VIN auto-fill. VIN SCAN cilnes atver jau aizpildītu meklēšanu. Izsoļu arhīva HTML (stat.vin, bid.cars, bidfax, poctra, checkcar.vin, plc.auction, CARFAX.eu) un Zviedrijas reģistrs (biluppgifter, Transportstyrelsen, car.info) nosūta adminam. stat.vin, bid.cars, BidFax, checkcar.vin, plc.auction, CARFAX.eu, Poctra, biluppgifter.se un NICB ielādē no jūsu pārlūka (GM_xmlhttpRequest), jo servera IP ir bloķēti. kfzgutachten.at (Austrijas §57a) sarakstu pēc «Suchen» nosūta pasūtījumam (atzinumus nepērk, neko nespiež). checkcar.vin atvērtajā atskaitē poga «Nosūtīt uz PROVIN» nosūta vēsturi un foto pasūtījumam vai ātrajam vērtējumam (neko nepērk). Pēc apstiprināta CarVertical pirkuma iziet checkout soļus; 3-D Secure paliek operatoram.
// @updateURL    https://www.provin.lv/userscripts/provin-vin-autofill.user.js
// @downloadURL  https://www.provin.lv/userscripts/provin-vin-autofill.user.js
// @match        http://localhost:*/admin*
// @match        http://127.0.0.1:*/admin*
// @match        https://provin.lv/admin*
// @match        https://www.provin.lv/admin*
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
// @match        https://www.carfax.eu/*
// @match        https://carfax.eu/*
// @match        https://en.cebia.com/*
// @match        https://www.cebia.com/*
// @match        https://cebia.com/*
// @match        https://www.auto.vin/*
// @match        https://auto.vin/*
// @match        https://plc.auction/*
// @match        https://www.plc.auction/*
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
// @match        https://kfzgutachten.at/*
// @match        https://www.kfzgutachten.at/*
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
// @connect      biluppgifter.se
// @connect      www.biluppgifter.se
// @connect      www.nicb.org
// @connect      nicb.org
// @connect      ss.lv
// @connect      ss.com
// @connect      auto24.lv
// @connect      auto24.ee
// @connect      autoplius.lt
// @connect      reklama.lv
// @connect      andele.lv
// @connect      andelemandele.lv
// @run-at       document-idle
// @sandbox      raw
// ==/UserScript==

(function () {
  "use strict";

  const SCRIPT_VERSION = "1.28.1";
  const host = window.location.hostname.replace(/^www\./, "");
  const params = new URLSearchParams(window.location.search);
  const path = window.location.pathname || "";
  /* Admin tilts tikai PROVIN admin lapā. Ceļš „/admin” svešā vietnē (piem. cits *.vercel.app) nedrīkst
     saņemt GM_xmlhttpRequest ar operatora sīkdatnēm, skenēšanas HTML vai CarVertical pirkuma karogu. */
  const IS_PROVIN_ADMIN =
    ["provin.lv", "localhost", "127.0.0.1"].indexOf(window.location.hostname.replace(/^www\./, "")) !== -1 &&
    /^\/admin(?:\/|$)/.test(path);
  /* TM 5.5 USER_SCRIPT / grant sandbox: document var būt ietīts; lapas DOM ir unsafeWindow. */
  function pageDocumentElement() {
    try {
      const uw = typeof unsafeWindow !== "undefined" ? unsafeWindow : null;
      if (uw && uw.document && uw.document.documentElement) return uw.document.documentElement;
    } catch {
      /* ignore */
    }
    return document.documentElement;
  }
  function userscriptAttrVersion(html) {
    try {
      return String(html.getAttribute("data-provin-userscript") || "");
    } catch {
      return "";
    }
  }
  let stampObserver = null;
  let stampTimer = 0;
  let stampReadbackOk = true;
  function stopStampObserver() {
    stampReadbackOk = false;
    if (stampTimer) {
      window.clearTimeout(stampTimer);
      stampTimer = 0;
    }
    if (stampObserver) {
      stampObserver.disconnect();
      stampObserver = null;
    }
  }
  function stampUserscriptVersion() {
    if (!stampReadbackOk) return;
    try {
      const html = pageDocumentElement();
      if (!html) return;
      const current = userscriptAttrVersion(html);
      if (current === SCRIPT_VERSION) return;
      /* 1.27.1: cita PROVIN skripta kopija (piem. vecā 1.26.x) jau atzīmēja savu versiju - nepārrakstām.
         Divas kopijas citādi rakstīja viena otrai pāri ik ~32 ms, un VIN SCAN kartīte raustījās (25.11).
         Admin lapa augstāko versiju uzzina no pong notikuma. */
      if (current) return;
      html.setAttribute("data-provin-userscript", SCRIPT_VERSION);
      try {
        window.__provinUserscriptVersion = SCRIPT_VERSION;
      } catch {
        /* ignore */
      }
      /* Ja getAttribute pēc setAttribute joprojām nav versija (TM 5.5 sandbox /
         USER_SCRIPT world), observeris citādi raksta bezgalīgi ~100% CPU. */
      if (userscriptAttrVersion(html) !== SCRIPT_VERSION) stopStampObserver();
    } catch {
      /* ignore */
    }
  }
  function scheduleStampUserscriptVersion() {
    if (!stampReadbackOk || stampTimer) return;
    stampTimer = window.setTimeout(function () {
      stampTimer = 0;
      stampUserscriptVersion();
    }, 32);
  }
  stampUserscriptVersion();
  if (IS_PROVIN_ADMIN) {
    /* React 19 noņem visus <html> atribūtus, kad saknes singletonu iegūst no jauna; tad admin rāda „nav aktīvs”. */
    if (stampReadbackOk) {
      try {
        stampObserver = new MutationObserver(scheduleStampUserscriptVersion);
        stampObserver.observe(pageDocumentElement(), {
          attributes: true,
          attributeFilter: ["data-provin-userscript"],
        });
      } catch {
        /* ignore */
      }
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

  /* ---------- CheckCar.vin pilnā atskaite: admin cilne pārsūta uz PROVIN serveri ----------
     checkcar.vin cilne (Nila nopirktā/atvērtā atskaite) ieliek GM krātuvē darbu (teksts, HTML, foto
     grupas) un pēc tam foto partijās (data URL, lejupielādēti Nila pārlūkā). Šī admin cilne tos sūta
     uz /api/admin/checkcar-import un /api/admin/cc-vin-photo ar savu sesiju (tā pati izcelsme). */
  const GM_CCFULL_JOB = "provin_ccfull_job";
  const GM_CCFULL_STATUS = "provin_ccfull_status";
  const GM_CCFULL_BATCH = "provin_ccfull_batch";
  const GM_CCFULL_ACK = "provin_ccfull_ack";
  const GM_CCFULL_CLAIM = "provin_ccfull_claim";
  const CCFULL_ERROR_LV = {
    order_not_found: "PROVIN nav pasūtījuma ar šo VIN",
    vin_mismatch: "Lapā redzams cits VIN",
    page_not_ready: "Atskaite vēl nav ielādēta",
    too_large: "Lapa par lielu",
    unauthorized: "Ielogojies PROVIN adminā",
    forbidden: "Nav piekļuves PROVIN adminam",
    invalid_vin: "Nederīgs VIN",
  };
  function ccfullGmJson(key) {
    try {
      const raw = GM_getValue(key, "");
      return raw ? JSON.parse(String(raw)) : null;
    } catch {
      return null;
    }
  }
  function ccfullSetStatus(obj) {
    try {
      GM_setValue(GM_CCFULL_STATUS, JSON.stringify(Object.assign({ at: Date.now() }, obj)));
    } catch (e) {
      console.warn("PROVIN checkcar imports: statuss", e);
    }
  }
  function ccfullErrorText(code) {
    const c = String(code || "");
    return CCFULL_ERROR_LV[c] || (c ? "Kļūda: " + c : "Kļūda");
  }
  if (IS_PROVIN_ADMIN && typeof fetch === "function") {
    const ccfullTab = Math.random().toString(36).slice(2);
    /* Atvērtā pasūtījuma / ātrā vērtējuma lapa = operatora izvēlētais mērķis (serveris pārbauda VIN). */
    function ccfullPageHint() {
      /* Dzīvais ceļš: admin ir SPA, `path` paliek no pirmās ielādes (piem. /admin pēc pārejas uz pasūtījumu). */
      const livePath = window.location.pathname || "";
      const q = livePath.match(/^\/admin\/atras-vertesanas\/([0-9a-f-]{36})(?:\/|$)/i);
      if (q) return { kind: "quick_eval", id: q[1].toLowerCase() };
      const o = livePath.match(/^\/admin\/orders\/([A-Za-z0-9_]+)(?:\/|$)/);
      if (o) return { kind: "order", id: o[1] };
      return null;
    }
    let ccfullBusy = false;
    let ccfullCurrent = null;
    function ccfullToast(text) {
      try {
        let el = document.getElementById("provin-ccfull-toast");
        if (!el) {
          el = document.createElement("div");
          el.id = "provin-ccfull-toast";
          el.style.cssText =
            "position:fixed;z-index:2147483647;left:16px;bottom:16px;max-width:420px;background:#0f172a;color:#fff;padding:10px 14px;border-radius:10px;font:500 13px/1.4 Inter,system-ui,sans-serif";
          document.body.appendChild(el);
        }
        el.textContent = text;
      } catch {
        /* ignore */
      }
    }
    async function ccfullPost(url, body) {
      const res = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      return { status: res.status, data: data || {} };
    }
    function ccfullClaim(jobId) {
      const c = ccfullGmJson(GM_CCFULL_CLAIM);
      if (c && c.jobId === jobId && c.tab !== ccfullTab && Date.now() - Number(c.at || 0) < 20000) return false;
      GM_setValue(GM_CCFULL_CLAIM, JSON.stringify({ jobId: jobId, tab: ccfullTab, at: Date.now() }));
      return true;
    }
    async function ccfullPrepare(job) {
      ccfullSetStatus({ jobId: job.jobId, stage: "working", message: "PROVIN nolasa atskaiti..." });
      ccfullToast("CheckCar.vin: nolasu atskaiti " + job.vin);
      const hint = ccfullPageHint();
      const body = {
        action: "prepare",
        vin: job.vin,
        text: job.text || "",
        html: job.html || "",
        pageUrl: job.pageUrl || "",
        groups: job.groups || [],
        hint: hint,
      };
      let r = await ccfullPost("/api/admin/checkcar-import", body);
      if (!r.data.ok && r.data.error === "hint_vin_mismatch") {
        /* Atvērtajā lapā cits (vai vēl nezināms) VIN - operators apstiprina, ka ielikt tieši šeit. */
        const pageVins = Array.isArray(r.data.hintVins) && r.data.hintVins.length ? r.data.hintVins.join(", ") : "nav zināms";
        const others = Array.isArray(r.data.alternatives) ? r.data.alternatives.length : 0;
        const ok = window.confirm(
          "CheckCar.vin atskaite: VIN " + job.vin + ".\nAtvērtajā " +
            (hint && hint.kind === "quick_eval" ? "ātrajā vērtējumā" : "pasūtījumā") + " VIN: " + pageVins + "." +
            (others ? "\nAr VIN " + job.vin + " ir vēl " + others + " pasūtījums/vērtējums." : "") +
            "\n\nIelikt atskaiti tieši šajā lapā?",
        );
        if (!ok) {
          ccfullSetStatus({ jobId: job.jobId, stage: "error", message: "Atcelts - atvērtajā lapā cits VIN" });
          ccfullToast("CheckCar.vin: atcelts - atvērtajā lapā cits VIN");
          return;
        }
        r = await ccfullPost("/api/admin/checkcar-import", Object.assign({}, body, { confirmHint: true }));
      }
      if (!r.data.ok) {
        const code = r.data.error || (r.status === 401 ? "unauthorized" : r.status === 403 ? "forbidden" : "http_" + r.status);
        const text =
          code === "order_not_found"
            ? "PROVIN nav pasūtījuma ar VIN " + (r.data.vin || job.vin) + " - atver pasūtījuma lapu adminā un nosūti vēlreiz"
            : ccfullErrorText(code);
        ccfullSetStatus({ jobId: job.jobId, stage: "error", message: text });
        ccfullToast("CheckCar.vin: " + text);
        return;
      }
      const target = r.data.target || { kind: "order", id: r.data.sessionId };
      ccfullCurrent = { jobId: job.jobId, target: target, sessionId: target.id, nextN: 0, uploaded: 0, failed: 0 };
      ccfullSetStatus({
        jobId: job.jobId,
        stage: "ready",
        sessionId: target.id,
        target: target,
        summary: r.data.summary || "",
        groups: r.data.groups || [],
        knownUrls: r.data.knownUrls || [],
        autobid: r.data.autobid || null,
      });
      const ab = r.data.autobid;
      ccfullToast(
        "CheckCar.vin: dati ielikti " + (target.kind === "quick_eval" ? "ātrajā vērtējumā" : "pasūtījumā") + ". " +
          (r.data.alternatives && r.data.alternatives.length ? "(Ir vēl " + r.data.alternatives.length + " ar šo VIN - lai izvēlētos, atver vajadzīgo lapu un nosūti vēlreiz.) " : "") +
          (r.data.summary || "") +
          (ab && ab.photos ? " Izsoļu arhīvā ir Autobid bildes bez ūdenszīmēm (" + ab.photos + ") - pārbaudi /admin/izsolu-arhivs." : ""),
      );
    }
    /* Admin CSP connect-src neatļauj data:, tāpēc data URL atkodē bez fetch. */
    function ccfullDataUrlToBlob(dataUrl) {
      const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(String(dataUrl || ""));
      if (!m || !m[2]) return null;
      const bin = atob(m[3]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: m[1] || "image/jpeg" });
    }
    async function ccfullUploadOne(target, item) {
      const blob = ccfullDataUrlToBlob(item.dataUrl);
      if (!blob || !blob.size) return "";
      const form = new FormData();
      form.append("action", "photo");
      form.append("kind", target.kind);
      form.append("id", target.id);
      form.append("file", blob, "checkcar.jpg");
      const res = await fetch("/api/admin/checkcar-import", { method: "POST", credentials: "same-origin", body: form });
      const data = await res.json().catch(() => ({}));
      return data && data.ok && data.id ? String(data.id) : "";
    }
    async function ccfullBatch(batch) {
      const cur = ccfullCurrent;
      const photos = [];
      let failed = 0;
      for (const item of batch.items || []) {
        try {
          const id = await ccfullUploadOne(cur.target, item);
          if (id) photos.push({ id: id, title: item.title || "", sourceUrl: item.url || "" });
          else failed += 1;
        } catch {
          failed += 1;
        }
      }
      if (photos.length) {
        const r = await ccfullPost("/api/admin/checkcar-import", {
          action: "attach",
          kind: cur.target.kind,
          id: cur.target.id,
          photos: photos,
        });
        if (!r.data.ok) failed += photos.length;
        else cur.uploaded += Number(r.data.added || 0);
      }
      cur.failed += failed + Number(batch.downloadFailed || 0);
      cur.nextN = Number(batch.n) + 1;
      GM_deleteValue(GM_CCFULL_BATCH);
      GM_setValue(GM_CCFULL_ACK, JSON.stringify({ jobId: cur.jobId, n: batch.n, uploaded: cur.uploaded, failed: cur.failed }));
      if (batch.last) {
        const where = cur.target.kind === "quick_eval" ? "ātrā vērtējuma" : "pasūtījuma";
        const text = "CheckCar.vin: gatavs - " + cur.uploaded + " foto" + (cur.failed ? ", neizdevās " + cur.failed : "") + ". Pārlādē " + where + " lapu.";
        ccfullSetStatus({ jobId: cur.jobId, stage: "done", sessionId: cur.sessionId, target: cur.target, message: text, uploaded: cur.uploaded, failed: cur.failed });
        ccfullToast(text);
        try {
          document.dispatchEvent(new CustomEvent("provin-checkcar-import", { detail: { sessionId: cur.sessionId, target: cur.target } }));
        } catch {
          /* ignore */
        }
        ccfullCurrent = null;
      } else {
        ccfullToast("CheckCar.vin: augšupielādēti " + cur.uploaded + " foto...");
      }
    }
    window.setInterval(function () {
      if (ccfullBusy) return;
      const job = ccfullGmJson(GM_CCFULL_JOB);
      if (job && job.jobId && (!ccfullCurrent || ccfullCurrent.jobId !== job.jobId)) {
        /* Vispārīga admin cilne dod 3 s priekšroku atvērtai pasūtījuma / ātrā vērtējuma lapai. */
        if (!ccfullPageHint() && Date.now() - Number(job.at || 0) < 3000) return;
        if (!ccfullClaim(job.jobId)) return;
        GM_deleteValue(GM_CCFULL_JOB);
        ccfullBusy = true;
        ccfullPrepare(job)
          .catch(function (e) {
            ccfullSetStatus({ jobId: job.jobId, stage: "error", message: ccfullErrorText("network") });
            console.warn("PROVIN checkcar imports", e);
          })
          .finally(function () {
            ccfullBusy = false;
          });
        return;
      }
      if (!ccfullCurrent) return;
      ccfullClaim(ccfullCurrent.jobId);
      const batch = ccfullGmJson(GM_CCFULL_BATCH);
      if (!batch || batch.jobId !== ccfullCurrent.jobId || Number(batch.n) !== ccfullCurrent.nextN) return;
      ccfullBusy = true;
      ccfullBatch(batch)
        .catch(function (e) {
          console.warn("PROVIN checkcar foto", e);
        })
        .finally(function () {
          ccfullBusy = false;
        });
    }, 1000);
  }

  /* ---------- CheckCar.vin pilnā atskaite: poga „Nosūtīt uz PROVIN” ----------
     Tikai atskaites lapā ar VIN. Neko nepērk un nespiež („buy / unlock” dara Nils). Pēc klikšķa savāc
     lapas tekstu, HTML un foto (pilnā izmērā, ja lapa to dod), foto lejupielādē šajā pārlūkā un caur
     GM krātuvi partijās nodod PROVIN admin cilnei (ja tādas nav, to atver). Ūdenszīmes netiek apstrādātas. */
  const CCFULL_SKIP_RE = /logo|icon|flag|sprite|avatar|payment|visa|mastercard|favicon|banner|badge|placeholder|spinner/i;
  const CCFULL_DATE_RE = /\b\d{1,2}[./]\d{1,2}[./]\d{4}\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s+[A-Z][a-z]{2,8}\.?\s+\d{4}\b/;
  const CCFULL_AUCTION_RE = /autobid|openlane|adesa|auto1|\bbca\b|copart|iaai|manheim|caronsale|ecarstrade|troostwijk|autorola|auction|izsole/i;
  const CCFULL_BATCH_SIZE = 4;
  const CCFULL_PHOTO_MAX = 400;

  function checkcarFullVin() {
    /* Dzīvais ceļš (checkcar.vin var pāriet uz citu atskaiti bez lapas pārlādes). */
    const livePath = window.location.pathname || "";
    const fromPath = (livePath.match(/(?:^|[^A-Z0-9])([A-HJ-NPR-Z0-9]{17})(?![A-Z0-9])/i) || [])[1] || "";
    if (fromPath) return fromPath.toUpperCase();
    const text = String((document.body && document.body.innerText) || "").toUpperCase();
    /* Lapā var būt arī citu auto VIN (iepriekšējās pārbaudes) - ņem biežāko pie „VIN”. */
    const counts = {};
    let best = "";
    for (const m of text.matchAll(/\bVIN\s*(?:CODE|KODS)?\s*:?\s*([A-HJ-NPR-Z0-9]{17})\b/g)) {
      counts[m[1]] = (counts[m[1]] || 0) + 1;
      if (!best || counts[m[1]] > counts[best]) best = m[1];
    }
    return best;
  }

  function isCheckcarReportPage() {
    if (!/report/i.test(path)) {
      const text = String((document.body && document.body.innerText) || "");
      if (!/vehicle\s+history\s+report|attention\s+marks|auction\s+sale\s+history/i.test(text)) return false;
    }
    return checkcarFullVin().length === 17;
  }

  function ccfullAbsUrl(raw) {
    const s = String(raw || "").trim();
    if (!s || s.startsWith("data:") || s.startsWith("blob:")) return "";
    try {
      const u = new URL(s, location.href);
      return u.protocol === "https:" ? u.toString().split("#")[0] : "";
    } catch {
      return "";
    }
  }

  function ccfullLargestSrcset(srcset) {
    let best = "";
    let bestW = 0;
    for (const part of String(srcset || "").split(",")) {
      const bits = part.trim().split(/\s+/);
      const w = parseFloat((bits[1] || "").replace(/[^\d.]/g, "")) || 1;
      if (bits[0] && w >= bestW) {
        best = bits[0];
        bestW = w;
      }
    }
    return best;
  }

  /** Pilnā izmēra foto URL: saites href uz attēlu, data-* lauki, lielākais srcset, tad src. */
  function ccfullPhotoUrl(img) {
    const a = img.closest ? img.closest("a[href]") : null;
    const href = a ? ccfullAbsUrl(a.getAttribute("href")) : "";
    if (href && /\.(jpe?g|png|webp)(\?|$)/i.test(href)) return href;
    const attrs = ["data-full", "data-large", "data-zoom", "data-zoom-image", "data-original", "data-src", "data-lazy-src"];
    for (const name of attrs) {
      const v = ccfullAbsUrl(img.getAttribute(name));
      if (v) return v;
    }
    const set = ccfullAbsUrl(ccfullLargestSrcset(img.getAttribute("srcset") || img.getAttribute("data-srcset")));
    if (set) return set;
    return ccfullAbsUrl(img.currentSrc || img.getAttribute("src"));
  }

  /** Tuvākais bloks ar datumu vai izsoles nosaukumu - grupas nosaukumam. */
  function ccfullGroupLabel(img) {
    let el = img.parentElement;
    for (let depth = 0; el && depth < 10; depth += 1) {
      const text = String(el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
      if (text && text.length <= 2500 && (CCFULL_DATE_RE.test(text) || CCFULL_AUCTION_RE.test(text))) {
        return text.slice(0, 500);
      }
      el = el.parentElement;
    }
    return "";
  }

  function collectCheckcarFullGroups() {
    const groups = [];
    const byLabel = Object.create(null);
    const seen = new Set();
    let total = 0;
    for (const img of document.querySelectorAll("img")) {
      if (total >= CCFULL_PHOTO_MAX) break;
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if ((w && w < 100) || (h && h < 80)) continue;
      const url = ccfullPhotoUrl(img);
      if (!url || CCFULL_SKIP_RE.test(url) || seen.has(url)) continue;
      seen.add(url);
      const label = ccfullGroupLabel(img);
      let g = byLabel[label];
      if (!g) {
        g = { label: label, urls: [] };
        byLabel[label] = g;
        groups.push(g);
      }
      g.urls.push(url);
      total += 1;
    }
    return groups;
  }

  function ccfullBlobToDataUrl(blob) {
    return new Promise(function (resolve) {
      try {
        const reader = new FileReader();
        reader.onload = function () {
          resolve(String(reader.result || ""));
        };
        reader.onerror = function () {
          resolve("");
        };
        reader.readAsDataURL(blob);
      } catch {
        resolve("");
      }
    });
  }

  /** Foto lejupielāde Nila pārlūkā: tā pati izcelsme ar fetch, citādi GM_xmlhttpRequest. */
  function ccfullDownload(url) {
    let sameOrigin = false;
    try {
      sameOrigin = new URL(url).origin === location.origin;
    } catch {
      sameOrigin = false;
    }
    if (sameOrigin && typeof fetch === "function") {
      return fetch(url, { credentials: "include" })
        .then(function (res) {
          return res.ok ? res.blob() : null;
        })
        .then(function (blob) {
          return blob && blob.size > 0 && blob.size < 12 * 1024 * 1024 ? ccfullBlobToDataUrl(blob) : "";
        })
        .catch(function () {
          return "";
        });
    }
    const xhr =
      typeof GM_xmlhttpRequest === "function"
        ? GM_xmlhttpRequest
        : typeof GM !== "undefined" && GM && typeof GM.xmlHttpRequest === "function"
          ? GM.xmlHttpRequest.bind(GM)
          : null;
    if (!xhr) return Promise.resolve("");
    return new Promise(function (resolve) {
      xhr({
        method: "GET",
        url: url,
        responseType: "blob",
        timeout: 30000,
        headers: { Referer: location.href, Accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
        onload: function (res) {
          const blob = res && res.response;
          if (res.status >= 200 && res.status < 300 && blob && blob.size > 0 && blob.size < 12 * 1024 * 1024) {
            ccfullBlobToDataUrl(blob).then(resolve);
          } else resolve("");
        },
        onerror: function () {
          resolve("");
        },
        ontimeout: function () {
          resolve("");
        },
      });
    });
  }

  function ccfullWait(check, timeoutMs) {
    return new Promise(function (resolve) {
      const started = Date.now();
      const timer = window.setInterval(function () {
        const v = check();
        if (v) {
          window.clearInterval(timer);
          resolve(v);
        } else if (Date.now() - started > timeoutMs) {
          window.clearInterval(timer);
          resolve(null);
        }
      }, 500);
    });
  }

  async function sendCheckcarFullReport(btn) {
    const vinNow = checkcarFullVin();
    const say = function (t) {
      btn.textContent = t;
    };
    btn.disabled = true;
    const jobId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const groups = collectCheckcarFullGroups();
    const text = String((document.body && document.body.innerText) || "").slice(0, 400000);
    let html = "";
    try {
      html = String(pageDocumentElement().outerHTML || "");
    } catch {
      html = "";
    }
    if (html.length > 900000) html = "";
    GM_deleteValue(GM_CCFULL_STATUS);
    GM_deleteValue(GM_CCFULL_BATCH);
    GM_deleteValue(GM_CCFULL_ACK);
    GM_setValue(
      GM_CCFULL_JOB,
      JSON.stringify({ jobId: jobId, vin: vinNow, pageUrl: location.href, text: text, html: html, groups: groups, at: Date.now() }),
    );
    say("Gaidu PROVIN admin cilni...");
    let openedAdmin = false;
    const status = await ccfullWait(function () {
      const s = ccfullGmJson(GM_CCFULL_STATUS);
      if (s && s.jobId === jobId && (s.stage === "ready" || s.stage === "error")) return s;
      if (!openedAdmin && !s) {
        const job = ccfullGmJson(GM_CCFULL_JOB);
        if (job && job.jobId === jobId && Date.now() - Number(job.at || 0) > 6000) {
          openedAdmin = true;
          say("Atveru PROVIN adminu...");
          window.open("https://www.provin.lv/admin", "_blank");
        }
      }
      return null;
    }, 180000);
    if (!status) {
      say("PROVIN neatbildēja - atver adminu un mēģini vēlreiz");
      btn.disabled = false;
      return;
    }
    if (status.stage === "error") {
      say(status.message || "Kļūda");
      btn.disabled = false;
      return;
    }
    const known = new Set(status.knownUrls || []);
    const queue = [];
    for (const g of status.groups || []) {
      for (const url of g.urls || []) if (!known.has(url)) queue.push({ title: g.title, url: url });
    }
    const autobidNote =
      status.autobid && status.autobid.photos ? " Izsoļu arhīvā ir Autobid oriģinālās bildes (" + status.autobid.photos + ")." : "";
    let n = 0;
    let done = 0;
    for (let i = 0; i < queue.length || n === 0; i += CCFULL_BATCH_SIZE) {
      const slice = queue.slice(i, i + CCFULL_BATCH_SIZE);
      const items = [];
      let downloadFailed = 0;
      for (const q of slice) {
        say("Lejupielādēju foto " + (done + 1) + "/" + queue.length + "...");
        const dataUrl = await ccfullDownload(q.url);
        done += 1;
        if (dataUrl) items.push({ title: q.title, url: q.url, dataUrl: dataUrl });
        else downloadFailed += 1;
      }
      const last = i + CCFULL_BATCH_SIZE >= queue.length;
      GM_setValue(
        GM_CCFULL_BATCH,
        JSON.stringify({ jobId: jobId, n: n, items: items, last: last, downloadFailed: downloadFailed }),
      );
      const myN = n;
      const ack = await ccfullWait(function () {
        const a = ccfullGmJson(GM_CCFULL_ACK);
        return a && a.jobId === jobId && Number(a.n) === myN ? a : null;
      }, 180000);
      if (!ack) {
        say("PROVIN admin cilne nepieņēma foto - mēģini vēlreiz");
        btn.disabled = false;
        return;
      }
      n += 1;
      if (last) break;
    }
    const fin = await ccfullWait(function () {
      const s = ccfullGmJson(GM_CCFULL_STATUS);
      return s && s.jobId === jobId && s.stage === "done" ? s : null;
    }, 30000);
    say((fin ? fin.message : "Nosūtīts uz PROVIN") + autobidNote);
    btn.disabled = false;
  }

  function mountCheckcarFullButton() {
    if (document.getElementById("provin-ccfull-send")) return true;
    if (!document.body || !isCheckcarReportPage()) return false;
    const btn = document.createElement("button");
    btn.id = "provin-ccfull-send";
    btn.type = "button";
    btn.textContent = "Nosūtīt uz PROVIN";
    btn.style.cssText =
      "position:fixed;z-index:2147483647;right:16px;top:16px;background:#0f172a;color:#fff;border:0;padding:10px 14px;border-radius:10px;font:600 14px/1.3 Inter,system-ui,sans-serif;cursor:pointer";
    btn.addEventListener("click", function (ev) {
      if (ev && ev.isTrusted === false) return;
      sendCheckcarFullReport(btn).catch(function (e) {
        console.warn("PROVIN checkcar: sūtīšana", e);
        btn.textContent = "Kļūda - mēģini vēlreiz";
        btn.disabled = false;
      });
    });
    document.body.appendChild(btn);
    return true;
  }

  if (host.endsWith("checkcar.vin")) {
    let ccfullTries = 0;
    if (!mountCheckcarFullButton()) {
      const ccfullTimer = window.setInterval(function () {
        ccfullTries += 1;
        if (mountCheckcarFullButton() || ccfullTries > 60) window.clearInterval(ccfullTimer);
      }, 1000);
    }
  }


  /* ---------- kfzgutachten.at (Austrijas §57a apskates): saraksts -> PROVIN pasūtījums ----------
     Saite no pasūtījuma: https://kfzgutachten.at/?vin=…&date=…&provin=<sessionId>.
     Skripts NEKO nespiež (Suchen spiež Nils, captcha neaiztiek), nepērk atzinumus un neaizpilda formas.
     Pēc «Suchen» nolasa rezultātu tabulu, ņem tikai pasūtījuma VIN rindas un ieliek GM krātuvē;
     admin lapa (tas pats skripts) tās nodod pasūtījuma panelim. Bez `provin` saitē neko nesūta. */
  const GM_KFZ_ORDER = "provin_kfz_at_order";
  const GM_KFZ_LIST = "provin_kfz_at_list";
  const GM_KFZ_ACK = "provin_kfz_at_ack";
  const KFZ_ORDER_TTL_MS = 2 * 60 * 60 * 1000;
  const KFZ_ORDER_ID_RE = /^[A-Za-z0-9_.-]{6,200}$/;
  const KFZ_VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
  const KFZ_DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;

  function kfzCleanVin(raw) {
    return String(raw || "")
      .replace(/[\s-]/g, "")
      .toUpperCase();
  }

  function kfzReadJson(key) {
    try {
      const raw = String(GM_getValue(key, "") || "");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /** Pasūtījums no saites (arī no ReturnUrl, ja lapa vispirms pārsūta uz pieteikšanos). */
  function kfzOrderFromUrl() {
    let id = params.get("provin") || "";
    let v = params.get("vin") || "";
    if (!id) {
      const ret = params.get("ReturnUrl") || params.get("returnUrl") || "";
      if (ret) {
        try {
          const u = new URL(ret, "https://kfzgutachten.at/");
          id = u.searchParams.get("provin") || "";
          v = u.searchParams.get("vin") || "";
        } catch {
          id = "";
        }
      }
    }
    id = String(id).trim();
    v = kfzCleanVin(v);
    if (!KFZ_ORDER_ID_RE.test(id) || !KFZ_VIN_RE.test(v)) return null;
    return { sessionId: id, vin: v };
  }

  function kfzPendingOrder() {
    const o = kfzReadJson(GM_KFZ_ORDER);
    if (!o || !KFZ_ORDER_ID_RE.test(String(o.sessionId || "")) || !KFZ_VIN_RE.test(String(o.vin || ""))) return null;
    if (Date.now() - Number(o.at || 0) > KFZ_ORDER_TTL_MS) return null;
    return { sessionId: String(o.sessionId), vin: String(o.vin) };
  }

  function kfzHtmlToText(html) {
    return String(html || "")
      .replace(/<(script|style|noscript|template|textarea|select)\b[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      /* HTML avota rindu pārtraukumi nav saraksta rindas - rindas nosaka tikai tagi. */
      .replace(/\s+/g, " ")
      .replace(/<\/(td|th)\s*>/gi, "\t")
      .replace(/<br\b[^>]*>/gi, "\n")
      .replace(/<\/(tr|p|div|li|h[1-6]|dd|dt|table|thead|tbody|section|article|header|footer)\s*>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;|&#160;/gi, " ")
      .replace(/&Auml;/g, "Ä")
      .replace(/&Ouml;/g, "Ö")
      .replace(/&Uuml;/g, "Ü")
      .replace(/&auml;/g, "ä")
      .replace(/&ouml;/g, "ö")
      .replace(/&uuml;/g, "ü")
      .replace(/&szlig;/g, "ß")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&amp;/gi, "&");
  }

  function kfzValidDate(raw) {
    const m = KFZ_DATE_RE.exec(String(raw || "").trim());
    if (!m) return "";
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    if (y < 1950 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return "";
    return m[0];
  }

  function kfzCell(raw) {
    return String(raw || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** Rezultātu rindas (Modelis | Datums | Numurzīme | VIN) no lapas HTML. Tabula vai kartītes ar etiķetēm. */
  function kfzAtListRowsFromHtml(html) {
    const text = kfzHtmlToText(html);
    const rows = [];
    const seen = {};
    function push(model, date, plate, rowVin) {
      const d = kfzValidDate(date);
      const v = kfzCleanVin(rowVin);
      const p = kfzCell(plate).toUpperCase();
      if (!d || !KFZ_VIN_RE.test(v) || !p || p.length > 15) return;
      const key = d + "|" + p + "|" + v;
      if (seen[key]) return;
      seen[key] = 1;
      rows.push({ model: kfzCell(model).slice(0, 80), date: d, plate: p, vin: v });
    }
    const rest = [];
    text.split("\n").forEach(function (line) {
      const cells = line.split("\t").map(kfzCell).filter(function (c) {
        return c !== "";
      });
      if (cells.length >= 4) {
        const di = cells.findIndex(function (c) {
          return Boolean(kfzValidDate(c));
        });
        if (di >= 0 && di + 2 < cells.length && KFZ_VIN_RE.test(kfzCleanVin(cells[di + 2]))) {
          push(cells.slice(0, di).join(" "), cells[di], cells[di + 1], cells[di + 2]);
          return;
        }
      }
      rest.push(line);
    });
    /* Kartīšu izkārtojums (piem. telefonā): «Marke und Type: … Gutachtendatum: … Kennzeichen: … FIN: …». */
    const flat = rest
      .join("\n")
      .replace(/(Marke und Type|Gutachtendatum|Kennzeichen|FIN)\s*:/gi, "\n$1:")
      .replace(/[ \t]+/g, " ");
    const re = /Marke und Type:\s*([^\n]*?)\s*\n\s*Gutachtendatum:\s*(\d{2}\.\d{2}\.\d{4})\s*\n\s*Kennzeichen:\s*([^\n]{1,15}?)\s*\n\s*FIN:\s*([A-HJ-NPR-Z0-9]{17})/gi;
    let m;
    while ((m = re.exec(flat))) push(m[1], m[2], m[3], m[4]);
    return rows;
  }

  function kfzStatus(message, isError) {
    if (!document.body) return;
    let bar = document.getElementById("provin-kfz-status");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "provin-kfz-status";
      bar.setAttribute("role", "status");
      document.body.appendChild(bar);
    }
    const css =
      "position:fixed;z-index:2147483647;right:12px;bottom:12px;max-width:320px;padding:6px 10px;border-radius:8px;" +
      "font:500 12px/1.3 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.12);pointer-events:none;" +
      (isError ? "background:#fef2f2;color:#b91c1c;border:1px solid #fecaca" : "background:#f8fafc;color:#334155;border:1px solid #e2e8f0");
    if (bar.textContent !== message) bar.textContent = message;
    bar.style.cssText = css;
  }

  function watchKfzAtList() {
    if (window.__provinKfzWatch) return;
    window.__provinKfzWatch = true;
    const fromUrl = kfzOrderFromUrl();
    if (fromUrl) {
      try {
        GM_setValue(GM_KFZ_ORDER, JSON.stringify({ sessionId: fromUrl.sessionId, vin: fromUrl.vin, at: Date.now() }));
      } catch (e) {
        console.warn("PROVIN kfzgutachten", e);
      }
    }
    const started = Date.now();
    let lastSig = "";
    let sentAt = 0;
    let sentCount = 0;
    const tick = function () {
      const order = kfzPendingOrder();
      let html = "";
      try {
        html = document.documentElement ? document.documentElement.outerHTML : "";
      } catch {
        html = "";
      }
      const rows = kfzAtListRowsFromHtml(html);
      if (!order) {
        if (rows.length > 0) kfzStatus("PROVIN: nav pasūtījuma - atver sarakstu no PROVIN pasūtījuma", true);
        return;
      }
      if (rows.length === 0) {
        if (!sentAt) kfzStatus("PROVIN: gaida sarakstu");
        return;
      }
      const mine = rows.filter(function (r) {
        return r.vin === order.vin;
      });
      if (mine.length === 0) {
        kfzStatus("PROVIN: sarakstā nav pasūtījuma VIN " + order.vin, true);
        return;
      }
      const text = mine
        .map(function (r) {
          return [r.model, r.date, r.plate, r.vin].join("\t");
        })
        .join("\n");
      const sig = order.sessionId + "|" + text;
      if (sig !== lastSig) {
        const at = Date.now();
        try {
          GM_setValue(
            GM_KFZ_LIST,
            JSON.stringify({ sessionId: order.sessionId, vin: order.vin, text: text, count: mine.length, at: at }),
          );
        } catch (e) {
          kfzStatus("PROVIN: neizdevās nosūtīt sarakstu", true);
          return;
        }
        lastSig = sig;
        sentAt = at;
        sentCount = mine.length;
      }
      const ack = kfzReadJson(GM_KFZ_ACK);
      const got = ack && String(ack.sessionId || "") === order.sessionId && Number(ack.at || 0) === sentAt;
      kfzStatus("PROVIN: " + sentCount + " apskates nosūtītas pasūtījumam" + (got ? " (saņemts)" : ""));
    };
    const timer = window.setInterval(function () {
      if (Date.now() - started > 30 * 60 * 1000) {
        window.clearInterval(timer);
        return;
      }
      tick();
    }, 1000);
    tick();
  }


  /* ---------- Admin: saglabāt hand-off pirms jaunas cilnes ---------- */
  if (IS_PROVIN_ADMIN) {
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
          if ((a.dataset.provinCarverticalPurchase || "").trim() === "1" && ev.isTrusted) {
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
      if (parsed.protocol !== "https:" || (h !== "tirgusdati.lv" && h !== "adify.lv")) {
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

    /* Sludinājuma apraksta rezerve (1.26.3): serveris bloķēts -> lapa no operatora pārlūka.
       Tikai šie portāli (sk. lib/listing-page-browser-fetch.ts). mobile.de NEKAD - Akamai bloķē. */
    const LISTING_PAGE_HOSTS = [
      "ss.lv",
      "ss.com",
      "auto24.lv",
      "auto24.ee",
      "autoplius.lt",
      "reklama.lv",
      "andele.lv",
      "andelemandele.lv",
    ];
    function listingPageHostAllowed(hostname) {
      const h = String(hostname || "").toLowerCase().replace(/\.$/, "");
      if (h === "mobile.de" || /\.mobile\.de$/.test(h)) return false;
      return LISTING_PAGE_HOSTS.some(function (d) {
        return h === d || h.slice(-(d.length + 1)) === "." + d;
      });
    }
    document.addEventListener("provin-listing-page-request", function (ev) {
      const detail = ev && ev.detail ? ev.detail : {};
      const requestId = String(detail.requestId || "");
      const fetchUrl = String(detail.fetchUrl || "").trim();
      function reply(payload) {
        document.dispatchEvent(
          new CustomEvent("provin-listing-page-result", {
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
      if (parsed.protocol !== "https:" || !listingPageHostAllowed(parsed.hostname)) {
        reply({ ok: false, error: "host_not_allowed" });
        return;
      }
      const xhr = gmXhr();
      if (!xhr) {
        reply({ ok: false, error: "no_gm_xhr" });
        return;
      }
      xhr({
        method: "GET",
        url: parsed.toString(),
        timeout: 18000,
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "lv-LV,lv;q=0.9,en;q=0.7",
        },
        onload: function (res) {
          const html = String(res.responseText || "");
          reply({
            ok: res.status >= 200 && res.status < 300,
            status: res.status,
            html: html.length > 2500000 ? "" : html,
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

    /* kfzgutachten.at saraksts (GM krātuvē no kfzgutachten.at cilnes) -> pasūtījuma panelis.
       Panelis pieņem tikai savu pasūtījumu (sessionId + VIN) un atbild ar ack; tad ierakstu dzēšam. */
    function pollKfzAtList() {
      if (window.__provinKfzPoll) return;
      window.__provinKfzPoll = true;
      document.addEventListener("provin-kfz-at-list-ack", function (ev) {
        const d = ev && ev.detail ? ev.detail : {};
        const data = kfzReadJson(GM_KFZ_LIST);
        if (!data || String(data.sessionId || "") !== String(d.sessionId || "") || Number(data.at || 0) !== Number(d.at || 0)) {
          return;
        }
        try {
          GM_deleteValue(GM_KFZ_LIST);
          GM_setValue(
            GM_KFZ_ACK,
            JSON.stringify({ sessionId: String(data.sessionId), at: Number(data.at), added: Number(d.added || 0), ackAt: Date.now() }),
          );
        } catch {
          /* ignore */
        }
      });
      window.setInterval(function () {
        const data = kfzReadJson(GM_KFZ_LIST);
        if (!data) return;
        if (Date.now() - Number(data.at || 0) > KFZ_ORDER_TTL_MS) {
          try {
            GM_deleteValue(GM_KFZ_LIST);
          } catch {
            /* ignore */
          }
          return;
        }
        document.dispatchEvent(
          new CustomEvent("provin-kfz-at-list", {
            detail: {
              sessionId: String(data.sessionId || ""),
              vin: String(data.vin || ""),
              text: String(data.text || ""),
              count: Number(data.count || 0),
              at: Number(data.at || 0),
            },
          }),
        );
      }, 1500);
    }

    watchStatVinBrowserFetch();
    pollSwedishImport();
    pollKfzAtList();
    pollVinScan();
    return;
  }

  if (host === "kfzgutachten.at") {
    watchKfzAtList();
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
    /* Tikai karogs no PROVIN admin klikšķa. URL parametru ?provin_purchase=1 var ielikt jebkura saite. */
    try {
      return String(GM_getValue(GM_CV_PURCHASE, "") || "") === "1";
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
      carfax_eu: "https://www.carfax.eu/preview-page?vin=" + v,
      checkcar_vin: "https://checkcar.vin/report/check/" + v,
      plc_auction: "https://plc.auction/?vin=" + v,
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
    if (name.endsWith("carfax.eu")) return "carfax_eu";
    if (name.endsWith("checkcar.vin")) return "checkcar_vin";
    if (name.endsWith("plc.auction")) return "plc_auction";
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
        id === "plc_auction" ? findPlcSearchInput() : findScanVinInput();
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
          id === "nicb" ||
          id === "bidfax" ||
          id === "poctra");
      if (mayClick && filled && !clicked && ticks >= 3) {
        clicked = clickSafeCheck();
        if (!clicked && id === "plc_auction" && input && typeof input.form?.requestSubmit === "function") {
          input.form.requestSubmit();
          clicked = true;
        } else if (!clicked && id === "plc_auction" && input) {
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
        /* Atvērta pilnā atskaite citā ceļā: nepāradresē, tur ir poga „Nosūtīt uz PROVIN”. */
        if (isCheckcarReportPage()) {
          done = true;
          window.clearInterval(interval);
          return;
        }
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
