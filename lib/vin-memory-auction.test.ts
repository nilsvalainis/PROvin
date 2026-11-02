import { describe, expect, it } from "vitest";
import { mergeObservations, type VinMemoryEntry } from "@/lib/vin-memory";
import { decideAdminApiAccess, decideAdminPageAccess, type AccessActor } from "@/lib/staff-roles";
import {
  applyIngestStep,
  buildAuctionSlices,
  freshAuctionIngestState,
  ingestProgress,
  lotLooksEnded,
  observationsFromAuctionLots,
  openlaneMakeUrl,
  pickIngestStep,
  recentVinBrowse,
  rigaDay,
  stateForTick,
  summarizeVinMemory,
  type AuctionIngestState,
  type AuctionSliceState,
  type AuctionStepFetch,
} from "@/lib/vin-memory-auction";

const NOW = new Date("2026-11-02T22:30:00.000Z");
const VIN = "WVWZZZ7NZEV015204";

function lot(over: Partial<Parameters<typeof observationsFromAuctionLots>[0][number]> = {}) {
  return {
    platform: "autobid" as const,
    vin: VIN,
    title: "VW Sharan 2.0 TDI",
    manufacturer: "Volkswagen",
    mileageKm: 184350,
    firstRegistration: "03.2014",
    countryCode: "DE",
    auctionStage: "IN_AUCTION",
    ...over,
  };
}

function okFetch(over: Partial<AuctionStepFetch> = {}): AuctionStepFetch {
  return { status: "ok", note: "", pagesFetched: 3, pageCount: 9, vehicles: [], ...over };
}

describe("observationsFromAuctionLots", () => {
  it("Autobid un Openlane ar īstu VIN kļūst par novērojumu bez bildēm", () => {
    const r = observationsFromAuctionLots(
      [
        lot(),
        {
          platform: "openline",
          vin: "WBAZZZ8V0K1237731",
          title: "BMW 320d",
          mileageKm: 93500,
          firstRegistration: "2017-02-07T00:00:00",
          year: "2017",
          countryCode: "nl",
          auctionStage: "AFTER_AUCTION",
        },
      ],
      "2026-11-02",
    );
    expect(r.inputs).toEqual([
      {
        vin: VIN,
        date: "2026-11-02",
        source: "autobid",
        km: 184350,
        model: "VW Sharan 2.0 TDI",
        firstRegistration: "2014-03",
        country: "DE",
      },
      {
        vin: "WBAZZZ8V0K1237731",
        date: "2026-11-02",
        source: "openline",
        km: 93500,
        model: "BMW 320d",
        firstRegistration: "2017-02-07",
        country: "nl",
      },
    ]);
    expect(r.endedWithVin).toBe(1);
    expect(JSON.stringify(r.inputs)).not.toMatch(/image|photo|http/i);
  });

  it("izmet Auto1 heksa virkni, tukšu VIN un OCR", () => {
    const r = observationsFromAuctionLots(
      [
        lot({ vin: "7B7A4C2C89AE96965", platform: "autobid" }),
        lot({ vin: "", title: "Bez VIN" }),
        lot({ vin: "WAUZZZ4G5EN012345", vinSource: "ocr_photo" }),
      ],
      "2026-11-02",
    );
    expect(r.inputs).toEqual([]);
    expect(r.skippedNoVin).toBe(3);
  });
});

describe("mergeObservations dedupe tajā pašā dienā un avotā", () => {
  it("otrais Autobid ieraksts tai pašā dienā nedubultojas; km aizpildās, ja pirmais bija tukšs", () => {
    const first = observationsFromAuctionLots([lot({ mileageKm: null })], "2026-11-02");
    const merged = mergeObservations({}, first.inputs, NOW);
    expect(merged.added).toBe(1);
    const again = mergeObservations(merged.table, first.inputs, NOW);
    expect(again.added).toBe(0);
    expect(again.updated).toBe(0);
    expect(again.table[VIN]!.observations).toHaveLength(1);

    const withKm = observationsFromAuctionLots([lot({ mileageKm: 184350 })], "2026-11-02");
    const filled = mergeObservations(merged.table, withKm.inputs, NOW);
    expect(filled.added).toBe(0);
    expect(filled.updated).toBe(1);
    expect(filled.table[VIN]!.observations[0]!.km).toBe(184350);
  });

  it("cita diena vai cits avots pievieno jaunu novērojumu", () => {
    const day = observationsFromAuctionLots([lot()], "2026-11-02");
    const base = mergeObservations({}, day.inputs, NOW);
    const nextDay = observationsFromAuctionLots([lot({ mileageKm: 185000 })], "2026-11-03");
    const later = mergeObservations(base.table, nextDay.inputs, NOW);
    expect(later.added).toBe(1);
    const openlane = observationsFromAuctionLots([lot({ platform: "openline", mileageKm: 184000 })], "2026-11-02");
    const both = mergeObservations(base.table, openlane.inputs, NOW);
    expect(both.added).toBe(1);
    expect(both.table[VIN]!.observations.map((o) => o.source).sort()).toEqual(["autobid", "openline"]);
  });
});

