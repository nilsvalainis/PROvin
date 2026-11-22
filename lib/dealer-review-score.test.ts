import { describe, expect, it } from "vitest";
import { emptyAutoRecordsBlock, type AutoRecordsBlockState } from "@/lib/admin-source-blocks";
import type { AutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import { emptyOutvinDealerReport, type OutvinEquipmentLine } from "@/lib/outvin-dealer-types";
import {
  buildDealerReviewScoreInput,
  computeDealerReviewScore,
  detectDealerTaxiSignals,
  scoreDealerReview,
  type DealerReviewScoreInput,
} from "@/lib/dealer-review-score";

/**
 * Piemēri no 22.11 audita (zurnals/dilera-atskaite-audits-2026-11-22.md) un apstiprinātā maketa.
 * Tikai VIN, datumi, km un darbi - bez personas datiem.
 */
const base: DealerReviewScoreInput = {
  dataState: "data",
  refunded: false,
  recordCount: 0,
  firstDate: "",
  lastDate: "",
  orderDateMs: 0,
  majorWorks: [],
  odometerDrops: [],
  campaignsDone: false,
  oilCoveragePct: null,
  paintSigns: [],
  taxiSignals: [],
  annualKm: null,
  totalLoss: false,
  auditsPurchased: false,
  shadowVerdict: null,
};

const ms = (d: string) => Date.parse(`${d}T12:00:00Z`);

// A - WBA5K11000D942446, BMW 530d Touring, 31 ieraksts.
const A: DealerReviewScoreInput = {
  ...base,
  recordCount: 31,
  firstDate: "20.01.2015",
  lastDate: "27.07.2024",
  orderDateMs: ms("2026-11-11"),
  majorWorks: [{ label: "EGR dzesētājs / vārsts", date: "10.06.2020", km: "94 269 km" }],
  odometerDrops: [{ fromKm: 96_533, toKm: 90_205, fromDate: "01.10.2019", toDate: "20.02.2020", significant: false }],
  oilCoveragePct: 100,
  annualKm: 18_000,
  shadowVerdict: "would_send",
};

// B - WDD2120251A120979, Mercedes E 350 CDI, rūpnīcas kodi 965 + 937.
const B: DealerReviewScoreInput = {
  ...base,
  recordCount: 8,
  firstDate: "15.06.2010",
  lastDate: "22.11.2018",
  orderDateMs: ms("2026-11-22"),
  oilCoveragePct: 76,
  taxiSignals: [
    { kind: "taxi", text: "965 ELECTR. PROVISION FOR HIRED CARS / TAXICAB" },
    { kind: "taxi", text: "937 REINFORCEMENT PACKAGE" },
  ],
  shadowVerdict: "would_send",
};

// C - WBAWY51000L877520, BMW X3 xDrive30d, 12 ieraksti līdz 2018.
const C: DealerReviewScoreInput = {
  ...base,
  recordCount: 12,
  firstDate: "15.12.2011",
  lastDate: "06.12.2018",
  orderDateMs: ms("2026-11-18"),
  paintSigns: [{ date: "12.08.2016" }],
  oilCoveragePct: 17,
  shadowVerdict: "would_send",
};

// D - WAUZZZF47HA003895, Audi A4 Allroad, 1 ieraksts pie 252 933 km.
const D: DealerReviewScoreInput = {
  ...base,
  recordCount: 1,
  firstDate: "08.01.2025",
  lastDate: "08.01.2025",
  orderDateMs: ms("2026-11-17"),
  shadowVerdict: "would_hold",
  shadowHoldReason: "AI raksta «DPF pārbaudīts», datos tikai pozīcija",
};

// E - datu nav, nauda atgriezta.
const E: DealerReviewScoreInput = { ...base, dataState: "no_data", refunded: true, orderDateMs: ms("2026-11-14") };

describe("scoreDealerReview - maketa piemēri", () => {
  it("A: 68, augsta, lūgt tagad; AUDITS vērts", () => {
    const r = scoreDealerReview(A);
    expect(r.score).toBe(68);
    expect(r.level).toBe("high");
    expect(r.action).toBe("ask_now");
    expect(r.audits.advice).toBe("worth");
    expect(r.audits.reasons[0]).toBe("Pēc 07.2024 dīlera ierakstu nav");
    const texts = r.reasons.map((x) => x.text);
    expect(texts).toContain("31 ieraksts");
    expect(texts).toContain("2015-2024, 9,5 gadi");
    expect(texts).toContain("Pēdējais ieraksts pirms 28 mēn. (07.2024)");
    expect(texts).toContain("Odometra kritums 96 533 → 90 205 km (2019-2020)");
    expect(texts).toContain("Eļļas maiņas visā periodā bez robiem");
    expect(texts).toContain("Kvalitātes pārbaude: izlaista");
  });

  it("B: TAXI - 74, augsta, lūgt tagad; AUDITS maz ticams", () => {
    const r = scoreDealerReview(B);
    expect(r.score).toBe(74);
    expect(r.level).toBe("high");
    expect(r.action).toBe("ask_now");
    expect(r.disqualifier?.kind).toBe("taxi");
    expect(r.disqualifier?.text).toBe("Taxi kodi 965 + 937 rūpnīcas komplektācijā");
    expect(r.reasons[0]).toMatchObject({ sign: "!", points: 30 });
    expect(r.audits.advice).toBe("unlikely");
    expect(r.reasons.map((x) => x.text)).toContain("Pēdējais ieraksts pirms 96 mēn. (11.2018)");
  });

  it("C: 43, vidēja, pēc 2 dienām; AUDITS vērts", () => {
    const r = scoreDealerReview(C);
    expect(r.score).toBe(43);
    expect(r.level).toBe("medium");
    expect(r.action).toBe("ask_later");
    expect(r.audits.advice).toBe("worth");
    expect(r.reasons.map((x) => x.text)).toEqual(
      expect.arrayContaining(["2011-2018, 7 gadi", "Krāsošanas pazīmes 08.2016", "Eļļas maiņas sedz tikai 17% nobraukuma"]),
    );
  });

  it("D: 4, zema, nelūgt (1 ieraksts + kvalitātes pārbaude aizturētu)", () => {
    const r = scoreDealerReview(D);
    expect(r.score).toBe(4);
    expect(r.level).toBe("low");
    expect(r.action).toBe("dont_ask");
    expect(r.audits.advice).toBe("worth");
    const texts = r.reasons.map((x) => x.text);
    expect(texts).toContain("1 ieraksts");
    expect(texts).toContain("Periods: 1 diena");
    expect(texts).toContain("Pēdējais ieraksts pirms 22 mēn. (01.2025)");
    expect(texts.some((t) => t.startsWith("Kvalitātes pārbaude aizturētu"))).toBe(true);
    expect(texts).toContain("1-2 ieraksti - ne augstāk par «zema»");
  });

  it("E: datu nav + atmaksa - nelūgt bez punktiem", () => {
    const r = scoreDealerReview(E);
    expect(r.score).toBeNull();
    expect(r.level).toBe("none");
    expect(r.action).toBe("dont_ask");
    expect(r.audits.advice).toBe("not_rated");
    expect(r.reasons.map((x) => x.text)).toEqual(["OneAuto: datu nav", "Maksājums atgriezts"]);
  });
});

describe("scoreDealerReview - noteikumi", () => {
  it("1-2 ieraksti nekad nav augstāk par zema", () => {
    const r = scoreDealerReview({
      ...A,
      recordCount: 2,
      auditsPurchased: true,
      shadowVerdict: null,
    });
    expect(r.score).toBeGreaterThanOrEqual(60);
    expect(r.level).toBe("low");
  });

  it("atrunājošs atradums paceļ līdz augsta arī ar 1 ierakstu", () => {
    const r = scoreDealerReview({ ...D, totalLoss: true });
    expect(r.disqualifier?.kind).toBe("total_loss");
    expect(r.level).toBe("high");
    expect(r.action).toBe("ask_now");
    expect(r.audits.advice).toBe("unlikely");
  });

  it("odometra kritums >10% (būtisks) ir atrunājošs; izlecējs nav", () => {
    const drop = { fromKm: 200_000, toKm: 150_000, fromDate: "01.01.2020", toDate: "01.01.2021" };
    expect(scoreDealerReview({ ...C, odometerDrops: [{ ...drop, significant: true }] }).disqualifier?.kind).toBe(
      "odometer_drop",
    );
    expect(scoreDealerReview({ ...C, odometerDrops: [{ ...drop, significant: false }] }).disqualifier).toBeNull();
  });

  it(">40 000 km gadā un ≥3 lielie mezgli ir atrunājoši", () => {
    expect(scoreDealerReview({ ...C, annualKm: 45_000 }).disqualifier?.kind).toBe("high_mileage");
    const m = { label: "Turbokompresors", date: "01.01.2017", km: "120 000 km" };
    const r = scoreDealerReview({ ...C, majorWorks: [m, { ...m, label: "Sajūgs" }, { ...m, label: "Ātrumkārba" }] });
    expect(r.disqualifier?.kind).toBe("many_major");
    // Lielie mezgli: +6 katrs, maks. 12.
    expect(r.reasons.filter((x) => x.text.startsWith("Turbo") || x.text.startsWith("Sajūgs") || x.text.startsWith("Ātrum")).map((x) => x.points)).toEqual([6, 6, 0]);
  });

  it("AUDITS nopirkts: +15 un AUDITS maz ticams", () => {
    const r = scoreDealerReview({ ...C, auditsPurchased: true });
    expect(r.score).toBe(58);
    expect(r.audits).toEqual({ advice: "unlikely", reasons: ["AUDITS jau nopirkts"] });
  });

  it("noderīgie atradumi ne vairāk par 25", () => {
    const m = { label: "Turbokompresors", date: "01.01.2017", km: "" };
    const r = scoreDealerReview({
      ...A,
      majorWorks: [m, { ...m, label: "Sajūgs" }],
      campaignsDone: true,
      paintSigns: [{ date: "01.01.2018" }],
    });
    // 12 (mezgli) + 8 (odometrs) + 4 + 6 + 5 = 35 -> 25.
    expect(r.score).toBe(25 + 15 + 8 + 25);
  });

  it("ēnu režīma nav - neņem vērā", () => {
    expect(scoreDealerReview({ ...C, shadowVerdict: null }).score).toBe(43);
    expect(scoreDealerReview({ ...C, shadowVerdict: "would_hold" }).score).toBe(28);
  });

  it("sūdzība - nelūgt bez punktiem", () => {
    const r = scoreDealerReview({ ...A, complaint: true });
    expect(r.score).toBeNull();
    expect(r.action).toBe("dont_ask");
  });
});

describe("detectDealerTaxiSignals", () => {
  it("Mercedes 965 + 937 ir taxi", () => {
    const s = detectDealerTaxiSignals({
      vin: "WDD2120251A120979",
      equipment: [
        { code: "965", description: "ELECTR. PROVISION FOR HIRED CARS / TAXICAB" },
        { code: "937", description: "REINFORCEMENT PACKAGE" },
        { code: "275", description: "MEMORY PACKAGE" },
      ],
    });
    expect(s.map((x) => x.kind)).toEqual(["taxi", "taxi"]);
  });

  it("937 cita markā bez taxi teksta nav taxi; ar «TAXI/RENTAL» ir", () => {
    expect(detectDealerTaxiSignals({ vin: "WBA5K11000D942446", equipment: [{ code: "937", description: "Comfort seats" }] })).toEqual([]);
    expect(
      detectDealerTaxiSignals({
        vin: "WDD2122231A338701",
        equipment: [{ code: "937", description: "TAXI/RENTAL VEHICLE REINFORCEMENT PACKAGE" }],
      }).map((x) => x.kind),
    ).toEqual(["taxi"]);
  });

  it("izņēmumi: Without taxi alarm, 9A0, Parts excluded for TAXI, TAXI Adm variant", () => {
    expect(
      detectDealerTaxiSignals({
        vin: "WAUZZZF47HA003895",
        equipment: [
          { code: "9A0", description: "Without taxi alarm system" },
          { code: "4901", description: "Parts excluded for TAXI" },
          { code: "", description: "Parking heater TAXI Adm variant" },
          { code: "", description: "Without taxi alarm system" },
        ],
      }),
    ).toEqual([]);
    expect(detectDealerTaxiSignals({ texts: ["Parts excluded for TAXI", "Without taxi alarm system"] })).toEqual([]);
  });

  it("OneAuto / Outvin aprīkojums ar taxi paketi", () => {
    expect(
      detectDealerTaxiSignals({ equipment: [{ code: "TX1", description: "Taxi package with taximeter preparation" }] }).map(
        (x) => x.kind,
      ),
    ).toEqual(["taxi"]);
  });

  it("reģistri: NL «Taxi: Ja», DK «Taxikørsel»; «Taxi: Nee» nav", () => {
    expect(detectDealerTaxiSignals({ texts: ["Kilometerstand: 120000\nTaxi: Ja"] }).map((x) => x.kind)).toEqual(["taxi"]);
    expect(detectDealerTaxiSignals({ texts: ["Anvendelse: Taxikørsel"] }).map((x) => x.kind)).toEqual(["taxi"]);
    expect(detectDealerTaxiSignals({ texts: ["Taxi: Nee", "TAXI Nee"] })).toEqual([]);
    expect(detectDealerTaxiSignals({ texts: ["Taxikørsel: Nej"] })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Ievade no melnraksta bloka (koda ceļš, kā kartītē)
// ---------------------------------------------------------------------------------------------

function row(date: string, km: number, works: string): AutoRecordsServiceWorkRow {
  return { date, odometer: String(km), location: "", works };
}

function blockWith(rows: AutoRecordsServiceWorkRow[], patch: Partial<AutoRecordsBlockState> = {}): AutoRecordsBlockState {
  return { ...emptyAutoRecordsBlock(), serviceWorks: rows, ...patch };
}

const emptyEquip = {} as OutvinEquipmentLine;
const OIL = "Engine oil and oil filter replaced";

describe("buildDealerReviewScoreInput", () => {
  it("B tips: Mercedes ar 965 + 937 aprīkojumā -> taxi, augsta, AUDITS maz ticams", () => {
    const rows = [
      row("15.06.2010", 18_000, OIL),
      row("20.06.2011", 40_000, OIL),
      row("22.06.2012", 61_000, OIL),
      row("25.06.2013", 80_000, OIL),
      row("26.06.2014", 98_000, OIL),
      row("30.06.2015", 112_000, OIL),
      row("01.07.2017", 130_000, OIL),
      row("22.11.2018", 142_124, OIL),
    ];
    const block = blockWith(rows, {
      outvinReport: {
        ...emptyOutvinDealerReport(),
        vehicleInfo: { ...emptyOutvinDealerReport().vehicleInfo, vinCode: "WDD2120251A120979" },
        equipment: [
          { ...emptyEquip, code: "965", description: "ELECTR. PROVISION FOR HIRED CARS / TAXICAB" },
          { ...emptyEquip, code: "937", description: "REINFORCEMENT PACKAGE" },
        ],
      },
    });
    const r = computeDealerReviewScore({
      autoRecords: block,
      job: { status: "done", vin: "WDD2120251A120979", createdAt: "2026-11-22T10:00:00Z" },
    });
    expect(r.disqualifier?.kind).toBe("taxi");
    expect(r.level).toBe("high");
    expect(r.action).toBe("ask_now");
    expect(r.audits.advice).toBe("unlikely");
    expect(r.reasons.find((x) => x.text.startsWith("8 ieraksti"))?.points).toBe(20);
  });

  it("A tips: EGR dzesētājs + odometra izlecējs tiek atrasti", () => {
    const rows = [
      row("20.01.2015", 20_000, OIL),
      row("20.01.2016", 40_000, OIL),
      row("20.01.2017", 60_000, OIL),
      row("20.01.2018", 75_000, OIL),
      row("01.10.2019", 96_533, OIL),
      row("20.02.2020", 90_205, "Brake pads rear replaced"),
      row("10.06.2020", 94_269, "EGR cooler replaced"),
      row("20.01.2021", 110_000, OIL),
      row("27.07.2024", 176_313, OIL),
    ];
    const input = buildDealerReviewScoreInput({
      autoRecords: blockWith(rows),
      job: { status: "done", vin: "WBA5K11000D942446", createdAt: "2026-11-11T10:00:00Z" },
    });
    expect(input.recordCount).toBe(9);
    expect(input.majorWorks.map((m) => m.label)).toEqual(["EGR dzesētājs / vārsts"]);
    expect(input.odometerDrops).toHaveLength(1);
    expect(input.odometerDrops[0]).toMatchObject({ fromKm: 96_533, toKm: 90_205, significant: false });
    expect(input.taxiSignals).toEqual([]);
    const r = scoreDealerReview(input);
    expect(r.disqualifier).toBeNull();
    expect(r.reasons.map((x) => x.text)).toContain("Pēdējais ieraksts pirms 28 mēn. (07.2024)");
  });

  it("C tips: grunts pildviela -> krāsošanas pazīmes", () => {
    const rows = [
      row("15.12.2011", 10_000, OIL),
      row("12.08.2016", 70_000, "Primer filler applied to front bumper"),
      row("06.12.2018", 97_151, "Vehicle check"),
    ];
    const input = buildDealerReviewScoreInput({
      autoRecords: blockWith(rows),
      job: { status: "done", vin: "WBAWY51000L877520", createdAt: "2026-11-18T10:00:00Z" },
    });
    expect(input.paintSigns.map((p) => p.date)).toEqual(["12.08.2016"]);
  });

  it("E tips: darbs «no_data» un atmaksa -> nelūgt", () => {
    const r = computeDealerReviewScore({
      autoRecords: blockWith([]),
      job: {
        status: "no_data",
        vin: "YV1XZEFV1P2071043",
        createdAt: "2026-11-14T10:00:00Z",
        refund: { at: "2026-11-15T10:00:00Z", amountCents: 2499, stripeRefundId: "re_x", by: "admin", reason: "no_data" },
      },
    });
    expect(r.level).toBe("none");
    expect(r.score).toBeNull();
  });

  it("ēnu režīma «aizturētu» spriedums nāk no darba ieraksta", () => {
    const input = buildDealerReviewScoreInput({
      autoRecords: blockWith([row("08.01.2025", 252_933, "DPF")]),
      job: {
        status: "done",
        vin: "WAUZZZF47HA003895",
        createdAt: "2026-11-17T10:00:00Z",
        shadowGate: {
          verdict: "would_hold",
          at: "2026-11-17T11:00:00Z",
          version: 1,
          checks: [
            { id: "contradictions", title: "Pretrunas ar datiem", state: "fail", severity: "block", reason: "AI raksta «DPF pārbaudīts»" },
          ],
        },
      },
    });
    expect(input.shadowVerdict).toBe("would_hold");
    expect(input.shadowHoldReason).toBe("AI raksta «DPF pārbaudīts»");
    expect(scoreDealerReview(input).level).toBe("low");
  });
});
