import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({ Barlow_Condensed: () => ({ className: "font", style: {} }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));

import { activeWaybillForCar, AutoparksV2Waybill } from "@/components/admin/iriss-autoparks-v2/AutoparksV2Waybill";
import { renderHtml, renderText } from "@/lib/test-render";

describe("Autoparka kartīte: «Pavadzīme» (Nils 27.10)", () => {
  it("bez derīgas pavadzīmes rāda pogu «Pavadzīme»", () => {
    const text = renderText(<AutoparksV2Waybill car={{ title: "BMW iX", vin: "WBY11CF060CM04850" }} />);
    expect(text).toContain("Pavadzīme");
    expect(renderHtml(<AutoparksV2Waybill car={{ title: "BMW iX", vin: "WBY11CF060CM04850" }} />)).toContain("data-autoparks-waybill");
  });

  it("atrod šī auto derīgo pavadzīmi pēc VIN (beigušās un arhīvā neskaita)", () => {
    const now = Date.parse("2026-10-27T10:00:00Z");
    const rows = [
      { vin: "WBY11CF060CM04850", validUntil: "2026-10-26T10:00:00Z", archived: false },
      { vin: "wby11cf060cm04850", validUntil: "2026-10-28T13:30:00Z", archived: false },
      { vin: "WBY11CF060CM04850", validUntil: "2026-10-29T10:00:00Z", archived: true },
      { vin: "TMBJJ7NS0K1234567", validUntil: "2026-10-30T10:00:00Z", archived: false },
    ];
    expect(activeWaybillForCar(rows, "WBY11CF060CM04850", now)).toBe(1);
    expect(activeWaybillForCar(rows, "", now)).toBe(-1);
  });
});
