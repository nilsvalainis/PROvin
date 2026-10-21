import { describe, expect, it } from "vitest";
import { AdminVinScanRecent } from "@/components/admin/AdminVinScanRecent";
import { renderHtml, renderText } from "@/lib/test-render";

describe("Pēdējie skenējumi (renderēts)", () => {
  it("pēc noklusējuma aizvērts: skaits redzams, saraksts nē", () => {
    const html = renderHtml(
      <AdminVinScanRecent
        entries={[
          { vin: "WBA3A5C50CF256551", at: "2026-10-21T10:00:00Z" },
          { vin: "1M8GDM9AXKP042788", at: "2026-10-21T09:00:00Z" },
        ]}
        onPick={() => undefined}
      />,
    );
    expect(renderText(<AdminVinScanRecent entries={[{ vin: "WBA3A5C50CF256551", at: "x" }]} onPick={() => undefined} />)).toContain(
      "Pēdējie skenējumi · 1",
    );
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("WBA3A5C50CF256551");
  });

  it("bez ierakstiem nerenderē neko", () => {
    expect(renderHtml(<AdminVinScanRecent entries={[]} onPick={() => undefined} />)).toBe("");
  });
});
