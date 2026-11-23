/**
 * PROVIN - CSDD izziņu PDF savācējs (Google Apps Script, info@provin.lv kontā).
 *
 * Ik 5 min meklē jaunas vēstules ar PDF pielikumu (pēdējās 7 dienas, bez etiķetes "PROVIN-apstrādāts"),
 * katru PDF nosūta uz PROVIN API (serveris pats pārbauda, vai tā ir e.csdd izziņa, un atrod pasūtījumu pēc
 * numura / VIN). Pēc atbildes vēstuli atzīmē ar etiķeti, lai to neapstrādātu otrreiz.
 *
 * Tokens NAV šajā failā: Script Properties -> CSDD_PDF_INBOX_TOKEN (tā pati vērtība kā Vercel env).
 * Soļi Nilam: docs/apps-script/csdd-pdf-inbox.md
 */

var API_URL = "https://www.provin.lv/api/ecsdd/pdf-inbox";
var LABEL_DONE = "PROVIN-apstrādāts";
var LABEL_SKIP = "PROVIN-nav-CSDD";
/** Gmail meklēšana: PDF pielikums, pēdējās 7 dienas, vēl nav apstrādāts. */
var QUERY = "has:attachment filename:pdf newer_than:7d -label:" + LABEL_DONE + " -label:" + LABEL_SKIP;
var MAX_THREADS = 20;
var MAX_PDF_BYTES = 8 * 1024 * 1024;

/** Galvenā funkcija (trigeris ik 5 min). */
function processCsddPdfInbox() {
  var token = PropertiesService.getScriptProperties().getProperty("CSDD_PDF_INBOX_TOKEN");
  if (!token || token.length < 24) {
    console.error("Nav CSDD_PDF_INBOX_TOKEN (Script Properties)");
    return;
  }
  var done = getOrCreateLabel_(LABEL_DONE);
  var skip = getOrCreateLabel_(LABEL_SKIP);
  var threads = GmailApp.search(QUERY, 0, MAX_THREADS);
  threads.forEach(function (thread) {
    // Drošībai: ja Gmail meklēšana etiķeti ar garumzīmi neizslēdza - pārbaudām arī šeit.
    var has = thread.getLabels().some(function (l) {
      var n = l.getName();
      return n === LABEL_DONE || n === LABEL_SKIP;
    });
    if (has) return;
    var outcome = "skip";
    thread.getMessages().forEach(function (msg) {
      msg.getAttachments({ includeInlineImages: false }).forEach(function (att) {
        var name = att.getName() || "";
        var type = att.getContentType() || "";
        if (!/\.pdf$/i.test(name) && type !== "application/pdf") return;
        var bytes = att.getBytes();
        if (!bytes || bytes.length === 0 || bytes.length > MAX_PDF_BYTES) return;
        var res = postPdf_(token, {
          messageId: msg.getId(),
          receivedAt: msg.getDate().toISOString(),
          fileName: name,
          pdfBase64: Utilities.base64Encode(bytes),
        });
        if (res === "retry") outcome = "retry";
        else if (res === "done" && outcome !== "retry") outcome = "done";
      });
    });
    // "retry" (serveris nav sasniedzams) - etiķeti neliek, nākamajā reizē mēģinās vēlreiz.
    if (outcome === "done") thread.addLabel(done);
    else if (outcome === "skip") thread.addLabel(skip);
  });
}

/** -> "done" (CSDD izziņa pieņemta), "skip" (nav CSDD izziņa / nav pasūtījuma), "retry" (kļūda). */
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
    return "skip";
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
