import { describe, expect, it, vi } from "vitest";

const path = { current: "/admin/iriss/pavadzimes" };
vi.mock("next/navigation", () => ({ usePathname: () => path.current }));

import { AdminShellLayoutContext } from "@/components/admin/AdminShellLayoutContext";
import { IrissRouteLoadingBack, irissLoadingBackHref } from "@/components/admin/IrissRouteLoadingBack";
import { renderHtml } from "@/lib/test-render";

const shell = (workspace: "iriss" | "pro") => ({ sidebarCollapsed: false, expandSidebar: () => undefined, workspace, theme: "light" as const });

describe("j23: atpakaļ poga ir jau ielādes skeletā", () => {
  it("IRISS sadaļās ved uz izvēlni; pašā izvēlnē, PRO un darbiniekiem (bez admin čaulas) nav", () => {
    expect(irissLoadingBackHref("/admin/iriss/pavadzimes", "iriss")).toBe("/admin/iriss");
    expect(irissLoadingBackHref("/admin/iriss/pasutijumi/abc", "iriss")).toBe("/admin/iriss");
    expect(irissLoadingBackHref("/admin/iriss", "iriss")).toBeNull();
    expect(irissLoadingBackHref("/admin/iriss/", "iriss")).toBeNull();
    expect(irissLoadingBackHref("/admin/iriss/pavadzimes", "pro")).toBeNull();
    expect(irissLoadingBackHref("/admin/iriss/pavadzimes", null)).toBeNull();
  });

  it("renderē 44x44 saiti uz /admin/iriss tikai IRISS admin čaulā", () => {
    path.current = "/admin/iriss/pavadzimes";
    const html = renderHtml(
      <AdminShellLayoutContext.Provider value={shell("iriss")}>
        <IrissRouteLoadingBack />
      </AdminShellLayoutContext.Provider>,
    );
    expect(html).toContain('href="/admin/iriss"');
    expect(html).toContain('aria-label="Atpakaļ"');
    expect(html).toContain("h-11 w-11");
    expect(renderHtml(<IrissRouteLoadingBack />)).toBe("");
    path.current = "/admin/iriss";
    expect(
      renderHtml(
        <AdminShellLayoutContext.Provider value={shell("iriss")}>
          <IrissRouteLoadingBack />
        </AdminShellLayoutContext.Provider>,
      ),
    ).toBe("");
  });
});
