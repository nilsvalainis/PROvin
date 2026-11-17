/**
 * FABLE 25.10: IRISS piedāvājuma PDF nedrukāja Degviela / Jauda / Krāsa (ne no laukiem, ne no redaktora bloka),
 * ikonas bija nobīdītas par vienu rindu, cenas bez formāta ("21500", bet "Kopā 23 600 €").
 */
import { describe, expect, it } from "vitest";
import { buildIrissOfferPdfBytes } from "@/lib/iriss-pasutijums-pdf";
import { emptyIrissOfferRecord, emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import { defaultIrissOfferBlocks } from "@/lib/iriss-offer-blocks";

async function pdfText(bytes: Uint8Array): Promise<string> {
  const core = (await import("pdf-parse/lib/pdf-parse.js")) as {
    default: (b: Buffer) => Promise<{ text: string }>;
  };
  return (await core.default(Buffer.from(bytes))).text;
}

function fixture() {
  const now = "2026-10-25T18:00:00.000Z";
  const rec = emptyIrissPasutijums("ord_fable", now);
  const offer = emptyIrissOfferRecord("off_fable", now);
  Object.assign(offer, {
    brandModel: "BMW 330i xDrive",
    firstRegistration: "03.2020",
    odometerReading: "88 000 km",
    transmission: "automatic",
    fuel: "diesel",
    powerKw: "190",
    color: "Melna",
    carPrice: "21500",
    deliveryPrice: "900",
    commissionFee: "pēc vienošanās",
  });
  return { rec, offer };
}

describe("IRISS piedāvājuma PDF pamatinformācija", () => {
  it("drukā Degviela, Jauda, Krāsa no laukiem (LV vērtības) un formatē cenas", async () => {
    const { rec, offer } = fixture();
    const text = await pdfText((await buildIrissOfferPdfBytes(rec, offer, { embedImages: false })).bytes);
    expect(text).toContain("Degviela:");
    expect(text).toContain("Dīzelis");
    expect(text).toContain("Jauda:");
    expect(text).toContain("190 kW");
    expect(text).toContain("Krāsa:");
    expect(text).toContain("Melna");
    expect(text).toContain("Automātiskā");
    expect(text).toMatch(/21\s500\s€/);
    expect(text).toContain("pēc vienošanās");
  });

  it("redaktora bloka vērtība uzvar lauku (kā redaktorā un publiskajā saitē)", async () => {
    const { rec, offer } = fixture();
    const blocks = defaultIrissOfferBlocks(offer).map((b) =>
      b.kind === "vehicle" ? { ...b, rows: b.rows!.map((r) => (r.id === "color" ? { ...r, value: "Pelēka metālika" } : r)) } : b,
    );
    const text = await pdfText((await buildIrissOfferPdfBytes(rec, { ...offer, blocks }, { embedImages: false })).bytes);
    expect(text).toContain("Pelēka metālika");
    expect(text).not.toContain("Melna");
  });
});
