import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AdminDealerSendDialog } from "@/components/admin/AdminDealerSendDialog";
import { renderHtml, renderText } from "@/lib/test-render";

/** 22.11 (Nils, iPhone 14 Pro): telefona doks aizsedza «Sūtīt klientam» loga sūtīšanas pogu. */
const src = (rel: string) => readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8");

function dealerDialog() {
  return (
    <AdminDealerSendDialog
      open
      onClose={() => undefined}
      sessionId="cs_test_1"
      vin="WBA5R1C0XLFH42873"
      b2b={false}
      customerEmail="klients@example.com"
      defaultSituation="ready"
      refundCents={null}
      pdfLang="lv"
      bridge={null}
      onSent={() => undefined}
    />
  );
}

describe("Telefona doks nenosedz logu pogas", () => {
  it("«Sūtīt klientam» logā darbību josla piestiprināta apakšā ar drošo zonu", () => {
    const html = renderHtml(dealerDialog());
    const footer = html.slice(html.indexOf("data-dealer-send-footer"));
    expect(footer).toMatch(/^data-dealer-send-footer="true" class="sticky bottom-0 [^"]*shrink-0/);
    expect(footer).toContain("env(safe-area-inset-bottom)");
    expect(renderText(dealerDialog())).toContain("Sūtīt e-pastu");
    expect(html).toContain("max-h-[100dvh]");
  });

  it("«Sūtīt klientam» logs iet portālā uz body un paslēpj doku", () => {
    const s = src("components/admin/AdminDealerSendDialog.tsx");
    expect(s).toContain("createPortal(dialog, document.body)");
    expect(s).toContain("useHoldAdminOverlayCover(open)");
  });

  it("«Sūtīt atskaiti» logs un pasūtījuma lapas logi paslēpj doku", () => {
    expect(src("components/admin/AdminSendReportDialog.tsx")).toContain("useHoldAdminOverlayCover(open)");
    const w = src("components/admin/OrderDetailWorkspace.tsx");
    expect(w).toMatch(/useHoldAdminOverlayCover\(\s*previewOpen \|\| portfolioAllFilesModalOpen \|\| notifyDialogOpen/);
  });

  it("lapas apakšā atkāpe telefonā ietver drošo zonu; dators bez izmaiņām (pb-24)", () => {
    const w = src("components/admin/OrderDetailWorkspace.tsx");
    expect(w).toContain('className="relative min-w-0 pb-24 max-md:pb-[calc(9rem+env(safe-area-inset-bottom,0px))]"');
  });

  it("1. Pielikumi pogu rinda telefonā pārnesas, datorā paliek shrink-0", () => {
    const w = src("components/admin/OrderDetailWorkspace.tsx");
    expect(w).toContain(
      'className="flex shrink-0 flex-wrap items-center gap-1.5 max-sm:min-w-0 max-sm:max-w-full max-sm:shrink"',
    );
  });

  it("doks pats ir tikai telefonā (md:hidden)", () => {
    expect(src("components/admin/mobile/AdminMobileChrome.tsx")).toMatch(/fixed inset-x-0 bottom-0 z-\[30\][^"]*md:hidden/);
  });
});

describe("«Sūtīt klientam» logs datorā (22.11 Nils: tukšs temats, iezīmēts teksts, ritinājums)", () => {
  it("temats un teksts aizpildīti no veidnes jau pirmajā renderēšanā", () => {
    const html = renderHtml(dealerDialog());
    expect(html).toContain('value="PROVIN · Atskaite gatava · Oficiālā dīlera dati · WBA5R1C0XLFH42873"');
    expect(html).toMatch(/<textarea[^>]*id="dealer-send-msg"[^>]*>[^<]*Labdien!/);
  });

  it("portālā uz body laukiem ir tieša teksta un fona krāsa (nemanto vietnes balto tekstu)", () => {
    const html = renderHtml(dealerDialog());
    expect(html).toMatch(/id="dealer-send-subj" class="[^"]*\bbg-white\b[^"]*\btext-slate-900\b/);
    expect(html).toMatch(/id="dealer-send-msg"[^>]*class="[^"]*\bbg-white\b[^"]*\btext-slate-900\b/);
    expect(html).toMatch(/class="amx amx-surface [^"]*md:text-slate-900/);
  });

  it("logs atveras augšā un nekas neiezīmē tekstu", () => {
    const s = src("components/admin/AdminDealerSendDialog.tsx");
    expect(s).toContain("scrollRef.current.scrollTop = 0");
    expect(s).not.toMatch(/\.select\(\)|setSelectionRange|autoFocus/);
  });

  it("loga fons (z-80) ir virs Copilot čipa (z-45); datora pogu josla (z-40) atvērta loga laikā paslēpta", () => {
    expect(renderHtml(dealerDialog())).toMatch(/data-dealer-send-dialog="true" class="fixed inset-0 z-\[80\]/);
    const w = src("components/admin/OrderDetailWorkspace.tsx");
    expect(w).toMatch(/data-order-pdf-bar\s+className=\{`fixed bottom-0 left-0 right-0 z-40 hidden /);
    // kamēr logs atvērts, datora PDF pogu josla nav redzama
    expect(w).toContain('adminOverlayCovered ? "" : "md:block"');
    const c = src("components/admin/AdminOrderCopilotPanel.tsx");
    expect(c).toMatch(/className=\{`fixed z-\[45\] flex max-w-\[16rem\]/);
  });
});
