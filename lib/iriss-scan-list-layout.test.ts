import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { emptyIrissScanRecord } from "@/lib/iriss-scan-types";
import { orderIrissScanListRows } from "@/lib/iriss-scan-list-order";

describe("radar list Jauns ieraksts and leftovers", () => {
  it("renders Jauns ieraksts as a link to /admin/iriss/scan/new", () => {
    const list = readFileSync("components/admin/IrissScanListClient.tsx", "utf8");
    const empty = readFileSync("app/admin/iriss/scan/page.tsx", "utf8");
    expect(list).toContain('href="/admin/iriss/scan/new"');
    expect(list.match(/Jauns ieraksts/g)?.length).toBeGreaterThanOrEqual(2);
    expect(list).not.toMatch(/AdminMobileRoundBtn name="pievienot"/);
    expect(empty).toContain('href="/admin/iriss/scan/new"');
    expect(empty).toContain("Jauns ieraksts");
    expect(list).not.toMatch(/\u2014|\u2013/);
  });

  it("keeps pinned rows and still appends a new radar that is missing from the saved order", () => {
    const old = emptyIrissScanRecord("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", "2026-10-01T00:00:00.000Z");
    old.brandModel = "Vecais";
    old.updatedAt = "2026-10-01T00:00:00.000Z";
    const created = emptyIrissScanRecord("8dc47497-a9ba-4108-acf3-b5244f5f89b5", "2026-10-20T12:00:00.000Z");
    created.brandModel = "Mercedes-Benz Sprinter H2L4";
    created.updatedAt = "2026-10-20T12:00:00.000Z";
    const ordered = orderIrissScanListRows([old, created], {
      pinnedOrder: [old.id],
      unpinnedOrder: [],
    });
    expect(ordered.map((row) => row.id)).toEqual([old.id, created.id]);
  });
});
