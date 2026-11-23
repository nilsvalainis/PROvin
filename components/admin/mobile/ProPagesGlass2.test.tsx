import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/partneri",
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, prefetch: () => undefined }),
}));

import { AdminB2bInvitePanel } from "@/components/admin/AdminB2bInvitePanel";
import { AdminListingPeekConversionCard } from "@/components/admin/AdminListingPeekConversionCard";
import { renderHtml } from "@/lib/test-render";

const root = path.resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

/** 3. posms (22.11 makets v2, sadaļa 5) - 2. grupa: telefonā stikla stils, funkcijas tās pašas. */
describe("PRO pārējās lapas telefonā - 2. grupa", () => {
  it("katrai PRO lapai telefonā stikla sakne (.amx-pg); IRISS lapas to nesaņem", () => {
    for (const [file, cls] of [
      ["app/admin/(dashboard)/statistika/page.tsx", "amx-pg--statistika"],
      ["app/admin/(dashboard)/partneri/page.tsx", "amx-pg--partneri"],
      ["app/admin/(dashboard)/teksti/page.tsx", "amx-pg--teksti"],
      ["app/admin/(dashboard)/konsultacijas/page.tsx", "amx-pg--konsultacijas"],
      ["app/admin/(dashboard)/commission-invoice/page.tsx", "amx-pg--rekini"],
      ["app/admin/(dashboard)/blogs/page.tsx", "amx-pg--blogs"],
      ["app/admin/(dashboard)/agregatu-zinasanas/page.tsx", "amx-pg--agregati"],
      ["app/admin/(dashboard)/b2b-demo/page.tsx", "amx-pg--demo"],
    ] as const) {
      expect(read(file), file).toContain(`amx amx-pg ${cls}`);
    }
    // Stils tikai telefonā.
    expect(read("app/admin/mobile/pages-glass-2.css")).toMatch(/^@media \(max-width: 767px\)/m);
    expect(read("app/admin/mobile/pages-glass-2.css")).not.toMatch(/^\.amx/m);
  });

  it("Partneri: cilnes telefonā, saites datorā paliek; esošās saites tās pašas", () => {
    const page = read("app/admin/(dashboard)/partneri/page.tsx");
    expect(page).toContain("data-amx-tabs");
    expect(page).toMatch(/href="\/admin\/partneri\/pieteikumi"/);
    expect(page).toMatch(/href="\/admin\/partneri\/statistika"/);
    expect(page).toContain('max-md:hidden">');
  });

  it("Ielūguma cenas: nosaukums + lauks vienā rindā, garie paskaidrojumi - hint", () => {
    const html = renderHtml(<AdminB2bInvitePanel />);
    expect(html.match(/data-amx-price-row/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(html).toMatch(/data-amx-hint[^>]*>\s*Partneris reģistrējas pats/);
    expect(html).toMatch(/data-amx-hint[^>]*>\s*Ja lauks ir tukšs/);
    expect(html).toContain("Izveidot ielūgumu");
  });

  it("Statistika: 4 skaitļi vienā rindā, paskaidrojums paslēpts, produktu saraksts paliek", () => {
    const html = renderHtml(
      <AdminListingPeekConversionCard
        stats={{
          peekCount: 257,
          skippedPeeks: 0,
          commentSentPeeks: 200,
          uniquePeople: 249,
          convertedPeople: 25,
          conversionRatePct: 10,
          orderCount: 29,
          revenueCents: 222000,
          byProduct: [{ label: "PROVIN AUDITS", people: 16 } as never],
        }}
      />,
    );
    expect(html).toContain("data-amx-kpis");
    expect(html).toMatch(/data-amx-hint[^>]*>25 no 249/);
    expect(html).toContain("PROVIN AUDITS");
  });
});
