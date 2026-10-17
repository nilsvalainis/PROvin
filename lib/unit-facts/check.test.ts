import { describe, expect, it } from "vitest";
import {
  checkAiCommentFacts,
  extractCampaignCodes,
  formatApplicableUnitFactsForPrompt,
  parseVehicleYear,
  splitSentences,
} from "@/lib/unit-facts/check";
import { UNIT_FACTS } from "@/lib/unit-facts/facts";

const ids = (r: ReturnType<typeof checkAiCommentFacts>) => r.flags.map((f) => `${f.level}:${f.id}`);

describe("unit facts base", () => {
  it("every fact has a dated source and unique id; no EUR", () => {
    const seen = new Set<string>();
    for (const f of UNIT_FACTS) {
      expect(seen.has(f.id)).toBe(false);
      seen.add(f.id);
      expect(f.sources.length).toBeGreaterThan(0);
      for (const s of f.sources) expect(s.accessed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(JSON.stringify(f)).not.toMatch(/€|\bEUR\b|eiro/);
      if (f.status === "verified") {
        const strong = f.sources.some((s) => ["oem_doc", "oem_press", "authority"].includes(s.kind));
        const independent = f.sources.filter((s) => s.kind !== "iriss" && s.kind !== "nils").length;
        expect(strong || independent >= 2).toBe(true);
      }
    }
  });
});

describe("splitSentences", () => {
  it("does not split codes with dots", () => {
    expect(splitSentences("Kārba 724.0 ir 7G-DCT. Nākamais teikums.")).toEqual([
      "Kārba 724.0 ir 7G-DCT.",
      "Nākamais teikums.",
    ]);
  });
});

describe("checkAiCommentFacts", () => {
  it("flags ZF on Audi Q7 4L CRCA (IRISS auto 13)", () => {
    const r = checkAiCommentFacts({
      text: "Automātiskā kārba visticamāk ir ZF 8HP, tai iesakām eļļas maiņu.",
      contextText: "CSDD: Audi Q7 4L, dzinējs CRCA, 180 kW",
      year: 2014,
    });
    expect(ids(r)).toContain("E:fact:audi_q7_4l_gearbox_aisin");
  });

  it("accepts Aisin on Q7 4L and flags Aisin on Q7 4M", () => {
    const ok = checkAiCommentFacts({
      text: "Aisin 8 pakāpju kārba 0C8 ir ar hidrotransformatoru.",
      contextText: "Audi Q7 4L CRCA",
      year: 2014,
    });
    expect(ok.flags.filter((f) => f.level === "E")).toEqual([]);
    const bad = checkAiCommentFacts({
      text: "Kārba ir Aisin 8 pakāpju.",
      contextText: "Audi Q7 4M 3.0 TDI CRTC",
      year: 2017,
    });
    expect(ids(bad)).toContain("E:fact:audi_q7_4m_gearbox_zf");
  });

  it("CLAA chain count is disputed: warn, never error", () => {
    const r = checkAiCommentFacts({
      text: "CLAA dzinēja konstrukcijai ir divas sadales ķēdes.",
      contextText: "Audi A6 Allroad, dzinējs CLAA 150 kW, DL501",
    });
    expect(ids(r)).toEqual(["W:disputed:vag_30tdi_gen2_chain_count"]);
  });

  it("flags two chains on first-gen CASA", () => {
    const r = checkAiCommentFacts({
      text: "CASA dzinējam ir divas sadales ķēdes aizmugurē.",
      contextText: "Audi Q7 2008, CASA 176 kW",
    });
    expect(ids(r)).toContain("E:fact:vag_30tdi_gen1_four_chains");
  });

  it("warns on wrong 7G-DCT next service (IRISS auto 7)", () => {
    const r = checkAiCommentFacts({
      text: "Nākamā 7G-DCT kārbas apkope paredzama pie 220-240 tūkst. km.",
      contextText: "Mercedes-Benz CLA 180, 7G-DCT, 90 kW",
    });
    expect(ids(r)).toContain("W:fact:mb_7gdct_service_interval");
  });

  it("warns on 285 kW for M340i and on kW not in data", () => {
    const r = checkAiCommentFacts({
      text: "B58 dzinējs ar 285 kW jaudu ir izturīgs.",
      contextText: "BMW M340i xDrive Touring G21, CSDD jauda 275 kW",
    });
    expect(ids(r)).toEqual(["W:fact:bmw_m340i_power_eu"]);
    const other = checkAiCommentFacts({
      text: "Dzinēja jauda ir 250 kW.",
      contextText: "BMW M340i xDrive Touring G21, CSDD jauda 275 kW",
    });
    expect(ids(other)).toEqual(["W:unsourced_power_kw"]);
  });

  it("flags eMMC on Tesla Model 3 (IRISS auto 1)", () => {
    const r = checkAiCommentFacts({
      text: "Iespējama eMMC atmiņas nodiluma problēma, kas izraisa ekrāna atteici.",
      contextText: "Tesla Model 3 Long Range 2021",
    });
    expect(ids(r)).toContain("E:fact:tesla_emmc_recall_21v035");
    const ok = checkAiCommentFacts({
      text: "eMMC atsaukums 21V-035 attiecas tikai uz Model S un X, uz šo auto neattiecas.",
      contextText: "Tesla Model 3 2021",
    });
    expect(ok.flags.filter((f) => f.level === "E")).toEqual([]);
  });

  it("flags 'no recalls' when order data has A12/00346/20 (IRISS auto 7 text D)", () => {
    const r = checkAiCommentFacts({
      text: "Ražotāja atsaukumi šim auto nav atrasti.",
      contextText: "Safety Gate atsaukums A12/00346/20, ražotāja kampaņa 9190204. Mercedes CLA 180",
    });
    expect(ids(r)).toContain("E:recall_denied");
  });

  it("does not flag recall denial when the code is named", () => {
    const r = checkAiCommentFacts({
      text: "Ražotāja atsaukums A12/00346/20. Izpildes statuss nav zināms, jāpārbauda pēc VIN.",
      contextText: "Safety Gate atsaukums A12/00346/20. Mercedes CLA 180",
    });
    expect(r.flags.filter((f) => f.id === "recall_denied")).toEqual([]);
  });

  it("flags 'no recalls' on Caddy with 48VS in data", () => {
    const r = checkAiCommentFacts({
      text: "Atsaukumu kampaņas šim auto nav.",
      contextText: "VW Caddy 2016 DFSF. Dīleris: kampaņa 48VS nav izpildīta.",
    });
    expect(ids(r)).toContain("E:recall_denied");
  });

  it("48VS Tiguan applicability is disputed: warn, never error", () => {
    const t = checkAiCommentFacts({
      text: "Atsaukums 48VS, visticamāk, uz šo Tiguan neattiecas.",
      contextText: "VW Tiguan 1.5 TSI 2022",
    });
    expect(ids(t)).toEqual(["W:disputed:vw_recall_48vs_scope"]);
    expect(t.flags.filter((f) => f.level === "E")).toEqual([]);
  });

  it("flags 48VS on a model outside the campaign", () => {
    const r = checkAiCommentFacts({
      text: "Pārbaudiet kampaņu 48VS (stūres skrūves).",
      contextText: "Škoda Superb 2.0 TDI 140 kW",
    });
    expect(ids(r)).toContain("E:fact:vw_recall_48vs_other_models");
  });

  it("flags N63 Customer Care on N63TU", () => {
    const r = checkAiCommentFacts({
      text: "Šim dzinējam piemērojama N63 Customer Care Package kampaņa.",
      contextText: "BMW 650i 2013, dzinējs N63TU (N63B44O1) 330 kW",
    });
    expect(ids(r)).toContain("E:fact:bmw_n63_customer_care_scope");
  });

  it("flags single-turbo claim on D5244T15", () => {
    const r = checkAiCommentFacts({
      text: "Dzinējs ir bez divu turbīnu shēmas, tāpēc vienkāršāks.",
      contextText: "Volvo XC60 2013 D5244T15 158 kW",
    });
    expect(ids(r)).toContain("E:fact:volvo_d5244t15_twin_turbo");
  });

  it("ignores pending_nils facts (B3)", () => {
    const r = checkAiCommentFacts({
      text: "D5244T5 ir biturbo dzinējs.",
      contextText: "Volvo S60 D5244T5",
    });
    expect(r.flags.filter((f) => f.factId === "volvo_d5244t5_single_turbo")).toEqual([]);
  });

  it("warns on EA288 belt interval other than 210 000 km", () => {
    const r = checkAiCommentFacts({
      text: "Zobsiksnas maiņa ik pēc 150 000 km.",
      contextText: "Škoda Superb DTUA 140 kW",
    });
    expect(ids(r)).toContain("W:fact:vag_ea288_timing_belt_210k");
    const ok = checkAiCommentFacts({
      text: "Zobsiksnas maiņa ik pēc 210 000 km.",
      contextText: "Škoda Superb DTUA 140 kW",
    });
    expect(ok.flags).toEqual([]);
  });

  it("flags N47 chain at front", () => {
    const r = checkAiCommentFacts({
      text: "Sadales ķēde atrodas dzinēja priekšpusē, maiņa vienkārša.",
      contextText: "BMW X1 E84 N47D20C 105 kW",
    });
    expect(ids(r)).toContain("E:fact:bmw_n47_chain_rear");
  });

  it("warns on unsourced campaign code and interval", () => {
    const r = checkAiCommentFacts({
      text: "Atsaukuma kampaņa 77AB attiecas uz šo modeli. Eļļas maiņa ik pēc 45 000 km.",
      contextText: "Opel Zafira 2015 125 kW",
    });
    expect(ids(r)).toEqual(expect.arrayContaining(["W:unsourced_campaign_code", "W:unsourced_interval"]));
  });

  it("clean text on clean context has no flags", () => {
    const r = checkAiCommentFacts({
      text: "Iesakām klātienē pārbaudīt aukstās palaišanas skaņu un eļļas noplūdes.",
      contextText: "BMW 320d F31 B47D20 140 kW",
    });
    expect(r.flags).toEqual([]);
  });

  it("extractCampaignCodes needs a campaign word nearby", () => {
    expect(extractCampaignCodes("Atsaukums 48VS un 23R7")).toEqual(["48VS", "23R7"]);
    expect(extractCampaignCodes("Modelis 2022, 48VS")).toEqual([]);
  });

  it("formats verified facts for prompt", () => {
    const s = formatApplicableUnitFactsForPrompt({ contextText: "Tesla Model 3 2021" });
    expect(s).toMatch(/^Pārbaudīti fakti/);
    expect(s).toMatch(/nedrīkst būt pretrunā/);
    expect(s).toMatch(/Model S/);
    expect(formatApplicableUnitFactsForPrompt({ contextText: "Opel Zafira" })).toBe("");
  });

  it("prompt block excludes disputed and pending_nils facts", () => {
    const claa = formatApplicableUnitFactsForPrompt({
      contextText: "Audi A6 Allroad, dzinējs CLAA 150 kW, DL501",
    });
    expect(claa).not.toMatch(/STRĪDĪGS|ķēžu skaits/);
    const bItem = formatApplicableUnitFactsForPrompt({ contextText: "Volvo S60 D5244T5" });
    expect(bItem).not.toMatch(/D5244T5/);
    const q7 = formatApplicableUnitFactsForPrompt({
      contextText: "Audi Q7 4L CRCA",
      year: 2014,
    });
    expect(q7).toMatch(/Aisin/);
    expect(q7).not.toMatch(/STRĪDĪG/);
  });
});

describe("parseVehicleYear", () => {
  it("reads CSDD model year, then first registration", () => {
    expect(parseVehicleYear("2014", "")).toBe(2014);
    expect(parseVehicleYear("", "2016-03-12")).toBe(2016);
    expect(parseVehicleYear("abc", "")).toBeNull();
  });
});

describe("unicode word boundaries", () => {
  it("engine code DETA does not match Latvian 'detaļu'", () => {
    const r = checkAiCommentFacts({
      text: "Zobsiksnas maiņa ik pēc 150 000 km.",
      contextText: "Volvo XC60 2013, virsbūves ārējo detaļu kosmētisks remonts",
    });
    expect(r.appliedFactIds).not.toContain("vag_ea288_timing_belt_210k");
  });
});
