/**
 * 26.11.2026 regresija uz īstiem pasūtījumiem: EN/RU/DE PDF palika latviešu teksts.
 * 1) avotu flīze «Izsoles» (pdfTopSources lang="lv"); 2) «1 g. 5 mo.»; 3) izsoļu kartītes bez `lang`;
 * 4) vārdnīcas aizstāšana datu teikumos («Doors nav atveramas», «Grey, metālika»); 5) CSDD TA defektu katalogs.
 */
import { describe, expect, it } from "vitest";
import { buildAuctionArchiveSummary } from "@/lib/auction-archive-offer";
import { buildAuctionLotsHtml } from "@/lib/auction-lot-cards-html";
import { translateAuctionKvValue } from "@/lib/auction-lot-cards-i18n";
import { buildCcVinAuctionCardsHtml } from "@/lib/cc-vin-pdf-html";
import { emptyCcVinBlock } from "@/lib/cc-vin-report";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import { htmlTextNeedsTranslation } from "@/lib/client-report-html-residue";
import { applyClientReportSweepTranslations } from "@/lib/client-report-dynamic-i18n";
import type { ClientReportLang } from "@/lib/client-report-i18n";
import { lvResidueAuctionRecord, lvResiduePayload, lvResiduePhotoMap } from "@/lib/client-report-lv-residue.fixtures";
import { applyClientReportTranslatedTexts, collectClientReportTranslatableTexts } from "@/lib/client-report-translatable-fields";
import { translateCsddTaDefectText } from "@/lib/csdd-ta-defects-i18n";
import { formatLatviaTenureShort } from "@/lib/latvia-registration-tenure";

const LANGS = ["en", "ru", "de"] as const;

function render(p: ClientReportPayload, lang: ClientReportLang): string {
  const texts = collectClientReportTranslatableTexts(p);
  for (const k of Object.keys(texts)) texts[k] = "Translated text.";
  return buildClientReportDocumentHtml({
    payload: lang === "lv" ? p : applyClientReportTranslatedTexts(p, texts),
    portfolio: [],
    pdfInsights: [],
    dateFmt: new Intl.DateTimeFormat("lv-LV"),
    formatBytes: () => "0 B",
    ccVinPhotoDataUrls: lvResiduePhotoMap(),
    lang,
  });
}

