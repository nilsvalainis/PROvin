import { describe, expect, it } from "vitest";

import { AdminThecarapiIngestBar } from "@/components/admin/AdminThecarapiIngestBar";
import { emptyCcVinBlock } from "@/lib/cc-vin-report";
import { renderText } from "@/lib/test-render";

const VIN = "WBA5R1C0XLFH42873";

describe("AdminThecarapiIngestBar", () => {
  it("izslēgtā stāvoklī nerāda ielādes pogu", () => {
    const text = renderText(
      <AdminThecarapiIngestBar
        orderVin={VIN}
        editable
        value={emptyCcVinBlock()}
        onChange={() => undefined}
        preset={{ enabled: false, used: 0, cap: 150, cachedSummary: "", cachedAt: "" }}
      />,
    );
    expect(text).toContain("TheCarApi izslēgts (nav apmaksāts / nav atslēgas)");
    expect(text).not.toContain("Ielādēt EU izsoles (TheCarApi)");
  });

  it("ieslēgtā stāvoklī rāda maksas pogu un mēneša skaitītāju", () => {
    const text = renderText(
      <AdminThecarapiIngestBar
        orderVin={VIN}
        editable
        value={emptyCcVinBlock()}
        onChange={() => undefined}
        preset={{ enabled: true, used: 3, cap: 150, cachedSummary: "", cachedAt: "" }}
      />,
    );
    expect(text).toContain("Ielādēt EU izsoles (TheCarApi)");
    expect(text).toContain("Atjaunot no jauna");
    expect(text).toContain("maksas izsaukums · šomēnes 3/150");
  });

  it("kešatmiņā rāda Atjaunot (maksas)", () => {
    const text = renderText(
      <AdminThecarapiIngestBar
        orderVin={VIN}
        editable
        value={emptyCcVinBlock()}
        onChange={() => undefined}
        preset={{
          enabled: true,
          used: 3,
          cap: 150,
          cachedSummary: "Openlane, 2024, 1 ieraksti",
          cachedAt: "2026-11-01T00:00:00.000Z",
        }}
      />,
    );
    expect(text).toContain("Atjaunot (maksas)");
    expect(text).toContain("Kešs: Openlane, 2024, 1 ieraksti");
  });
});