describe("izsoļu gājiena kursors", () => {
  it("Rīgas diena un sākuma solis ir Autobid kataloga pirmā lapa", () => {
    expect(rigaDay(new Date("2026-11-02T22:30:00.000Z"))).toBe("2026-11-03");
    expect(rigaDay(new Date("2026-11-02T12:00:00.000Z"))).toBe("2026-11-02");
    const state = freshAuctionIngestState(NOW);
    const step = pickIngestStep(state, NOW);
    expect(step).toMatchObject({ source: "autobid", sliceId: "autobid:catalog", startPage: 1, maxPages: 3 });
    expect(state.slices.filter((s) => s.source === "openline").length).toBeGreaterThan(10);
    expect(openlaneMakeUrl("land rover", { from: 2018, to: 2020 })).toBe(
      "https://www.openlane.eu/en/findcar?makes=land+rover&yearFrom=2018&yearTo=2020",
    );
  });

  it("Autobid lapas bīdās, kļūda neapstiprina lapu, pēc diviem Autobid soļiem nāk Openlane", () => {
    let state = freshAuctionIngestState(NOW);
    const step1 = pickIngestStep(state, NOW)!;
    state = applyIngestStep(state, step1, okFetch({ pagesFetched: 3, pageCount: 10 }), { vins: 4, skippedNoVin: 20, endedWithVin: 1 }, NOW);
    expect(state.slices[0]).toMatchObject({ status: "active", nextPage: 4, vins: 4, endedWithVin: 1 });

    const blocked = pickIngestStep(state, NOW)!;
    state = applyIngestStep(
      state,
      blocked,
      { status: "blocked_by_waf", note: "HTTP 429", pagesFetched: 0, pageCount: 0, vehicles: [] },
      { vins: 0, skippedNoVin: 0, endedWithVin: 0 },
      NOW,
    );
    expect(state.slices[0]!.nextPage).toBe(4);
    expect(state.slices[0]!.attempts).toBe(0);
    expect(pickIngestStep(state, NOW)?.source).toBe("openline");

    const later = new Date(NOW.getTime() + 7 * 60 * 60 * 1000);
    const pausedOpenlane: AuctionIngestState = {
      ...state,
      holdUntil: { ...state.holdUntil, openline: new Date(later.getTime() + 60_000).toISOString() },
    };
    expect(pickIngestStep(pausedOpenlane, later)).toMatchObject({ source: "autobid", startPage: 4 });
  });

  it("Openlane, kas neietilpst releja lapās, paliek partial un dabū gada šķēles, nevis done", () => {
    const slices = buildAuctionSlices().filter((s) => s.id === "autobid:catalog" || s.id === "openline:bmw");
    slices[0] = { ...slices[0]!, status: "done" };
    let state: AuctionIngestState = { ...freshAuctionIngestState(NOW, slices), lastSource: "autobid", autobidStreak: 2 };
    const step = pickIngestStep(state, NOW)!;
    expect(step).toMatchObject({ source: "openline", sliceId: "openline:bmw", startPage: 1, maxPages: 2 });
    state = applyIngestStep(state, step, okFetch({ pagesFetched: 2, pageCount: 14, note: "" }), { vins: 0, skippedNoVin: 40, endedWithVin: 0 }, NOW);
    const bmw = state.slices.find((s) => s.id === "openline:bmw")!;
    expect(bmw.status).toBe("partial");
    expect(bmw.note).toContain("2/14");
    const years = state.slices.filter((s) => s.id.startsWith("openline:bmw:"));
    expect(years.map((s) => s.id)).toEqual([
      "openline:bmw:2010-2014",
      "openline:bmw:2015-2017",
      "openline:bmw:2018-2020",
      "openline:bmw:2021-2023",
      "openline:bmw:2024-2026",
    ]);
    expect(state.completedDay).toBeNull();
    expect(lotLooksEnded("AFTER_AUCTION")).toBe(true);
    expect(lotLooksEnded("IN_AUCTION")).toBe(false);
  });

  it("trīs neveiksmes apzīmē šķēli kā kļūdu; pabeigtu gājienu nākamā Rīgas diena sāk no jauna", () => {
    const only = buildAuctionSlices().filter((s) => s.id === "autobid:catalog");
    let state = freshAuctionIngestState(NOW, only);
    const fail: AuctionStepFetch = { status: "fetch_failed", note: "Noildze", pagesFetched: 0, pageCount: 0, vehicles: [] };
    for (let i = 0; i < 3; i += 1) {
      const step = pickIngestStep(state, NOW)!;
      state = applyIngestStep(state, step, fail, { vins: 0, skippedNoVin: 0, endedWithVin: 0 }, NOW);
    }
    expect(state.slices[0]!.status).toBe("error");
    expect(state.completedDay).toBe(rigaDay(NOW));
    expect(pickIngestStep(state, NOW)).toBeNull();
    const next = stateForTick(state, new Date("2026-11-03T22:30:00.000Z"));
    expect(next.passDay).toBe("2026-11-04");
    expect(next.slices[0]!.status).toBe("pending");
    expect(next.completedDay).toBeNull();
  });

  it("kopsavilkums skaita VIN un novērojumus pa avotiem", () => {
    const table = mergeObservations(
      {},
      [
        ...observationsFromAuctionLots([lot()], "2026-11-02").inputs,
        ...observationsFromAuctionLots([lot({ platform: "openline", mileageKm: 180000 })], "2026-11-02").inputs,
      ],
      NOW,
    ).table;
    const counts = summarizeVinMemory(Object.values(table));
    expect(counts.vins).toBe(1);
    expect(counts.observations).toBe(2);
    expect(counts.bySource.autobid).toEqual({ vins: 1, observations: 1 });
    expect(counts.bySource.openline).toEqual({ vins: 1, observations: 1 });
    expect(counts.bySource.order).toEqual({ vins: 0, observations: 0 });
    const progress = ingestProgress(freshAuctionIngestState(NOW));
    expect(progress.autobid.pending).toBe(1);
    expect(progress.openline.pending).toBeGreaterThan(10);
  });

  it("pārlūkošana rāda jaunākos VIN un ievēro limitu", () => {
    const older: VinMemoryEntry = {
      vin: "WVWZZZ3CZGE000001",
      updatedAt: "2026-11-01T00:00:00.000Z",
      observations: [{ date: "2026-11-01", source: "order", km: 1000, model: "Golf" }],
    };
    const newer: VinMemoryEntry = {
      vin: VIN,
      updatedAt: "2026-11-02T00:00:00.000Z",
      observations: [{ date: "2026-11-02", source: "autobid", km: 93500, model: "Sharan", firstRegistration: "03.2014" }],
    };
    const rows = recentVinBrowse([older, newer]);
    expect(rows.map((r) => r.vin)).toEqual([VIN, older.vin]);
    expect(rows[0]).toMatchObject({ km: 93500, model: "Sharan", firstRegistration: "03.2014", sources: ["autobid"], date: "2026-11-02" });
    expect(recentVinBrowse([older, newer], 1)).toHaveLength(1);
  });
});

