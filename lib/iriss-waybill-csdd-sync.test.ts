import { describe, expect, it } from "vitest";
import {
  applyCsddPlatesReport,
  csddActiveForPlate,
  emptyCsddPlatesDoc,
  knownWaybillNumbers,
  mergeCsddActiveRows,
  mergeCsddPlateStates,
  parseCsddPlatesReport,
  type CsddPlatesDoc,
} from "@/lib/iriss-waybill-csdd-plates";
import { emptyWaybillPlateStates, waybillPlateOccupancy } from "@/lib/iriss-waybill-plates";
import { irissMobilePlateStripItems } from "@/lib/iriss-mobile-plate-strip";
import type { IrissPavadzimeListRow } from "@/lib/iriss-pavadzimes-types";
import {
  collectActiveWaybills,
  csddMessageSnippet,
  findNewWaybillAfterSave,
  isActiveStatus,
  lookupCandidates,
  nextWaybillNo,
  parseWaybillDetail,
} from "@/scripts/iriss-ttr/csdd-waybills-core.mjs";
import { plateSnapshot } from "@/scripts/iriss-ttr/waybill-worker-core.mjs";

const NOW = Date.parse("2026-10-23T13:30:00.000Z");
const P02812_UNTIL = "2026-10-25T05:35:00.000Z";

/** Incidents 23.10: P02812 (ML350) uz B193-7 līdz 25.10 07:35, izrakstīta ar roku (mūsu indeksā nav). */
const csddDoc = (over: Partial<CsddPlatesDoc["plates"][number]> = {}): CsddPlatesDoc =>
  applyCsddPlatesReport(
    emptyCsddPlatesDoc(),
    parseCsddPlatesReport({
      plates: [
        {
          plate: "B193-7",
          ok: true,
          checkedAt: "2026-10-23T13:25:00.000Z",
          active: [{ waybillNo: "P02812", validUntil: P02812_UNTIL, brandModel: "MERCEDES-BENZ ML 350" }],
          ...over,
        },
        { plate: "B762-7", ok: true, checkedAt: "2026-10-23T13:25:00.000Z", active: [] },
      ],
    })!,
    new Date(NOW),
  );

describe("CSDD pavadzīmes kartīte (kā Aivara lookup)", () => {
  const card = [
    "Pavadzīmes numurs: P02812",
    "Statuss: Derīgs",
    "Numura zīme: B193-7",
    "Marka, modelis: MERCEDES-BENZ ML 350",
    "VIN: WDC1641221A000001",
    "Izsniegta: 23.10.2026 10:35",
    "Derīga līdz: 25.10.2026 07:35",
  ].join("\n");

  it("nolasa numuru, statusu, numurzīmi un derīguma beigas Rīgas laikā (arī pēc ziemas laika maiņas)", () => {
    expect(parseWaybillDetail(card, "P02812")).toMatchObject({
      waybillNo: "P02812",
      active: true,
      plate: "B193-7",
      validUntil: P02812_UNTIL,
      vin: "WDC1641221A000001",
      brandModel: "MERCEDES-BENZ ML 350",
    });
    expect(parseWaybillDetail(card, "P02813")).toBeNull();
    expect(parseWaybillDetail("Nekas nav atrasts", "P02812")).toBeNull();
  });

  it("23.10 pārbaude serverī: numurzīme ir <input> vērtība (p1Card), laiks aiz 'plkst.' -> B193-7 līdz 07:35, nevis 23:59", () => {
    const real = [
      "Pavadzīmes numurs: P02812",
      "Statuss: Derīgs",
      "Tirdzniecības numurs:  B193-7 ",
      "Akta numurs: GDZ00316",
      "Komersanta pārstāvis: NILS VALAINIS",
      "Derīga no: 23.10.2026, plkst. 07:35",
      "Derīga līdz: 25.10.2026, plkst. 07:35",
    ].join("\n");
    expect(parseWaybillDetail(real, "P02812")).toMatchObject({ plate: "B193-7", active: true, validUntil: P02812_UNTIL, validUntilDateOnly: false });
    // Tikai datums: dienas beigas, atzīmēts kā neprecīzs.
    expect(parseWaybillDetail("Pavadzīmes numurs: P02812\nStatuss: Derīgs\nB193-7\nDerīga līdz: 25.10.2026", "P02812")).toMatchObject({
      validUntil: "2026-10-25T21:59:00.000Z",
      validUntilDateOnly: true,
    });
    // Datumu periods vienā rindā: beigas ir vēlākais.
    expect(parseWaybillDetail("Pavadzīmes numurs: P02812\nStatuss: Derīgs\nB193-7\nPeriods: 23.10.2026 07:35 - 25.10.2026 07:35")?.validUntil).toBe(P02812_UNTIL);
  });

  it("bez lauka 'Derīga līdz' ņem vēlāko datumu kartītē", () => {
    const t = "Pavadzīmes numurs: P02806\nStatuss: Derīgs\nB193-7 TOYOTA\n21.10.2026 10:00\n23.10.2026 10:00";
    expect(parseWaybillDetail(t)?.validUntil).toBe("2026-10-23T07:00:00.000Z");
  });

  it("statuss: tikai 'Derīgs' aizņem numuru", () => {
    expect(isActiveStatus("Derīgs")).toBe(true);
    for (const s of ["Nederīgs", "Pārtraukts", "Anulēts", "Beidzies", "", "Derīgs (pārtraukts)"]) expect(isActiveStatus(s)).toBe(false);
  });

  it("CSDD kļūdas teksts pēc Saglabāt", () => {
    expect(csddMessageSnippet("Pavadzīme\nKļūda: numura zīme B193-7 jau tiek izmantota pavadzīmē P02812\n")).toContain("jau tiek izmantota");
    expect(csddMessageSnippet("Viss kārtībā")).toBe("");
  });
});

