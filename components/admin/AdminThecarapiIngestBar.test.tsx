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

  it("ieslēgtā stāvoklī rāda pogu un paketes skaitītāju bez vārda «maksas»", () => {
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
    expect(text).toContain("paketē · šomēnes 3 no 100 000");
    expect(text).not.toContain("maksas");
  });

  it("saglabātai vēsturei ar detaļām rāda «Pārbaudīt vēlreiz»", () => {
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
          cachedStatus: "found",
          cacheHasDetail: true,
        }}
      />,
    );
    expect(text).toContain("Pārbaudīt vēlreiz");
    expect(text).toContain("Saglabāts: Openlane, 2024, 1 ieraksti · 2026-11-01");
    expect(text).not.toContain("maksas");
  });

  it("vēsture atrada izsoles, detaļu nav: «Ielādēt detaļas»", () => {
    const text = renderText(
      <AdminThecarapiIngestBar
        orderVin={VIN}
        editable
        value={emptyCcVinBlock()}
        onChange={() => undefined}
        preset={{
          enabled: true,
          used: 188,
          cap: 0,
          cachedSummary: "AUTO1, 2026, 1 ieraksti",
          cachedAt: "2026-11-17T00:00:00.000Z",
          cachedStatus: "found",
          cacheHasDetail: false,
        }}
      />,
    );
    expect(text).toContain("Ielādēt detaļas");
    expect(text).toContain("paketē · šomēnes 188 no 100 000");
  });

  it("TheCarApi neatrada izsoles: skaidrs teksts, nav «Ielādēt detaļas» un nav «Kešs: nav ierakstu»", () => {
    const text = renderText(
      <AdminThecarapiIngestBar
        orderVin={VIN}
        editable
        value={emptyCcVinBlock()}
        onChange={() => undefined}
        preset={{
          enabled: true,
          used: 188,
          cap: 0,
          cachedSummary: "nav ierakstu",
          cachedAt: "2026-11-26T10:00:00.000Z",
          cachedStatus: "none",
          cacheHasDetail: false,
        }}
      />,
    );
    expect(text).toContain("TheCarApi šim VIN izsoles neatrada (pārbaudīts 2026-11-26)");
    expect(text).not.toContain("Ielādēt detaļas");
    expect(text).not.toContain("Kešs:");
    expect(text).toContain("Pārbaudīt vēlreiz");
  });
});
