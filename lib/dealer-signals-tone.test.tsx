import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DealerSignalsEditor } from "@/components/admin/AdminDealerSignalsMenu";
import { buildDealerSignalsSectionHtml, type ClientReportPayload } from "@/lib/client-report-html";
import { CLIENT_REPORT_LANGS } from "@/lib/client-report-i18n";
import {
  addManualDealerSignal,
  dealerSignalTone,
  dealerSignalsPdfRows,
  regenerateDealerSignals,
  setDealerSignalTone,
  type DealerSignalsState,
} from "@/lib/dealer-signals";
import { parseDealerSignals } from "@/lib/dealer-signals-persist";

/** Signālu krāsas izvēle (Nils 27.11): sarkans / oranžs / parasts. */
const dealer = (state: DealerSignalsState): Pick<ClientReportPayload, "pdfReportKind" | "dealerSignals" | "dealerSignalsAuditLink" | "dealerSignalsTranslated"> => ({
  pdfReportKind: "dealer",
  dealerSignals: state,
  dealerSignalsAuditLink: { url: "https://www.provin.lv/lv/papildinajums/abc" },
});

describe("signāla krāsa", () => {
  it("noklusējums pēc tipa (vecie ieraksti bez tone)", () => {
    expect(dealerSignalTone({ kind: "mileage_mismatch" })).toBe("red");
    expect(dealerSignalTone({ kind: "special_status" })).toBe("red");
    expect(dealerSignalTone({ kind: "incidents" })).toBe("neutral");
    expect(dealerSignalTone({ kind: "us_history", tone: "orange" })).toBe("orange");
  });

  it("parse: derīga krāsa paliek, nederīga - ārā", () => {
    const st = parseDealerSignals({
      enabled: true,
      items: [
        { kind: "incidents", checked: true, tone: "orange" },
        { kind: "us_history", checked: true, tone: "purple" },
      ],
    });
    expect(st?.items).toEqual([
      { kind: "incidents", checked: true, tone: "orange" },
      { kind: "us_history", checked: true },
    ]);
  });

  it("maiņa: noklusējuma krāsa noņem lauku, cita saglabājas", () => {
    const base: DealerSignalsState = { enabled: true, items: [{ kind: "mileage_mismatch", checked: true }] };
    const neutral = setDealerSignalTone(base, "mileage_mismatch", "neutral");
    expect(neutral.items[0]).toEqual({ kind: "mileage_mismatch", checked: true, tone: "neutral" });
    expect(setDealerSignalTone(neutral, "mileage_mismatch", "red").items[0]).toEqual({ kind: "mileage_mismatch", checked: true });
    expect(setDealerSignalTone(base, "mileage_mismatch", "red")).toBe(base);
  });

  it("«Pārģenerēt no datiem» saglabā krāsu (arī atiestatot) un manuālajiem", () => {
    let st: DealerSignalsState = { enabled: true, items: [{ kind: "incidents", checked: false, text: "Labots", tone: "orange" }] };
    st = addManualDealerSignal(st, "us_history");
    st = setDealerSignalTone(st, "us_history", "red");
    const reset = regenerateDealerSignals(st, ["incidents"], { keepEdits: false });
    expect(reset.items).toEqual([
      { kind: "incidents", checked: true, tone: "orange" },
      { kind: "us_history", checked: true, manual: true, tone: "red" },
    ]);
    expect(regenerateDealerSignals(st, ["incidents"]).items[0]).toEqual({ kind: "incidents", checked: false, text: "Labots", tone: "orange" });
  });

  it("PDF visās valodās lieto izvēlēto krāsu", () => {
    const st: DealerSignalsState = {
      enabled: true,
      items: [
        { kind: "mileage_mismatch", checked: true, tone: "neutral" },
        { kind: "incidents", checked: true, tone: "orange" },
        { kind: "us_history", checked: true, tone: "red" },
        { kind: "auction_photos", checked: true },
      ],
    };
    for (const lang of CLIENT_REPORT_LANGS) {
      expect(dealerSignalsPdfRows(st, lang).map((r) => [r.kind, r.tone, r.alert])).toEqual([
        ["mileage_mismatch", "neutral", false],
        ["incidents", "orange", false],
        ["us_history", "red", true],
        ["auction_photos", "neutral", false],
      ]);
      const html = buildDealerSignalsSectionHtml(dealer(st), lang);
      expect(html).toContain('class="pdf-dealer-signal-row" data-signal="mileage_mismatch"');
      expect(html).toContain('class="pdf-dealer-signal-row pdf-dealer-signal-row--warn" data-signal="incidents"');
      expect(html).toContain('class="pdf-dealer-signal-row pdf-dealer-signal-row--alert" data-signal="us_history"');
      expect(html).toContain('class="pdf-dealer-signal-row" data-signal="auction_photos"');
    }
  });

  it("redaktorā katrai rindai 3 krāsu apļi, priekšskats pēc krāsas", () => {
    const st: DealerSignalsState = {
      enabled: true,
      items: [
        { kind: "mileage_mismatch", checked: true },
        { kind: "incidents", checked: true, tone: "orange" },
      ],
    };
    const html = renderToStaticMarkup(<DealerSignalsEditor state={st} onChange={() => {}} onRegenerate={() => {}} size="touch" />);
    expect(html.match(/data-dealer-signal-tone-picker=/g)).toHaveLength(2);
    expect(html.match(/data-dealer-signal-tone="(red|orange|neutral)"/g)).toHaveLength(6);
    expect(html).toContain('aria-label="Oranžs"');
    expect(html).toMatch(/aria-checked="true" aria-label="Oranžs"/);
    expect(html).toContain('data-dealer-signal-preview-row="incidents" data-dealer-signal-preview-tone="orange"');
    expect(html).toContain('data-dealer-signal-preview-row="mileage_mismatch" data-dealer-signal-preview-tone="red"');
    expect(html).toContain("h-11 w-11");
  });
});
