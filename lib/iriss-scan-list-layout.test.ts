import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { emptyIrissScanRecord } from "@/lib/iriss-scan-types";
import { orderIrissScanListRows } from "@/lib/iriss-scan-list-order";

describe("radar list Jauns radars and leftovers", () => {
  it("renders Jauns radars as a link to /admin/iriss/scan/new", () => {
    const list = readFileSync("components/admin/IrissScanListClient.tsx", "utf8");
    const empty = readFileSync("app/admin/iriss/scan/page.tsx", "utf8");
    const editor = readFileSync("components/admin/IrissScanEditor.tsx", "utf8");
    const findsUi = readFileSync("components/admin/IrissScanFinds.tsx", "utf8");
    expect(list).toContain("AdminCollapsedMenuButton");
    expect(list).toContain('href="/admin/iriss/scan/new"');
    expect(list.match(/Jauns radars/g)?.length).toBeGreaterThanOrEqual(1);
    expect(list).toContain("Jauns radars");
    expect(list).toContain("Atjaunot eCarsTrade");
    expect(list).toContain("IrissRadarBrandMark");
    // Bez izsoļu logo sarakstā (Nils 21.10): avotu skaits un laiks vienā rindā.
    expect(list).not.toContain("IrissAuctionLogo");
    expect(list).toContain("avoti");
    expect(list).toContain("line-clamp-2");
    expect(list).toContain("flex-wrap");
    expect(list).toContain("shrink-0");
    expect(list).toContain("whitespace-nowrap");
    expect(list).not.toContain("iriss-radars-view bg-");
    expect(list).toMatch(/AdminMobileRoundBtn name="pievienot"/);
    expect(list).not.toContain("IrissScanNewFab");
    expect(list).not.toMatch(/sticky top-0/);
    expect(empty).toContain('href="/admin/iriss/scan/new"');
    expect(empty).toContain("Jauns radars");
    expect(list).not.toMatch(/\u2014|\u2013/);
    expect(editor).not.toMatch(/\u2014|\u2013/);
    expect(editor).toContain("Saglabāts");
    expect(editor).toContain("Saites");
    expect(editor).toContain("Izveidot");
    expect(editor).toContain("Atvērt visas");
    expect(editor).toContain("w-24");
    expect(editor).toContain("iriss-ok-chip");
    expect(editor).toContain("<textarea");
    expect(editor).toContain("IrissScanFinds");
    expect(findsUi).toContain("Jaunākie atradumi");
    expect(editor).toContain("Neizdevās saglabāt");
    expect(editor).toContain("Dzēst šo radara ierakstu?");
    expect(editor).toContain("Darbību nevar atsaukt.");
    expect(editor).not.toMatch(/>Saglabāt</);
    expect(editor).toContain("IrissUnsavedChangesGuard");
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
