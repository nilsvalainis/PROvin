import { describe, expect, it } from "vitest";
import {
  applyBusinessPogaEvent,
  businessPogaDateRange,
  emptyBusinessPogaDay,
  parseBusinessPogaDay,
  summarizeBusinessPoga,
  UNKNOWN_PARTNER,
  type BusinessPogaEvent,
} from "@/lib/business-poga-stats";

const DZA = "ptr_1d061c48be30f728";
const A2K = "ptr_886cad5d589c097c";
const VIN = "WAUZZZFY7H2024825";

function day(date: string, events: BusinessPogaEvent[]) {
  return events.reduce(applyBusinessPogaEvent, emptyBusinessPogaDay(date));
}

describe("Business pogas uzskaite", () => {
  it("skaita klikšķus, apmaksas sākumus un bloķētos pa partneriem un auto", () => {
    const d = day("2026-11-05", [
      { type: "click", partnerId: DZA, vin: VIN, title: "Audi Q5" },
      { type: "click", partnerId: DZA, vin: VIN },
      { type: "started", partnerId: DZA, vin: VIN },
      { type: "blocked", partnerId: DZA, reason: "vehicle_missing" },
      { type: "blocked", partnerId: DZA, reason: "vehicle_missing" },
    ]);
    expect(d.partners[DZA]).toEqual({ clicks: 2, started: 1, blocked: { vehicle_missing: 2 } });
    expect(d.cars[`${DZA}|${VIN}`]).toMatchObject({ clicks: 2, started: 1, title: "Audi Q5" });
  });

  it("viltotus partneru ID saskaita vienā kopējā rindā un auto nepieraksta", () => {
    const d = day("2026-11-05", [{ type: "blocked", partnerId: "ptr_<script>", reason: "partner", vin: VIN }]);
    expect(Object.keys(d.partners)).toEqual([UNKNOWN_PARTNER]);
    expect(d.cars).toEqual({});
  });

  it("saglabātā diena pēc nolasīšanas ir tāda pati, nederīgi ieraksti izmesti", () => {
    const d = day("2026-11-05", [{ type: "click", partnerId: DZA, vin: VIN, title: "Audi Q5" }]);
    const raw = JSON.parse(JSON.stringify(d));
    raw.partners["evil"] = { clicks: 99 };
    expect(parseBusinessPogaDay(raw, "2026-11-05")).toEqual(d);
  });

  it("kopsavilkums: konversija apmaksāti/klikšķi, ieņēmumi no Stripe, periods un partnera filtrs", () => {
    const days = [
      day("2026-10-31", [{ type: "click", partnerId: DZA, vin: VIN }]),
      day("2026-11-05", [
        { type: "click", partnerId: DZA, vin: VIN, title: "Audi Q5" },
        { type: "click", partnerId: DZA, vin: VIN },
        { type: "click", partnerId: A2K, vin: "WDC1671191A000001" },
        { type: "blocked", partnerId: A2K, reason: "referer" },
      ]),
    ];
    const sales = [
      { partnerId: DZA, created: Date.parse("2026-11-05T10:00:00Z") / 1000, amountCents: 6999, vin: VIN },
      { partnerId: DZA, created: Date.parse("2026-10-20T10:00:00Z") / 1000, amountCents: 6999, vin: VIN },
    ];
    const s = summarizeBusinessPoga(days, sales, { from: "2026-11-01", to: "2026-11-30" });
    expect(s.totals).toMatchObject({ clicks: 3, blocked: 1, paid: 1, revenueCents: 6999 });
    expect(s.totals.conversion).toBeCloseTo(1 / 3);
    expect(s.partners[0]).toMatchObject({ partnerId: DZA, clicks: 2, paid: 1 });
    expect(s.cars[0]).toMatchObject({ vin: VIN, title: "Audi Q5", clicks: 2, paid: 1 });
    expect(s.blockedByReason).toEqual([{ reason: "referer", count: 1 }]);
    expect(s.daily).toEqual([{ date: "2026-11-05", clicks: 3, paid: 1 }]);

    const only = summarizeBusinessPoga(days, sales, { from: "2026-11-01", to: "2026-11-30", partnerId: A2K });
    expect(only.totals).toMatchObject({ clicks: 1, paid: 0, blocked: 1 });
    expect(only.totals.conversion).toBe(0);
  });

  it("bez klikšķiem konversija nav aprēķināta", () => {
    expect(summarizeBusinessPoga([], [], { from: "2026-11-01", to: "2026-11-30" }).totals.conversion).toBeNull();
  });

  it("datumu intervāls ieskaitot abas malas", () => {
    expect(businessPogaDateRange("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(businessPogaDateRange("2026-11-02", "2026-11-01")).toEqual([]);
  });
});
