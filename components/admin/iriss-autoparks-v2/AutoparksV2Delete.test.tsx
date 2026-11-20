import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({ Barlow_Condensed: () => ({ className: "font", style: {} }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

import { DELETE_CAR_CONFIRM_LV, DeleteCarButton, RestoreFromArchiveButton } from "@/components/admin/iriss-autoparks-v2/AutoparksV2Cabinet";
import type { AutoparksV2Basics } from "@/lib/iriss-autoparks-v2";
import { renderHtml, renderText } from "@/lib/test-render";

describe("Autoparks v2 kabinets: «Dzēst auto» (create => delete)", () => {
  it("rāda sarkano kontūrpogu «Dzēst auto»", () => {
    expect(renderText(<DeleteCarButton carId="ap-1" title="Audi SQ5" />)).toContain("Dzēst auto");
    expect(renderHtml(<DeleteCarButton carId="ap-1" title="Audi SQ5" />)).toContain("iriss-btn--danger-outline");
  });

  it("apstiprinājumā skaidri: neatgriezeniski + pārdotam lietot statusu «Pārdots» (Nils 20.11)", () => {
    expect(DELETE_CAR_CONFIRM_LV).toBe("Dzēš neatgriezeniski ar visiem failiem. Pārdotam auto izmanto statusu «Pārdots» - tas pārceļ uz arhīvu.");
  });
});

describe("Autoparks v2 kabinets: «Atjaunot no arhīva» (Nils 20.11)", () => {
  it("rāda pogu", () => {
    const basics = { id: "ap-1", title: "Audi SQ5", status: "sold", statusLabel: "Pārdots", archived: true } as AutoparksV2Basics;
    expect(renderText(<RestoreFromArchiveButton basics={basics} onBasics={() => {}} />)).toContain("Atjaunot no arhīva");
  });
});
