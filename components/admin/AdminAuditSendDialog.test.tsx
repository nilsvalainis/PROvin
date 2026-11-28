import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AdminAuditSendDialog } from "@/components/admin/AdminAuditSendDialog";
import { renderHtml, renderText } from "@/lib/test-render";

const VIN = "WAUZZZ4G7FN012345";
const src = (rel: string) => readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8");
const noop = async () => undefined;

function dialog(b2b: boolean, over: Partial<Parameters<typeof AdminAuditSendDialog>[0]> = {}) {
  return (
    <AdminAuditSendDialog
      open
      onClose={() => undefined}
      sessionId="cs_test_1"
      vin={VIN}
      car="Audi A6 Avant 3.0 TDI"
      basicsLine={`${VIN} · Audi A6 Avant · AB-1234`}
      b2b={b2b}
      recipientRole={b2b ? "partner" : "client"}
      customerEmail={b2b ? "info@auto-partneris.lv" : "anna.k@gmail.com"}
      customerPhoneDigits="37126123456"
      initialLang={b2b ? "de" : "lv"}
      autoLang="lv"
      lockedLang={b2b ? "de" : null}
      onUnlockLang={() => false}
      attachments={[{ id: "p1", name: "Servisa vēsture.pdf", size: 600_000, mime: "application/pdf" }]}
      criticalIssues={[]}
      prepare={async () => ({ pdfPathname: "x", downloadUrl: "https://x", filename: "a.pdf", bytes: 1 })}
      send={async () => ({ sentTo: "a@b.lv", version: 1 })}
      setComplete={noop}
      recordWhatsapp={noop}
      onOpenOldForm={() => undefined}
      onDone={() => undefined}
      whatsappPingHref={null}
      {...over}
    />
  );
}

describe("AUDITS «Sūtīt atskaiti» forma (makets 27.11)", () => {
  it("B2C: galvene, «Vecā forma», situācijas, valodas LV/EN/RU, kanāls, opcijas ar konsultāciju", () => {
    const t = renderText(dialog(false));
    expect(t).toContain("Sūtīt atskaiti PROVIN AUDITS");
    expect(t).toContain("Vecā forma");
    expect(t).toContain("Klients: anna.k@gmail.com");
    expect(t).toMatch(/Gatava\s+Labota versija/);
    expect(t).toMatch(/LV\s+EN\s+RU\s+Kanāls/);
    expect(t).not.toMatch(/\bDE\b/);
    expect(t).toContain("Konsultācijas bloks e-pastā");
    expect(t).toContain("Kopija Dropbox /_PROv/");
    expect(t).toContain("Pēc nosūtīšanas atzīmēt «Izpildīts»");
    expect(t).toContain("Servisa vēsture.pdf");
    expect(t).not.toContain("B2B");
    const html = renderHtml(dialog(false));
    expect(html).toContain('value="PROVIN.LV · AUDITS atskaite gatava · WAUZZZ4G7FN012345"');
    expect(html).toMatch(/<textarea[^>]*id="audit-send-msg"[^>]*>[^<]*Labdien!/);
    expect(html).toContain("data-dealer-send-extra-files");
  });

  it("kontrolsaraksts: 4 punkti bez atzīmēm, «Sūtīt e-pastu» neaktīva līdz visi atzīmēti", () => {
    const html = renderHtml(dialog(false));
    const t = renderText(dialog(false));
    expect(t).toContain("Pārbaude pirms sūtīšanas 0 / 4");
    for (const item of ["Jaunākais fails", "Lauki aizpildīti", "Pamatdati pareizi", "Nav pretrunu"]) expect(t).toContain(item);
    expect(t).toContain(`${VIN} · Audi A6 Avant · AB-1234`);
    const checklist = html.slice(html.indexOf("data-audit-send-checklist"), html.indexOf("Opcijas"));
    expect(checklist.match(/type="checkbox"/g)?.length).toBeGreaterThanOrEqual(4);
    expect(checklist).not.toMatch(/type="checkbox"[^>]*checked=""/);
    expect(html).toMatch(/data-audit-send-submit="true"[^>]*disabled=""/);
  });

  it("kritiskas pretrunas - brīdinājums augšā un sarkans punkts kontrolsarakstā", () => {
    const issues = [{ id: "km", severity: "critical", title: "Nobraukums", detail: "x", sources: [], values: [] }] as never;
    const html = renderHtml(dialog(false, { criticalIssues: issues }));
    expect(html).toContain("data-critical-source-issues");
    expect(renderText(dialog(false, { criticalIssues: issues }))).toContain("Kritiskas pretrunas: 1");
  });

  it("B2B diskrēts: čips, DE valoda (partnera), bez konsultācijas, temats bez PROVIN.LV, bez partnera nosaukuma", () => {
    const t = renderText(dialog(true));
    expect(t).toContain("B2B · diskrēts");
    expect(t).toContain("B2B partneris: info@auto-partneris.lv");
    expect(t).toMatch(/LV\s+EN\s+RU\s+DE/);
    expect(t).toContain("Partnera valoda: DE");
    expect(t).not.toContain("Konsultācijas bloks");
    const html = renderHtml(dialog(true));
    expect(html).toContain(`value="Fahrzeugprüfung · ${VIN}"`);
    expect(html).toMatch(/aria-selected="true"[^>]*>(?:<span[^>]*><\/span>)?DE</);
    const msg = html.slice(html.indexOf('id="audit-send-msg"'), html.indexOf("</textarea>"));
    expect(msg).not.toMatch(/PROVIN\.LV|AUDITS|Audi A6|Partneris|g\.page|https?:/);
    expect(msg.trim().endsWith("PROVIN")).toBe(true);
  });

  it("logs: portālā uz body, paslēpj telefona doku, plats datorā, josla apakšā", () => {
    const s = src("components/admin/AdminAuditSendDialog.tsx");
    expect(s).toContain("createPortal(dialog, document.body)");
    expect(s).toContain("useHoldAdminOverlayCover(open)");
    const html = renderHtml(dialog(false));
    expect(html).toContain("sm:max-w-[1060px]");
    expect(html.slice(html.indexOf("data-audit-send-footer"))).toContain("env(safe-area-inset-bottom)");
  });
});

