/**
 * PROVIN - CSDD izziņu PDF savācējs (Google Apps Script, info@provin.lv kontā).
 *
 * Ik 5 min meklē jaunas vēstules ar PDF pielikumu (pēdējās 7 dienas, vēl bez PROVIN etiķetes).
 * PRIVĀTUMS: uz PROVIN sūta TIKAI PDF, kas
 *   1) ir vēstulē, kas pāradresēta no Nila Gmail (adrese Script Properties `FORWARDED_FROM`, nevis kodā), UN
 *   2) izskatās pēc e.csdd izziņas: PDF metadatos "TCPDF" (e.csdd PDF ģenerators) VAI faila nosaukumā / tematā
 *      ir LV numurzīme.
 * Ja nav pārliecības - PDF NESŪTA, vēstule saņem etiķeti "PROVIN-pārbaudīt" (Nils paskatās pats).
 * Citas vēstules (rēķini, klientu dokumenti) netiek sūtītas nekur - tikai iekšēja etiķete "PROVIN-nav-CSDD".
 *
 *
 * Otrs darbs (processCarverticalCodes, ik 1 min): CarVertical pieteikšanās kods. Nila Gmail filtrs pāradresē CarVertical
 * koda e-pastus uz info@provin.lv; skripts no JAUNAS (<= 15 min) vēstules no carvertical.com, kas pāradresēta no Nila
 * Gmail, izvelk 6 zīmju kodu un sūta to uz PROVIN /api/carvertical/login-code (tas pats CSDD_PDF_INBOX_TOKEN).
 * PROVIN kodu nodod CarVertical relejam tikai, ja tas tieši tagad gaida kodu. Kods netiek logots nekur.
 *
 * Trešais darbs (processCarfaxPdfInbox, ik 5 min): CARFAX atskaites PDF. Pēc kredīta izlietošanas carfax.eu sūta uz
 * info@provin.lv vēstuli ar pielikumu "CARFAX - <VIN>.pdf". Skripts ņem TIKAI vēstules no carfax.eu ar šādu pielikuma
 * nosaukumu un sūta PDF (daļās pa 2 MB) uz PROVIN /api/carfax/pdf-inbox (tas pats CSDD_PDF_INBOX_TOKEN). PROVIN atrod
 * pasūtījumu pēc VIN un ieliek PDF CARFAX blokā; ja pasūtījuma nav - saglabā kā nepiesaistītu (adminā "Pievienot").
 * Etiķetes: "PROVIN-carfax-ok" (nosūtīts) / "PROVIN-carfax-pārbaudīt" (PROVIN teica, ka nav CARFAX atskaite) /
 * "PROVIN-carfax-nav-atskaite" (CARFAX vēstule bez atskaites PDF, piem. rēķins - netika sūtīts).
 *
 * Script Properties (Project Settings -> Script Properties):
 *   CSDD_PDF_INBOX_TOKEN - tā pati vērtība kā Vercel env (nekad kodā);
 *   FORWARDED_FROM       - Nila Gmail adrese, no kuras pāradresē CSDD e-pastus (nekad kodā).
 * Soļi Nilam: docs/apps-script/csdd-pdf-inbox.md
 */

var API_URL = "https://www.provin.lv/api/ecsdd/pdf-inbox";
var INBOX_ADDRESS = "info@provin.lv";
var LABEL_DONE = "PROVIN-apstrādāts";
var LABEL_SKIP = "PROVIN-nav-CSDD";
var LABEL_CHECK = "PROVIN-pārbaudīt";
var QUERY = "has:attachment filename:pdf newer_than:7d -from:carfax.eu";
var MAX_THREADS = 30;
var MAX_PDF_BYTES = 8 * 1024 * 1024;
/** LV numurzīme: 2-3 burti + 1-4 cipari (piem. RO8544, ABC123). */
var PLATE_RE = /(^|[^A-Z0-9])[A-Z]{2,3}[ -]?\d{1,4}([^A-Z0-9]|$)/i;
var SCAN_BYTES = 4096;

