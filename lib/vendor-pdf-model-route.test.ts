import { describe, expect, it, vi } from "vitest";

import {
  resolveVendorPdfPrimary,
  runVendorPdfExtractWithFallback,
  toGeminiResponseSchema,
  vendorPdfGeminiShortfall,
  withTimeout,
} from "@/lib/vendor-pdf-model-route";
import { parseVendorPdfAgentPayload, VENDOR_PDF_AGENT_SCHEMA } from "@/lib/vendor-pdf-agent-payload";
import { emptyVendorReportExtract, type VendorReportExtract } from "@/lib/vendor-report-extract";

function extract(counts: { mileage?: number; incidents?: number; service?: number }): VendorReportExtract {
  const out = emptyVendorReportExtract("autodna");
  for (let i = 0; i < (counts.mileage ?? 0); i++) {
    out.mileage.push({ date: `01.01.${2010 + i}`, odometer: String(10_000 * (i + 1)), country: "Latvija" } as never);
  }
  for (let i = 0; i < (counts.incidents ?? 0); i++) {
    out.incidents.push({ date: `01.02.${2010 + i}`, incidentNo: "", lossAmount: "100 EUR" } as never);
  }
  for (let i = 0; i < (counts.service ?? 0); i++) {
    out.serviceHistory.push({ date: `01.03.${2010 + i}`, odometer: "", works: ["Eļļas maiņa"] } as never);
  }
  return out;
}

describe("resolveVendorPdfPrimary", () => {
  it("defaults to sonnet", () => {
    expect(resolveVendorPdfPrimary(undefined)).toBe("sonnet");
    expect(resolveVendorPdfPrimary("")).toBe("sonnet");
    expect(resolveVendorPdfPrimary("claude")).toBe("sonnet");
    expect(resolveVendorPdfPrimary("sonnet")).toBe("sonnet");
  });
  it("accepts gemini case-insensitively", () => {
    expect(resolveVendorPdfPrimary(" Gemini ")).toBe("gemini");
  });
});

describe("vendorPdfGeminiShortfall", () => {
  it("accepts a read that matches or exceeds the text layer", () => {
    expect(vendorPdfGeminiShortfall(extract({ mileage: 10, incidents: 2 }), extract({ mileage: 10, incidents: 2 }))).toBeNull();
    expect(vendorPdfGeminiShortfall(extract({ mileage: 12 }), extract({ mileage: 10 }))).toBeNull();
  });
  it("tolerates small differences (merged duplicates)", () => {
    expect(vendorPdfGeminiShortfall(extract({ mileage: 8 }), extract({ mileage: 10 }))).toBeNull();
  });
  it("flags clearly fewer records in any category", () => {
    expect(vendorPdfGeminiShortfall(extract({ mileage: 7 }), extract({ mileage: 10 }))).toMatch(/mileage/);
    expect(vendorPdfGeminiShortfall(extract({ mileage: 10, incidents: 0 }), extract({ mileage: 10, incidents: 1 }))).toMatch(
      /incidents/,
    );
    expect(vendorPdfGeminiShortfall(extract({ mileage: 5, service: 1 }), extract({ mileage: 5, service: 4 }))).toMatch(
      /serviceHistory/,
    );
  });
  it("flags an empty Gemini read even when the text layer found nothing", () => {
    expect(vendorPdfGeminiShortfall(extract({}), extract({}))).toBe("gemini_empty_extract");
  });
});