describe("«Lūgt Google atsauksmi» (Nils 28.11 - kā vecajā formā)", () => {
  it("B2C: ķeksis ieslēgts pēc noklusējuma; B2B: izslēgts un neaktīvs", () => {
    const b2c = renderHtml(dialog(false));
    expect(renderText(dialog(false))).toContain("Lūgt Google atsauksmi");
    expect(b2c).toMatch(/<label data-audit-send-review=""[^>]*><input type="checkbox"[^>]*checked=""/);
    const b2b = renderHtml(dialog(true));
    expect(renderText(dialog(true))).toContain("Lūgt Google atsauksmi");
    const row = /<label data-audit-send-review=""[^>]*>(<input[^>]*>)/.exec(b2b)?.[1] ?? "";
    expect(row).toContain('disabled=""');
    expect(row).not.toContain('checked=""');
  });

  it("vērtība iet uz serveri: e-pastā `auditSend.review`, WhatsApp - `audit_send` ar `review`", () => {
    const d = src("components/admin/AdminAuditSendDialog.tsx");
    expect(d).toContain("auditSend: { situation, b2b, consult: !b2b && consult, review: !b2b && reviewAsk }");
    expect(d).toContain("recordWhatsapp({ situation, lang, b2b, review: !b2b && reviewAsk })");
    const ws = src("components/admin/OrderDetailWorkspace.tsx");
    expect(ws).toMatch(/action: "audit_send",[^\n]*review \}/);
    const marks = src("app/api/admin/order-client-marks/route.ts");
    expect(marks).toContain("enqueueReviewAskAfterReport");
    expect(marks).toContain("withReviewOptOut(next, true, nowIso)");
  });
});

describe("pieslēgšana pasūtījumā", () => {
  const w = src("components/admin/OrderDetailWorkspace.tsx");
  it("«Sūtīt atskaiti» (dators), telefona «Sūtīt» un «Vairāk» atver jauno formu AUDITS/BUSINESS pasūtījumiem", () => {
    expect(w).toContain("onClick={() => openSendReport()}");
    expect(w).toContain('{ id: "send-report", label: "Sūtīt atskaiti", onClick: () => openSendReport() }');
    expect(w).toMatch(/const mobileSend = \(\) => \{[\s\S]*?openSendReport\(\);\n  \};/);
    expect(w).toMatch(/auditSendFormEligible =\s*sendReportDefaultKind !== "dealer" &&\s*!isMiniHighlightAdminOrder/);
    expect(w).toMatch(/if \(auditSendFormEligible\) setAuditSendOpen\(true\);\s*else setSendReportOpen\(true\);/);
  });
  it("vecais logs paliek («Vecā forma», ASV, dīleris); pogas «Nosūtīt klientam» nav noņemtas", () => {
    expect(w).toContain("<AdminSendReportDialog");
    expect(w).toMatch(/onOpenOldForm=\{\(\) => \{\s*setAuditSendOpen\(false\);\s*setSendReportOpen\(true\);/);
    expect(w).toContain("Nosūtīt klientam");
  });
  it("sūtīšana iet caur to pašu servera ceļu ar customSubject/customText un auditSend; pēc «Aizvērt» - uz sarakstu", () => {
    const fn = w.slice(w.indexOf("<AdminAuditSendDialog"), w.indexOf("whatsappPingHref={sendReportWhatsappHref}"));
    expect(fn).toContain("customSubject: input.subject");
    expect(fn).toContain("auditSend: input.auditSend");
    expect(fn).toContain("onDone={() => void returnToOrdersAfterAuditSend()}");
    const back = w.slice(w.indexOf("const returnToOrdersAfterAuditSend"), w.indexOf("const dealerSendBridge"));
    expect(back.indexOf("flushWorkspaceServerPatch")).toBeLessThan(back.indexOf("router.push(ADMIN_ORDERS_LIST_HREF)"));
  });
});