var CARFAX_API_URL = "https://www.provin.lv/api/carfax/pdf-inbox";
var CARFAX_QUERY = "from:carfax.eu has:attachment filename:pdf newer_than:3d";
var LABEL_CARFAX_OK = "PROVIN-carfax-ok";
var LABEL_CARFAX_CHECK = "PROVIN-carfax-pārbaudīt";
var LABEL_CARFAX_SKIP = "PROVIN-carfax-nav-atskaite";
/** Pielikums "CARFAX - <VIN>.pdf" (VIN 17 zīmes). */
var CARFAX_FILE_RE = /^CARFAX\s*-\s*[A-HJ-NPR-Z0-9]{17}(\s*\(\d+\))?\.pdf$/i;
var CARFAX_CHUNK_BYTES = 2 * 1024 * 1024;
var CARFAX_MAX_BYTES = 20 * 1024 * 1024;

var CV_CODE_API_URL = "https://www.provin.lv/api/carvertical/login-code";
var CV_QUERY = "from:carvertical.com newer_than:1d";
var CV_CODE_MAX_AGE_MS = 15 * 60 * 1000;
/** Vārdi, kas norāda uz pieteikšanās kodu (LV / EN / LT / EE / DE / PL). */
var CV_CODE_KEYWORD_RE = /(kods|kodu|koda|code|verification|verifik|pierakst|prisijung|kood|anmelde|weryfik)/i;

/** Galvenā funkcija (trigeris ik 5 min). */
function processCsddPdfInbox() {
  // Rezerve, ja 1 min trigeris vēl nav uzstādīts (kodi netiek sūtīti divreiz - sk. processCarverticalCodes).
  try {
    processCarverticalCodes();
  } catch (e) {
    console.warn("CarVertical kodi: " + e);
  }
  // Rezerve, ja CARFAX trigeris vēl nav uzstādīts (PROVIN to pašu PDF otrreiz neieliek).
  try {
    processCarfaxPdfInbox();
  } catch (e) {
    console.warn("CARFAX PDF: " + e);
  }
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty("CSDD_PDF_INBOX_TOKEN");
  var forwardedFrom = (props.getProperty("FORWARDED_FROM") || "").trim().toLowerCase();
  if (!token || token.length < 24 || forwardedFrom.indexOf("@") < 0) {
    console.error("Nav CSDD_PDF_INBOX_TOKEN vai FORWARDED_FROM (Script Properties)");
    return;
  }
  var labels = {
    done: getOrCreateLabel_(LABEL_DONE),
    skip: getOrCreateLabel_(LABEL_SKIP),
    check: getOrCreateLabel_(LABEL_CHECK),
  };
  var threads = GmailApp.search(QUERY, 0, 100);
  var handled = 0;
  for (var i = 0; i < threads.length && handled < MAX_THREADS; i++) {
    var thread = threads[i];
    var has = thread.getLabels().some(function (l) {
      var n = l.getName();
      return n === LABEL_DONE || n === LABEL_SKIP || n === LABEL_CHECK;
    });
    if (has) continue;
    handled++;
    var outcome = processThread_(thread, token, forwardedFrom);
    // "retry" (PROVIN nav sasniedzams) - etiķeti neliek, nākamajā reizē mēģinās vēlreiz.
    if (outcome !== "retry") thread.addLabel(labels[outcome]);
  }
}

/** -> "done" | "skip" | "check" | "retry" */
function processThread_(thread, token, forwardedFrom) {
  var outcome = "skip";
  thread.getMessages().forEach(function (msg) {
    // Nav pāradresēts no Nila Gmail -> PDF nekur nesūta (rēķini, klientu dokumenti).
    if (!isForwardedFromNils_(msg, forwardedFrom)) return;
    msg.getAttachments({ includeInlineImages: false }).forEach(function (att) {
      var name = att.getName() || "";
      var type = att.getContentType() || "";
      if (!/\.pdf$/i.test(name) && type !== "application/pdf") return;
      var bytes = att.getBytes();
      if (!bytes || bytes.length === 0 || bytes.length > MAX_PDF_BYTES || !looksLikeCsddPdf_(bytes, name, msg.getSubject() || "")) {
        // Nav pārliecības, ka tā ir CSDD izziņa -> nesūta, Nils pārbauda pats.
        if (outcome === "skip") outcome = "check";
        return;
      }
      var res = postPdf_(token, {
        messageId: msg.getId(),
        receivedAt: msg.getDate().toISOString(),
        fileName: name,
        pdfBase64: Utilities.base64Encode(bytes),
      });
      if (res === "retry") outcome = "retry";
      else if (outcome !== "retry") outcome = res === "done" ? "done" : "check";
    });
  });
  return outcome;
}

