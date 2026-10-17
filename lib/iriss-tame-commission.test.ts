import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { dzPasutijumsTermsWithCommission } from "@/lib/dzintarzeme-pasutijums-terms-content";
import { computeDzintarzemeTame, type DzintarzemeTameExtraLine } from "@/lib/dzintarzeme-tame-calculator";
import {
  defaultIrissTameCommissionSettings,
  parseIrissTameCommissionSettings,
} from "@/lib/iriss-tame-commission";

vi.mock("server-only", () => ({}));

const tameBase = {
  brandModel: "BMW",
  vin: "",
  autoPrice: 10000,
  applyVatToAutoPrice: false,
  depositPercent: 20,
  transportNet: 0,
  chemicalCleaningNet: 0,
  polishingNet: 0,
  paintingNet: 0,
  leasingValuationNet: 0,
  extraServices: [] as DzintarzemeTameExtraLine[],
};

describe("IRISS tame commission settings", () => {
  it("defaults to 1190 / 990 + 3,5 %", () => {
    const d = defaultIrissTameCommissionSettings();
    expect(d.variantANet).toBe(1190);
    expect(d.variantBBaseNet).toBe(990);
    expect(d.variantBLoanPercent).toBe(3.5);
    const a = computeDzintarzemeTame({ ...tameBase, commissionVariant: "A" });
    expect(a.commissionNet).toBe(1190);
    const b = computeDzintarzemeTame({ ...tameBase, commissionVariant: "B" });
    expect(b.commissionNet).toBe(1270);
    expect(b.tableRows.find((row) => row.label === "Aizdevuma komisija")?.subtitle).toBe(
      "3,5 % no summas pēc priekšapmaksas",
    );
  });

  it("uses saved rates in the calculator and the order terms", () => {
    const rates = { variantANet: 500, variantBBaseNet: 400, variantBLoanPercent: 2 };
    const a = computeDzintarzemeTame({ ...tameBase, commissionVariant: "A" }, rates);
    expect(a.commissionNet).toBe(500);
    const b = computeDzintarzemeTame({ ...tameBase, commissionVariant: "B" }, rates);
    expect(b.commissionNet).toBe(560);
    const terms = dzPasutijumsTermsWithCommission(rates);
    const texts = terms.filter((block) => block.kind === "p").map((block) => block.text);
    expect(texts.some((t) => t.includes("500,00 EUR"))).toBe(true);
    expect(texts.some((t) => t.includes("400,00 EUR") && t.includes("2 %"))).toBe(true);
  });

  it("keeps the signed terms wording when rates stay at the defaults", () => {
    const terms = dzPasutijumsTermsWithCommission(defaultIrissTameCommissionSettings());
    const texts = terms.filter((block) => block.kind === "p").map((block) => block.text);
    expect(texts.some((t) => t.includes("1190,00 EUR"))).toBe(true);
    expect(texts.some((t) => t.includes("990,00 EUR + 3,5 %"))).toBe(true);
  });

  it("drops invalid saved numbers back to the defaults", () => {
    const parsed = parseIrissTameCommissionSettings({
      variantANet: -1,
      variantBBaseNet: "990,50",
      variantBLoanPercent: 250,
    });
    expect(parsed.variantANet).toBe(1190);
    expect(parsed.variantBBaseNet).toBe(990.5);
    expect(parsed.variantBLoanPercent).toBe(3.5);
  });
});

describe("IRISS tame commission store", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function loadStore(dir: string) {
    vi.stubEnv("IRISS_TAME_COMMISSION_DIR", dir);
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.resetModules();
    return import("@/lib/iriss-tame-commission-store");
  }

  it("returns defaults until a value is saved, then reads it back", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "iriss-tame-"));
    dirs.push(dir);
    const store = await loadStore(dir);
    const fresh = await store.readIrissTameCommissionSettings();
    expect(fresh.variantANet).toBe(1190);
    const saved = await store.writeIrissTameCommissionSettings({
      variantANet: 1300,
      variantBBaseNet: 800,
      variantBLoanPercent: 4,
    });
    expect(saved.variantANet).toBe(1300);
    expect(saved.updatedAt.length).toBeGreaterThan(8);
    const again = await store.readIrissTameCommissionSettings();
    expect(again.variantBBaseNet).toBe(800);
    expect(again.variantBLoanPercent).toBe(4);
  });
});
