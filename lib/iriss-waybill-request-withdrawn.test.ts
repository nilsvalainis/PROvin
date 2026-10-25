/**
 * FABLE 25.10: izdots pieprasījums (rindā "issued"), kura PDF vēl nav Dropbox indeksā, pēc CSDD «Pārtraukt»
 * (active=[] ar nolasījumu pēc izdošanas) palika "aizņemts" līdz validUntil, un jaunai pavadzīmei prasīja anulēt.
 */
import { describe, expect, it } from "vitest";
import { rigaLocalToUtc } from "@/lib/iriss-pavadzimes-parse";
import type { CsddPlatesDoc } from "@/lib/iriss-waybill-csdd-plates";
import {
  composeWaybillPlateStates,
  csddWithdrawnRequestNos,
  unionWithdrawnNos,
  withWaybillRequestStates,
  type WaybillLiveRequest,
} from "@/lib/iriss-waybill-live-plates";
import { emptyWaybillPlateStates } from "@/lib/iriss-waybill-plates";

const iso = (d: number, h: number, mi = 0) => rigaLocalToUtc(2026, 10, d, h, mi)!.toISOString();
const now = new Date(iso(25, 14, 0));

const issued = (over: Partial<WaybillLiveRequest> = {}): WaybillLiveRequest => ({
  id: "wbr_p99902",
  status: "issued",
  createdAt: iso(25, 9, 0),
  updatedAt: iso(25, 9, 5),
  validFrom: iso(25, 9, 4),
  validUntil: iso(27, 9, 4),
  waybillNo: "P99902",
  vehicle: { brandModel: "VW Tiguan", vin: "", plate: "B192-7", orderId: "" },
  ...over,
});

const csdd = (active: string[], checkedAt: string, ok = true): CsddPlatesDoc => ({
  version: 1,
  updatedAt: checkedAt,
  plates: [
    {
      plate: "B192-7",
      ok,
      checkedAt,
      error: "",
      active: active.map((waybillNo) => ({ waybillNo, validUntil: iso(27, 9, 4), brandModel: "" })),
    },
  ],
});

const b192 = (states: { plate: string; busy: boolean }[]) => states.find((s) => s.plate === "B192-7")?.busy;

describe("izdots pieprasījums bez indeksa rindas + CSDD Pārtraukt", () => {
  it("CSDD active=[] pēc izdošanas: numurs brīvs (apļi, pogas, POST 409 pārbaude)", () => {
    const doc = csdd([], iso(25, 13, 50));
    const req = issued();
    expect([...csddWithdrawnRequestNos([req], doc)]).toEqual(["P99902"]);
    expect(b192(composeWaybillPlateStates([], doc, [req], now))).toBe(false);
    const withdrawn = unionWithdrawnNos(new Set(), csddWithdrawnRequestNos([req], doc));
    expect(b192(withWaybillRequestStates(emptyWaybillPlateStates(), [req], now.getTime(), withdrawn))).toBe(false);
  });

  it("CSDD vēl rāda aktīvu: aizņemts", () => {
    const doc = csdd(["P99902"], iso(25, 13, 50));
    expect(csddWithdrawnRequestNos([issued()], doc).size).toBe(0);
    expect(b192(composeWaybillPlateStates([], doc, [issued()], now))).toBe(true);
  });

  it("CSDD nolasījums pirms izdošanas vai neizdevies: neatsauc (paliek aizņemts)", () => {
    expect(b192(composeWaybillPlateStates([], csdd([], iso(25, 9, 0)), [issued()], now))).toBe(true);
    expect(b192(composeWaybillPlateStates([], csdd([], iso(25, 13, 50), false), [issued()], now))).toBe(true);
    expect(b192(composeWaybillPlateStates([], null, [issued()], now))).toBe(true);
  });

  it("bez validFrom izmanto updatedAt (vēlāko) - vajag jaunāku CSDD nolasījumu", () => {
    const req = issued({ validFrom: "", updatedAt: iso(25, 13, 55) });
    expect(b192(composeWaybillPlateStates([], csdd([], iso(25, 13, 50)), [req], now))).toBe(true);
    expect(b192(composeWaybillPlateStates([], csdd([], iso(25, 13, 58)), [req], now))).toBe(false);
  });

  it("rindā vēl Gaida / Izveido - neietekmē (tikai issued)", () => {
    const doc = csdd([], iso(25, 13, 50));
    expect(csddWithdrawnRequestNos([issued({ status: "queued" }), issued({ status: "in_progress" })], doc).size).toBe(0);
  });
});
