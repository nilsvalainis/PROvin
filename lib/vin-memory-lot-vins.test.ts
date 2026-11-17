import { describe, expect, it } from "vitest";

import { applyLotVinResult, emptyLotVinQueue, enqueueLotsWithoutVin, mapLotVinRelayResponse, pickLotVinBatch } from "@/lib/vin-memory-lot-vins";

const now = new Date("2026-11-18T01:00:00Z");
const ol = (id: string, vin = "") => ({ platform: "openline" as const, externalId: id, detailUrl: `https://www.openlane.eu/en/car/info?auctionId=${id}`, vin, title: "Mercedes GLA", mileageKm: 307468 });

describe("lotu VIN rinda", () => {
  it("rindā nonāk tikai lotes bez VIN ar derīgu lotes lapu, un tikai vienreiz", () => {
    const lots = [ol("11862697"), ol("11862698", "W1N2477121J329770"), { platform: "autobid" as const, externalId: "1", detailUrl: "https://evil.example/item/x" }];
    const first = enqueueLotsWithoutVin(emptyLotVinQueue(now), lots, "2026-11-18", now);
    expect(first.added).toBe(1);
    expect(first.queue.pending.map((p) => p.key)).toEqual(["openline:11862697"]);
    expect(enqueueLotsWithoutVin(first.queue, lots, "2026-11-18", now).added).toBe(0);
  });

  it("atrasts VIN kļūst par novērojumu, lote vairs netiek prasīta", () => {
    const q = enqueueLotsWithoutVin(emptyLotVinQueue(now), [ol("11862697"), ol("11862699")], "2026-11-18", now).queue;
    const picked = pickLotVinBatch(q, now)!;
    expect(picked.platform).toBe("openline");
    const relay = mapLotVinRelayResponse(200, {
      ok: true,
      status: "ok",
      note: "",
      results: picked.items.map((item, i) => ({ url: item.url, status: i === 0 ? "ok" : "no_vin", vin: i === 0 ? "w1n2477121j329770" : "329770", mileageKm: 307468, firstRegistration: "2021-12-14", title: "" })),
    });
    const out = applyLotVinResult(q, picked, relay, "2026-11-18", now);
    expect(out.inputs).toHaveLength(1);
    expect(out.inputs[0]).toMatchObject({ vin: "W1N2477121J329770", source: "openline", km: 307468, model: "Mercedes GLA", date: "2026-11-18" });
    expect(out.queue.pending).toHaveLength(0);
    expect(out.queue.totals).toMatchObject({ asked: 2, vins: 1, noVin: 1 });
    expect(enqueueLotsWithoutVin(out.queue, [ol("11862697")], "2026-11-19", now).added).toBe(0);
  });

  it("pārtraukta partija: neapstrādātās lotes nezaudē mēģinājumus, īsta kļūda zaudē", () => {
    const q = enqueueLotsWithoutVin(emptyLotVinQueue(now), [ol("11862697")], "2026-11-18", now).queue;
    const picked = pickLotVinBatch(q, now)!;
    const row = { url: picked.items[0]!.url, status: "error", vin: "", mileageKm: null, firstRegistration: "", title: "" };
    const cut = applyLotVinResult(q, picked, mapLotVinRelayResponse(200, { ok: true, status: "blocked", note: "blocked: captcha", results: [row] }), "2026-11-18", now);
    expect(cut.queue.pending[0]!.attempts).toBe(0);
    const real = applyLotVinResult(q, picked, mapLotVinRelayResponse(200, { ok: true, status: "ok", note: "", results: [row] }), "2026-11-18", now);
    expect(real.queue.pending[0]!.attempts).toBe(1);
  });

  it("dienas limits vai login: lotes paliek rindā un platforma ir pauzē", () => {
    const q = enqueueLotsWithoutVin(emptyLotVinQueue(now), [ol("11862697")], "2026-11-18", now).queue;
    const picked = pickLotVinBatch(q, now)!;
    const out = applyLotVinResult(q, picked, mapLotVinRelayResponse(429, { ok: false, error: "dienas limits 300 lotu VIN" }), "2026-11-18", now);
    expect(out.inputs).toHaveLength(0);
    expect(out.queue.pending).toHaveLength(1);
    expect(pickLotVinBatch(out.queue, now)).toBeNull();
  });
});
