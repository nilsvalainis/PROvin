import { describe, expect, it } from "vitest";

import { AdminVendorReportSummary } from "@/components/admin/AdminVendorReportSummary";
import { renderText } from "@/lib/test-render";

describe("AdminVendorReportSummary", () => {
  it("rāda visus brīdinājumus un foto skaitu", () => {
    const t = renderText(
      <AdminVendorReportSummary
        summary={{
          hasReport: true,
          warnings: [
            { key: "damage", level: "red", text: "Negadījumi / bojājumi: 2 · 07.2026" },
            { key: "taxi", level: "orange", text: "Taksometrs" },
          ],
          photos: { inReport: 26, inserted: 26 },
        }}
      />,
    );
    expect(t).toContain("Negadījumi / bojājumi: 2 · 07.2026");
    expect(t).toContain("Taksometrs");
    expect(t).toContain("Iekļautas fotogrāfijas: 26 / atskaitē 26");
    expect(t).not.toContain("Brīdinājumu nav");
  });

  it("bez brīdinājumiem - «Brīdinājumu nav», ielādes laikā «ielādē…»", () => {
    const t = renderText(<AdminVendorReportSummary summary={{ hasReport: true, warnings: [], photos: { inReport: null, inserted: 0 } }} photosLoading />);
    expect(t).toContain("Brīdinājumu nav");
    expect(t).toContain("Iekļautas fotogrāfijas: ielādē…");
  });
});
