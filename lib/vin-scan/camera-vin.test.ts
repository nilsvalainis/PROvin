import { describe, expect, it } from "vitest";
import {
  VIN_SCAN_HISTORY_MAX,
  cameraVinCandidates,
  parseVinScanHistory,
  pickCameraVin,
  pushVinScanHistory,
  vinScanHistoryInfo,
} from "@/lib/vin-scan/camera-vin";

describe("camera VIN", () => {
  it("atrod VIN ar atstarpēm un O→0", () => {
    expect(cameraVinCandidates("WBA 3A5C5 0CF256 551")).toContain("WBA3A5C50CF256551");
    expect(cameraVinCandidates("1M8GDM9AXKP042788")).toContain("1M8GDM9AXKP042788");
  });

  it("dod priekšroku VIN ar pareizu kontrolciparu", () => {
    const pick = pickCameraVin(["XX 1M8GDM9AXKP042788 1M8GDM9AXKP042789"]);
    expect(pick?.vin).toBe("1M8GDM9AXKP042788");
    expect(pick?.checkDigitOk).toBe(true);
  });

  it("bez trāpījuma - null", () => {
    expect(pickCameraVin(["nav teksta"])).toBeNull();
  });

  it("vēsture: jaunākais augšā, bez dublikātiem, ne vairāk kā 15", () => {
    let list = pushVinScanHistory([], "1M8GDM9AXKP042788", "2026-10-21T10:00:00Z");
    list = pushVinScanHistory(list, "WBA3A5C50CF256551", "2026-10-21T10:01:00Z");
    list = pushVinScanHistory(list, "1M8GDM9AXKP042788", "2026-10-21T10:02:00Z");
    expect(list.map((e) => e.vin)).toEqual(["1M8GDM9AXKP042788", "WBA3A5C50CF256551"]);
    for (let i = 0; i < 30; i++) list = pushVinScanHistory(list, `WBA3A5C50CF2565${String(10 + i)}`, "x");
    expect(list.length).toBeLessThanOrEqual(VIN_SCAN_HISTORY_MAX);
    expect(parseVinScanHistory(JSON.stringify(list)).length).toBe(list.length);
    expect(parseVinScanHistory("bojāts")).toEqual([]);
  });

  it("WMI info", () => {
    expect(vinScanHistoryInfo("WBA3A5C50CF256551")).toMatch(/BMW/);
  });
});

describe("camera VIN rangs", () => {
  it("VIN prefikss nepārspēj īsto VIN", () => {
    const pick = pickCameraVin(["VNWBA3A5C50CF256551\n", "VNWBA3A5C50CF256551\n", "VNWBA3A5CS50CF256551\n"]);
    expect(pick?.vin).toBe("WBA3A5C50CF256551");
  });
});
