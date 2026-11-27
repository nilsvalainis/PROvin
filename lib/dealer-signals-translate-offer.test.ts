import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildDealerSignalsSectionHtml, type ClientReportPayload } from "@/lib/client-report-html";
import {
  applyClientReportTranslatedTexts,
  collectClientReportTranslatableTexts,
} from "@/lib/client-report-translatable-fields";
import {
  dealerSignalText,
  dealerSignalsMissingTranslations,
  dealerSignalsPdfNeedsOffer,
  dealerSignalsPdfRows,
  dealerSignalsTextsToTranslate,
  isDealerSignalTextAllowed,
  withDealerSignalTranslations,
  type DealerSignalsState,
} from "@/lib/dealer-signals";
import { parseDealerSignals } from "@/lib/dealer-signals-persist";

/** Nils 27.11 (abi A): labotā teksta tulkojums EN/RU/DE PDF; AUDITA piedāvājums tikai sūtot. */
const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

const CUSTOM = "Ieraksti liecina par virsbūves remontu";
const STATE: DealerSignalsState = {
  enabled: true,
  items: [
    { kind: "mileage_mismatch", checked: true },
    { kind: "incidents", checked: true, text: CUSTOM },
    { kind: "auction_photos", checked: false, text: "Foto ar bojājumiem" },
  ],
};

describe("labotā signāla teksta tulkojums", () => {
  it("tulkojamie teksti: tikai ķeksēti ar labotu tekstu; izslēgta sadaļa - nekas", () => {
    expect(dealerSignalsTextsToTranslate(STATE)).toEqual({ incidents: CUSTOM });
    expect(dealerSignalsTextsToTranslate({ ...STATE, enabled: false })).toEqual({});
    expect(dealerSignalsMissingTranslations(STATE, "lv")).toEqual({});
    expect(dealerSignalsMissingTranslations(STATE, "en")).toEqual({ incidents: CUSTOM });
  });

  it("PDF tulkošanas ceļš: teksts nonāk tulkojamo laukos un tulkojums PDF (nevis standarta teksts)", () => {
    const payload = { pdfReportKind: "dealer", dealerSignals: STATE } as unknown as ClientReportPayload;
    const texts = collectClientReportTranslatableTexts(payload);
    expect(texts["dealerSignal.incidents"]).toBe(CUSTOM);
    expect(texts["dealerSignal.auction_photos"]).toBeUndefined();
    const full = collectClientReportTranslatableTexts({ ...payload, pdfReportKind: "full" } as ClientReportPayload);
    expect(Object.keys(full).some((k) => k.startsWith("dealerSignal."))).toBe(false);

    const translated = applyClientReportTranslatedTexts(payload, {
      "dealerSignal.incidents": "Records indicate body repair",
    });
    expect(translated.dealerSignalsTranslated).toEqual({ incidents: "Records indicate body repair" });
    const html = buildDealerSignalsSectionHtml(translated, "en");
    expect(html).toContain("Records indicate body repair");
    expect(html).not.toContain(CUSTOM);
    expect(html).toContain("Possible odometer correction");
  });

  it("tulkojums neizdevās vai atgriež LV / ciparus / avotu -> standarta teksts klienta valodā", () => {
    const item = STATE.items[1]!;
    const std = "Accident or damage records are available for this car";
    expect(dealerSignalText(item, "en")).toBe(std);
    expect(dealerSignalText(item, "en", CUSTOM)).toBe(std);
    expect(dealerSignalText(item, "en", "3 records found")).toBe(std);
    expect(dealerSignalText(item, "en", "CARFAX shows repair")).toBe(std);
    expect(dealerSignalText(item, "lv")).toBe(CUSTOM);
  });

  it("labotā tekstā cipari vai avota nosaukums -> standarta teksts visās valodās (sarkanais lauks)", () => {
    expect(isDealerSignalTextAllowed("Pēc AutoDNA datiem bijis negadījums")).toBe(false);
    expect(isDealerSignalTextAllowed("Divi ieraksti")).toBe(true);
    const bad = { kind: "incidents" as const, text: "Pēc AutoDNA datiem bijis negadījums" };
    expect(dealerSignalText(bad, "lv")).toBe("Par šo auto pieejami negadījumu vai bojājumu ieraksti");
    expect(dealerSignalText(bad, "en", "According to records there was an accident")).toBe(
      "Accident or damage records are available for this car",
    );
    expect(dealerSignalsTextsToTranslate({ enabled: true, items: [{ ...bad, checked: true }] })).toEqual({});
  });

  it("saglabātais priekšskata tulkojums ir prioritārs un derīgs tikai tam pašam tekstam", () => {
    const saved = withDealerSignalTranslations(STATE, "de", {
      incidents: { src: CUSTOM, text: "Einträge deuten auf eine Karosseriereparatur hin" },
    });
    expect(saved).not.toBe(STATE);
    expect(dealerSignalsMissingTranslations(saved, "de")).toEqual({});
    expect(dealerSignalsMissingTranslations(saved, "ru")).toEqual({ incidents: CUSTOM });
    const rows = dealerSignalsPdfRows(saved, "de", { incidents: "Anderer KI-Text" });
    expect(rows.find((r) => r.kind === "incidents")?.text).toBe("Einträge deuten auf eine Karosseriereparatur hin");
    // Persistence saglabā tulkojumu.
    expect(parseDealerSignals(JSON.parse(JSON.stringify(saved)))?.items[1]?.tr?.de?.text).toBe(
      "Einträge deuten auf eine Karosseriereparatur hin",
    );
    // Teksts mainīts -> vecais tulkojums neder.
    const edited: DealerSignalsState = {
      ...saved,
      items: saved.items.map((i) => (i.kind === "incidents" ? { ...i, text: "Cits teksts" } : i)),
    };
    expect(dealerSignalText(edited.items[1]!, "de")).toBe("Für dieses Fahrzeug liegen Unfall- oder Schadenseinträge vor");
    expect(dealerSignalsMissingTranslations(edited, "de")).toEqual({ incidents: "Cits teksts" });
    // Neatbilstošs src netiek saglabāts.
    expect(withDealerSignalTranslations(edited, "de", { incidents: { src: CUSTOM, text: "x" } })).toBe(edited);
  });
});