/**
 * Pāradresēta no Nila Gmail: `X-Forwarded-For` satur FORWARDED_FROM, vai vēstule nonākusi info@provin.lv
 * (`Delivered-To` / `To`) ar Gmail pāradresācijas galveni `X-Forwarded-To`.
 */
function isForwardedFromNils_(msg, forwardedFrom) {
  var xff = (msg.getHeader("X-Forwarded-For") || "").toLowerCase();
  if (xff.indexOf(forwardedFrom) >= 0) return true;
  var xft = (msg.getHeader("X-Forwarded-To") || "").toLowerCase();
  if (!xft) return false;
  var deliveredTo = (msg.getHeader("Delivered-To") || "").toLowerCase();
  var to = (msg.getTo() || "").toLowerCase();
  return deliveredTo.indexOf(INBOX_ADDRESS) >= 0 || to.indexOf(INBOX_ADDRESS) >= 0;
}

/** e.csdd PDF: "TCPDF" PDF metadatos (pirmie vai pēdējie ~4 KB) vai numurzīme faila nosaukumā / tematā. */
function looksLikeCsddPdf_(bytes, name, subject) {
  var head = bytesToLatin1_(bytes, 0, Math.min(SCAN_BYTES, bytes.length));
  var tail = bytesToLatin1_(bytes, Math.max(0, bytes.length - SCAN_BYTES), bytes.length);
  if (head.indexOf("%PDF-") !== 0) return false;
  if (/TCPDF/.test(head) || /TCPDF/.test(tail)) return true;
  return PLATE_RE.test(name.replace(/\.pdf$/i, "")) || PLATE_RE.test(subject);
}

function bytesToLatin1_(bytes, from, to) {
  var out = [];
  for (var i = from; i < to; i++) out.push(String.fromCharCode(bytes[i] & 255));
  return out.join("");
}

/** -> "done" (pieņemta / pasūtījums nav atrasts), "check" (serveris: nav CSDD izziņa), "retry". */
function postPdf_(token, payload) {
  try {
    var resp = UrlFetchApp.fetch(API_URL, {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + token },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    var code = resp.getResponseCode();
    if (code >= 500 || code === 401 || code === 429) {
      console.warn("PROVIN API " + code);
      return "retry";
    }
    var json = JSON.parse(resp.getContentText() || "{}");
    if (json.status === "attached" || json.status === "duplicate" || json.status === "no_order") return "done";
    return "check";
  } catch (e) {
    console.warn("PROVIN API nav sasniedzams: " + e);
    return "retry";
  }
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

/** Vienreiz: izveido 5 min trigeri (palaid no redaktora, apstiprini atļaujas). */
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === "processCsddPdfInbox" || fn === "processCarverticalCodes" || fn === "processCarfaxPdfInbox") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("processCsddPdfInbox").timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger("processCarverticalCodes").timeBased().everyMinutes(1).create();
  ScriptApp.newTrigger("processCarfaxPdfInbox").timeBased().everyMinutes(5).create();
}

/**
 * CARFAX PDF (trigeris ik 5 min). Ņem tikai vēstules no carfax.eu (sūtītāja domēns) ar pielikumu "CARFAX - <VIN>.pdf".
 * Citi pielikumi un sūtītāji netiek sūtīti nekur. PDF iet daļās (Vercel pieprasījuma limits ~4,5 MB).
 */
function processCarfaxPdfInbox() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var token = PropertiesService.getScriptProperties().getProperty("CSDD_PDF_INBOX_TOKEN");
    if (!token || token.length < 24) {
      console.error("Nav CSDD_PDF_INBOX_TOKEN (Script Properties)");
      return;
    }
    var threads = GmailApp.search(CARFAX_QUERY, 0, 20);
    for (var i = 0; i < threads.length; i++) {
      var thread = threads[i];
      var has = thread.getLabels().some(function (l) {
        var n = l.getName();
        return n === LABEL_CARFAX_OK || n === LABEL_CARFAX_CHECK || n === LABEL_CARFAX_SKIP;
      });
      if (has) continue;
      var outcome = processCarfaxThread_(thread, token);
      // "retry" (PROVIN nav sasniedzams) - etiķeti neliek, nākamajā reizē vēlreiz.
      if (outcome === "ok") thread.addLabel(getOrCreateLabel_(LABEL_CARFAX_OK));
      else if (outcome === "check") thread.addLabel(getOrCreateLabel_(LABEL_CARFAX_CHECK));
      else if (outcome === "none") thread.addLabel(getOrCreateLabel_(LABEL_CARFAX_SKIP));
    }
  } finally {
    lock.releaseLock();
  }
}