describe("CSDD sinhronizācija: saraksti + secīgi numuri (arī ar roku izrakstītās)", () => {
  const registry: Record<string, string> = {
    P02810: "Pavadzīmes numurs: P02810\nStatuss: Beidzies\nB762-7\nDerīga līdz: 22.10.2026 10:00",
    P02811: "Pavadzīmes numurs: P02811\nStatuss: Derīgs\nB762-7 VOLVO XC60\nDerīga līdz: 24.10.2026 10:00",
    P02812: "Pavadzīmes numurs: P02812\nStatuss: Derīgs\nB193-7\nMarka, modelis: MERCEDES-BENZ ML 350\nDerīga līdz: 25.10.2026 07:35",
  };
  const lookup = async (no: string) => parseWaybillDetail(registry[no] ?? "", no);

  it("atrod P02812 pēc kārtas, pat ja sarakstā tās nav; P02811 aizņem B762-7", async () => {
    const res = await collectActiveWaybills({ plates: ["B193-7", "B762-7"], listRows: ["P02810 B762-7 Beidzies"], lookup, nowMs: NOW });
    expect(res.ok).toBe(true);
    expect(res.maxNumber).toBe("P02812");
    expect(res.plates["B193-7"].map((w: { waybillNo: string }) => w.waybillNo)).toEqual(["P02812"]);
    expect(res.plates["B762-7"].map((w: { waybillNo: string }) => w.waybillNo)).toEqual(["P02811"]);
  });

  it("zināmais numurs no servera aizstāj tukšu sarakstu; bez neviena numura - ok:false (nevar zināt)", async () => {
    const res = await collectActiveWaybills({ plates: ["B193-7"], listRows: [], known: ["P02810"], lookup, nowMs: NOW });
    expect(res.plates["B193-7"]).toHaveLength(1);
    const none = await collectActiveWaybills({ plates: ["B193-7"], listRows: [], lookup, nowMs: NOW });
    expect(none).toMatchObject({ ok: false });
  });

  it("beigusies (pēc derīguma) pavadzīme vairs neaizņem", async () => {
    const res = await collectActiveWaybills({ plates: ["B193-7"], listRows: ["P02812 B193-7"], lookup, nowMs: Date.parse("2026-10-25T06:00:00.000Z") });
    expect(res.plates["B193-7"]).toEqual([]);
  });

  it("kartīšu skaits ierobežots (CSDD slodze)", async () => {
    let calls = 0;
    const many = await collectActiveWaybills({
      plates: ["B193-7"],
      listRows: Array.from({ length: 40 }, (_, i) => `P0${2700 + i} B193-7`),
      lookup: async () => {
        calls += 1;
        return null;
      },
      nowMs: NOW,
      maxLookups: 10,
    });
    expect(many.ok).toBe(true);
    expect(calls).toBe(10);
  });

  it("kandidāti: tikai rindas ar mūsu numuriem + zināmie", () => {
    expect(lookupCandidates({ listRows: ["P02800 B193-7", "P02801 X123-4", "P02802 B762-7"], plates: ["B193-7"], known: ["P02790"] })).toEqual({
      candidates: ["P02790", "P02800"],
      maxSeen: "P02802",
    });
    expect(nextWaybillNo("P02812")).toBe("P02813");
    expect(nextWaybillNo("P00999")).toBe("P01000");
  });

  it("pēc Saglabāt: atrod jauno pēc VIN un derīguma; 'nav izveidota' tikai, ja šim numuram jaunas nav vispār", async () => {
    const saved: Record<string, string> = {
      P02813: "Pavadzīmes numurs: P02813\nStatuss: Derīgs\nB193-7 BMW 216D\nVIN: WBA2E31000P791726\nDerīga līdz: 23.10.2026 17:30",
    };
    const input = { plate: "B193-7", vin: "WBA2E31000P791726", validHours: 1 };
    const found = await findNewWaybillAfterSave({ input, beforeMax: "P02812", lookup: async (no: string) => parseWaybillDetail(saved[no] ?? "", no), nowMs: NOW });
    expect(found).toEqual({ found: true, waybillNo: "P02813" });
    const none = await findNewWaybillAfterSave({ input, beforeMax: "P02812", lookup: async () => null, nowMs: NOW });
    expect(none).toEqual({ found: false, checked: true });
    // Jauna pavadzīme uz šī numura, bet cits VIN -> nevar droši pateikt (cilvēkam).
    const other = await findNewWaybillAfterSave({
      input: { ...input, vin: "WBA00000000000000" },
      beforeMax: "P02812",
      lookup: async (no: string) => parseWaybillDetail(saved[no] ?? "", no),
      nowMs: NOW,
    });
    expect(other).toEqual({ found: false, checked: false });
    expect(await findNewWaybillAfterSave({ input, beforeMax: "", lookup: async () => null, nowMs: NOW })).toEqual({ found: false, checked: false });
  });

  it("worker momentuzņēmums Vercel: tikai numurs, derīgums, auto (bez VIN); kļūda - bez aktīvajām", () => {
    const snap = plateSnapshot(
      [
        { ok: true, platesChecked: ["B193-7", "B762-7"], plates: { "B193-7": [{ waybillNo: "P02812", validUntil: P02812_UNTIL, brandModel: "ML 350", vin: "WDC1" }], "B762-7": [] } },
        { ok: false, error: "nav pieslēgšanās", platesChecked: ["B192-7"] },
      ],
      "2026-10-23T13:25:00.000Z",
    );
    expect(snap.plates[0]).toEqual({
      plate: "B193-7",
      ok: true,
      checkedAt: "2026-10-23T13:25:00.000Z",
      active: [{ waybillNo: "P02812", validUntil: P02812_UNTIL, brandModel: "ML 350" }],
      error: "",
    });
    expect(snap.plates[2]).toMatchObject({ plate: "B192-7", ok: false, active: [], error: "nav pieslēgšanās" });
  });
});

