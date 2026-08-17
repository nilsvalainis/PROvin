import { describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

vi.mock("server-only", () => ({}));

import { buildIrissPasutijumiListPdfBytes } from "@/lib/iriss-pasutijums-pdf";
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
