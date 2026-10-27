import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }) }));

import { AutoparksV2Cela } from "@/components/admin/iriss-autoparks-v2/AutoparksV2Cela";
import { buildAutoparksTransit } from "@/lib/iriss-autoparks-transit";
import { renderHtml, renderText } from "@/lib/test-render";

const transit = buildAutoparksTransit(
  { id: "lo-1", auction: "auto1", pickupAddress: "Zörbig", pickupRef: "", stockNo: "KR57312", pickupDate: "", freeParkingUntil: "", status: "organize_pickup" },
  { stage: "in_transit", pickupCode: "", pickupDate: "" },
  null,
);

describe("Kabineta cilne «Ceļā»", () => {
  it("posmi, savākšana, krava; «Atvests» poga un saite uz Loģistiku", () => {
    const text = renderText(<AutoparksV2Cela transit={transit} />);
    for (const t of ["Gaida", "Ieplānots", "Ceļā", "Atvests", "Zörbig", "KR57312", "Nav kravā", "Atvests → Gaida sagatavošanu"]) expect(text).toContain(t);
    const html = renderHtml(<AutoparksV2Cela transit={transit} />);
    expect(html).toContain('href="/admin/iriss/logistika?car=lo-1"');
    expect(html).toMatch(/aria-current="step"[^>]*>.*Ceļā/);
  });

  it("bez rakstīšanas tiesības - tikai skats", () => {
    expect(renderText(<AutoparksV2Cela transit={transit} canWrite={false} />)).not.toContain("Atvests → Gaida sagatavošanu");
  });
});
