import { describe, expect, it } from "vitest";
import { computeWaybillLifecycles } from "@/lib/iriss-pavadzimes-lifecycle";
import { rigaLocalToUtc } from "@/lib/iriss-pavadzimes-parse";
import { irissMobilePlateStripItems } from "@/lib/iriss-mobile-plate-strip";
import type { CsddPlatesDoc } from "@/lib/iriss-waybill-csdd-plates";
import { mergeCsddPlateStates } from "@/lib/iriss-waybill-csdd-plates";
import { composeWaybillPlateStates, type WaybillLiveRequest } from "@/lib/iriss-waybill-live-plates";
import { csddRefutesWaybill, waybillPlateOccupancy, withdrawnWaybillNos } from "@/lib/iriss-waybill-plates";

const iso = (y: number, m: number, d: number, h: number, mi: number) => rigaLocalToUtc(y, m, d, h, mi)!.toISOString();

/** j66: 25.10 pēc CSDD «Pārtraukt» P02818 (B193-7) un P02813 (B762-7) ir Arhīvā, CSDD active=[]. */
describe("j66 pārtrauktā pavadzīme neaizņem numuru", () => {
  const now = new Date(iso(2026, 10, 25, 13, 30));
  const p02818 = { number: "P02818", plate: "B193-7", issuedAt: iso(2026, 10, 25, 9, 0), validUntil: iso(2026, 10, 27, 9, 0) };
  const p02813 = { number: "P02813", plate: "B762-7", issuedAt: iso(2026, 10, 24, 10, 0), validUntil: iso(2026, 10, 26, 10, 0) };
  const p00750 = { number: "P00750", plate: "B192-7", issuedAt: iso(2026, 10, 25, 8, 0), validUntil: iso(2026, 10, 27, 8, 0) };
  const csdd = (active: Record<string, string[]>, checkedAt = iso(2026, 10, 25, 13, 20)): CsddPlatesDoc => ({
    version: 1,
    updatedAt: checkedAt,
    plates: Object.entries(active).map(([plate, nums]) => ({
      plate: plate as "B193-7",
      ok: true,
      checkedAt,
      error: "",
      active: nums.map((waybillNo) => ({ waybillNo, validUntil: iso(2026, 10, 27, 9, 0), brandModel: "" })),
    })),
  });
  const busyOf = (states: { plate: string; busy: boolean }[]) => Object.fromEntries(states.map((s) => [s.plate, s.busy]));

  it("archived=true ar validUntil nākotnē: lifecycle nav active, numurs nav aizņemts", () => {
    const a = { ...p02818, archived: true };
    const b = { ...p02813, archived: true };
    const m = computeWaybillLifecycles([a, b, p00750], now);
    expect(m.get(a)?.lifecycle).toBe("interrupted");
    expect(m.get(b)?.lifecycle).toBe("interrupted");
    expect(m.get(p00750)?.lifecycle).toBe("active");
    expect(busyOf(waybillPlateOccupancy([a, b, p00750], now))).toEqual({ "B193-7": false, "B762-7": false, "B192-7": true });
    expect(irissMobilePlateStripItems([a, b, p00750], now).map((i) => i.busy)).toEqual([false, false, true]);
  });

  it("CSDD active=[] (svaigs, pēc izdošanas): nav aizņemts un nav active, arī bez archived", () => {
    const doc = csdd({ "B193-7": [], "B762-7": [], "B192-7": ["P00750"] });
    const rows = [p02818, p02813, p00750];
    const states = mergeCsddPlateStates(waybillPlateOccupancy(rows, now, doc), doc, now.getTime());
    expect(busyOf(states)).toEqual({ "B193-7": false, "B762-7": false, "B192-7": true });
    const m = computeWaybillLifecycles(rows, now, doc);
    expect(m.get(p02818)?.lifecycle).toBe("interrupted");
    expect(m.get(p02813)?.lifecycle).toBe("interrupted");
    expect(m.get(p00750)?.lifecycle).toBe("active");
  });

  it("parasta dzīva pavadzīme joprojām aizņem numuru (arī ja CSDD to rāda kā aktīvu)", () => {
    const doc = csdd({ "B193-7": ["P02818"] });
    const states = mergeCsddPlateStates(waybillPlateOccupancy([p02818], now, doc), doc, now.getTime());
    expect(states.find((s) => s.plate === "B193-7")).toMatchObject({ busy: true, current: { number: "P02818" } });
    expect(computeWaybillLifecycles([p02818], now, doc).get(p02818)?.lifecycle).toBe("active");
  });

  it("CSDD nolasījums pirms izdošanas vai neizdevies - neatsauc (paliek aizņemts)", () => {
    const old = csdd({ "B193-7": [] }, iso(2026, 10, 25, 8, 0));
    expect(csddRefutesWaybill(old, p02818)).toBe(false);
    expect(busyOf(waybillPlateOccupancy([p02818], now, old))["B193-7"]).toBe(true);
    const failed: CsddPlatesDoc = { ...csdd({ "B193-7": [] }), plates: [{ ...csdd({ "B193-7": [] }).plates[0], ok: false }] };
    expect(csddRefutesWaybill(failed, p02818)).toBe(false);
    expect(csddRefutesWaybill(csdd({ "B193-7": [] }), { ...p02818, issuedAt: "" })).toBe(false);
    expect(csddRefutesWaybill(null, p02818)).toBe(false);
  });

  it("CSDD īsta aktīvā, kuras nav indeksā kā atsauktas, joprojām aizņem numuru", () => {
    const doc = csdd({ "B193-7": ["P02900"] });
    const rows = [{ ...p02818, archived: true }];
    const withdrawn = withdrawnWaybillNos(rows, doc);
    const states = mergeCsddPlateStates(waybillPlateOccupancy(rows, now, doc), doc, now.getTime(), withdrawn);
    expect(states.find((s) => s.plate === "B193-7")).toMatchObject({ busy: true, current: { number: "P02900" } });
  });
});

