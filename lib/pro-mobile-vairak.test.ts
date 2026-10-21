import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

describe("PRO Vairāk pages on phones", () => {
  it("Konsultācijas: one header with the right title", () => {
    expect(read("app/admin/(dashboard)/konsultacijas/page.tsx")).toContain('<div className="max-md:hidden">\n        <AdminDashboardHeaderWithMenu>');
    const table = read("components/admin/AdminOrdersTable.tsx");
    expect(table).toContain('title={consultationList ? "Konsultācijas" : "Pasūtījumi"}');
    expect(table).toContain("v.primaryClient !== adminOrderCardTitle(o.makeModel, v)");
  });

  it("Izmaksas: active month is readable and Labot is a 44 px target", () => {
    const costs = read("components/admin/AdminCostsView.tsx");
    expect(costs).toContain('style={{ color: on ? "var(--costs-tab-on-fg)" : "var(--costs-tab-off-fg)" }}');
    expect(costs).toContain("max-md:inline-flex max-md:min-h-11 max-md:items-center max-md:text-[14px]");
  });

  it("Partneri: links look like links, B2B tag text is visible", () => {
    const page = read("app/admin/(dashboard)/partneri/page.tsx");
    expect(page.match(/style=\{\{ color: "var\(--color-provin-accent\)" \}\}/g)?.length).toBe(2);
    expect(read("components/admin/AdminB2bAction.tsx")).toContain('style={{ color: "#c2410c" }}');
  });

  it("Statistika: no second back link at the bottom on phones", () => {
    expect(read("app/admin/(dashboard)/statistika/page.tsx")).toContain('<p className="mt-8 text-[12px] max-md:hidden">');
    expect(read("components/admin/AdminListingPeekConversionCard.tsx")).toContain("Atvērt ātros vērtējumus ›");
  });
});

describe("PRO mobile large title", () => {
  it("shrinks long titles (Konsultācijas) so they are not cut off next to three buttons", () => {
    expect(read("components/admin/mobile/AdminMobileChrome.tsx")).toContain('title.length > 10 ? "text-[28px] leading-none" : "text-[34px] leading-none"');
  });
});
