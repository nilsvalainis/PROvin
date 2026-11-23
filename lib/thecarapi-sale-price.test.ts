import { describe, expect, it } from "vitest";

import { auctionArchiveLotFacts, auctionArchiveVehicleRows } from "@/lib/auction-archive-facts";
import { auctionArchiveDescriptions } from "@/lib/auction-archive-pdf-html";
import { buildCcVinPdfInnerHtml } from "@/lib/cc-vin-pdf-html";
import { emptyCcVinBlock, type CcVinSaleRow } from "@/lib/cc-vin-report";
import { salesWithAuctionFinalPrice, thecarapiSalePrice, thecarapiSalePriceFromFields } from "@/lib/thecarapi-sale-price";
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

/** Openlane ieraksts (sintētisks, pēc reālas formas 01.10.2026): solījumi līdz 7 300, publiskā cena 11 168. */
function openlane(): ThecarapiAdminRecord {
  const f = (key: string, value: string) => ({ key, value });
  return {
    site: "openlane",
    id: "11628722",
    date: "2026-10-01",
    venue: "Openlane",
    photoDate: "2026-10-01",
    photoUrls: [],
    photos: [],
    raw: null,
    rawHistory: null,
    rawDetail: null,
    fields: [
      f("clean_make", "Opel"),
      f("clean_model", "Vivaro"),
      f("current_price", "7300"),
      f("final_price", "7300"),
      f("current_final", "11168"),
      f("public_price_eur", "11168"),
      f("estimated_value_eur", "6500"),
      f("country_code", "DE"),
      f("mileage", "210648"),
      f("steering", "left"),
      f("effluent_standard_group_search", "EU6"),
      f("car_identification.EngineDescription", "2.0"),
      f("cylinder_capacity", "2000"),
      f("car_identification.IsFourWheelDrive", "nē"),
      f("car_identification.Specs.Size", "carsize.Lighttruck"),
      f("car_identification.Condition.IsDriving", "jā"),
      f("car_identification.Condition.HasExtraWheelsSet", "nē"),
      f("car_identification.Documents.COCAvailable", "2"),
      f("car_identification.Documents.RegistrationDocsAvailable", "2"),
      f("car_identification.CountryMessages[0].description", "Is the COC available ?"),
      f("car_identification.CountryMessages[0].name", "IsCocAvailable"),
      f("car_identification.CountryMessages[0].value", "NO"),
      f("car_identification.CountryMessages[1].description", "Delay of delivery"),
      f("car_identification.CountryMessages[1].name", "DeliveryDelay"),
      f("car_identification.CountryMessages[1].value", "7-10"),
      f("car_identification.CountryMessages[2].description", "Is the Registration docs available ?"),
      f("car_identification.CountryMessages[2].name", "IsRegDocAvailable"),
      f("car_identification.CountryMessages[2].value", "Yes"),
      f("car_identification.Location.LblPhysicalLocationValue", "Moenchengladbach ([de])"),
      f("car_identification.Commercial.IsVisible", "jā"),
      f("car_identification.Location.CarEcadisCountryId", "2"),
    ],
  } as unknown as ThecarapiAdminRecord;
}

describe("izsoles cena (Nils 23.11: divas cenas vienai izsolei)", () => {
  it("final_price = pēdējais solījums → etiķete «Pēdējais solījums»; publiskā cena tikai adminam", () => {
    const sp = thecarapiSalePriceFromFields(openlane().fields);
    expect(sp.eur).toBe(7300);
    expect(sp.source).toBe("final_price");
    expect(sp.label).toBe("Pēdējais solījums");
    expect(sp.publicEur).toBe(11168);
    expect(sp.conflict).toContain("11 168");
  });

  it("bez final_price - pēdējais solījums; final_price ≠ solījums - «Noslēguma cena»; tikai publiskā - tā ar savu etiķeti", () => {
    const row = (o: Record<string, unknown>) => thecarapiSalePrice((k) => o[k]);
    expect(row({ public_price_eur: 13070, current_price: 8700 })).toMatchObject({ eur: 8700, label: "Pēdējais solījums" });
    expect(row({ final_price: 9000, current_price: 8000 })).toMatchObject({ eur: 9000, label: "Noslēguma cena" });
    expect(row({ public_price_eur: 9300 })).toMatchObject({ eur: 9300, label: "Portāla publiskā cena", conflict: "" });
    expect(row({ currency_code_id: "GBP", final_price: 8000, public_price_eur: 9300 })).toMatchObject({ eur: 9300 });
  });

  it("vecā pārdošanas rinda ar publisko cenu PDF renderī saņem noslēguma cenu", () => {
    const rows = salesWithAuctionFinalPrice(
      [{ date: "01.10.2026", venue: "Openlane", odometer: "210 648 km", price: "11 168 EUR", status: "Openlane · 11628722" } as CcVinSaleRow],
      [openlane()],
    );
    expect(rows[0]!.price).toBe("7 300 EUR");
    expect(rows[0]!.priceLabel).toBe("Pēdējais solījums");
  });
});