/** j66b: pēc #617 overlay slāņi (izdots pieprasījums, vecs CSDD active) atkal padarīja B193-7 aizņemtu. */
describe("j66b atsauktā pavadzīme overlay slāņos neaizņem numuru", () => {
  const now = new Date(iso(2026, 10, 25, 13, 30));
  const p02818 = { number: "P02818", plate: "B193-7", issuedAt: iso(2026, 10, 25, 9, 0), validUntil: iso(2026, 10, 27, 9, 0) };
  const csdd = (active: Record<string, string[]>, checkedAt = iso(2026, 10, 25, 13, 20)): CsddPlatesDoc => ({
    version: 1,
    updatedAt: checkedAt,
    plates: Object.entries(active).map(([plate, nums]) => ({
      plate: plate as "B193-7",
      ok: true,
      checkedAt,
      error: "",
      active: nums.map((waybillNo) => ({ waybillNo, validUntil: iso(2026, 10, 27, 9, 0), brandModel: "" })),
    })),
  });
  const issued: WaybillLiveRequest = {
    id: "wbr_p02818",
    status: "issued",
    createdAt: iso(2026, 10, 25, 9, 0),
    updatedAt: iso(2026, 10, 25, 9, 1),
    validUntil: "2026-10-26T14:51:30.131Z",
    waybillNo: "P02818",
    vehicle: { brandModel: "VW Tiguan", vin: "", plate: "B193-7", orderId: "" },
  };

  it("Arhīvs Dropbox + palicis izdots pieprasījums (request.validUntil): numurs brīvs", () => {
    const plates = composeWaybillPlateStates([{ ...p02818, archived: true }], csdd({ "B193-7": [] }), [issued], now);
    expect(plates.find((s) => s.plate === "B193-7")).toEqual({ plate: "B193-7", busy: false });
  });

  it("Arhīvs + vecs CSDD active ar to pašu nr.: numurs brīvs", () => {
    const plates = composeWaybillPlateStates([{ ...p02818, archived: true }], csdd({ "B193-7": ["P02818"] }), [], now);
    expect(plates.find((s) => s.plate === "B193-7")).toEqual({ plate: "B193-7", busy: false });
  });

  it("parasta dzīva pavadzīme joprojām aizņem numuru", () => {
    const plates = composeWaybillPlateStates([p02818], csdd({ "B193-7": ["P02818"] }), [issued], now);
    expect(plates.find((s) => s.plate === "B193-7")).toMatchObject({ busy: true, current: { number: "P02818" } });
  });

  it("CSDD īsta aktīvā bez Arhīva indeksā joprojām aizņem numuru", () => {
    const plates = composeWaybillPlateStates([], csdd({ "B193-7": ["P02812"] }), [], now);
    expect(plates.find((s) => s.plate === "B193-7")).toMatchObject({ busy: true, current: { number: "P02812" } });
  });
});
