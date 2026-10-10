import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { buildLetterFacts, buildSourceCards, csddCardFacts, formatDateLv, validityTone } from "@/lib/quick-eval-cards";

const NOW = Date.UTC(2026, 9, 10);

function input(mut?: (b: ReturnType<typeof createDefaultSourceBlocks>) => void) {
  const blocks = createDefaultSourceBlocks();
  mut?.(blocks);
  return { blocks, parts: {} as Record<string, string | undefined>, sourceAt: {}, seedAt: null, peekVin: "", listingUrl: "", now: NOW };
}

describe("quick-eval-cards", () => {
  it("validity tones", () => {
    expect(validityTone("2026-01-01", NOW)).toBe("bad");
    expect(validityTone("2026-10-20", NOW)).toBe("warn");
    expect(validityTone("2027-05-01", NOW)).toBe("ok");
    expect(formatDateLv("2026-03-04")).toBe("04.03.2026");
  });

  it("curated CSDD facts with expired OCTA and VIN mismatch", () => {
    const b = createDefaultSourceBlocks();
    b.csdd.makeModel = "VOLVO XC60";
    b.csdd.vin = "YV1DZ8256C2000001";
    b.csdd.insuranceValidUntil = "2026-01-01";
    b.csdd.vehicleType = "N1 kravas";
    b.csdd.grossMassKg = "3500";
    const f = csddCardFacts(b.csdd, "YV1DZ8256C2999999", NOW);
    expect(f.find((x) => x.label === "OCTA")?.tone).toBe("bad");
    expect(f.find((x) => x.label === "Reģ. nr. · VIN")?.tone).toBe("bad");
    expect(f.find((x) => x.label === "Pilnā masa")?.value).toBe("3500 kg");
  });

  it("card tones from seed parts and data", () => {
    const i = input((b) => {
      b.tjekbil.mileage = [{ date: "2024-05-01", odometer: "120000", country: "DK", origin: "" }];
    });
    i.parts = { csdd: "error", listing: "no_adify_data" };
    const cards = buildSourceCards(i);
    expect(cards.find((c) => c.id === "csdd")?.tone).toBe("bad");
    expect(cards.find((c) => c.id === "listing")?.tone).toBe("none");
    expect(cards.find((c) => c.id === "tjekbil")?.tone).toBe("ok");
    expect(cards.find((c) => c.id === "mnt_ee")?.tone).toBe("pending");
    expect(cards.find((c) => c.id === "ltab")?.tone).toBe("none");
  });

  it("letter facts", () => {
    const i = { ...input((b) => {
      b.tjekbil.incidents = [{ date: "2022-01-01", amount: "", country: "DK", note: "x" }];
      b.tirgus.listingMileageOdometer = "150000";
    }), ltab: { at: "2026-10-01T00:00:00Z", mark: "clean" as const }, ccVinCount: 12 };
    const f = buildLetterFacts(i);
    expect(f.incidents).toContain("1 negadījumi");
    expect(f.incidents).toContain("LTAB: nav zaudējumu");
    expect(f.odometer).toContain("150");
    expect(f.photos).toBe("CC-VIN: 12 foto");
  });
});
