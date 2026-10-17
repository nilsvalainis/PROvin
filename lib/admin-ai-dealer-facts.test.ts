import { describe, expect, it } from "vitest";
import { emptyAutoRecordsBlock } from "@/lib/admin-source-blocks";
import { emptyOneautoBlock } from "@/lib/oneauto-block";
import { emptyOneautoIngest } from "@/lib/oneauto-to-auto-records";
import {
  buildDealerFactsBrief,
  checkMapAgainstDealerFacts,
  detectDealerComponents,
  extractDealerCampaignCode,
  extractDealerFacts,
  fillAlreadyDoneEvidenceFromDealer,
  findTextContradictionsWithDealer,
  isDealerCampaignText,
  textMentionsDealerCampaigns,
} from "@/lib/admin-ai-dealer-facts";
import { lintTechnicalRiskText } from "@/lib/admin-ai-technical-risk-lint";
import { scoreTechRiskAbPair } from "@/lib/admin-ai-tech-risk-ab-harness";
import type { TechnicalRiskMap } from "@/lib/admin-ai-technical-risk-map-types";

function block() {
  const b = emptyOneautoBlock();
  b.display = {
    equipment: [{ label: "Warranty start", value: "2018-03-14" }],
    powertrain: [{ label: "Engine", value: "N47D20" }],
    serviceTimeline: [
      { date: "2019-05-02", odometer: "60 120", place: "BMW Partner", works: "Engine oil service; filter" },
      { date: "2021-08-10", odometer: "121000", place: "BMW Partner", works: "Timing chain kit replaced (Steuerkette)" },
      { date: "2022-01-15", odometer: "140500", place: "BMW Partner", works: "Technische Aktion 0012345678 software update" },
    ],
  };
  return b;
}

function map(over: Partial<TechnicalRiskMap> = {}): TechnicalRiskMap {
  return {
    identification: {
      engine: { value: "N47D20", confidence: "A", evidence: "", candidates: [] },
      gearbox: { value: "", confidence: "C", evidence: "", candidates: [] },
      platform: { value: "", confidence: "C", evidence: "", candidates: [] },
    },
    risks: [
      {
        component: "sadales ķēde",
        failure_mode: "izstiepšanās",
        typical_km_range: null,
        this_car_position: "iekšā",
        already_done_evidence: null,
        probability: "medium",
        impact: "high",
        priority: 1,
        applies_to_this_car: true,
        confidence: "high",
        sources: [],
        cost_band_eur: null,
        inspection_hint: "",
      },
    ],
    damage_interpretation: [],
    recalls: [{ id_or_title: "nav atrasts", source: "KBA", status_known: false }],
    strengths: [],
    unknowns: [],
    ...over,
  };
}

