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
var QUERY = "has:attachment filename:pdf newer_than:7d";
var MAX_THREADS = 30;
var MAX_PDF_BYTES = 8 * 1024 * 1024;
/** LV numurzīme: 2-3 burti + 1-4 cipari (piem. RO8544, ABC123). */
var PLATE_RE = /(^|[^A-Z0-9])[A-Z]{2,3}[ -]?\d{1,4}([^A-Z0-9]|$)/i;
var SCAN_BYTES = 4096;

/** Galvenā funkcija (trigeris ik 5 min). */
function processCsddPdfInbox() {
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
    if (t.getHandlerFunction() === "processCsddPdfInbox") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("processCsddPdfInbox").timeBased().everyMinutes(5).create();
}
