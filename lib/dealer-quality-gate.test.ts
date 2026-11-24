/**
 * Ēnu režīma kvalitātes pārbaude (Nils 22.11.2026) ar audita 22.11 piemēriem (bez personas datiem).
 */
import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import type { AutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import {
  buildDealerQualityGateInput,
  evaluateDealerQualityGate,
  extractOilChangeCountClaims,
  findPositionOnlyActionClaims,
  vinFromDealerPdfFilename,
  type DealerQualityGateInput,
} from "@/lib/dealer-quality-gate";
import type { DealerGateCheckId, DealerShadowGate } from "@/lib/dealer-shadow-types";
import type { OneautoServiceEvent } from "@/lib/oneauto-catalog";

const VIN = "WBAMZ71040DM71041";
const r = (date: string, odometer: string, works: string, location = ""): AutoRecordsServiceWorkRow => ({
  date,
  odometer,
  location,
  works,
});
const ev = (date: string, odometer: string, works: string, place = ""): OneautoServiceEvent => ({ date, odometer, place, works });

const OIL_OK =
  "Ražotāja intervāls: 30 000 km / 24 mēn.\nDīlera datos fiksētas 2 dzinēja eļļas maiņas: 29.07.2018 un 21.07.2014.";
const COMMENTS_OK =
  "Dīlera datos ir 4 servisa ieraksti no 2014. līdz 2025. gadam. 09.11.2022 ierakstā ir pozīcijas: aizdedzes spole, pneimobalons aizmugurē (darbība nav norādīta).";

function base(over: Partial<DealerQualityGateInput> = {}): DealerQualityGateInput {
  return {
    jobVin: VIN,
    job: { status: "done", commentLang: "lv" },
    serviceWorks: [
      r("11.11.2025", "140740", "Apsildes elements", "Autohaus Hoyer GmbH"),
      r("09.11.2022", "140740", "Aizdedzes spole\nPneimobalons (aizmugurē)", "Autohaus Hoyer GmbH"),
      r("29.07.2018", "109818", "Eļļas maiņa"),
      r("21.07.2014", "37274", "Eļļas maiņa", "Auto Center Weiterstadt GmbH"),
    ],
    rawEvents: [
      ev("2025-11-11", "140740", "Heating element", "Autohaus Hoyer GmbH"),
      ev("2022-11-09", "140740", "Ignition coil\nPneumatic spring, rear", "Autohaus Hoyer GmbH"),
      ev("2018-07-29", "109818", "Oil service"),
      ev("2014-07-21", "37274", "Engine oil change", "Auto Center Weiterstadt GmbH"),
    ],
    oilNotes: OIL_OK,
    comments: COMMENTS_OK,
    code: {
      oilChangeCount: 2,
      avgIntervalKm: 72_544,
      ringIntervalKm: null,
      maxIntervalKm: 72_544,
      minIntervalKm: 72_544,
      longestGapKm: 72_544,
      longestGapMonths: 48,
      monthsSinceLast: 12,
    },
    drivetrain: null,
    powertrainContradiction: false,
    draftVin: VIN,
    pdf: { filename: `OFICIALA_DILERA_DATI_${VIN}.pdf`, at: "2026-11-22T10:00:00.000Z" },
    ...over,
  };
}

function check(gate: DealerShadowGate, id: DealerGateCheckId) {
  return gate.checks.find((c) => c.id === id)!;
}

describe("evaluateDealerQualityGate", () => {
  it("tīra atskaite -> «sistēma sūtītu», visas 8 pārbaudes ok", () => {
    const gate = evaluateDealerQualityGate(base(), { nowIso: "2026-11-22T10:00:00.000Z", trigger: "job" });
    expect(gate.verdict).toBe("would_send");
    expect(gate.checks).toHaveLength(8);
    expect(gate.checks.filter((c) => c.state !== "ok")).toEqual([]);
    expect(gate).toMatchObject({ at: "2026-11-22T10:00:00.000Z", version: 1, trigger: "job" });
  });

  it("(h) datu nav / kļūda -> aizturētu, pārējās pārbaudes izlaistas", () => {
    for (const status of ["no_data", "failed", "no_vin", "running"] as const) {
      const gate = evaluateDealerQualityGate(base({ job: { status, error: status === "failed" ? "http_500" : undefined } }));
      expect(gate.verdict).toBe("would_hold");
      expect(check(gate, "job_status").state).toBe("fail");
      expect(gate.checks.filter((c) => c.id !== "job_status").every((c) => c.state === "skip")).toBe(true);
    }
    const refunded = evaluateDealerQualityGate(
      base({ job: { status: "done", refund: { kind: "stripe", stripeRefundId: "re_1", amountCents: 2499, at: "x" } as never } }),
    );
    expect(check(refunded, "job_status").reason).toMatch(/atgriezts/);
  });

  it("(a) WBAMZ71040DM71041: 09.11.2022 vizīte pielikta 11.11.2025 (vienāds km, 3 gadi) -> aizturētu", () => {
    const gate = evaluateDealerQualityGate(
      base({
        serviceWorks: [
          r("11.11.2025", "140740", "Apsildes elements\nAizdedzes spole\nPneimobalons (aizmugurē)"),
          r("29.07.2018", "109818", "Eļļas maiņa"),
          r("21.07.2014", "37274", "Eļļas maiņa"),
        ],
      }),
    );
    expect(gate.verdict).toBe("would_hold");
    const c = check(gate, "raw_dates");
    expect(c).toMatchObject({ state: "fail", severity: "block", place: "service_table" });
    expect(c.reason).toContain("09.11.2022 · 140 740 km");
    expect(c.reason).toContain("11.11.2025");
  });

  it("(a) W0LJ7BJBSBV658020: tabulas datums 20.08.2019, RAW eļļas maiņa 10.07.2019 ar citu km -> aizturētu", () => {
    const gate = evaluateDealerQualityGate(
      base({
        serviceWorks: [r("20.08.2019", "329671", "Dzinēja eļļas un filtra maiņa")],
        rawEvents: [ev("10.07.2019", "329500", "Motoröl wechseln")],
      }),
    );
    const c = check(gate, "raw_dates");
    expect(c.state).toBe("fail");
    expect(c.reason).toMatch(/Tabulā 20\.08\.2019 · 329 671 km - RAW šāda ieraksta nav/);
  });

  it("(a) tā pati vizīte (vienāds km, 4 dienas) - sapludināta rinda atbilst RAW", () => {
    const gate = evaluateDealerQualityGate(
      base({
        serviceWorks: [r("05.02.2025", "199228", "Sveces\nEļļas maiņa", "Zenter Autohaus")],
        rawEvents: [ev("05.02.2025", "199228", "Zündkerzen", "Zenter Autohaus"), ev("01.02.2025", "199228", "Ölwechsel", "Zenter Autohaus")],
      }),
    );
    expect(check(gate, "raw_dates").state).toBe("ok");
  });

  it("(b) W0LJ7BJBSBV658020: AI teksts 13 eļļas maiņas, tabula 6 -> aizturētu", () => {
    const gate = evaluateDealerQualityGate(
      base({
        code: { ...base().code, oilChangeCount: 6 },
        oilNotes: "Ražotāja intervāls: 30 000 km / 12 mēn.\nDīlera datos fiksētas 13 eļļas maiņas laikā no 2011. līdz 2025. gadam.",
      }),
    );
    expect(gate.verdict).toBe("would_hold");
    const c = check(gate, "oil_facts");
    expect(c).toMatchObject({ state: "fail", severity: "block", place: "oil_notes" });
    expect(c.reason).toMatch(/Tekstā 13 eļļas maiņas, kods \(PDF tabula\) - 6/);
  });

  it("(b) vidējais intervāls tekstā nesakrīt ar kodu -> aizturētu; ±3 % pielaide der", () => {
    const wrong = evaluateDealerQualityGate(
      base({ oilNotes: `${OIL_OK}\nVidējais intervāls starp maiņām: 16 518 km.` }),
    );
    expect(check(wrong, "oil_facts").reason).toMatch(/Vidējais intervāls tekstā 16 518 km, kods - 72 544 km/);
    const close = evaluateDealerQualityGate(base({ oilNotes: `${OIL_OK}\nVidējais intervāls starp maiņām: 72 600 km.` }));
    expect(check(close, "oil_facts").state).toBe("ok");
  });

  it("(b) WDD2122231A338701: «kopš pēdējā ieraksta 9 mēn.», kods 133 mēn. -> aizturētu", () => {
    const gate = evaluateDealerQualityGate(
      base({
        code: { ...base().code, monthsSinceLast: 133 },
        comments: `${COMMENTS_OK} Kopš pēdējā dīlera ieraksta pagājuši 9 mēn.`,
      }),
    );
    expect(check(gate, "oil_facts")).toMatchObject({ state: "fail", place: "comments" });
  });

  it("extractOilChangeCountClaims: skaitļi un vārdi; tūkstošu grupa un gads nav skaits", () => {
    expect(extractOilChangeCountClaims("Fiksētas sešas dzinēja eļļas maiņas.").map((c) => c.count)).toEqual([6]);
    expect(extractOilChangeCountClaims("Eļļas maiņa veikta 4 reizes.").map((c) => c.count)).toEqual([4]);
    expect(extractOilChangeCountClaims("Eļļas maiņas: 3.").map((c) => c.count)).toEqual([3]);
    expect(extractOilChangeCountClaims("Pie 30 000 km eļļas maiņa. Eļļas maiņa 2019. gadā.")).toEqual([]);
  });

  it("(c) SJNFFAJ11U2507806: netulkotas rindas - 1-2 brīdinājums, 3+ aizturētu; RAW produktam izlaists", () => {
    const one = evaluateDealerQualityGate(
      base({ serviceWorks: [...base().serviceWorks.slice(0, 3), r("21.07.2014", "37274", "Nissan Customer Maintenance Plan")] }),
    );
    expect(check(one, "translation")).toMatchObject({ state: "fail", severity: "warn" });
    expect(check(one, "translation").reason).toContain("Nissan Customer Maintenance Plan");
    expect(one.verdict).toBe("would_send");

    const many = evaluateDealerQualityGate(
      base({
        serviceWorks: [
          ...base().serviceWorks.slice(0, 3),
          r("21.07.2014", "37274", "Roadside Recovery\nNissan Customer Maintenance Plan\nKey Read History"),
        ],
      }),
    );
    expect(check(many, "translation")).toMatchObject({ state: "fail", severity: "block" });
    expect(many.verdict).toBe("would_hold");

    const rawProduct = evaluateDealerQualityGate(
      base({ job: { status: "done", skipTranslate: true, commentLang: "source" }, serviceWorks: [r("21.07.2014", "37274", "Roadside Recovery")] }),
    );
    expect(check(rawProduct, "translation").state).toBe("skip");
  });

  it("(d) aizliegtie: ieteikums, «eksperts», garā domuzīme, IRISS -> aizturētu", () => {
    const cases = [
      ["Pārdevējam jālūdz servisa rēķini par 2022. gadu.", "ieteikums"],
      ["Apskatē ieteicams pārbaudīt pneimatisko piekari.", "ieteikums"],
      ["Eksperta slēdziens: ieraksti pilnīgi.", "eksperts"],
      ["Ieraksti 2014 — 2025 ir pilnīgi un secīgi bez robiem.", "domuzīme"],
      ["Dati sagatavoti IRISS sistēmā no dīlera ierakstiem.", "IRISS"],
    ] as const;
    for (const [sentence, what] of cases) {
      const gate = evaluateDealerQualityGate(base({ comments: `${COMMENTS_OK} ${sentence}` }));
      const c = check(gate, "forbidden");
      expect(c.state, sentence).toBe("fail");
      expect(c.reason).toContain(what);
      expect(gate.verdict).toBe("would_hold");
    }
  });

  it("(e) reģistrs 1 dzenošā ass, AI raksta 4Motion -> aizturētu", () => {
    const gate = evaluateDealerQualityGate(
      base({
        drivetrain: { drivenAxles: 1, awd: false, sourceLabel: "DMR" },
        comments: `${COMMENTS_OK} Auto ir aprīkots ar 4Motion pilnpiedziņu.`,
      }),
    );
    expect(check(gate, "contradictions")).toMatchObject({ state: "fail", severity: "block", place: "comments" });
  });

  it("(e) WAUZZZF47HA003895: RAW tikai «Particulate filter.», AI «pārbaudīts kvēpu filtrs» -> brīdinājums", () => {
    const raw = [ev("2025-01-08", "252933", "Particulate filter.\nEmergency battery for telematics.")];
    expect(
      findPositionOnlyActionClaims("2025. gada 8. janvārī pārbaudīts kvēpu filtrs (DPF).", raw).map((h) => h.date),
    ).toEqual(["08.01.2025"]);
    expect(findPositionOnlyActionClaims("08.01.2025 ierakstā ir pozīcija: kvēpu filtrs.", raw)).toEqual([]);
    const gate = evaluateDealerQualityGate(
      base({
        serviceWorks: [r("08.01.2025", "252933", "Kvēpu filtrs\nTelemātikas avārijas akumulators")],
        rawEvents: raw,
        comments: `${COMMENTS_OK} 08.01.2025 nomainīts telemātikas avārijas akumulators.`,
      }),
    );
    expect(check(gate, "contradictions")).toMatchObject({ state: "fail", severity: "warn" });
  });

  it("(e) kritiska avotu pretruna -> brīdinājums, spriedumu nemaina", () => {
    const gate = evaluateDealerQualityGate(
      base({
        sourceIssues: [
          {
            id: "mileage_drop_x",
            kind: "mileage_drop",
            severity: "critical",
            title: "Nobraukums samazinās starp avotiem, −30 000 km",
            values: [
              { source: "CSDD", value: "180 000 km (15.06.2021)" },
              { source: "OFICIĀLĀ DĪLERA DATI", value: "150 000 km (01.09.2022)" },
            ],
          },
        ],
      }),
    );
    expect(check(gate, "contradictions")).toMatchObject({ state: "fail", severity: "warn" });
    expect(check(gate, "contradictions").reason).toContain("Avotu pretruna");
  });

  it("(e) dzinēja / degvielas pretruna -> aizturētu", () => {
    const gate = evaluateDealerQualityGate(base({ powertrainContradiction: true }));
    expect(check(gate, "contradictions")).toMatchObject({ state: "fail", severity: "block" });
  });

  it("(f) PDF vēl nav -> brīdinājums (sūtītu); cits VIN PDF vai melnrakstā -> aizturētu", () => {
    const noPdf = evaluateDealerQualityGate(base({ pdf: null }));
    expect(check(noPdf, "pdf")).toMatchObject({ state: "fail", severity: "warn" });
    expect(noPdf.verdict).toBe("would_send");

    const otherVin = evaluateDealerQualityGate(
      base({ pdf: { filename: "OFICIALA_DILERA_DATI_W0LJ7BJBSBV658020_EN.pdf", at: "x" } }),
    );
    expect(check(otherVin, "pdf").reason).toMatch(/PDF VIN W0LJ7BJBSBV658020 nesakrīt/);
    expect(otherVin.verdict).toBe("would_hold");

    const draft = evaluateDealerQualityGate(base({ draftVin: "SJNFFAJ11U2507806" }));
    expect(check(draft, "pdf").reason).toMatch(/Melnraksta VIN/);
    expect(vinFromDealerPdfFilename(`OFICIALA_DILERA_DATI_${VIN}_DE.pdf`)).toBe(VIN);
  });

  it("(g) tukšs vai par īsu AI lauks -> aizturētu", () => {
    expect(check(evaluateDealerQualityGate(base({ comments: "" })), "ai_fields").reason).toMatch(/Komentāri» ir tukšs/);
    expect(check(evaluateDealerQualityGate(base({ oilNotes: "Ražotāja intervāls." })), "ai_fields").reason).toMatch(/par īsu/);
  });
});

describe("buildDealerQualityGateInput", () => {
  it("ņem tabulu, RAW un AI laukus no melnraksta; eļļas skaits tas pats, ko PDF tabula", () => {
    const blocks = createDefaultSourceBlocks();
    blocks.auto_records = {
      ...blocks.auto_records,
      serviceWorks: base().serviceWorks.map((x) => ({ ...x })),
      oilChangeIntervalNotes: `<p>${OIL_OK}</p>`,
      comments: `<p>${COMMENTS_OK}</p>`,
      oneautoIngest: {
        vinOverride: "",
        lastFetchedVin: VIN,
        fetchedAt: "",
        selectedProducts: [],
        lastCostEur: "",
        results: {},
        serviceTimelineOriginal: [...base().rawEvents],
      },
    };
    const input = buildDealerQualityGateInput({
      job: { vin: VIN, status: "done", commentLang: "lv" },
      sourceBlocks: blocks,
      pdf: null,
      nowMs: Date.UTC(2026, 10, 22),
    });
    expect(input.serviceWorks).toHaveLength(4);
    expect(input.rawEvents).toHaveLength(4);
    expect(input.code.oilChangeCount).toBe(2);
    expect(input.comments).toContain("4 servisa ieraksti");
    const gate = evaluateDealerQualityGate(input);
    expect(gate.checks.filter((c) => c.state === "fail").map((c) => c.id)).toEqual(["pdf"]);
    expect(gate.verdict).toBe("would_send");
  });
});
