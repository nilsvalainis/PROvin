import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/pro",
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, prefetch: () => undefined }),
}));

import { ProTodayHome, type ProTodaySection } from "@/components/admin/mobile/ProTodayHome";
import { proMenuCatalog } from "@/lib/admin-menu-catalog";
import { proTodayRows } from "@/lib/admin-pro-today";
import { renderHtml } from "@/lib/test-render";

const sections: ProTodaySection[] = [
  ...proMenuCatalog()
    .filter((c) => c.kind === "app")
    .map((c) => ({ id: c.id, title: c.title, href: c.href, icon: c.icon })),
  { id: "pro-konsultacijas", title: "Konsultācijas", href: "/admin/konsultacijas", icon: "msg" },
];

describe("PRO telefona sākums «Šodien» (izvēlne B)", () => {
  const rows = proTodayRows({ ingest: { notSent: 3, errors: 2 }, proHome: null, openCount: 2, nowMs: Date.now() });
  const html = renderHtml(<ProTodayHome rows={rows} sections={sections} onShowGrid={() => undefined} />);

  it("augšā darāmais: skaitlis + teksts, kļūdas sarkanā, saites uz filtrētu sarakstu", () => {
    expect(html).toContain('data-pro-today-rows');
    expect(html).toMatch(/href="\/admin\/dashboard\?ielase=nav-nosutiti"[^>]*><span class="amx-today-n">3<\/span>/);
    expect(html).toMatch(/data-alert="true" href="\/admin\/dashboard\?ielase=kludas"><span class="amx-today-n amx-tx--red">2<\/span>/);
    expect(html).toContain("Ātrie vērtējumi gaida");
    // Kavējumu rinda nav, jo termiņu datu nav.
    expect(html).not.toContain("Auditi kavē");
  });

  it("sadaļas 2 kolonnās: 9 galvenās + «Visas sadaļas» ar kopējo skaitu; ikonas bez krāsainām flīzēm", () => {
    const ids = [...html.matchAll(/data-pro-section="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual([
      "pro-pasutijumi",
      "pro-dilera",
      "pro-vin",
      "pro-atrie",
      "pro-arhivs",
      "pro-partneri",
      "pro-izmaksas",
      "pro-statistika",
      "pro-teksti",
      "visas",
    ]);
    expect(html).toContain("Izsoļu arhīvs");
    expect(html).toContain(`<span class="amx-today-sec-n">${sections.length}</span>`);
    expect(html).not.toContain("--menu-tone");
  });

  it("bez datiem - neviena darāmā rinda (nekādi izdomāti skaitļi)", () => {
    const empty = renderHtml(<ProTodayHome rows={[]} sections={sections} />);
    expect(empty).not.toContain("data-pro-today-rows");
    expect(empty).toContain("Sadaļas");
  });
});
