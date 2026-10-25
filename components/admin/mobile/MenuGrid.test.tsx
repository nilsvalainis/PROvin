import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/iriss",
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, prefetch: () => undefined }),
}));

import { MenuGrid } from "@/components/admin/mobile/MenuGrid";
import { IRISS_DEFAULT_LAYOUT_IDS, irissMenuCatalog } from "@/lib/admin-menu-catalog";
import type { MenuLayout } from "@/lib/admin-menu-layout";
import { renderHtml } from "@/lib/test-render";

const catalog = irissMenuCatalog([], true);

function tileOrder(initialLayout?: MenuLayout | null): string[] {
  const html = renderHtml(
    <MenuGrid
      workspace="iriss"
      catalog={catalog}
      defaultIds={IRISS_DEFAULT_LAYOUT_IDS}
      badgeOf={() => 0}
      renderWidget={() => null}
      initialLayout={initialLayout}
    />,
  );
  return [...html.matchAll(/class="menu-tile-link" aria-label="([^"]+)"/g)].map((m) => m[1]);
}

describe("j23: IRISS izvēlnes režģis nepārkārtojas zem pirksta", () => {
  it("saglabātais servera izkārtojums ir jau pirmajā HTML (nav jāgaida fetch, kas vēlāk pārbīda ikonas)", () => {
    const saved: MenuLayout = [
      { id: "pasutijumi", size: "app" },
      { id: "pavadzimes", size: "app" },
      { id: "sludinajumi", size: "app" },
      { id: "w-logistika", size: "M" },
    ];
    expect(tileOrder(saved)).toEqual(["Pasūtījumi", "Pavadzīmes", "Sludinājumi", "Kravas un karte"]);
  });

  it("nav saglabāta (null) vai nav zināms (undefined): noklusējuma secība", () => {
    const def = tileOrder(undefined);
    expect(def[0]).toBe("Autoparks");
    expect(def).toContain("Pavadzīmes");
    expect(def).toContain("Loģistika");
    expect(def).not.toContain("Kravas un karte");
    expect(tileOrder(null)).toEqual(def);
    expect(tileOrder([])).toEqual(def);
  });

  it("nezināmas ikonas servera izkārtojumā tiek izmestas, pārējās paliek savā vietā", () => {
    expect(tileOrder([{ id: "nav-tadas", size: "app" }, { id: "vin", size: "app" }, { id: "pavadzimes", size: "app" }])).toEqual([
      "VIN pārbaude",
      "Pavadzīmes",
    ]);
  });
});
