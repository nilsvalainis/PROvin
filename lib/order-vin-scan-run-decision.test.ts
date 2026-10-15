import { describe, expect, it } from "vitest";

import {
  ORDER_VIN_SCAN_DEDUPE_MS,
  ORDER_VIN_SCAN_STUCK_MS,
  orderVinScanAlreadyDone,
  orderVinScanDedupeKey,
  orderVinScanRunningIsStuck,
  orderVinScanSourceNeedsRescan,
  resetOrderVinScanSlots,
  takeOrderVinScanSlot,
} from "@/lib/order-vin-scan-run-decision";

describe("VIN SCAN palaišanas lēmumi", () => {
  it("running vecāks par 10 min ir iestrēdzis", () => {
    const now = Date.parse("2026-10-15T12:00:00.000Z");
    expect(orderVinScanRunningIsStuck("2026-10-15T11:51:00.000Z", now)).toBe(false);
    expect(orderVinScanRunningIsStuck(new Date(now - ORDER_VIN_SCAN_STUCK_MS).toISOString(), now)).toBe(true);
    expect(orderVinScanRunningIsStuck("nav-datums", now)).toBe(true);
  });

  it("already_done ignorē unknown, timeout un blocked", () => {
    expect(orderVinScanAlreadyDone([])).toBe(false);
    expect(orderVinScanAlreadyDone([{ status: "found" }, { status: "none" }, { status: "browser_only" }])).toBe(true);
    expect(orderVinScanAlreadyDone([{ status: "found" }, { status: "unknown" }])).toBe(false);
    expect(orderVinScanSourceNeedsRescan("timeout")).toBe(true);
    expect(orderVinScanSourceNeedsRescan("blocked")).toBe(true);
    expect(orderVinScanSourceNeedsRescan("config_missing")).toBe(false);
    expect(orderVinScanSourceNeedsRescan("browser_only")).toBe(false);
  });

  it("viena sesija un VIN 60 s dala to pašu solījumu, force sāk jaunu", async () => {
    resetOrderVinScanSlots();
    const key = orderVinScanDedupeKey(" cs_1 ", "wba5r1c0xlfh42873");
    expect(key).toBe("cs_1:WBA5R1C0XLFH42873");
    let calls = 0;
    const now = 1_000_000;
    const first = takeOrderVinScanSlot(key, false, async () => {
      calls += 1;
      return "a";
    }, now);
    const second = takeOrderVinScanSlot(key, false, async () => {
      calls += 1;
      return "b";
    }, now + 1_000);
    expect(await first).toBe("a");
    expect(await second).toBe("a");
    expect(calls).toBe(1);
    const third = takeOrderVinScanSlot(key, false, async () => {
      calls += 1;
      return "c";
    }, now + ORDER_VIN_SCAN_DEDUPE_MS);
    expect(await third).toBe("c");
    const forced = takeOrderVinScanSlot(key, true, async () => "d", now + ORDER_VIN_SCAN_DEDUPE_MS);
    expect(await forced).toBe("d");
    resetOrderVinScanSlots();
  });
});
