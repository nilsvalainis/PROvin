/** 27.11.2026 (WVWZZZ3CZNE054721): izsoļu tabulā 11.11.2026, izsoles kartītē 12.11.2026 - viens datums visur. */
import { describe, expect, it } from "vitest";
import { alignCcVinSaleDatesWithRecords, normalizeCcVinBlock } from "@/lib/cc-vin-report";

const sale = (date: string, id: string) => ({ date, venue: "Openlane", odometer: "151 255 km", price: "8 300 EUR", status: `Openlane · ${id}` });

describe("izsoļu vēstures datums = izsoles ieraksta datums", () => {
  it("last_seen (11.11) -> izsoles beigas (12.11); sakrītošs un nesaistīts paliek", () => {
    const out = alignCcVinSaleDatesWithRecords(
      [sale("11.11.2026", "11835156"), sale("10.11.2026", "11825905"), sale("05.11.2026", "99999")],
      [
        { id: "11835156", date: "2026-11-12" },
        { id: "11825905", date: "2026-11-10" },
      ],
    );
    expect(out.map((r) => r.date)).toEqual(["12.11.2026", "10.11.2026", "05.11.2026"]);
  });
  it("lielāka atšķirība par 7 dienām - nemainām", () => {
    expect(alignCcVinSaleDatesWithRecords([sale("01.10.2026", "1")], [{ id: "1", date: "2026-11-12" }])[0]!.date).toBe("01.10.2026");
  });
  it("normalizeCcVinBlock izlīdzina saglabātos datus", () => {
    const b = normalizeCcVinBlock({
      sales: [sale("08.10.2026", "11652624")],
      thecarapiRecords: [{ site: "openlane", id: "11652624", date: "2026-10-09", venue: "Openlane", fields: [], photos: [], photoUrls: [] }],
    });
    expect(b.sales[0]!.date).toBe("09.10.2026");
  });
});