describe("runVendorPdfExtractWithFallback", () => {
  it("sonnet primary never calls Gemini (default behaviour unchanged)", async () => {
    const sonnet = extract({ mileage: 3 });
    const runGemini = vi.fn();
    const runSonnet = vi.fn(async () => sonnet);
    const out = await runVendorPdfExtractWithFallback({ primary: "sonnet", local: extract({}), runGemini, runSonnet });
    expect(out).toEqual({ extract: sonnet, used: "sonnet", fallbackReason: "" });
    expect(runGemini).not.toHaveBeenCalled();
  });

  it("sonnet primary propagates Sonnet errors as before", async () => {
    await expect(
      runVendorPdfExtractWithFallback({
        primary: "sonnet",
        local: extract({}),
        runGemini: vi.fn(),
        runSonnet: async () => {
          throw new Error("missing_ai_key");
        },
      }),
    ).rejects.toThrow("missing_ai_key");
  });

  it("uses Gemini when it reads enough records", async () => {
    const gemini = extract({ mileage: 6, incidents: 1 });
    const runSonnet = vi.fn();
    const out = await runVendorPdfExtractWithFallback({
      primary: "gemini",
      local: extract({ mileage: 6, incidents: 1 }),
      runGemini: async () => gemini,
      runSonnet,
    });
    expect(out.used).toBe("gemini");
    expect(out.extract).toBe(gemini);
    expect(runSonnet).not.toHaveBeenCalled();
  });

  it("falls back to Sonnet when Gemini errors", async () => {
    const sonnet = extract({ mileage: 4 });
    const onFallback = vi.fn();
    const out = await runVendorPdfExtractWithFallback({
      primary: "gemini",
      local: extract({ mileage: 4 }),
      runGemini: async () => {
        throw new Error("Gemini īslaicīgi pārslogots");
      },
      runSonnet: async () => sonnet,
      onFallback,
    });
    expect(out.used).toBe("sonnet");
    expect(out.extract).toBe(sonnet);
    expect(out.fallbackReason).toMatch(/^gemini_error:/);
    expect(onFallback).toHaveBeenCalledOnce();
  });

  it("falls back to Sonnet when Gemini returns invalid JSON", async () => {
    const sonnet = extract({ mileage: 2 });
    const out = await runVendorPdfExtractWithFallback({
      primary: "gemini",
      local: extract({ mileage: 2 }),
      runGemini: async () => parseVendorPdfAgentPayload("{not json", "autodna"),
      runSonnet: async () => sonnet,
    });
    expect(out.used).toBe("sonnet");
    expect(out.fallbackReason).toContain("ai_invalid_json");
  });

  it("falls back to Sonnet when Gemini reads clearly fewer records", async () => {
    const sonnet = extract({ mileage: 10 });
    const out = await runVendorPdfExtractWithFallback({
      primary: "gemini",
      local: extract({ mileage: 10 }),
      runGemini: async () => extract({ mileage: 3 }),
      runSonnet: async () => sonnet,
    });
    expect(out.used).toBe("sonnet");
    expect(out.extract).toBe(sonnet);
    expect(out.fallbackReason).toMatch(/gemini_shortfall_mileage/);
  });

  it("keeps the partial Gemini read if Sonnet also fails after a shortfall", async () => {
    const gemini = extract({ mileage: 3 });
    const out = await runVendorPdfExtractWithFallback({
      primary: "gemini",
      local: extract({ mileage: 10 }),
      runGemini: async () => gemini,
      runSonnet: async () => {
        throw new Error("529 overloaded");
      },
    });
    expect(out.used).toBe("gemini");
    expect(out.extract).toBe(gemini);
    expect(out.fallbackReason).toMatch(/sonnet_error:529/);
  });

  it("throws the Sonnet error when both models fail", async () => {
    await expect(
      runVendorPdfExtractWithFallback({
        primary: "gemini",
        local: extract({}),
        runGemini: async () => {
          throw new Error("missing_gemini_key");
        },
        runSonnet: async () => {
          throw new Error("sonnet down");
        },
      }),
    ).rejects.toThrow("sonnet down");
  });
});

describe("withTimeout", () => {
  it("rejects slow promises with a labelled timeout", async () => {
    vi.useFakeTimers();
    const p = withTimeout(new Promise(() => {}), 1000, "gemini");
    const assertion = expect(p).rejects.toThrow("gemini_timeout");
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
    vi.useRealTimers();
  });
  it("passes through fast results", async () => {
    await expect(withTimeout(Promise.resolve(7), 1000, "x")).resolves.toBe(7);
  });
});

describe("toGeminiResponseSchema", () => {
  it("uppercases types and keeps property names intact", () => {
    const g = toGeminiResponseSchema(VENDOR_PDF_AGENT_SCHEMA) as {
      type: string;
      properties: Record<string, { type: string; items?: { type: string; properties: Record<string, { type: string }> } }>;
    };
    expect(g.type).toBe("OBJECT");
    expect(g.properties.mileage?.type).toBe("ARRAY");
    expect(g.properties.mileage?.items?.type).toBe("OBJECT");
    expect(g.properties.mileage?.items?.properties.odometer?.type).toBe("STRING");
    expect(JSON.stringify(g)).not.toMatch(/"type":"(object|array|string)"/);
    expect(JSON.stringify(g)).not.toContain("additionalProperties");
  });
});
