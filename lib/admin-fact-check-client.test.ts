import { describe, expect, it } from "vitest";
import {
  collectFilledFactCheckFields,
  factCheckDismissKey,
  isIntervalWarningFlag,
  openErrorFactCheckFlags,
  parseVehicleYear,
  visibleFactCheckFlags,
} from "@/lib/admin-fact-check-client";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import type { FactCheckFlag } from "@/lib/unit-facts/types";

function flag(partial: Partial<FactCheckFlag> & Pick<FactCheckFlag, "id" | "level" | "kind" | "message" | "sentence">): FactCheckFlag {
  return partial;
}

describe("admin fact-check client", () => {
  it("parseVehicleYear reads CSDD year", () => {
    expect(parseVehicleYear("2014")).toBe(2014);
    expect(parseVehicleYear("", "2018-01-01")).toBe(2018);
  });

  it("dismiss key is id|sentence", () => {
    expect(factCheckDismissKey({ id: "fact:x", sentence: "Kārba ir ZF." })).toBe("fact:x|Kārba ir ZF.");
  });

  it("collapses interval warnings; errors stay open", () => {
    const interval = flag({
      id: "unsourced_interval",
      level: "W",
      kind: "unsourced",
      message: "Intervāls 45 000 km nav avotots.",
      sentence: "Eļļas maiņa ik pēc 45 000 km.",
    });
    const service = flag({
      id: "fact:mb_7gdct_service_interval",
      level: "W",
      kind: "contradiction",
      factId: "mb_7gdct_service_interval",
      message: "7G-DCT eļļas maiņas cikls.",
      sentence: "Nākamā apkope pie 220 tūkst. km.",
    });
    const err = flag({
      id: "fact:audi_q7_4l_gearbox_aisin",
      level: "E",
      kind: "contradiction",
      message: "Q7 4L kārba ir Aisin.",
      sentence: "Kārba ir ZF 8HP.",
    });
    expect(isIntervalWarningFlag(interval)).toBe(true);
    expect(isIntervalWarningFlag(service)).toBe(true);
    expect(isIntervalWarningFlag(err)).toBe(false);
    expect(openErrorFactCheckFlags([interval, err], [])).toEqual([err]);
  });

  it("hides dismissed flags", () => {
    const f = flag({
      id: "recall_denied",
      level: "E",
      kind: "recall_denied",
      message: "Atsaukums datos.",
      sentence: "Atsaukumu nav.",
    });
    expect(visibleFactCheckFlags([f], [factCheckDismissKey(f)])).toEqual([]);
    expect(openErrorFactCheckFlags([f], [factCheckDismissKey(f)])).toEqual([]);
  });

  it("collects filled AI fields including oil intervals", () => {
    const sourceBlocks = createDefaultSourceBlocks();
    sourceBlocks.auto_records.oilChangeIntervalNotes = "<p>Maiņa ik 15 000 km.</p>";
    sourceBlocks.csdd.comments = "CSDD komentārs par TA.";
    const fields = collectFilledFactCheckFields({
      tehniskoRiskuAnalize: "Kārba ir Aisin.",
      iriss: "",
      apskatesPlāns: "",
      mileageComment: "",
      incidentsComment: "",
      sourcesComparisonComment: "",
      sourceBlocks,
    });
    expect(fields.map((f) => f.field)).toEqual(
      expect.arrayContaining(["technical_risks", "csdd", "auto_records:oilChangeIntervalNotes"]),
    );
    expect(fields.find((f) => f.field === "auto_records:oilChangeIntervalNotes")?.text).toMatch(/15 000/);
    expect(fields.some((f) => f.field === "summary")).toBe(false);
  });
});

describe("28.11: PDF teksti ārpus komentāriem un AI pārbaude", () => {
  it("kartītes un dīlera signāli ar «pdf:» atslēgām; izslēgtās kartītes un izslēgti signāli - nē", async () => {
    const { collectPdfExtraFactCheckFields, PDF_TEXT_FACT_FIELD_PREFIX } = await import("@/lib/admin-fact-check-client");
    const { DEALER_SIGNAL_KINDS } = await import("@/lib/dealer-signals");
    const kind = DEALER_SIGNAL_KINDS[0]!;
    const fields = collectPdfExtraFactCheckFields({
      manualBanners: [
        { id: "a", severity: "red", title: "Negadījumi", value: "Nav ierakstu", text: "" } as never,
        { id: "b", severity: "red", text: "Paslēpts", includeInPdf: false } as never,
      ],
      dealerSignals: { enabled: true, items: [{ kind, checked: true, text: "Izsolē 3 bojājumi." }] } as never,
    });
    expect(fields.map((f) => f.field)).toEqual([`${PDF_TEXT_FACT_FIELD_PREFIX}banner.0`, `${PDF_TEXT_FACT_FIELD_PREFIX}signal.${kind}`]);
    expect(fields[0]!.text).toBe("Negadījumi. Nav ierakstu.");
    expect(
      collectPdfExtraFactCheckFields({ dealerSignals: { enabled: false, items: [{ kind, checked: true, text: "x" }] } as never }),
    ).toEqual([]);
  });

  it("pdfTextFactFlags: tikai «pdf:» lauki, ar lauka nosaukumu", async () => {
    const { pdfTextFactFlags } = await import("@/lib/admin-fact-check-client");
    const f = flag({ id: "owner_count", level: "E", kind: "owner_count", message: "3 pret 2", sentence: "s" });
    const at = new Date().toISOString();
    const out = pdfTextFactFlags(
      {
        summary: { flags: [f], appliedFactIds: [], checkedAt: at },
        "pdf:banner.0": { flags: [f], appliedFactIds: [], checkedAt: at },
      },
      { "pdf:banner.0": "PDF kartīte 1" },
    );
    expect(out.map((x) => x.message)).toEqual(["PDF kartīte 1: 3 pret 2"]);
  });

  it("withAiSkippedNotice: informācija tikai, ja AI pieprasīta un nav izpildīta", async () => {
    const { withAiSkippedNotice } = await import("@/lib/admin-fact-check-client");
    const base = { flags: [], appliedFactIds: [], checkedAt: "x" };
    expect(withAiSkippedNotice({ ...base, aiSkipped: "ai_disabled" }, false).flags).toEqual([]);
    expect(withAiSkippedNotice({ ...base, aiUsed: true }, true).flags).toEqual([]);
    const r = withAiSkippedNotice({ ...base, aiSkipped: "ai_disabled" }, true);
    expect(r.flags.map((x) => [x.id, x.level])).toEqual([["ai_check_skipped", "I"]]);
  });
});
