import { describe, expect, it } from "vitest";

import { emptyVendorAvotuBlock } from "@/lib/admin-source-blocks";
import { upsertVendorPdfAiContext } from "@/lib/vendor-ai-context-fill";

const START_RE = /^=== PDF teksts \(automātiski\): AutoDNA · 19\.11\.2026 ===$/m;
const END = "=== /PDF teksts (automātiski): AutoDNA ===";

function block(aiContextRaw: string, extra: Record<string, unknown> = {}) {
  return { ...emptyVendorAvotuBlock(), aiContextRaw, ...extra };
}

const opts = { sourceLabel: "AutoDNA", dateLabel: "19.11.2026" };

describe("upsertVendorPdfAiContext", () => {
  it("ieliek marķētu bloku tukšā laukā", () => {
    const out = upsertVendorPdfAiContext(emptyVendorAvotuBlock(), "  AutoDNA report body  ", opts);
    expect(out.aiContextRaw).toMatch(START_RE);
    expect(out.aiContextRaw).toContain("\nAutoDNA report body\n");
    expect(out.aiContextRaw.endsWith(END)).toBe(true);
  });

  it("tukšs PDF teksts neko nemaina", () => {
    const b = block("operatora piezīme");
    expect(upsertVendorPdfAiContext(b, "   ", opts)).toBe(b);
  });

  it("jaunāks PDF nomaina tikai automātisko bloku, operatora un Copilot teksts paliek", () => {
    const first = upsertVendorPdfAiContext(block("Operatora piezīme"), "VECAIS PDF", {
      ...opts,
      dateLabel: "01.11.2026",
    });
    const withCopilot = { ...first, aiContextRaw: `${first.aiContextRaw}\n\nCopilot: papildu fakts` };
    const second = upsertVendorPdfAiContext(withCopilot, "JAUNAIS PDF", opts);
    const text = second.aiContextRaw;
    expect(text.startsWith("Operatora piezīme\n\n")).toBe(true);
    expect(text).toContain("JAUNAIS PDF");
    expect(text).not.toContain("VECAIS PDF");
    expect(text).not.toContain("01.11.2026");
    expect(text).toMatch(START_RE);
    expect(text.endsWith("Copilot: papildu fakts")).toBe(true);
    expect(text.match(/=== PDF teksts/g)).toHaveLength(1);
  });

  it("cita avota bloku neaiztiek", () => {
    const cv = upsertVendorPdfAiContext(emptyVendorAvotuBlock(), "CV TEKSTS", {
      sourceLabel: "CarVertical",
      dateLabel: "01.11.2026",
    });
    const out = upsertVendorPdfAiContext(cv, "ADNA TEKSTS", opts);
    expect(out.aiContextRaw).toContain("CV TEKSTS");
    expect(out.aiContextRaw).toContain("ADNA TEKSTS");
  });

  it("atkārtots tas pats PDF tajā pašā dienā - bez izmaiņām", () => {
    const first = upsertVendorPdfAiContext(block("piezīme"), "PDF", opts);
    expect(upsertVendorPdfAiContext(first, "PDF", opts)).toBe(first);
  });

  it("vecs nemarķēts teksts, kas vienāds ar iepriekšējo automātisko, tiek aizstāts", () => {
    const old = block("VECAIS PDF TEKSTS", { mileagePasteRaw: "VECAIS PDF TEKSTS" });
    const out = upsertVendorPdfAiContext(old, "JAUNAIS PDF", {
      ...opts,
      previousAutoTexts: [old.mileagePasteRaw as string],
    });
    expect(out.aiContextRaw).not.toContain("VECAIS");
    expect(out.aiContextRaw).toMatch(START_RE);
  });

  it("vecs nemarķēts teksts, kas vienāds ar jauno PDF tekstu, tiek aizstāts (ietīts marķieros)", () => {
    const out = upsertVendorPdfAiContext(block("TAS PATS PDF"), "TAS PATS PDF", opts);
    expect(out.aiContextRaw.match(/TAS PATS PDF/g)).toHaveLength(1);
    expect(out.aiContextRaw).toMatch(START_RE);
  });

  it("vecs operatora teksts bez marķieriem netiek dzēsts - bloks pievienots beigās", () => {
    const out = upsertVendorPdfAiContext(block("Operatora teksts"), "JAUNAIS PDF", {
      ...opts,
      previousAutoTexts: ["kaut kas cits"],
    });
    expect(out.aiContextRaw.startsWith("Operatora teksts\n\n=== PDF teksts")).toBe(true);
    expect(out.aiContextRaw).toContain("JAUNAIS PDF");
  });

  it("limita gadījumā saīsina PDF bloku, nevis operatora tekstu", () => {
    const operator = "O".repeat(800);
    const out = upsertVendorPdfAiContext(block(operator), "P".repeat(5000), {
      ...opts,
      maxLen: 1000,
    });
    expect(out.aiContextRaw.length).toBeLessThanOrEqual(1000);
    expect(out.aiContextRaw.startsWith(operator)).toBe(true);
    expect(out.aiContextRaw.endsWith(END)).toBe(true);
  });

  it("ja operatora teksts aizņem visu limitu, neko nemaina", () => {
    const b = block("O".repeat(1000));
    expect(upsertVendorPdfAiContext(b, "PDF", { ...opts, maxLen: 1000 })).toBe(b);
  });

  it("noklusētais limits 100 000 zīmju", () => {
    const out = upsertVendorPdfAiContext(block("piezīme"), "x".repeat(150_000), opts);
    expect(out.aiContextRaw.length).toBeLessThanOrEqual(100_000);
    expect(out.aiContextRaw.startsWith("piezīme")).toBe(true);
  });
});
