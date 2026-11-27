import { createElement } from "react";
import { describe, expect, it } from "vitest";

import { AdminQuickEvalCheckcarSection, quickEvalHasCheckcarImport } from "@/components/admin/AdminQuickEvalCheckcarSection";
import { emptyCcVinBlock } from "@/lib/cc-vin-report";
import { attachCheckcarPhotos, mergeCheckcarRaw } from "@/lib/checkcar-full-report";
import { renderHtml } from "@/lib/test-render";

const PEEK = "8e51f2ea-0000-4000-8000-000000000001";

describe("ātrā vērtējuma CheckCar sadaļa", () => {
  it("bez CheckCar importa neko nerāda", () => {
    expect(quickEvalHasCheckcarImport(emptyCcVinBlock())).toBe(false);
    expect(renderHtml(createElement(AdminQuickEvalCheckcarSection, { peekId: PEEK, block: emptyCcVinBlock() }))).toBe("");
  });

  it("rāda izsoles rindas un foto grupas no ātrā vērtējuma krātuves", () => {
    const base = {
      ...emptyCcVinBlock(),
      rawUnprocessedData: mergeCheckcarRaw("", "teksts", "27.11.2026"),
      sales: [{ date: "14.03.2025", venue: "AUTOBID", odometer: "187 300", price: "4 250 €", status: "Pārdots" }],
    };
    const { block } = attachCheckcarPhotos(base, [
      { id: "ih_ph_000000000000000000000001", title: "CheckCar.vin · Autobid · 14.03.2025", sourceUrl: "https://img.example/1.jpg" },
    ]);
    const html = renderHtml(createElement(AdminQuickEvalCheckcarSection, { peekId: PEEK, block }));
    expect(html).toContain("AUTOBID");
    expect(html).toContain("187 300 km");
    expect(html).toContain("CheckCar.vin · Autobid · 14.03.2025 (1)");
    expect(html).toContain(`/api/admin/checkcar-import?kind=quick_eval&amp;id=${PEEK}&amp;photoId=ih_ph_000000000000000000000001`);
  });
});