describe("extractDealerFacts", () => {
  it("dod stabilus ID, km, mezglus un kampaņas", () => {
    const f = extractDealerFacts(block());
    expect(f.rows.map((r) => r.id)).toEqual(["D1", "D2", "D3"]);
    expect(f.rows[0]!.odometerKm).toBe(60120);
    expect(f.rows[1]!.components).toContain("timing_chain");
    expect(f.rows[2]!.kind).toBe("campaign");
    expect(f.rows[2]!.campaignCode).toBe("0012345678");
    expect(f.vehicle).toEqual([{ label: "Warranty start", value: "2018-03-14" }]);
  });

  it("ņem oriģinālvalodu no auto_records, ne tukšo oneauto.display", () => {
    const oneauto = emptyOneautoBlock();
    expect(oneauto.display.serviceTimeline).toEqual([]);
    const autoRecords = emptyAutoRecordsBlock();
    autoRecords.serviceWorks = [
      { date: "12.03.2024", odometer: "45210", location: "Kia Rīga", works: "Kampaņas LV tulkojums 240S09" },
    ];
    autoRecords.oneautoIngest = {
      ...emptyOneautoIngest(),
      serviceTimelineOriginal: [
        {
          date: "12.03.2024",
          odometer: "45210",
          place: "Kia Autohaus",
          works: "Type: Campaign 240S09\nAirbag software update",
        },
      ],
    };
    const f = extractDealerFacts({ oneauto, autoRecords });
    expect(f.rows).toHaveLength(1);
    expect(f.rows[0]!.works).toMatch(/Type:\s*Campaign 240S09/i);
    expect(f.rows[0]!.works).not.toMatch(/tulkojums/i);
    expect(f.rows[0]!.kind).toBe("campaign");
    expect(f.rows[0]!.campaignCode).toBe("240S09");
    expect(f.rows[0]!.date).toBe("12.03.2024");
    expect(f.rows[0]!.odometerKm).toBe(45210);
  });

  it("Kia, Volvo un VAG oriģinālvalodas paraugi dod kampaņas rindas ar kodu, datumu un km", () => {
    const kia = extractDealerFacts({
      autoRecords: {
        serviceWorks: [],
        oneautoIngest: {
          serviceTimelineOriginal: [
            {
              date: "2024-03-12",
              odometer: "45 210",
              place: "Kia Motors",
              works: "Type: Campaign\n240S09 Safety Recall airbag ECU",
            },
          ],
        },
      },
    });
    expect(kia.rows).toHaveLength(1);
    expect(kia.rows[0]).toMatchObject({
      kind: "campaign",
      campaignCode: "240S09",
      odometerKm: 45210,
    });
    expect(kia.rows[0]!.date).toMatch(/12\.03\.2024|2024-03-12/);

    const volvo = extractDealerFacts({
      autoRecords: {
        serviceWorks: [],
        oneautoIngest: {
          serviceTimelineOriginal: [
            {
              date: "08.06.2021",
              odometer: "87300",
              place: "Volvo Partner",
              works: "Recall uitgevoerd volgens QB R29904. Safety Recall P12. S29975 executed.",
            },
          ],
        },
      },
    });
    expect(volvo.rows).toHaveLength(1);
    expect(volvo.rows[0]!.kind).toBe("campaign");
    expect(volvo.rows[0]!.campaignCode).toBe("R29904");
    expect(volvo.rows[0]!.odometerKm).toBe(87300);
    expect(volvo.rows[0]!.date).toBe("08.06.2021");

    const vag = extractDealerFacts({
      autoRecords: {
        serviceWorks: [],
        oneautoIngest: {
          serviceTimelineOriginal: [
            {
              date: "03.11.2020",
              odometer: "61200",
              place: "Volkswagen Zentrum",
              works: "Aktion 23E7 software. Rückruf / Actie uitgevoerd.",
            },
          ],
        },
      },
    });
    expect(vag.rows).toHaveLength(1);
    expect(vag.rows[0]).toMatchObject({
      kind: "campaign",
      campaignCode: "23E7",
      date: "03.11.2020",
      odometerKm: 61200,
    });
  });

  it("ja oriģināls tukšs, ņem serviceWorks un atpazīst LV stumbrus bez \\b", () => {
    const f = extractDealerFacts({
      oneauto: emptyOneautoBlock(),
      autoRecords: {
        serviceWorks: [
          {
            date: "01.04.2023",
            odometer: "99000",
            location: "Dīleris",
            works: "Servisa kampaņa izpildīta. Atsaukums un servisa akcija fiksēta.",
          },
        ],
        oneautoIngest: { serviceTimelineOriginal: [] },
      },
    });
    expect(f.rows).toHaveLength(1);
    expect(f.rows[0]!.kind).toBe("campaign");
    expect(isDealerCampaignText("kampaņa")).toBe(true);
    expect(isDealerCampaignText("atsaukums")).toBe(true);
    expect(isDealerCampaignText("servisa akcija")).toBe(true);
    expect(extractDealerCampaignCode("Type: Recall 21C026")).toBe("21C026");
  });

  it("bez OneAuto datiem brīfs tukšs", () => {
    expect(buildDealerFactsBrief(extractDealerFacts(null))).toBe("");
    expect(buildDealerFactsBrief(extractDealerFacts(emptyOneautoBlock()))).toBe("");
  });

  it("brīfā nav EUR", () => {
    const brief = buildDealerFactsBrief(extractDealerFacts(block()));
    expect(brief).toContain("D2");
    expect(brief).not.toMatch(/€|EUR/);
  });

  it("atpazīst mezglus vairākās valodās", () => {
    expect(detectDealerComponents("Wasserpumpe ersetzt")).toContain("water_pump");
    expect(detectDealerComponents("Distributieriem vervangen")).toContain("timing_belt");
    expect(detectDealerComponents("Ūdens sūkņa maiņa")).toContain("water_pump");
  });
});

describe("karte pret dīlera faktiem", () => {
  const f = extractDealerFacts(block());

  it("DF1 un DF2", () => {
    const ids = checkMapAgainstDealerFacts(map(), f).map((i) => i.id);
    expect(ids).toEqual(["DF1", "DF2"]);
  });

  it("aizpilda already_done_evidence ar D ID, neko neizdzēš", () => {
    const m = fillAlreadyDoneEvidenceFromDealer(map(), f);
    expect(m.risks).toHaveLength(1);
    expect(m.risks[0]!.already_done_evidence).toMatch(/^D2 /);
    expect(checkMapAgainstDealerFacts(m, f).map((i) => i.id)).toEqual(["DF2"]);
  });
});

describe("teksts pret dīlera faktiem", () => {
  const f = extractDealerFacts(block());
  const bad = "Sadales ķēde\nSadales ķēdes maiņa ir nepieciešama tuvākajā laikā.";
  const good = "Sadales ķēde\nDīlera datos jau fiksēta sadales ķēdes maiņa (D2, 10.08.2021). Klātienē klausies auksto startu.";

  it("atrod pretrunu", () => {
    expect(findTextContradictionsWithDealer(bad, f)).toHaveLength(1);
    expect(findTextContradictionsWithDealer(good, f)).toHaveLength(0);
  });

  it("L14 ir kļūda izturīgam mezglam, L15 brīdinājums par nepieminētu kampaņu", () => {
    const r = lintTechnicalRiskText({ text: bad, dealerFacts: f });
    expect(r.errors.some((e) => e.id === "L14")).toBe(true);
    expect(r.warnings.some((w) => w.id === "L15")).toBe(true);
    expect(textMentionsDealerCampaigns("Kampaņa izpildīta (D3).", f)).toBe(true);
  });

  it("bez dīlera faktiem L14/L15 neizpildās", () => {
    const r = lintTechnicalRiskText({ text: bad });
    expect(r.issues.some((i) => i.id === "L14" || i.id === "L15")).toBe(false);
  });

  it("A/B harness skaita dīlera pretrunas", () => {
    const s = scoreTechRiskAbPair({ slot: 1, id: "x", label: "x", old: bad, new: good, map: map(), dealerFacts: f });
    expect(s.dealer.contradictionsOld).toBe(1);
    expect(s.dealer.contradictionsNew).toBe(0);
    expect(s.dealer.dealerRows).toBe(3);
  });
});