/** -> "ok" | "check" | "retry" | "none" */
function processCarfaxThread_(thread, token) {
  var outcome = "none";
  thread.getMessages().forEach(function (msg) {
    if (!isCarfaxSender_(msg.getFrom() || "")) return;
    msg.getAttachments({ includeInlineImages: false }).forEach(function (att) {
      var name = att.getName() || "";
      if (!CARFAX_FILE_RE.test(name)) return;
      var bytes = att.getBytes();
      if (!bytes || bytes.length < 100 || bytes.length > CARFAX_MAX_BYTES) {
        if (outcome !== "retry") outcome = "check";
        return;
      }
      var res = postCarfaxPdf_(token, bytes, name, msg);
      if (res === "retry") outcome = "retry";
      else if (outcome !== "retry" && outcome !== "check") outcome = res;
    });
  });
  return outcome;
}

/** Sūtītājs: ...@carfax.eu vai ...@<apakšdomēns>.carfax.eu. */
function isCarfaxSender_(from) {
  var m = String(from).toLowerCase().match(/@([a-z0-9.-]+)>?\s*$/);
  if (!m) return false;
  return m[1] === "carfax.eu" || /\.carfax\.eu$/.test(m[1]);
}

function md5Hex_(bytes) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, bytes)
    .map(function (b) {
      var h = (b & 255).toString(16);
      return h.length === 1 ? "0" + h : h;
    })
    .join("");
}

/** PDF daļās -> "ok" (pieņemts / jau bija / nepiesaistīts), "check" (nav CARFAX atskaite), "retry". */
function postCarfaxPdf_(token, bytes, name, msg) {
  var md5 = md5Hex_(bytes);
  var count = Math.ceil(bytes.length / CARFAX_CHUNK_BYTES);
  for (var i = 0; i < count; i++) {
    var part = bytes.slice(i * CARFAX_CHUNK_BYTES, Math.min(bytes.length, (i + 1) * CARFAX_CHUNK_BYTES));
    var json;
    try {
      var resp = UrlFetchApp.fetch(CARFAX_API_URL, {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: "Bearer " + token },
        payload: JSON.stringify({
          md5: md5,
          fileName: name,
          chunkIndex: i,
          chunkCount: count,
          chunkBase64: Utilities.base64Encode(part),
          messageId: msg.getId(),
          receivedAt: msg.getDate().toISOString(),
        }),
        muteHttpExceptions: true,
      });
      var code = resp.getResponseCode();
      if (code >= 500 || code === 401 || code === 429) {
        console.warn("PROVIN CARFAX API " + code);
        return "retry";
      }
      if (code === 400) return "check";
      json = JSON.parse(resp.getContentText() || "{}");
    } catch (e) {
      console.warn("PROVIN API nav sasniedzams: " + e);
      return "retry";
    }
    if (i < count - 1) {
      if (json.status !== "chunk_saved") return "retry";
      continue;
    }
    console.log("CARFAX PDF: " + json.status);
    if (json.status === "attached" || json.status === "duplicate" || json.status === "unmatched") return "ok";
    if (json.status === "not_carfax") return "check";
    return "retry";
  }
  return "retry";
}

/**
 * CarVertical pieteikšanās kods (trigeris ik 1 min). Ņem tikai vēstules, kas:
 *   1) no carvertical.com (sūtītāja domēns), 2) pāradresētas no Nila Gmail (FORWARDED_FROM), 3) ne vecākas par 15 min,
 *   4) ar tieši vienu 6 zīmju kodu blakus vārdam "kods / code / verification".
 * Gmail vienā sarakstē (thread) var būt vairāki kodi, tāpēc apstrādātās vēstules atceras pēc ID (CacheService, 6 h).
 * Kods netiek logots; žurnālā tikai rezultāts.
 */
