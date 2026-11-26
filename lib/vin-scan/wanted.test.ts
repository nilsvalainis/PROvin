import { describe, expect, it } from "vitest";

import { classifyBrowserProbe } from "@/lib/vin-scan/browser-classify";
import { isVinScanSourceId, VIN_SCAN_REMOVED_IDS } from "@/lib/vin-scan/catalog";
import {
  isVinScanWantedSource,
  vinScanWantedDotClass,
  vinScanWantedStatusLabel,
  vinScanWantedTileClass,
} from "@/lib/vin-scan/wanted";

const VIN = "WVWZZZ3CZWE123456";

describe("policijas meklētie TL", () => {
  it("statusa teksti un krāsas", () => {
    expect(vinScanWantedStatusLabel("none")).toBe("Nav meklēšanā");
    expect(vinScanWantedDotClass("none")).toBe("bg-emerald-500");
    expect(vinScanWantedStatusLabel("found")).toBe("Meklēšanā");
    expect(vinScanWantedDotClass("found")).toBe("bg-rose-600");
    expect(vinScanWantedStatusLabel("unknown")).toBe("");
  });

  it("Lietuvas policija (lt_itpr) izņemta pilnībā", () => {
    expect(isVinScanSourceId("lt_itpr")).toBe(false);
    expect((VIN_SCAN_REMOVED_IDS as readonly string[]).includes("lt_itpr")).toBe(true);
    expect(isVinScanWantedSource("lt_itpr")).toBe(false);
    expect(vinScanWantedTileClass("lt_itpr", "found")).toBe("");
    expect(classifyBrowserProbe("lt_itpr", `Ieškoma transporto priemonė ${VIN}. Paieškos priežastis: vagystė.`, VIN)).toBeNull();
    expect(isVinScanWantedSource("plc_auction")).toBe(false);
  });
});
