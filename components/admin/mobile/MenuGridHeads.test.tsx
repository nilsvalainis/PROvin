import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/iriss",
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, prefetch: () => undefined }),
}));

import { MenuGrid } from "@/components/admin/mobile/MenuGrid";
import type { MenuCatalogItem, MenuLayout } from "@/lib/admin-menu-layout";
import { renderHtml, renderText } from "@/lib/test-render";

const widgets: MenuCatalogItem[] = [
  {
    id: "w-logistika",
    kind: "widget",
    title: "Kravas un karte",
    href: "/admin/iriss/logistika",
    sizes: ["M"],
    defaultSize: "M",
    icon: "pin",
    tone: "#1a73e8",
    hideHead: true,
  },
  {
    id: "w-pavadzimes",
    kind: "widget",
    title: "Pavadzīmju termiņi",
    href: "/admin/iriss/pavadzimes",
    sizes: ["M"],
    defaultSize: "M",
    icon: "csdd",
    tone: "#006b3f",
    hideHead: true,
  },
];

const layout: MenuLayout = [
  { id: "w-logistika", size: "M" },
  { id: "w-pavadzimes", size: "M" },
];

describe("Pavadzīmes un Loģistika bez vidžeta virsraksta", () => {
  it("nerāda virsrakstu, bet aria-label paliek pieskārienam", () => {
    const html = renderHtml(
      <MenuGrid
        workspace="iriss"
        catalog={widgets}
        defaultIds={["w-logistika", "w-pavadzimes"]}
        badgeOf={() => 0}
        renderWidget={(item) => <span>SATURS {item.id}</span>}
        initialLayout={layout}
      />,
    );
    const text = renderText(
      <MenuGrid
        workspace="iriss"
        catalog={widgets}
        defaultIds={["w-logistika", "w-pavadzimes"]}
        badgeOf={() => 0}
        renderWidget={(item) => <span>SATURS {item.id}</span>}
        initialLayout={layout}
      />,
    );
    expect(html).toContain('aria-label="Kravas un karte"');
    expect(html).toContain('aria-label="Pavadzīmju termiņi"');
    expect(html).not.toContain("menu-widget-head");
    expect(text).not.toContain("Kravas un karte");
    expect(text).not.toContain("Pavadzīmju termiņi");
    expect(text).toContain("SATURS w-logistika");
  });
});
