import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("iriss order documents and limits layout", () => {
  it("keeps generate menu, dates and admin-only limits card", () => {
    const room = readFileSync("components/admin/IrissOrderRoom.tsx", "utf8");
    const album = readFileSync("components/admin/IrissOrderPhotoAlbumSection.tsx", "utf8");
    const sorter = readFileSync("components/admin/IrissOfferImageSorter.tsx", "utf8");
    const sidebar = readFileSync("components/admin/AdminSidebar.tsx", "utf8");
    const card = readFileSync("components/admin/IrissLimitsSidebarCard.tsx", "utf8");
    const api = readFileSync("app/api/admin/limits/route.ts", "utf8");
    expect(room).toContain("iriss-dokumenti-view");
    expect(room).toContain("Saglabātie dokumenti");
    expect(room).toContain("Ģenerēt");
    expect(room).toContain("Lejupielādēt");
    expect(room).toContain("Vispirms saglabājiet pasūtījumu un piedāvājumu.");
    expect(album).toContain("Pievienot failus");
    expect(album).toContain("Kopēt uz piedāvājumu");
    expect(sorter).toContain("Vāks");
    expect(sidebar).toContain("IrissLimitsSidebarCard");
    expect(sidebar).toContain("IrissPavadzimesSidebarCard");
    expect(card).toContain("LIMITI");
    expect(card).toContain("Tikai adminam");
    expect(card).toContain("iriss-limits-card");
    expect(card).toContain("bg-[var(--s1,#fff)]");
    expect(sidebar).toContain("AdminMobileSheet");
    expect(sidebar).toContain("opaque");
    expect(sidebar).not.toMatch(/z-\[30\]/);
    expect(api).toContain('actor.kind !== "admin"');
    expect(room).not.toMatch(/\u2014|\u2013/);
  });
});