describe("izsoles kartīte: tulkoti fakti, nevis tehnisks izmetiens", () => {
  it("klienta faktos viena cena, anketas atbildes kā rindas, bez jautājumiem aprakstā", () => {
    const facts = auctionArchiveLotFacts(openlane(), { showPrices: true });
    const kv = Object.fromEntries([...facts.sale, ...facts.condition, ...facts.prices].map((r) => [r.k, r.v]));
    expect(kv["Pēdējais solījums"]).toBe("7 300 €");
    expect(kv["Noslēguma cena"]).toBeUndefined();
    expect(Object.values(kv)).not.toContain("11 168 €");
    expect(facts.prices).toHaveLength(2);
    expect(kv["COC atbilstības sertifikāts"]).toBe("Nav");
    expect(kv["Reģistrācijas dokumenti"]).toBe("Ir");
    expect(kv["Piegādes laiks pēc izsoles"]).toBe("7-10 dienas");
    expect(kv["Auto brauc"]).toBe("Jā");
    expect(kv["Otrs riepu komplekts"]).toBe("Nav");
    expect(kv["Auto atrašanās vieta"]).toBe("Moenchengladbach, Vācija");
    expect(auctionArchiveDescriptions(openlane())).toEqual([]);
    const vehicle = Object.fromEntries(auctionArchiveVehicleRows([openlane()]).map((r) => [r.k, r.v]));
    expect(vehicle["Dzinējs"]).toBe("2,0 l (2 000 cm³)");
    expect(vehicle["Emisiju standarts"]).toBe("Euro 6");
    expect(vehicle["Stūre"]).toBe("Kreisajā pusē");
    expect(vehicle["Virsbūve"]).toContain("Vieglais kravas furgons");
  });

  it("AUDITS sadaļa - kopīgā kartīte bez «Citi dati» un tehniskajiem ID", () => {
    const block = emptyCcVinBlock();
    block.thecarapiRecords = [openlane()];
    const html = buildCcVinPdfInnerHtml(block);
    expect(html).toContain('class="aa-embed"');
    expect(html).toContain("Openlane izsole");
    expect(html).toContain("Pēdējais solījums");
    expect(html).toContain("7 300 €");
    expect(html).not.toContain("Noslēguma cena");
    expect(html).not.toContain("11 168");
    expect(html).not.toMatch(/Citi dati|Is visible|Ecadis|Location id|Is the COC available/i);
  });
});

describe("laika līnija: «Pārdots» tikai ar avota statusu", () => {
  it("bez statusa - «Izsole · Openlane»; ar sold - «Pārdots»; ar not sold - «Nav pārdots»", async () => {
    const { lifecycleSaleOutcome, lifecycleSaleTitle } = await import("@/lib/vehicle-lifecycle-timeline");
    expect(lifecycleSaleTitle(lifecycleSaleOutcome("Openlane · 11628722"), "Openlane")).toBe("Izsole · Openlane");
    expect(lifecycleSaleTitle(lifecycleSaleOutcome("Sold"), "Copart")).toBe("Pārdots · Copart");
    expect(lifecycleSaleTitle(lifecycleSaleOutcome("Statuss: Pārdots"), "IAA")).toBe("Pārdots · IAA");
    expect(lifecycleSaleTitle(lifecycleSaleOutcome("Nav pārdots"), "BCA")).toBe("Nav pārdots · BCA");
    expect(lifecycleSaleTitle(lifecycleSaleOutcome(""), "Mobile.de")).toBe("Pārdošanas ieraksts · Mobile.de");
  });
});
