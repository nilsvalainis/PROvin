import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const files = [
  "components/admin/IrissOrderRoom.tsx",
  "components/admin/IrissPasutijumsEditor.tsx",
  "components/admin/IrissRangeFromToField.tsx",
  "components/admin/IrissSpecDiapazoniBlock.tsx",
  "components/admin/IrissMarketplaceLoadPanel.tsx",
  "components/admin/IrissScanEditor.tsx",
  "lib/marketplace/query-from-order.ts",
  "lib/marketplace/query-from-scan.ts",
  "app/admin/iriss/iriss-admin.css",
] as const;

describe("IRISS DIAPAZONI mockup v2", () => {
  const sources = Object.fromEntries(files.map((file) => [file, readFileSync(file, "utf8")]));

  it("embeds the ranges block in both spec editors", () => {
    expect(sources["components/admin/IrissOrderRoom.tsx"]).toContain("IrissSpecDiapazoniBlock");
    // Nils 31.10: jaunais pasūtījums lieto tās pašas soļu kartītes (IrissOrderStepCards ar diapazoniem).
    expect(sources["components/admin/IrissPasutijumsEditor.tsx"]).toContain("IrissOrderStepCards");
    expect(sources["components/admin/IrissSpecDiapazoniBlock.tsx"]).toContain("DIAPAZONI");
    expect(sources["components/admin/IrissSpecDiapazoniBlock.tsx"]).toContain('label="Gadi"');
    expect(sources["components/admin/IrissSpecDiapazoniBlock.tsx"]).toContain('label="Cena"');
    expect(sources["components/admin/IrissSpecDiapazoniBlock.tsx"]).not.toMatch(/no-līdz/);
    expect(sources["components/admin/IrissOrderRoom.tsx"]).not.toMatch(/Cena no-līdz|Gadi no-līdz/);
    expect(sources["components/admin/IrissPasutijumsEditor.tsx"]).not.toMatch(/Cena no-līdz|Gadi no-līdz/);
  });

  it("keeps load copy split and uses Gadi labels", () => {
    const query = sources["lib/marketplace/query-from-order.ts"];
    expect(query).toContain('yearFrom: "gadi no"');
    expect(query).toContain('yearTo: "gadi līdz"');
    expect(query).toContain("Ielādēt nav iespējams. Aizpildi:");
    expect(query).toContain("Vēl vajag vienu no: nobraukums līdz, tilpums vai jauda.");
    expect(query).not.toContain('yearFrom: "gads no"');
    const panel = sources["components/admin/IrissMarketplaceLoadPanel.tsx"];
    expect(panel).toContain("mobile.de ielādējas automātiski katru dienu 9:00 (izņemot svētdienas)");
    expect(panel).toContain("ar pogu Ielādēt");
    expect(panel).toContain("Ielāde izslēgta (izmaksu kontrole)");
    expect(panel).toContain("mēneša kopsumma");
    expect(panel).toContain("Izmaksu pieņēmumi");
    expect(panel).toContain("formatMarketplaceUsd");
    expect(panel).toContain("/api/admin/iriss-marketplace/usage");
    expect(sources["components/admin/IrissPasutijumsEditor.tsx"]).toContain("/room-hits");
    expect(sources["components/admin/IrissMarketplaceLoadPanel.tsx"]).toContain("onLoaded");
    expect(sources["components/admin/IrissOrderRoom.tsx"]).toContain(
      "mobile.de un AutoScout24 nāk no ielādes zemāk",
    );
    expect(panel).toContain("Automātiska ielāde radarā nav");
    expect(panel).toContain("scanId");
    expect(panel).toContain("MARKETPLACE_RADAR_EXTRA_RANGE_MESSAGE");
    expect(panel).toContain("formatMarketplaceUsd(monthlyCapUsd)");
    expect(sources["components/admin/IrissScanEditor.tsx"]).toContain("apifyMobiledeEnabled");
    expect(sources["components/admin/IrissScanEditor.tsx"]).toContain("IrissMarketplaceLoadPanel");
    expect(sources["components/admin/IrissScanEditor.tsx"]).toContain("Furgons");
  });

  it("styles required empty fields and phone units without em dashes", () => {
    const css = sources["app/admin/iriss/iriss-admin.css"];
    expect(css).toContain("#fca5a5");
    expect(css).toContain("#fffafa");
    expect(css).toContain("iriss-range-unit-end");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) minmax(0, 1fr)");
    for (const file of [
      "components/admin/IrissOrderRoom.tsx",
      "components/admin/IrissRangeFromToField.tsx",
      "components/admin/IrissSpecDiapazoniBlock.tsx",
      "components/admin/IrissMarketplaceLoadPanel.tsx",
      "components/admin/IrissScanEditor.tsx",
      "lib/marketplace/query-from-order.ts",
      "lib/marketplace/query-from-scan.ts",
    ] as const) {
      expect(sources[file], file).not.toMatch(/\u2014|\u2013/);
    }
  });
});
