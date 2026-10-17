import { describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

async function extractPdfText(buffer: Buffer): Promise<string> {
  const core = (await import("pdf-parse/lib/pdf-parse.js")) as {
    default?: (data: Buffer) => Promise<{ text?: unknown }>;
  };
  const pdfParse = core.default;
  if (typeof pdfParse !== "function") throw new Error("pdf-parse missing");
  const result = await pdfParse(buffer);
  return typeof result.text === "string" ? result.text : "";
}

vi.mock("server-only", () => ({}));

import { buildIrissPasutijumiListPdfBytes, buildIrissPasutijumsPdfBytes } from "@/lib/iriss-pasutijums-pdf";
import { emptyIrissPasutijums, type IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

describe("IRISS pasūtījumu saraksta PDF", () => {
  it("builds a PDF with client, spec, equipment and notes", async () => {
    const rec = emptyIrissPasutijums("list-pdf-test", "2026-08-17T12:00:00.000Z");
    rec.clientFirstName = "Anna";
    rec.clientLastName = "Bērziņa";
    rec.phone = "20000000";
    rec.brandModel = "VW Golf";
    rec.engineType = "Benzīns";
    rec.equipmentRequired = "ACC";
    rec.notes = "Pārbaudīt VIN";
    const bytes = await buildIrissPasutijumiListPdfBytes([rec]);
    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(Buffer.from(bytes.subarray(0, 5)).toString("latin1")).toBe("%PDF-");
  });

  it("builds a PDF from local IRISS drafts when present", async () => {
    const dir = path.join(process.cwd(), ".data/iriss-pasutijumi");
    let names: string[] = [];
    try {
      names = (await fs.readdir(dir)).filter((n) => n.endsWith(".json") && !n.startsWith("_"));
    } catch {
      return;
    }
    if (names.length === 0) return;
    const records: IrissPasutijumsRecord[] = [];
    for (const name of names) {
      const raw = JSON.parse(await fs.readFile(path.join(dir, name), "utf8")) as IrissPasutijumsRecord;
      if (raw?.id) records.push({ ...emptyIrissPasutijums(raw.id, raw.createdAt || new Date().toISOString()), ...raw });
    }
    const bytes = await buildIrissPasutijumiListPdfBytes(records);
    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(Buffer.from(bytes.subarray(0, 5)).toString("latin1")).toBe("%PDF-");
  });
});

describe("IRISS viena pasūtījuma PDF", () => {
  it("stays two pages (data + terms) with a signature strip on page 1", async () => {
    const rec = emptyIrissPasutijums("order-pdf-test", "2026-08-17T12:00:00.000Z");
    rec.clientFirstName = "Anna";
    rec.clientLastName = "Bērziņa";
    rec.phone = "20000000";
    rec.orderDate = "2026-04-22";
    rec.brandModel = "VW Golf";
    rec.engineType = "Benzīns";
    rec.equipmentRequired = "ACC";
    rec.equipmentDesired = "Kamera";
    rec.notes = "Pārbaudīt VIN";
    rec.dealServiceStartDeposit = true;
    rec.dealEkki = true;
    const bytes = await buildIrissPasutijumsPdfBytes(rec);
    expect(Buffer.from(bytes.subarray(0, 5)).toString("latin1")).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
  });

  it("signs the order PDF as Nils Valainis with SIA IRISS details and short hyphens", async () => {
    const rec = emptyIrissPasutijums("order-pdf-brand", "2026-08-17T12:00:00.000Z");
    rec.clientFirstName = "Anna";
    rec.clientLastName = "Bērziņa";
    rec.brandModel = "VW Golf";
    rec.advance = { amount: "200", paidAt: "2026-10-17", method: "transfer", invoiceNo: "" };
    const bytes = await buildIrissPasutijumsPdfBytes(rec);
    const text = await extractPdfText(Buffer.from(bytes));
    expect(text).toContain("Dzintarzeme Auto");
    expect(text).toContain("SIA ĪRISS");
    expect(text).toContain("59202001191");
    expect(text).toContain("Nils Valainis");
    expect(text).toContain("Pakalpojuma sniedzēja paraksts");
    expect(text).toContain("info@dzintarzemeauto.lv");
    expect(text).toContain("00 371 204 205 39");
    expect(text).toContain("www.dzintarzemeauto.lv");
    expect(text).toContain("1190,00 EUR");
    expect(text).toContain("990,00 EUR + 3,5 %");
    expect(text).toContain("Avanss");
    expect(text).toContain("ieskaitāms komisijas maksā");
    expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});
