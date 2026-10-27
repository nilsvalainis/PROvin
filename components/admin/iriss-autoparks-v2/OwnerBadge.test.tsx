import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({ Barlow_Condensed: () => ({ className: "font", style: {} }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

import { OwnerBadge } from "@/components/admin/iriss-autoparks-v2/AutoparksV2Cabinet";
import type { AutoparksV2Basics } from "@/lib/iriss-autoparks-v2";
import { renderHtml, renderText } from "@/lib/test-render";

const basics = (owner: "IRISS" | "DZA") => ({ id: "ap-1", owner }) as unknown as AutoparksV2Basics;

describe("Īpašnieka atzīme (makets B, Nils 27.10)", () => {
  it("pilni nosaukumi un krāsa pēc īpašnieka", () => {
    expect(renderText(<OwnerBadge basics={basics("IRISS")} canEdit={false} onBasics={() => {}} />)).toBe("SIA IRISS");
    expect(renderHtml(<OwnerBadge basics={basics("DZA")} canEdit={false} onBasics={() => {}} />)).toContain("ap2-owner-badge dza");
    expect(renderText(<OwnerBadge basics={basics("DZA")} canEdit={false} onBasics={() => {}} />)).toBe("SIA Dzintarzeme Auto");
  });

  it("ar tiesību - maināms (izvēle ar abiem pilnajiem nosaukumiem)", () => {
    const html = renderHtml(<OwnerBadge basics={basics("IRISS")} canEdit onBasics={() => {}} />);
    expect(html).toContain('aria-label="Īpašnieks"');
    expect(html).toContain("SIA Dzintarzeme Auto");
  });
});