describe("Izsoļu portālu arhīvs ir tikai administratoram", () => {
  const vinStaff: AccessActor = { kind: "staff", sections: ["vin"] };
  const allIriss: AccessActor = {
    kind: "staff",
    sections: ["pasutijumi", "sludinajumi", "radars", "logistika", "serviss", "pavadzimes", "vin"],
  };

  it("lapa un API darbiniekam ir aizliegti, arī VIN sadaļai", () => {
    expect(decideAdminPageAccess("/admin/izsolu-arhivs", { kind: "admin" })).toBe("allow");
    expect(decideAdminApiAccess("/api/admin/vin-memory-archive", { kind: "admin" })).toBe("allow");
    expect(decideAdminPageAccess("/admin/izsolu-arhivs", vinStaff)).toBe("forbidden");
    expect(decideAdminApiAccess("/api/admin/vin-memory-archive", vinStaff)).toBe("forbidden");
    expect(decideAdminPageAccess("/admin/izsolu-arhivs", allIriss)).toBe("forbidden");
    expect(decideAdminApiAccess("/api/admin/vin-memory-archive", allIriss)).toBe("forbidden");
    expect(decideAdminPageAccess("/admin/vin-scan", vinStaff)).toBe("allow");
  });
});

describe("Openlane gada šķēle vairs nedalās", () => {
  it("partial gadi paliek partial bez jauniem bērniem", () => {
    const parent: AuctionSliceState = {
      id: "openline:bmw:2018-2020",
      source: "openline",
      url: openlaneMakeUrl("bmw", { from: 2018, to: 2020 }),
      kind: "years",
      nextPage: 1,
      pageCount: null,
      status: "pending",
      attempts: 0,
      note: "",
      vins: 0,
      skippedNoVin: 0,
      endedWithVin: 0,
    };
    const state = freshAuctionIngestState(NOW, [parent]);
    const step = pickIngestStep({ ...state, lastSource: "autobid", autobidStreak: 2 }, NOW)!;
    const next = applyIngestStep(
      { ...state, lastSource: "autobid", autobidStreak: 2 },
      step,
      okFetch({ pagesFetched: 2, pageCount: 9 }),
      { vins: 1, skippedNoVin: 3, endedWithVin: 0 },
      NOW,
    );
    expect(next.slices).toHaveLength(1);
    expect(next.slices[0]!.status).toBe("partial");
    expect(next.completedDay).toBe(rigaDay(NOW));
  });
});
