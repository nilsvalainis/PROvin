import { describe, expect, it } from "vitest";
import {
  atraFreeGroups,
  atraFreeSourceIds,
  atraHistoryDate,
  atraHistoryToCsv,
  atraHrefFromDealerParams,
  atraPaidCost,
  atraRunLabel,
  formatAtraCost,
  mergeAtraHistory,
  parseAtraHistoryMeta,
  parseAtraQuery,
  pushAtraHistory,
} from "@/lib/atra-parbaude";
import type { DealerCheckHistoryEntry } from "@/lib/dealer-check-history";

const VIN = "WBANP71040CY09201";

function dealerEntry(over: Partial<DealerCheckHistoryEntry> = {}): DealerCheckHistoryEntry {
  return {
    id: "dc-abcdef123456",
    vin: VIN,
    plate: "OP4475",
    template: "dzintarzeme",
    createdAt: "2026-11-23T08:14:00.000Z",
    fetchedAt: "2026-11-23T08:14:00.000Z",
    createdBy: "env-admin",
    status: "open",
    orderId: "",
    chargedCents: 300,
    hasData: true,
    autoparksTitle: "",
    ...over,
  };
}

describe("Ātrā pārbaude - avoti", () => {
  it("bezmaksas avoti bez maksas API; TheCarApi tikai, ja paketē ieslēgts", () => {
    const off = atraFreeSourceIds(false);
    const on = atraFreeSourceIds(true);
    expect(off).not.toContain("thecarapi_eu");
    expect(off).not.toContain("joj_copart_iaai");
    expect(on).toContain("thecarapi_eu");
    expect(on.length).toBe(off.length + 1);
  });

  it("grupas aptver visus bezmaksas avotus tieši vienreiz", () => {
    const groups = atraFreeGroups(true);
    const ids = groups.flatMap((g) => g.items.map((i) => i.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...atraFreeSourceIds(true)].sort());
    expect(groups.find((g) => g.id === "izsoles")?.items[0]?.id).toBe("thecarapi_eu");
  });

  it("maksas kopsumma pirms palaišanas: noklusējums 0, OneAuto + JoJ ar «~», Speckr kredīts", () => {
    expect(atraPaidCost([])).toEqual({ cents: 0, approx: false, speckrCredits: 0, count: 0 });
    expect(atraRunLabel(atraPaidCost([]))).toBe("Pārbaudīt");
    const one = atraPaidCost(["oe_service_history"]);
    expect(formatAtraCost(one)).toBe("3,00 €");
    expect(atraRunLabel(one)).toBe("Pārbaudīt · 3,00 €");
    const mix = atraPaidCost(["oe_service_history", "joj_copart_iaai", "speckr"]);
    expect(mix.cents).toBe(346);
    expect(formatAtraCost(mix)).toBe("~3,46 € + 1 Speckr kredīts");
  });
});

describe("Ātrā pārbaude - ievade un pāradresācija", () => {
  it("viens lauks: VIN vai LV numurs", () => {
    expect(parseAtraQuery(VIN.toLowerCase())).toEqual({ kind: "vin", vin: VIN });
    expect(parseAtraQuery("op4475")).toEqual({ kind: "plate", plate: "OP4475" });
    expect(parseAtraQuery("??")).toEqual({ kind: "none" });
  });

  it("/admin/dilera-dati parametri pāriet uz /admin/vin-scan", () => {
    expect(atraHrefFromDealerParams(undefined)).toBe("/admin/vin-scan?skats=dilera");
    expect(atraHrefFromDealerParams({ vin: VIN, no: "autoparks" })).toBe(`/admin/vin-scan?vin=${VIN}&no=autoparks&skats=dilera`);
    expect(atraHrefFromDealerParams({ id: "dc-abcdef123456" })).toBe("/admin/vin-scan?id=dc-abcdef123456&skats=dilera");
    expect(atraHrefFromDealerParams({ id: "../x", vn: "AB1234" })).toBe("/admin/vin-scan?vn=AB1234&skats=dilera");
  });
});

describe("Ātrā pārbaude - vēsture", () => {
  it("meta: tikai drošas vērtības", () => {
    expect(parseAtraHistoryMeta({ plate: "op4475", potential: "augsts", costCents: 46.4, orderId: "x y", dealerCheckId: "bad" })).toEqual({
      plate: "OP4475",
      potential: "augsts",
      costCents: 46,
    });
  });

  it("jauns ieraksts bez meta patur iepriekšējos laukus, ar meta - pārraksta", () => {
    let list = pushAtraHistory([], VIN, "2026-11-23T08:00:00Z", { plate: "OP4475", title: "BMW 530" });
    list = pushAtraHistory(list, VIN, "2026-11-23T08:05:00Z", null);
    expect(list).toEqual([{ vin: VIN, at: "2026-11-23T08:05:00Z", plate: "OP4475", title: "BMW 530" }]);
    list = pushAtraHistory(list, VIN, "2026-11-23T08:06:00Z", { orderId: "ord1" });
    expect(list[0]?.orderId).toBe("ord1");
    expect(list[0]?.title).toBe("BMW 530");
  });

  it("apvieno abas krātuves; piesaistītais dīlera ieraksts nedublējas, maksa saskaitās", () => {
    const rows = mergeAtraHistory(
      [
        { vin: VIN, at: "2026-11-23T08:15:00Z", title: "BMW 530", costCents: 46, dealerCheckId: "dc-abcdef123456" },
        { vin: "WAUZZZ4G0EN112604", at: "2026-11-22T15:40:00Z" },
      ],
      [dealerEntry(), dealerEntry({ id: "dc-zzzzzz999999", vin: "WVWZZZ3CZEE000001", plate: "NE6693", createdAt: "2026-11-21T10:02:00Z", orderId: "1208", chargedCents: 336 })],
    );
    expect(rows.map((r) => r.vin)).toEqual([VIN, "WAUZZZ4G0EN112604", "WVWZZZ3CZEE000001"]);
    expect(rows[0]).toMatchObject({ costCents: 346, plate: "OP4475", dealerCheckId: "dc-abcdef123456", href: "/admin/vin-scan?id=dc-abcdef123456" });
    expect(rows[1]?.href).toBe("/admin/vin-scan?vin=WAUZZZ4G0EN112604");
    expect(rows[2]).toMatchObject({ orderId: "1208", costCents: 336 });
    const csv = atraHistoryToCsv(rows);
    expect(csv.split("\n")[0]).toBe("datums,vin,numurzime,auto,potencials,maksa,sablons,pasutijuma_id,dilera_parbaude");
    expect(csv).toContain("3,46 €");
  });

  it("datums tabulai Rīgas laikā", () => {
    expect(atraHistoryDate("2026-11-23T08:14:00Z")).toBe("23.11 10:14");
  });
});