describe("Vercel: numura statuss = mūsu indekss + CSDD reģistrs (incidents B193-7 'brīvs')", () => {
  it("ar roku izrakstīta P02812 (indeksā nav) -> B193-7 aizņemts ar CSDD numuru, nevis 'brīvs'", () => {
    const states = mergeCsddPlateStates(waybillPlateOccupancy([], new Date(NOW)), csddDoc(), NOW);
    expect(states.find((s) => s.plate === "B193-7")).toEqual({
      plate: "B193-7",
      busy: true,
      current: { number: "P02812", brandModel: "MERCEDES-BENZ ML 350", validUntil: P02812_UNTIL },
    });
    expect(states.find((s) => s.plate === "B762-7")?.busy).toBe(false);
  });

  it("CSDD 'brīvs' nekad nepārraksta mūsu 'aizņemts'", () => {
    const index = [{ plate: "B762-7", validUntil: "2026-10-24T10:00:00.000Z", issuedAt: "2026-10-22T10:00:00.000Z", number: "P02811" }];
    const states = mergeCsddPlateStates(waybillPlateOccupancy(index, new Date(NOW)), csddDoc(), NOW);
    expect(states.find((s) => s.plate === "B762-7")).toMatchObject({ busy: true, current: { number: "P02811" } });
  });

  it("neizdevies nolasījums atstāj iepriekšējo aktīvo (līdz derīguma beigām); vecs nolasījums nepārraksta jaunāku", () => {
    const doc = csddDoc();
    const failed = applyCsddPlatesReport(doc, parseCsddPlatesReport({ plates: [{ plate: "B193-7", ok: false, checkedAt: "2026-10-23T13:40:00.000Z", error: "VPN" }] })!);
    expect(csddActiveForPlate(failed, "B1937", NOW)?.waybillNo).toBe("P02812");
    expect(failed.plates.find((p) => p.plate === "B193-7")?.error).toBe("VPN");
    const older = applyCsddPlatesReport(doc, parseCsddPlatesReport({ plates: [{ plate: "B193-7", ok: true, checkedAt: "2026-10-23T13:00:00.000Z", active: [] }] })!);
    expect(csddActiveForPlate(older, "B193-7", NOW)?.waybillNo).toBe("P02812");
    expect(csddActiveForPlate(doc, "B193-7", Date.parse("2026-10-25T06:00:00.000Z"))).toBeNull();
    // Jauns veiksmīgs nolasījums: brīvs.
    const freed = applyCsddPlatesReport(doc, parseCsddPlatesReport({ plates: [{ plate: "B193-7", ok: true, checkedAt: "2026-10-23T14:00:00.000Z", active: [] }] })!);
    expect(csddActiveForPlate(freed, "B193-7", NOW)).toBeNull();
  });

  it("worker ziņojums: nederīgi numuri un svešas numurzīmes tiek izmesti", () => {
    expect(parseCsddPlatesReport({ plates: [{ plate: "X999-1", ok: true, checkedAt: "2026-10-23T13:00:00Z", active: [] }] })).toBeNull();
    const e = parseCsddPlatesReport({
      plates: [{ plate: "b1937", ok: true, checkedAt: "2026-10-23T13:00:00Z", active: [{ waybillNo: "<script>" }, { waybillNo: "p02812" }] }],
    });
    expect(e?.[0]).toMatchObject({ plate: "B193-7", active: [{ waybillNo: "P02812", validUntil: "", brandModel: "" }] });
    expect(parseCsddPlatesReport(null)).toBeNull();
  });

  it("mobilā josla / sānjosla: CSDD rinda bez PDF (tukšs id), josla rāda stundas, nevis 'Brīvs'", () => {
    const rows = mergeCsddActiveRows([] as IrissPavadzimeListRow[], csddDoc(), new Date(NOW));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "", number: "P02812", plate: "B193-7", validUntil: P02812_UNTIL });
    const strip = irissMobilePlateStripItems(rows, new Date(NOW));
    expect(strip.find((i) => i.plate === "B193-7")).toMatchObject({ busy: true, statusLabel: "40 h" });
    expect(strip.find((i) => i.plate === "B762-7")).toMatchObject({ busy: false, statusLabel: "Brīvs" });
  });

  it("zināmie numuri worker pārbaudei: CSDD aktīvie + jaunākie 3 no indeksa (tikai firmas numuriem)", () => {
    const index = [
      { number: "P02805", plate: "B193-7" },
      { number: "P02811", plate: "B762-7" },
      { number: "P02809", plate: "B193-7" },
      { number: "P00745", plate: "B192-7" },
      { number: "P02790", plate: "B193-7" },
    ];
    expect(knownWaybillNumbers(index, csddDoc(), ["B193-7", "B762-7"])).toEqual(["P02812", "P02811", "P02809", "P02805"]);
    expect(knownWaybillNumbers(index, null, ["B192-7"])).toEqual(["P00745"]);
    expect(emptyWaybillPlateStates()).toHaveLength(3);
  });
});
