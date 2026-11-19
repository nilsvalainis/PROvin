import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { extractDealerFactsFromServiceWorks } from "@/lib/admin-ai-dealer-facts";
import type { AutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import {
  dealerAccidentZoneDetail,
  dealerAssemblyReplacedDetail,
  dealerMajorWorkCategory,
  hasAnyMajorAssemblyRepair,
  isAccidentRepairWork,
  isMajorAssemblyRepairWork,
  isRoutineMaintenanceWork,
} from "@/lib/dealer-major-works";
import {
  buildDealerMajorWorksHtml,
  collectDealerMajorWorkHits,
  dealerVisitMajorMarker,
} from "@/lib/pdf-dealer-timeline";
import { buildDealerServiceVisitsHtml } from "@/lib/pdf-dealer-service-visits";

describe("Negadījuma / virsbūves remonts (accident_repair)", () => {
  it.each([
    ["LV virsbūves remonts", "Virsbūves remonts"],
    ["LV krāsošana pēc bojājuma", "Priekšējā spārna krāsošana pēc bojājuma"],
    ["LV avārijas remonts", "Avārijas remonts, priekšējais bamperis"],
    ["LV apdrošināšanas remonts", "Apdrošināšanas remonts (KASKO)"],
    ["LV sadursme", "Remonts pēc sadursmes"],
    ["LV negadījums", "Bojājumu novēršana pēc negadījuma"],
    ["LV translit kuzova remonts", "Kuzova remonts"],
    ["DE Unfallinstandsetzung", "Unfallinstandsetzung vorne rechts"],
    ["DE Karosserie", "Karosseriearbeiten Heckklappe"],
    ["DE Unfallschaden", "Unfallschaden instandgesetzt, Stoßfänger lackiert"],
    ["DE Versicherungsschaden", "Versicherungsschaden: Tür hinten links"],
    ["EN accident repair", "Accident repair front end"],
    ["EN collision", "Collision damage repair, rear bumper"],
    ["EN body shop", "Body shop repair after impact"],
    ["EN insurance repair", "Insurance repair - left quarter panel"],
    ["RU кузовной ремонт", "Кузовной ремонт"],
    ["RU ремонт после ДТП", "Ремонт после ДТП"],
    ["RU покраска после повреждения", "Покраска двери после повреждения"],
  ])("tiek atpazīts: %s", (_label, works) => {
    expect(isAccidentRepairWork(works)).toBe(true);
    expect(isMajorAssemblyRepairWork(works, "accident_repair")).toBe(true);
    expect(hasAnyMajorAssemblyRepair(works)).toBe(true);
    expect(isRoutineMaintenanceWork(works)).toBe(false);
  });

  it.each([
    ["LV apkope", "Apkope. Motoreļļas un filtra maiņa"],
    ["LV stikla tīrītāji", "Stikla tīrītāju slotiņu maiņa"],
    ["LV mazgāšana", "Auto mazgāšana"],
    ["LV avārijas signalizācija", "Avārijas signalizācijas slēdža nomaiņa"],
    ["LV atsaukums", "Garantijas atsaukums, programmatūras atjauninājums"],
    ["DE Inspektion", "Inspektion mit Ölservice"],
    ["DE Wäsche", "Karosseriewäsche und Innenreinigung"],
    ["DE unfallfrei", "Fahrzeug unfallfrei, Inspektion durchgeführt"],
    ["DE Rückruf", "Rückruf: Airbag Gasgenerator erneuert"],
    ["DE Karosseriesteuergerät", "Karosseriesteuergerät programmiert"],
    ["DE Rost Garantie", "Karosserie Durchrostungsgarantie Prüfung"],
    ["EN accident check", "Accident check"],
    ["EN collision warning", "Collision warning camera calibration"],
    ["EN safety recall", "Safety recall - body control module update"],
    ["EN wipers", "Wiper blades replaced"],
    ["EN no accident", "No accident damage found, vehicle inspection"],
    ["RU аварийная сигнализация", "Замена кнопки аварийной сигнализации"],
    ["RU ТО", "Плановое ТО: замена масла и фильтра"],
  ])("rutīna nav negadījums: %s", (_label, works) => {
    expect(isAccidentRepairWork(works)).toBe(false);
    expect(isMajorAssemblyRepairWork(works, "accident_repair")).toBe(false);
  });

  it("negadījuma remonts nedublējas kā Virsbūve / stikls", () => {
    expect(isMajorAssemblyRepairWork("Unfallinstandsetzung Stoßfänger lackiert", "body_glass")).toBe(false);
    // Bez negadījuma vārda paliek esošā kategorija.
    expect(isMajorAssemblyRepairWork("Kreisā spārna pārkrāsošana", "body_glass")).toBe(true);
    expect(isMajorAssemblyRepairWork("Kreisā spārna pārkrāsošana", "accident_repair")).toBe(false);
  });

  it("kategorija: negadījums atsevišķi no mehāniskajiem mezgliem", () => {
    expect(dealerMajorWorkCategory("accident_repair")).toBe("accident");
    expect(dealerMajorWorkCategory("gearbox")).toBe("mechanical");
    expect(dealerMajorWorkCategory("body_glass")).toBe("mechanical");
  });
});

const ROWS: AutoRecordsServiceWorkRow[] = [
  { date: "10.03.2018", odometer: "20000", location: "Dīleris A", works: "Inspektion mit Ölservice" },
  { date: "05.06.2019", odometer: "41000", location: "Dīleris A", works: "Unfallinstandsetzung vorne rechts" },
  { date: "12.02.2020", odometer: "58000", location: "Dīleris B", works: "Getriebe getauscht" },
  { date: "20.09.2021", odometer: "79000", location: "Dīleris B", works: "Accident repair rear bumper" },
  { date: "01.04.2022", odometer: "90000", location: "Dīleris B", works: "Wiper blades replaced" },
];

function visitBoxes(html: string): string[] {
  return html.match(/<article class="pdf-svc-box[^"]*">[\s\S]*?<\/article>/g) ?? [];
}

function boxFor(html: string, needle: string): string {
  return visitBoxes(html).find((b) => b.includes(needle)) ?? "";
}

describe("Lielo darbu izcelšana servisa vizītēs", () => {
  const facts = extractDealerFactsFromServiceWorks(ROWS);

  it("katrs negadījums ir savs ieraksts Lielajos darbos", () => {
    const hits = collectDealerMajorWorkHits(facts);
    const accidents = hits.filter((h) => h.id === "accident_repair");
    expect(accidents.map((h) => h.date)).toEqual(["05.06.2019", "20.09.2021"]);
    expect(hits.some((h) => h.id === "gearbox")).toBe(true);
    const major = buildDealerMajorWorksHtml(facts, "lv");
    expect(major).toContain("pdf-svc-major__item--accident");
    expect(major).toContain("Negadījuma / virsbūves remonts");
  });

  it("iekrāso tās pašas rindas: negadījums sarkanīgs, mezgls atsevišķi, rutīna bez akcenta", () => {
    const html = buildDealerServiceVisitsHtml(ROWS, {
      condenseRecords: true,
      majorMarksForRow: dealerVisitMajorMarker(facts),
    });
    const accident = boxFor(html, "Unfallinstandsetzung");
    expect(accident).toContain("pdf-svc-box--hl pdf-svc-box--accident");
    expect(accident).toContain("pdf-svc-hl__item--accident");
    expect(accident).not.toContain("pdf-svc-major-chip");
    expect(accident).toContain("Bojājuma remonts");

    const gearbox = boxFor(html, "Getriebe getauscht");
    expect(gearbox).toContain("pdf-svc-box--hl pdf-svc-box--mechanical");
    expect(gearbox).toContain("pdf-svc-hl__item--mechanical");
    expect(gearbox).toContain("Ātrumkārba");

    expect(boxFor(html, "Inspektion")).not.toContain("pdf-svc-box--hl");
    expect(boxFor(html, "Wiper blades")).not.toContain("pdf-svc-box--hl");
  });

  it("tulko čipa etiķeti atskaites valodā", () => {
    const html = buildDealerServiceVisitsHtml(ROWS, {
      condenseRecords: true,
      lang: "en",
      majorMarksForRow: dealerVisitMajorMarker(facts),
    });
    expect(boxFor(html, "Unfallinstandsetzung")).toContain("Damage repair");
  });

  it("operatora slēptais ieraksts netiek iekrāsots", () => {
    const hits = collectDealerMajorWorkHits(facts);
    const first = hits.find((h) => h.id === "accident_repair")!;
    const html = buildDealerServiceVisitsHtml(ROWS, {
      condenseRecords: true,
      majorMarksForRow: dealerVisitMajorMarker(facts, [
        { key: `accident_repair@${first.factId}`, action: "hide" },
      ]),
    });
    expect(boxFor(html, "Unfallinstandsetzung")).not.toContain("pdf-svc-box--hl");
    expect(boxFor(html, "Accident repair rear bumper")).toContain("pdf-svc-box--accident");
  });

  it("operatora pievienots ieraksts iekrāso rindu pēc datuma / km", () => {
    const html = buildDealerServiceVisitsHtml(ROWS, {
      condenseRecords: true,
      majorMarksForRow: dealerVisitMajorMarker(facts, [
        { key: "custom:1", action: "set", assemblyId: "body_glass", date: "01.04.2022", km: "90 000 km" },
      ]),
    });
    const wiper = boxFor(html, "Wiper blades");
    expect(wiper).toContain("pdf-svc-box--mechanical");
    expect(wiper).toContain("Virsbūve / stikls");
  });

  it("operatora kategorijas maiņa maina krāsu", () => {
    const hits = collectDealerMajorWorkHits(facts);
    const gearbox = hits.find((h) => h.id === "gearbox")!;
    const html = buildDealerServiceVisitsHtml(ROWS, {
      condenseRecords: true,
      majorMarksForRow: dealerVisitMajorMarker(facts, [
        { key: `gearbox@${gearbox.factId}`, action: "set", assemblyId: "accident_repair" },
      ]),
    });
    expect(boxFor(html, "Getriebe getauscht")).toContain("pdf-svc-box--accident");
  });

  it("bez marķiera HTML paliek kā iepriekš", () => {
    const html = buildDealerServiceVisitsHtml(ROWS, { condenseRecords: true });
    expect(html).not.toContain("pdf-svc-box--hl");
    expect(html).not.toContain("pdf-svc-hl");
  });
});

describe("Galvenes josla (variants 2)", () => {
  const facts = extractDealerFactsFromServiceWorks(ROWS);
  const render = (lang: "lv" | "en" | "ru" | "de") =>
    buildDealerServiceVisitsHtml(ROWS, {
      condenseRecords: true,
      lang,
      majorMarksForRow: dealerVisitMajorMarker(facts),
    });

  it("kategorija + droša precizācija: zona un «nomainīta»", () => {
    const html = render("lv");
    const front = boxFor(html, "Unfallinstandsetzung");
    expect(front).toContain("<b>Bojājuma remonts</b>");
    expect(front).toContain("- priekšā labajā pusē");
    expect(front).toContain("<svg class=\"pdf-svc-hl__ico\"");
    expect(boxFor(html, "Accident repair rear bumper")).toContain("- aizmugurē");
    const gearbox = boxFor(html, "Getriebe getauscht");
    expect(gearbox).toContain("<b>Ātrumkārba</b>");
    expect(gearbox).toContain("- nomainīta");
  });

  it("precizācija tulkota EN/RU/DE", () => {
    expect(boxFor(render("en"), "Unfallinstandsetzung")).toContain("- front right");
    expect(boxFor(render("en"), "Getriebe getauscht")).toContain("- replaced");
    expect(boxFor(render("ru"), "Unfallinstandsetzung")).toContain("- спереди справа");
    expect(boxFor(render("ru"), "Getriebe getauscht")).toContain("Коробка передач");
    expect(boxFor(render("de"), "Unfallinstandsetzung")).toContain("- vorne rechts");
    expect(boxFor(render("de"), "Getriebe getauscht")).toContain("- ersetzt");
  });

  it("operatora pievienots ieraksts bez drošas precizācijas rāda tikai kategoriju", () => {
    const html = buildDealerServiceVisitsHtml(ROWS, {
      condenseRecords: true,
      majorMarksForRow: dealerVisitMajorMarker(facts, [
        { key: "custom:1", action: "set", assemblyId: "body_glass", date: "01.04.2022", km: "90 000 km" },
      ]),
    });
    const wiper = boxFor(html, "Wiper blades");
    expect(wiper).toContain("<b>Virsbūve / stikls</b></span>");
    expect(wiper).not.toContain("pdf-svc-hl__detail");
  });
});

describe("Precizācijas atpazīšana", () => {
  it("zona: DE/EN/LV/RU; pretrunīga vai neminēta - tukša", () => {
    expect(dealerAccidentZoneDetail("Unfallinstandsetzung vorne rechts")).toBe("priekšā labajā pusē");
    expect(dealerAccidentZoneDetail("Accident repair rear left door")).toBe("aizmugurē kreisajā pusē");
    expect(dealerAccidentZoneDetail("Aizmugurējā bampera krāsošana pēc bojājuma")).toBe("aizmugurē");
    expect(dealerAccidentZoneDetail("Ремонт после ДТП, левое переднее крыло")).toBe("priekšā kreisajā pusē");
    expect(dealerAccidentZoneDetail("Unfallinstandsetzung")).toBe("");
    expect(dealerAccidentZoneDetail("Unfallinstandsetzung vorne und hinten")).toBe("");
    expect(dealerAccidentZoneDetail("Inspektion vorne rechts")).toBe("");
  });

  it("«nomainīts» tikai skaidrai nomaiņai", () => {
    expect(dealerAssemblyReplacedDetail("Getriebe getauscht", "gearbox")).toBe("nomainīta");
    expect(dealerAssemblyReplacedDetail("Engine replaced", "engine")).toBe("nomainīts");
    expect(dealerAssemblyReplacedDetail("Getriebe instandgesetzt", "gearbox")).toBe("");
    expect(dealerAssemblyReplacedDetail("Getriebeöl erneuert", "gearbox")).toBe("");
    expect(dealerAssemblyReplacedDetail("Windschutzscheibe ersetzt", "body_glass")).toBe("");
  });
});

describe("Lielie mezgli kopsavilkuma šūna", () => {
  it("vairāki negadījumi kopsavilkumā rāda kategoriju vienreiz", async () => {
    const { buildDealerVisitSummaryHtml } = await import("@/lib/pdf-dealer-timeline");
    const facts = extractDealerFactsFromServiceWorks(ROWS);
    const html = buildDealerVisitSummaryHtml(ROWS, facts, "lv");
    expect(html.match(/Negadījuma \/ virsbūves remonts/g)?.length).toBe(1);
  });
});

describe("Saplūdusi vizīte: mezgla nomaiņa + tā eļļa", () => {
  it.each([
    ["DE", "Getriebe getauscht\nGetriebeöl erneuert"],
    ["DE vienā rindā", "Getriebe getauscht Getriebeöl erneuert"],
    ["EN", "Gearbox replaced. Gearbox oil refilled"],
    ["EN vienā rindā", "Gearbox replaced gearbox oil"],
    ["EN replacement of", "Replacement of automatic transmission, ATF filled"],
    ["RU", "Коробка передач заменена, масло залито"],
    ["RU замена коробки", "Замена коробки передач и масла"],
    ["LV", "Ātrumkārbas nomaiņa, ātrumkārbas eļļa"],
  ])("ātrumkārbas maiņa tiek atpazīta: %s", (_l, works) => {
    expect(isMajorAssemblyRepairWork(works, "gearbox")).toBe(true);
    expect(isRoutineMaintenanceWork(works)).toBe(false);
  });

  it.each([
    ["DE Getriebeöl", "Getriebeöl erneuert"],
    ["DE Ölwechsel Getriebe", "Ölwechsel Getriebe"],
    ["EN gearbox oil", "Gearbox oil replaced"],
    ["EN gearbox oil change", "Gearbox oil and filter change"],
    ["EN ATF", "ATF change automatic transmission"],
    ["EN fluid", "Transmission fluid replaced"],
    ["RU масло АКПП", "Замена масла АКПП"],
    ["RU масло в коробке", "Замена масла в коробке передач"],
    ["LV eļļa", "Ātrumkārbas eļļas maiņa"],
  ])("tikai eļļas maiņa paliek rutīna: %s", (_l, works) => {
    expect(isMajorAssemblyRepairWork(works, "gearbox")).toBe(false);
    expect(hasAnyMajorAssemblyRepair(works)).toBe(false);
  });
});