function processCarverticalCodes() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var props = PropertiesService.getScriptProperties();
    var token = props.getProperty("CSDD_PDF_INBOX_TOKEN");
    var forwardedFrom = (props.getProperty("FORWARDED_FROM") || "").trim().toLowerCase();
    if (!token || token.length < 24 || forwardedFrom.indexOf("@") < 0) return;
    var cache = CacheService.getScriptCache();
    var nowMs = Date.now();
    var threads = GmailApp.search(CV_QUERY, 0, 10);
    for (var i = 0; i < threads.length; i++) {
      var thread = threads[i];
      var touched = false;
      var check = false;
      thread.getMessages().forEach(function (msg) {
        var id = "cv-code-" + msg.getId();
        var receivedMs = msg.getDate().getTime();
        if (nowMs - receivedMs > CV_CODE_MAX_AGE_MS || cache.get(id)) return;
        if (!isCarverticalSender_(msg.getFrom() || "") || !isForwardedFromNils_(msg, forwardedFrom)) return;
        var code = extractCarverticalCode_(msg.getSubject() || "", msg.getPlainBody() || "");
        if (!code) {
          cache.put(id, "1", 21600);
          check = true;
          console.warn("CarVertical vēstulē kods netika atrasts viennozīmīgi");
          return;
        }
        var res = postCarverticalCode_(token, { code: code, receivedAt: msg.getDate().toISOString(), messageId: msg.getId() });
        // "retry" (relejs aizņemts / PROVIN nav sasniedzams) - nākamajā minūtē vēlreiz, kamēr vēstule nav vecāka par 15 min.
        if (res === "retry") return;
        cache.put(id, "1", 21600);
        touched = true;
        console.log("CarVertical kods: " + res);
      });
      if (touched) thread.addLabel(getOrCreateLabel_(LABEL_DONE));
      if (check) thread.addLabel(getOrCreateLabel_(LABEL_CHECK));
    }
  } finally {
    lock.releaseLock();
  }
}

/** Sūtītājs: ...@carvertical.com vai ...@<apakšdomēns>.carvertical.com. */
function isCarverticalSender_(from) {
  var m = String(from).toLowerCase().match(/@([a-z0-9.-]+)>?\s*$/);
  if (!m) return false;
  var host = m[1];
  return host === "carvertical.com" || /\.carvertical\.com$/.test(host);
}

/**
 * 6 zīmju kods (A-Z, 0-9) no temata + teksta. Atgriež kodu tikai, ja tas ir viennozīmīgs:
 *   - tekstā ir vārds "kods / code / verification" u.c.; UN
 *   - kods ir atsevišķā rindā (tipisks koda e-pasts) VAI līdz 200 zīmēm aiz atslēgas vārda un satur vismaz vienu ciparu.
 * Saites tiek izmestas (tajās ir nejaušas virknes). Vairāki dažādi kandidāti -> "" (Nils ievada pats).
 */
function extractCarverticalCode_(subject, body) {
  var text = (String(subject || "") + "\n" + String(body || "")).replace(/https?:\/\/\S+/g, " ");
  if (!CV_CODE_KEYWORD_RE.test(text)) return "";
  var found = {};
  text.split(/\r?\n/).forEach(function (line) {
    var m = line.trim().match(/^([A-Z0-9]{6})$/);
    if (m) found[m[1]] = true;
  });
  var kw = new RegExp(CV_CODE_KEYWORD_RE.source, "gi");
  var k;
  while ((k = kw.exec(text)) !== null) {
    var win = text.slice(k.index, k.index + k[0].length + 200);
    var re = /(^|[^A-Za-z0-9])([A-Z0-9]{6})(?![A-Za-z0-9])/g;
    var t;
    while ((t = re.exec(win)) !== null) {
      if (/\d/.test(t[2])) found[t[2]] = true;
    }
  }
  var codes = Object.keys(found);
  return codes.length === 1 ? codes[0] : "";
}

/** -> "accepted" | "rejected" | "ignored" | "invalid" | "retry" */
function postCarverticalCode_(token, payload) {
  try {
    var resp = UrlFetchApp.fetch(CV_CODE_API_URL, {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + token },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    var code = resp.getResponseCode();
    if (code >= 500 || code === 401 || code === 429) return "retry";
    if (code === 204) return "ignored";
    if (code === 400) return "invalid";
    var json = JSON.parse(resp.getContentText() || "{}");
    return json.status === "accepted" ? "accepted" : "rejected";
  } catch (e) {
    console.warn("PROVIN API nav sasniedzams: " + e);
    return "retry";
  }
}