describe("AUDITA piedāvājums tikai sūtot", () => {
  it("PDF ar rezerves saiti jāpārveido sūtot; ar piedāvājuma saiti - nē; bez sadaļas - nē", () => {
    expect(dealerSignalsPdfNeedsOffer(null)).toBe(false);
    expect(dealerSignalsPdfNeedsOffer({ url: "https://www.provin.lv/lv?plan=audits&vin=X" })).toBe(true);
    expect(dealerSignalsPdfNeedsOffer({ url: "https://www.provin.lv/lv/papildinajums/abc", offer: true })).toBe(false);
    // Sūtot mēģināts, piedāvājums nav pieejams (jau apmaksāts) -> PDF netiek pārveidots vēlreiz.
    expect(dealerSignalsPdfNeedsOffer({ url: "https://www.provin.lv/lv?plan=audits&vin=X", offer: false })).toBe(false);
  });

  it("PDF ģenerēšana / priekšskats neveido piedāvājumu; to veido tikai sūtīšanas ceļš", () => {
    const src = read("components/admin/OrderDetailWorkspace.tsx");
    const start = src.indexOf("const openPrintReport = async");
    const end = src.indexOf("const prepareSendReportPdf", start);
    expect(start).toBeGreaterThan(0);
    const printBody = src.slice(start, src.indexOf("\n  };\n", start));
    expect(printBody).not.toContain("/api/admin/order-upsell");
    expect(printBody).toContain("opts?.dealerSignalsAuditLink");
    // Vienīgais piedāvājuma POST - sūtīšanas palīgā.
    expect(src.match(/kind: "dealer_to_audit"/g)).toHaveLength(1);
    const offerFn = src.slice(src.indexOf("const openDealerSignalsOfferLink"), end);
    expect(offerFn).toContain('kind: "dealer_to_audit"');
    const prep = src.slice(end, src.indexOf("const sendPreparedReport", end));
    expect(prep).toMatch(/prepOpts\?\.forSend && kind === "dealer"/);
    // Nosūtītais PDF = PDF ar piedāvājuma saiti.
    const send = src.slice(src.indexOf("const sendPreparedReport"), src.indexOf("const sendPreparedReport") + 3000);
    expect(send).toContain("await ensureDealerSignalsOfferPdf(input.prepared, input.lang)");
    expect(send).toContain("serverPdfPathname: prepared.pdfPathname");
    expect(send).not.toContain("input.prepared.pdfPathname");
  });

  it("«Sūtīt klientam» PDF veido ar forSend; «PDF» poga - bez", () => {
    const dlg = read("components/admin/AdminDealerSendDialog.tsx");
    const send = dlg.slice(dlg.indexOf("const send = async"));
    expect(send).toContain("bridge.prepareDealerPdf(pdfLang, { forSend: true })");
    const download = dlg.slice(dlg.indexOf("const downloadPdf = async"), dlg.indexOf("const send = async"));
    expect(download).toContain("bridge.prepareDealerPdf(pdfLang)");
    expect(download).not.toContain("forSend");
  });
});
