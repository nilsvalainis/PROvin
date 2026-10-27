import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({ Barlow_Condensed: () => ({ className: "font", style: {} }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

import { DeleteCarButton } from "@/components/admin/iriss-autoparks-v2/AutoparksV2Cabinet";
import { renderHtml, renderText } from "@/lib/test-render";

describe("Autoparks v2 kabinets: «Dzēst auto» (create => delete)", () => {
  it("rāda sarkano kontūrpogu «Dzēst auto»", () => {
    expect(renderText(<DeleteCarButton carId="ap-1" title="Audi SQ5" />)).toContain("Dzēst auto");
    expect(renderHtml(<DeleteCarButton carId="ap-1" title="Audi SQ5" />)).toContain("iriss-btn--danger-outline");
  });
});
