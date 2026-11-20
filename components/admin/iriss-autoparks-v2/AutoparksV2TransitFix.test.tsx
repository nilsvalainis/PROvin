import { describe, expect, it } from "vitest";
import { AutoparksV2TransitFix } from "@/components/admin/iriss-autoparks-v2/AutoparksV2TransitFix";
import { renderHtml, renderText } from "@/lib/test-render";

describe("P2: admina saraksts «Ceļā bez Loģistikas»", () => {
  it("rāda nosaukumu, VIN, iegādes datumu un pārcelšanas pogas", () => {
    const rows = [{ id: "ap-1", title: "Volvo XC60", vin: "YV1DZ8256D2439274", purchaseDate: "2026-10-12" }];
    const text = renderText(<AutoparksV2TransitFix initialRows={rows} />);
    expect(text).toContain("Volvo XC60");
    expect(text).toContain("YV1DZ8256D2439274");
    expect(text).toContain("12.10.2026");
    expect(text).toContain("Pārcelt uz Noliktavā (0)");
    expect(renderHtml(<AutoparksV2TransitFix initialRows={rows} />)).toMatch(/<button[^>]*disabled=""[^>]*>Pārcelt uz Noliktavā/);
  });

  it("tukšs saraksts", () => {
    expect(renderText(<AutoparksV2TransitFix initialRows={[]} />)).toContain("Nav auto");
  });
});