function textNodes(html: string): string[] {
  const at = html.indexOf("<body");
  const body = (at >= 0 ? html.slice(at) : html).replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "");
  return [...body.matchAll(/>([^<]+)</g)]
    .map((m) => m[1]!.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Izsoļu kartīšu LV etiķetes, kas EN/RU/DE nedrīkst palikt. */
const AUCTION_LV = /(?<![\p{L}\p{N}])(izsole|izsoles|izsolē|ZS|Izsoļu)(?![\p{L}\p{N}])/iu;

describe("1. pdfTopSources - avotu flīze atskaites valodā", () => {
  const noVenue = () => {
    const p = lvResiduePayload();
    return {
      ...p,
      ccVinBlock: { ...emptyCcVinBlock(), sales: [{ date: "01.10.2026", venue: "", odometer: "390 100 km", price: "", status: "" }] },
    } as unknown as ClientReportPayload;
  };
  it.each([
    ["en", "Auctions"],
    ["ru", "Аукционы"],
    ["de", "Auktionen"],
  ] as const)("%s: izsoļu avots bez portāla nosaukuma - «%s», ne «Izsoles»", (lang, name) => {
    const nodes = textNodes(render(noVenue(), lang));
    expect(nodes).toContain(name);
    expect(nodes).not.toContain("Izsoles");
  });
});

describe("2. formatLatviaTenureShort - valodas parametrs", () => {
  it("LV nemainās (noklusējums)", () => {
    expect(formatLatviaTenureShort(520, 17)).toBe("1 g. 5 mēn.");
    expect(formatLatviaTenureShort(12, 0)).toBe("12 dienas");
  });
  it("EN / RU / DE", () => {
    expect(formatLatviaTenureShort(520, 17, "en")).toBe("1 yr 5 mo");
    expect(formatLatviaTenureShort(520, 17, "ru")).toBe("1 г. 5 мес.");
    expect(formatLatviaTenureShort(520, 17, "de")).toBe("1 J. 5 Mon.");
    expect(formatLatviaTenureShort(400, 24, "en")).toBe("2 yr");
    expect(formatLatviaTenureShort(150, 5, "de")).toBe("5 Mon.");
    expect(formatLatviaTenureShort(1, 0, "en")).toBe("1 day");
    expect(formatLatviaTenureShort(12, 0, "ru")).toBe("12 дн.");
  });
});

describe("3. izsoļu kartītes ar `lang`", () => {
  const record = lvResidueAuctionRecord();
  const summary = buildAuctionArchiveSummary({ vin: "TESTVIN", title: "", block: { thecarapiRecords: [record], photoGroups: [] } });
  const lots = (lang: ClientReportLang) => {
    const parts = buildAuctionLotsHtml({ summary, records: [record], photos: [], dataUrls: new Map(), showPrices: true, lang });
    return [parts.timeline, parts.findings, parts.vehicle, ...parts.lots, parts.equipment].join("\n");
  };

  it("LV - etiķetes kā līdz šim", () => {
    const nodes = textNodes(lots("lv"));
    expect(nodes).toContain("1. izsole");
    expect(nodes.some((t) => / izsole$/.test(t))).toBe(true);
    expect(nodes).toContain("Izsoles Nr.");
  });

  it.each([
    ["en", "Auction 1", "Lot no.", "Vehicle data", "auction"],
    ["ru", "Аукцион 1", "№ лота", "Данные автомобиля", "Аукцион"],
    ["de", "1. Auktion", "Los-Nr.", "Fahrzeugdaten", "Auktion"],
  ] as const)("%s: kartīšu etiķetes tulkotas, nav «izsole», «Izsoles Nr.», «ZS»", (lang, ordinal, lotNo, vehicle, auctionWord) => {
    const nodes = textNodes(lots(lang));
    expect(nodes).toContain(ordinal);
    expect(nodes).toContain(lotNo);
    expect(nodes).toContain(vehicle);
    expect(nodes.some((t) => t.includes(auctionWord))).toBe(true);
    expect(nodes.filter((t) => AUCTION_LV.test(t))).toEqual([]);
  });

  it("buildCcVinAuctionCardsHtml padod `lang`", () => {
    const html = buildCcVinAuctionCardsHtml({ ...emptyCcVinBlock(), thecarapiRecords: [record] } as ReturnType<typeof emptyCcVinBlock>, { lang: "en" });
    expect(textNodes(html)).toContain("Auction 1");
    expect(textNodes(html).filter((t) => AUCTION_LV.test(t))).toEqual([]);
  });

  it("vērtības: ZS, «no 5», «+ PVN», fiksētās frāzes", () => {
    expect(translateAuctionKvValue("110 kW (150 ZS)", "en")).toBe("110 kW (150 HP)");
    expect(translateAuctionKvValue("150 ZS", "ru")).toBe("150 л.с.");
    expect(translateAuctionKvValue("110 kW (150 ZS)", "de")).toBe("110 kW (150 PS)");
    expect(translateAuctionKvValue("4,5 no 5", "de")).toBe("4,5 von 5");
    expect(translateAuctionKvValue("350 € + PVN", "en")).toBe("350 € + VAT");
    expect(translateAuctionKvValue("Nav norādīti", "ru")).toBe("Не указаны");
    expect(translateAuctionKvValue("150 ZS", "lv")).toBe("150 ZS");
  });

  it("atlieku pārbaude noķer «izsole/izsoles» bez garumzīmēm", () => {
    expect(htmlTextNeedsTranslation("BCA izsole")).toBe(true);
    expect(htmlTextNeedsTranslation("1. izsole")).toBe(true);
    expect(htmlTextNeedsTranslation("Izsoles Nr.")).toBe(true);
  });

  it.each(LANGS)("%s: pilna atskaite ar izsolēm + TA defektiem - izsoļu etiķetes nav latviski", (lang) => {
    const nodes = textNodes(render(lvResiduePayload({ auctions: true }), lang));
    expect(nodes.filter((t) => AUCTION_LV.test(t) && !/\(oriģināls\)/.test(t))).toEqual([]);
    // TA defekti no CSDD fiktūras - deterministiski tulkoti.
    expect(nodes.some((t) => /Stāvbremze nedarbojas/.test(t))).toBe(false);
  });
});

describe("4. vārdnīca tikai pilnās etiķetēs - datu teikumi paliek AI gājienam", () => {
  const doc = (body: string) => `<!DOCTYPE html><html lang="lv"><head></head><body>${body}</body></html>`;
  const html = doc(
    "<td>Durvis</td><p>Durvis nav atveramas</p><td>Dati</td><p>Dati nav pieejami</p><p>Ieraksts atspoguļo stāvokli</p><td>Pelēka, metālika</td><td>Pelēka</td>",
  );

  it.each(LANGS)("%s: nav jauktu teikumu", (lang) => {
    const nodes = textNodes(applyClientReportSweepTranslations(html, lang));
    expect(nodes).toContain("Durvis nav atveramas");
    expect(nodes).toContain("Dati nav pieejami");
    expect(nodes).toContain("Ieraksts atspoguļo stāvokli");
    expect(nodes).toContain("Pelēka, metālika");
    expect(nodes).not.toContain("Durvis");
    expect(nodes.join("|")).not.toMatch(/Doors nav|Data nav|Record atspoguļo|Grey, metālika|Двери нет|Türen nav/);
  });

  it("pilnās šūnas tulkotas", () => {
    const nodes = textNodes(applyClientReportSweepTranslations(html, "en"));
    expect(nodes).toContain("Doors");
    expect(nodes).toContain("Grey");
  });

  it.each([
    ["en", "3 - Unroadworthy condition"],
    ["ru", "3 - Непригоден для движения"],
    ["de", "3 - Nicht verkehrssicherer Zustand"],
  ] as const)("%s: TA vērtējums 3", (lang, out) => {
    const nodes = textNodes(applyClientReportSweepTranslations(doc("<td>3 - Braukšanai nederīgā stāvoklī</td><td>Novērtējums 3 - Braukšanai nederīgā stāvoklī</td>"), lang));
    expect(nodes).toContain(out);
    expect(nodes.join("|")).not.toMatch(/[āčēģīķļņšūž]/);
  });

  it.each(LANGS)("%s: TA vērtējumi 0-2 joprojām tulkoti", (lang) => {
    const body = ["0 - Teicamā tehniskā stāvoklī", "1 - Ar pieļaujamiem defektiem", "2 - Ar mēneša laikā labojamiem defektiem"].map((v) => `<td>${v}</td>`).join("");
    expect(textNodes(applyClientReportSweepTranslations(doc(body), lang)).join("|")).not.toMatch(/[āčēģīķļņšūž]/);
  });
});

describe("5. CSDD TA defektu katalogs (no repo e-CSDD fiktūrām)", () => {
  it.each([
    ["Nenozīmīga eļļas noplūde no motora (transmisijas).", "en", "Minor oil leak from the engine (transmission)."],
    ["Priekšējais tilts. Neliela kreisā ārējā stūres šarnīra brīvkustība.", "en", "Front axle. Slight play in the left outer steering joint."],
    ["Nedeg kreisais priekšējais gabarītlukturis.", "de", "Linkes vorderes Begrenzungslicht leuchtet nicht."],
    ["Virspusēja rāmja vai nesošā elementa korozija.", "ru", "Поверхностная коррозия рамы или несущего элемента."],
    ["Nepietiekams riepu protektora dziļums.", "de", "Unzureichende Reifenprofiltiefe."],
    ["Bremžu pārvada cauruļvadu korozija sākuma stadijā.", "en", "Early-stage corrosion of the brake lines."],
    ["Stūres mehānisms. Palielināta brīvkustība.", "en", "Steering gear. Excessive play."],
    ["Labais galvenais lukturis viegli aizsvīdis.", "ru", "Правая основная фара слегка запотела."],
  ] as const)("%s (%s)", (lv, lang, out) => {
    expect(translateCsddTaDefectText(lv, lang)).toBe(out);
  });
});
