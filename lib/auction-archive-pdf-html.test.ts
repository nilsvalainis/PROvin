import { describe, expect, it } from "vitest";
import {
  archiveDateTime,
  archiveDay,
  archiveVersionLabel,
  auctionArchiveEquipment,
  auctionArchiveKeyFindings,
  auctionArchiveLotFacts,
  auctionArchiveModelTitle,
  auctionArchiveVehicleRows,
} from "@/lib/auction-archive-facts";
import {
  auctionArchiveDamageBlockHtml,
  auctionArchiveDescriptions,
  auctionArchiveGallerySpans,
  auctionArchivePdfFilename,
  auctionArchiveTextsToTranslate,
  buildAuctionArchivePdfHtml,
  damageSlotLv,
} from "@/lib/auction-archive-pdf-html";
import { translateAuctionArchiveTexts } from "@/lib/auction-archive-pdf";
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

const f = (key: string, value: string) => ({ key, label: key, value });
const base = { photoUrls: [], raw: null, rawHistory: null, rawDetail: null, rawImages: null, photos: [] };

/** Saīsināts WAUZZZF43PA018831 (Nila 23.11 fails): BCA + Openlane vienā dienā, atslēgas 2 vs 1. */
const bca: ThecarapiAdminRecord = {
  ...base,
  site: "bca",
  id: "8001732514",
  date: "2026-10-21",
  venue: "BCA",
  photoDate: "2026-10-21",
  fields: [
    f("auction_id", "8001732514"),
    f("clean_make", "Audi"),
    f("clean_model", "A4"),
    f("model_display", "2.0 40 TDI BUSIN ADVAN. S TRONIC"),
    f("date_first_registration", "2022-10-25T00:00:00"),
    f("body_type", "Wagon"),
    f("cylinder_capacity", "1968"),
    f("fuel_group", "Diesel"),
    f("gearbox_group", "Sequential"),
    f("kw", "150"),
    f("hp", "204"),
    f("country_code", "IT"),
    f("country_marker_color", "#009246"),
    f("eur_rates.USD", "1.099"),
    f("mileage", "193320"),
    f("current_price", "10100"),
    f("current_final", "12409.96"),
    f("start_price", "9900"),
    f("auction_end_at", "2026-10-21T09:00:00Z"),
    f("batch_start_date", "2026-10-19T16:30:00"),
    f("car_identification.BCADetail.manufacture_date", "10/2022"),
    f("car_identification.BCADetail.gears", "7"),
    f("car_identification.BCADetail.reports[0].title", "Basic Inspection"),
    f("car_identification.BCAFacts.Number of Keys", "2"),
    f("car_identification.BCAFacts.Service history present", "Present"),
    f("car_identification.BCAFacts.Log book present", "Yes"),
    f("car_identification.BCAFacts.Last history service date", "20260710"),
    f("car_identification.BCAFacts.Last history service odometer", "183428"),
    f("car_identification.BCAFacts.MoT date", "20261024"),
    f("car_identification.BCAFacts.Vehicle source", "Lease"),
    f("car_identification.BCAFacts.Manufacturer warranty", "Unknown"),
    f("car_identification.BCAListing.reserve_price", "11000"),
    f("car_identification.BCAListing.seller_branding", "Alphabet"),
    f("car_identification.BCAListing.vat_type", "Qualifying"),
    f("car_identification.BCAListing.vat_percent", "22"),
    f("car_identification.BCAListing.drive", "Front"),
    f("car_identification.BCAListing.color_type", "Metallic"),
    f("car_identification.BCAListing.damaged_sale", "nē"),
    f("car_identification.ColorEn", "Grey"),
    f(
      "car_identification.BCAEquipment",
      "Seat covering: Cloth, Airbag Status: Yes, Airbags: 0, Satellite navigation: Yes, Alloys wheels: Yes, Cabin trim inlay: Unknown, Anti-lock braking: Yes, Cruise control: Yes, Sunroof: No",
    ),
    f("car_identification.BCAFees.buyer_fee_net", "446"),
  ],
};

const openlane: ThecarapiAdminRecord = {
  ...base,
  site: "openlane",
  id: "11719692",
  date: "2026-10-21",
  venue: "Openlane",
  photoDate: "2026-10-21",
  fields: [
    f("auction_id", "11719692"),
    f("clean_make", "Audi"),
    f("clean_model", "A4"),
    f("clean_type", "40 TDI"),
    f("car_identification.ModelDisplay", "A4 Avant"),
    f("gearbox_group", "Automatic"),
    f("co2", "138"),
    f("mileage", "193320"),
    f("car_identification.Specs.BodyColor", "carcolor.grey"),
    f("car_identification.Condition.NumberOfKeys", "1"),
    f("car_identification.Condition.HasDamages", "nē"),
    f("car_identification.Condition.HasTechnicalDamage", "nē"),
    f("car_identification.ServiceHistory.HasMaintenanceRecord", "nē"),
    f("car_identification.Documents.COCAvailable", "0"),
    f("car_identification.Location.LblPhysicalLocationValue", "Drizzona ([it])"),
    f("car_identification.InspectionReports[0].type", "external_damage_report"),
    f("car_identification.EtgOptionList[0].Name", "Mirrors / Cameras - Heated mirrors"),
    f("car_identification.EtgOptionList[0].CategoryId", "20"),
    f("car_identification.EtgOptionList[1].Name", "Seats - Upholstery"),
    f("car_identification.EtgOptionList[2].Name", "Safety systems - Rain sensor"),
    f("car_identification.EtgOptionList[3].Name", "Comfort - Massagesitze vorne"),
    f("description", "Kratzer an der Stoßstange hinten, Service neu"),
  ],
};

const summary = {
  vin: "WAUZZZF43PA018831",
  title: "Audi 2.0 40 TDI BUSIN ADVAN. S TRONIC",
  auctions: [
    { key: "bca:8001732514", date: "2026-10-21", platform: "BCA", country: "Itālija", km: 193320, priceEur: 12409, photos: 0 },
    { key: "openlane:11719692", date: "2026-10-21", platform: "Openlane", country: "Itālija", km: 193320, priceEur: 13070, photos: 17 },
  ],
  photoCount: 17,
  manualSources: [{ kind: "link" as const, label: "checkcar.vin", url: "https://checkcar.vin/x" }],
};
const ph = (n: number) => `ih_ph_${String(n).padStart(24, "0")}`;

describe("izsoļu arhīva fakti (v2)", () => {
  it("datumi bez laika joslas nobīdes; izsoles laiks Rīgā", () => {
    expect(archiveDay("2022-10-25T00:00:00")).toBe("25.10.2022");
    expect(archiveDay("20260710")).toBe("10.07.2026");
    expect(archiveDay("10/2022")).toBe("10.2022");
    expect(archiveDateTime("2026-10-21T09:00:00Z")).toBe("21.10.2026 12:00");
    expect(archiveDateTime("2026-10-19T16:30:00")).toBe("19.10.2026 19:30");
  });

  it("modelis, versija un transportlīdzekļa dati latviski, bez avota kodiem", () => {
    expect(auctionArchiveModelTitle([bca, openlane])).toBe("Audi A4 Avant 40 TDI");
    expect(archiveVersionLabel("2.0 40 TDI BUSIN ADVAN. S TRONIC")).toBe("2.0 40 TDI Business Advanced S tronic");
    const rows = Object.fromEntries(auctionArchiveVehicleRows([bca, openlane]).map((r) => [r.k, r.v]));
    expect(rows["Pirmā reģistrācija"]).toBe("25.10.2022");
    expect(rows["Ražots"]).toBe("10.2022");
    expect(rows["Virsbūve"]).toBe("Universālis");
    expect(rows["Dzinējs"]).toBe("2,0 l (1 968 cm³), dīzelis, 40 TDI");
    expect(rows["Jauda"]).toBe("150 kW (204 ZS)");
    expect(rows["Ātrumkārba"]).toBe("Automātiskā (S tronic, dubultsajūga), 7 pārnesumi");
    expect(rows["Piedziņa"]).toBe("Priekšējā");
    expect(rows["Krāsa"]).toBe("Pelēka, metālika");
    expect(rows["CO₂ izmeši"]).toBe("138 g/km");
    expect(rows["Reģistrācijas valsts"]).toBe("Itālija");
    expect(JSON.stringify(rows)).not.toMatch(/carcolor|Sequential|Wagon|Diesel|03:00/);
  });

  it("svarīgie trūkstošie - sarkanā «Nav datu», nesvarīgie tukšie - slēpti", () => {
    const rows = auctionArchiveVehicleRows([{ ...base, site: "x", id: "1", date: "", venue: "", photoDate: "", fields: [f("body_type", "Sedan")] }]);
    expect(rows.filter((r) => r.missing).map((r) => r.k)).toEqual(["Pirmā reģistrācija", "Dzinējs", "Jauda"]);
    expect(rows.find((r) => r.k === "Virsbūve")?.v).toBe("Sedans");
    expect(rows.map((r) => r.k)).not.toContain("Krāsa");
  });

  it("aprīkojums: apvienots, tulkots, bez «No» un sīkumiem; nezināmais - tulkošanai", () => {
    const eq = auctionArchiveEquipment([bca, openlane]);
    const all = eq.groups.flatMap((g) => g.items);
    expect(all).toEqual(
      expect.arrayContaining(["Navigācija", "Vieglmetāla diski", "Kruīza kontrole", "Auduma sēdekļu apdare", "Apsildāmi spoguļi", "Lietus sensors"]),
    );
    expect(all).not.toContain("Lūka");
    expect(all.join(" ")).not.toMatch(/ABS|Airbag|Cabin|Upholstery|Yes/);
    expect(eq.untranslated).toEqual(["Comfort - Massagesitze vorne"]);
    const tr = auctionArchiveEquipment([openlane], new Map([["Comfort - Massagesitze vorne", "priekšējie sēdekļi ar masāžu"]]));
    expect(tr.groups.flatMap((g) => g.items)).toContain("Priekšējie sēdekļi ar masāžu");
  });

  it("izsoles fakti: serviss, apskate, izcelsme, dokumenti; cenas tikai ar ķeksi", () => {
    const b = auctionArchiveLotFacts(bca);
    const kv = Object.fromEntries([...b.sale, ...b.condition].map((r) => [r.k, r.v]));
    // batch_start_date bez zonas = portāla vietējais laiks (Vācija, +2 h oktobrī) → Rīgā 17:30.
    expect(kv["Izsoles laiks"]).toBe("19.10.2026 17:30 - 21.10.2026 12:00");
    expect(kv["Pārdevējs"]).toBe("Alphabet");
    expect(kv["Auto izcelsme"]).toBe("Līzinga auto");
    expect(kv["Atslēgas"]).toBe("2");
    expect(kv["Pēdējais serviss"]).toBe("10.07.2026, 183 428 km");
    expect(kv["Tehniskās apskates termiņš"]).toBe("24.10.2026");
    expect(kv["Pārbaudes atskaites"]).toBe("Pamata tehniskās pārbaudes atskaite");
    expect(kv["Auto atrašanās vieta"]).toBeUndefined();
    expect(b.prices).toEqual([]);
    const p = Object.fromEntries(auctionArchiveLotFacts(bca, { showPrices: true }).prices.map((r) => [r.k, r.v]));
    // current_final (publiskā cena) nozīme nav dokumentēta - klientam nerāda (Nils 23.11).
    expect(p).toMatchObject({ "Sākuma cena": "9 900 €", "Pēdējais solījums": "10 100 €", PVN: "Atskaitāms (22 %)" });
    expect(p["Noslēguma cena"]).toBeUndefined();
    const o = auctionArchiveLotFacts(openlane);
    const okv = Object.fromEntries([...o.sale, ...o.condition].map((r) => [r.k, r.v]));
    expect(okv["Auto atrašanās vieta"]).toBe("Drizzona");
    expect(okv["COC atbilstības sertifikāts"]).toBe("Nav");
    expect(okv["Pārbaudes atskaites"]).toBe("Ārējo bojājumu atskaite");
    expect(o.damagesDeclared).toBe(false);
  });

  it("galvenie fakti: vienāds nobraukums, viena diena, atšķirīgas atslēgas (sarkanā), samazinājums - sarkanā", () => {
    const lot = (platform: string, km: number, keys: number) => ({
      platform,
      date: "2026-10-21",
      km,
      damageCount: 0,
      facts: { ...auctionArchiveLotFacts(openlane), keys },
    });
    const out = auctionArchiveKeyFindings([lot("BCA", 193320, 2), lot("Openlane", 193320, 1)]);
    expect(out.map((x) => x.text)).toEqual(
      expect.arrayContaining([
        "Nobraukums visās izsolēs vienāds - 193 320 km.",
        "21.10.2026 auto vienlaikus piedāvāts 2 izsoļu portālos (BCA, Openlane).",
        "Atslēgu skaits izsolēs atšķiras: BCA - 2, Openlane - 1.",
      ]),
    );
    expect(out.find((x) => x.text.startsWith("Atslēgu"))?.alert).toBe(true);
    const down = auctionArchiveKeyFindings([lot("A", 150000, 1), { ...lot("B", 120000, 1), date: "2026-11-01" }]);
    expect(down[0]).toMatchObject({ alert: true });
  });

  it("galvenie fakti: tikai fakti, bez ieteikumiem (Business / dīlera PDF)", () => {
    const lot = (damageCount: number) => ({
      platform: "Openlane",
      date: "2026-10-01",
      km: 210648,
      damageCount,
      facts: { ...auctionArchiveLotFacts(openlane), damagesDeclared: damageCount > 0 },
    });
    const texts = [
      ...auctionArchiveKeyFindings([lot(0)]),
      ...auctionArchiveKeyFindings([lot(1)]),
      ...auctionArchiveKeyFindings([lot(3)]),
      ...auctionArchiveKeyFindings([lot(0), { ...lot(0), km: 150000, date: "2026-11-01" }]),
    ].map((x) => x.text);
    expect(texts).toContain("Izsolēs bojājumi nav norādīti.");
    expect(texts).toContain("Izsolēs norādīts 1 bojājums.");
    expect(texts).toContain("Izsolēs norādīti 3 bojājumi.");
    for (const t of texts) expect(t).not.toMatch(/vērtējiet|pārbaudiet|iesakām|ieteicam|skatīt/iu);
  });
});

describe("izsoļu arhīva PDF HTML (katalogs, PROVIN PDF valoda)", () => {
  const photos = Array.from({ length: 17 }, (_, i) => ({
    id: ph(i + 1),
    auctionKey: "openlane:11719692",
    date: "2026-10-21",
    caption: i === 6 ? "Odometrs" : "Openlane · 2026-10-21",
  }));
  const dataUrls = new Map(photos.map((p) => [p.id, "data:image/jpeg;base64,AA"]));
  const build = (showPrices?: boolean) =>
    buildAuctionArchivePdfHtml({
      summary,
      records: [bca, openlane],
      photos,
      dataUrls,
      translations: new Map([["Kratzer an der Stoßstange hinten, Service neu", "Skrāpējums uz aizmugurējā bufera, serviss jauns"]]),
      generatedAt: new Date("2026-11-23T08:20:00Z"),
      showPrices,
    });

  it("tās pašas PROVIN PDF klases kā dīlera datiem: sadaļas galvene, vāks, skaitļu josla, kolofons", () => {
    const html = build(true);
    expect(html).toContain('<h1 class="pdf-v1-doc-title">IZSOĻU ARHĪVS</h1>');
    expect(html).toContain('<h3 class="pdf-dealer-cover__model">Audi A4 Avant 40 TDI</h3>');
    expect(html).toContain("2.0 40 TDI Business Advanced S tronic");
    expect(html.match(/class="pdf-svc-summary__cell"/g)).toHaveLength(4);
    for (const t of ["Izsoļu hronoloģija", "Galvenie fakti", "Transportlīdzekļa dati", "BCA izsole", "Openlane izsole", "Aprīkojums"]) {
      expect(html).toContain(`<h2 class="pdf-sec pdf-sec--nobar">${t}</h2>`);
    }
    for (const t of ["Izsoles dati", "Cenas (avota dati)", "Stāvoklis un dokumenti", "Izsoles apraksts"]) {
      expect(html).toContain(`<p class="pdf-subhead">${t}</p>`);
    }
    expect(html).toMatch(/13\s070\s€/);
    expect(html).toContain("PROVIN.LV · IZSOĻU ARHĪVS · Audi A4 Avant 40 TDI · VIN WAUZZZF43PA018831");
    expect(html).toContain('class="pdf-doc-footer"');
    expect(html).toContain('data-provin-fonts","ready"');
    expect(html).not.toMatch(/aa-theme|aa-tl\b/);
    expect(html).toContain("checkcar.vin");
    expect(html).not.toContain("https://checkcar.vin/x");
  });

  it("hronoloģija: ar bildēm - liela bilde + datu josla; bez bildēm - kompakta datu kartīte pilnā platumā", () => {
    const html = build(true);
    expect(html.match(/class="aa-cat__item"/g)).toHaveLength(1);
    expect(html.match(/class="aa-cat__item aa-cat__item--plain"/g)).toHaveLength(1);
    expect(html.match(/class="aa-cat__img"/g)).toHaveLength(1);
    expect(html).toContain("<dt>Izsoles Nr.</dt><dd>8001732514</dd>");
    // Izsoles Nr. tikai hronoloģijā - izsoles kartītē neatkārto.
    expect(html.match(/8001732514/g)).toHaveLength(1);
  });

  it("apraksts latviski, oriģināls mazāk; aprīkojums - pēdējā sadaļa pēc galerijas", () => {
    const html = build(true);
    expect(html).toContain('<p class="aa-desc__lv">Skrāpējums uz aizmugurējā bufera, serviss jauns</p>');
    expect(html).toContain("(oriģināls)</span> Kratzer");
    expect(html.indexOf(">Aprīkojums</h2>")).toBeGreaterThan(html.lastIndexOf('class="aa-gallery"'));
  });

  it("galerija: 15 lapā, stingrs režģis bez pus-tukšām rindām, paraksts bez dublikātiem", () => {
    const html = build(true);
    expect(html.match(/<figure class="aa-fig /g)).toHaveLength(17);
    expect(html.match(/<section class="aa-gallery">/g)).toHaveLength(2);
    expect(html).toContain("<b>7/17</b><span>Odometrs · 21.10.2026 · Openlane</span>");
    expect(html).toContain("<b>1/17</b><span>21.10.2026 · Openlane</span>");
    // 2. lapā 2 bildes - abas pusplatumā.
    expect(html.match(/aa-fig--6/g)?.length).toBeGreaterThanOrEqual(2);
    expect(auctionArchiveGallerySpans(15)).toEqual(Array(15).fill(4));
    expect(auctionArchiveGallerySpans(2)).toEqual([6, 6]);
    expect(auctionArchiveGallerySpans(7)).toEqual([4, 4, 4, 6, 6, 6, 6]);
    expect(auctionArchiveGallerySpans(5)).toEqual([4, 4, 4, 6, 6]);
    expect(auctionArchiveGallerySpans(4)).toEqual([6, 6, 6, 6]);
    expect(auctionArchiveGallerySpans(1)).toEqual([12]);
    for (let n = 1; n <= 15; n += 1) expect(auctionArchiveGallerySpans(n).reduce((a, b) => a + b, 0) % 12).toBe(0);
  });

  it("nekādu jēlu avota lauku, kodu un «Nav datu» kaudžu", () => {
    const html = build(true);
    expect(html).not.toMatch(/TheCarApi|carcolor|Sequential|Has maintenance|BCAEquipment|Bcaequipment|#009246|eur_rates|Country marker|Basic Inspection|external_damage|Unknown/);
    expect(html.match(/Nav datu/g) ?? []).toHaveLength(0);
  });

  it("cenas pēc noklusējuma NErāda (Nils 23.11, lēmums 4)", () => {
    const html = build();
    expect(html).not.toContain("Cenas");
    expect(html).not.toMatch(/13\s070/);
    expect(html).not.toMatch(/12\s409/);
    expect(html).not.toMatch(/Rezerves|solījums|komisija/);
  });

  it("bojājumu bloks: izsoles bojājumi + operatora «Redzams bildē»; bez abiem - nav", () => {
    expect(damageSlotLv("Labā puse", "Aizmugurējās durvis")).toEqual({ zone: "right", slot: 2 });
    expect(damageSlotLv("Priekša", "Buferis")).toEqual({ zone: "front", slot: 1 });
    expect(auctionArchiveDamageBlockHtml([], [])).toBe("");
    const html = auctionArchiveDamageBlockHtml(
      [{ zone: "Aizmugure", part: "Buferis", type: "Skrāpējums", size: "20-50 mm", quantity: "1", repair: "", notes: "" }],
      [{ auctionKey: "openlane:1", zone: "right", note: "pēdas durvīs" }],
    );
    expect(html).toContain('<p class="pdf-subhead">Bojājumi un defekti · 1 bojājums</p>');
    expect(html).toContain("Skrāpējums · 20-50 mm");
    expect(html).toContain("Redzams bildē (PROVIN atzīme) · pēdas durvīs");
    expect(html).toContain("<svg");
  });

  it("apraksti: tikai brīvais teksts (ne virsraksti/atskaišu nosaukumi); tulkošanai - apraksti + nezināmais aprīkojums", () => {
    expect(auctionArchiveDescriptions(bca)).toEqual([]);
    expect(auctionArchiveDescriptions(openlane)).toEqual(["Kratzer an der Stoßstange hinten, Service neu"]);
    expect(auctionArchiveTextsToTranslate([bca, openlane])).toEqual(["Kratzer an der Stoßstange hinten, Service neu", "Comfort - Massagesitze vorne"]);
    expect(auctionArchivePdfFilename("wauzzzf43pa018831")).toBe("IZSOLU_ARHIVS_WAUZZZF43PA018831.pdf");
  });
});

describe("izsoļu arhīva tulkojums (rindu skaita pārbaude)", () => {
  it("pareizs skaits - tulkojumi; nepareizs divreiz - oriģināls (tukša karte)", async () => {
    const ok = await translateAuctionArchiveTexts(["Rain sensor", "Scratch on bumper"], async () => '{"items":["Lietus sensors","Skrāpējums uz bufera"]}');
    expect(ok.get("Scratch on bumper")).toBe("Skrāpējums uz bufera");
    let calls = 0;
    const bad = await translateAuctionArchiveTexts(["A text", "B text"], async () => {
      calls += 1;
      return '{"items":["Tikai viens"]}';
    });
    expect(calls).toBe(2);
    expect(bad.size).toBe(0);
    let n = 0;
    const retry = await translateAuctionArchiveTexts(["A text"], async () => (++n === 1 ? "nav json" : '{"items":["A teksts"]}'));
    expect(retry.get("A text")).toBe("A teksts");
  });
});

describe("izsoļu arhīva PDF klienta valodā (EN/RU/DE)", () => {
  const photos = [{ id: ph(1), auctionKey: "openlane:11719692", date: "2026-10-21", caption: "" }];
  const dataUrls = new Map(photos.map((p) => [p.id, "data:image/jpeg;base64,AA"]));
  const build = (lang?: "lv" | "en" | "ru" | "de") =>
    buildAuctionArchivePdfHtml({
      summary,
      records: [bca, openlane],
      photos,
      dataUrls,
      translations: new Map([["Kratzer an der Stoßstange hinten, Service neu", "Scratch on the rear bumper, service new"]]),
      generatedAt: new Date("2026-11-23T08:20:00Z"),
      showPrices: true,
      lang,
    });

  it("EN: virsraksts, vāks, skaitļu josla, kartītes, piezīme un kājene - angliski; nav LV etiķešu", () => {
    const html = build("en");
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<h1 class="pdf-v1-doc-title">AUCTION ARCHIVE</h1>');
    expect(html).toContain("European auction archive");
    expect(html).toContain("<span>Auctions</span>");
    expect(html).toContain("<span>Last auction</span>");
    expect(html).toContain("<span>Mileage</span>");
    expect(html).toContain("2 auctions");
    expect(html).toContain("Auction timeline");
    expect(html).toContain("BCA auction");
    expect(html).toContain("(original)</span> Kratzer");
    expect(html).toContain("Data from the European auction portal archive");
    expect(html).toContain("PROVIN.LV · AUCTION ARCHIVE");
    expect(html).toContain("<title>AUCTION_ARCHIVE_WAUZZZF43PA018831_EN.pdf</title>");
    for (const lv of ["IZSOĻU ARHĪVS", "Eiropas izsoļu arhīvs", "Pēdējā izsole", "Ģenerēts", "Izsoļu hronoloģija", "(oriģināls)", "Dati no Eiropas"]) {
      expect(html).not.toContain(lv);
    }
  });

  it("RU un DE: virsraksts un skaits savā valodā", () => {
    expect(build("ru")).toContain("АРХИВ АУКЦИОНОВ");
    expect(build("ru")).toContain("2 аукциона");
    expect(build("de")).toContain("AUKTIONSARCHIV");
    expect(build("de")).toContain("2 Auktionen");
  });

  it("LV (noklusējums) - nemainīts", () => {
    const html = build();
    expect(html).toBe(build("lv"));
    expect(html).toContain('<html lang="lv">');
    expect(html).toContain("<title>IZSOLU_ARHIVS_WAUZZZF43PA018831.pdf</title>");
    expect(html).toContain("2 izsoles");
  });

  it("faila nosaukums klienta valodā (buildReportPdfFilename)", () => {
    expect(auctionArchivePdfFilename("WAUZZZF43PA018831", "en")).toBe("AUCTION_ARCHIVE_WAUZZZF43PA018831_EN.pdf");
    expect(auctionArchivePdfFilename("WAUZZZF43PA018831", "de")).toBe("AUKTIONSARCHIV_WAUZZZF43PA018831_DE.pdf");
    expect(auctionArchivePdfFilename("WAUZZZF43PA018831")).toBe("IZSOLU_ARHIVS_WAUZZZF43PA018831.pdf");
  });

  it("avota teksti tulkoti klienta valodā (nevis LV)", async () => {
    let sys = "";
    let prompt = "";
    const out = await translateAuctionArchiveTexts(
      ["Kratzer an der Stoßstange"],
      async (a) => {
        sys = a.systemInstruction;
        prompt = a.userPrompt;
        return '{"items":["Scratch on the bumper"]}';
      },
      "en",
    );
    expect(out.get("Kratzer an der Stoßstange")).toBe("Scratch on the bumper");
    expect(sys).toContain("English");
    expect(sys).not.toContain("Latvian");
    expect(prompt).toContain("into English");
  });
});

describe("izsoļu arhīva PDF avota vērtības EN/RU/DE (Nils 26.11)", () => {
  const photos = [{ id: ph(1), auctionKey: "openlane:11719692", date: "2026-10-21", caption: "" }];
  const dataUrls = new Map(photos.map((p) => [p.id, "data:image/jpeg;base64,AA"]));
  const build = (lang: "lv" | "en" | "ru" | "de", translations = new Map<string, string>()) =>
    buildAuctionArchivePdfHtml({ summary, records: [bca, openlane], photos, dataUrls, translations, generatedAt: new Date("2026-11-23T08:20:00Z"), showPrices: true, lang });

  it("pārnesumkārba, piedziņa, krāsa, virsbūve, izcelsme, atskaites, aprīkojuma grupas - bez AI vārdnīca", () => {
    const lv = build("lv");
    for (const v of ["Priekšējā", "Pelēka, metālika", "Līzinga auto", "Pamata tehniskās pārbaudes atskaite", "Komforts un salons"]) expect(lv).toContain(v);
    const en = build("en");
    for (const v of ["Front-wheel drive", "Grey, metallic", "Leased car", "Basic technical inspection report", "Comfort and interior", "7 gears", "Estate"]) {
      expect(en).toContain(v);
    }
    for (const v of ["Priekšējā", "Pelēka", "metālika", "Līzinga auto", "Pamata tehniskās", "Komforts un salons", "pārnesumi", "Universālis"]) {
      expect(en).not.toContain(v);
    }
    const de = build("de");
    expect(de).toContain("Frontantrieb");
    expect(de).toContain("Grau, Metallic");
    expect(de).toContain("Leasingfahrzeug");
    expect(build("ru")).toContain("Серый, металлик");
  });

  it("LV aprīkojuma nosaukumi un vērtības, ko vārdnīca nezina - AI tulkojums no tā paša izsaukuma", () => {
    const texts = auctionArchiveTextsToTranslate([bca, openlane], "en");
    // LV saraksts nemainās; EN/RU/DE papildus - mūsu LV teksti.
    expect(texts.slice(0, 2)).toEqual(auctionArchiveTextsToTranslate([bca, openlane]));
    const lvEquip = auctionArchiveEquipment([bca, openlane]).groups.flatMap((g) => g.items).find((x) => /[āēīūčšžņļķģ]/i.test(x));
    expect(lvEquip).toBeTruthy();
    expect(texts).toContain(lvEquip);
    const html = build("en", new Map([[lvEquip!, "TRANSLATED EQUIPMENT"]]));
    expect(html).toContain("TRANSLATED EQUIPMENT");
    expect(html).not.toContain(`>${lvEquip}<`);
  });

  it("EN/RU/DE tulkošana - līdz 3 izsaukumiem pa 40 rindām; LV - viens", async () => {
    const texts = Array.from({ length: 95 }, (_, i) => `Text number ${i}`);
    let calls = 0;
    const gen = async (a: { userPrompt: string }) => {
      calls += 1;
      const arr = JSON.parse(a.userPrompt.slice(a.userPrompt.indexOf("["), a.userPrompt.lastIndexOf("]") + 1)) as string[];
      return JSON.stringify({ items: arr.map((x) => `T ${x}`) });
    };
    const out = await translateAuctionArchiveTexts(texts, gen, "de");
    expect(calls).toBe(3);
    expect(out.size).toBe(95);
    expect(out.get("Text number 94")).toBe("T Text number 94");
    calls = 0;
    expect((await translateAuctionArchiveTexts(texts, gen, "lv")).size).toBe(40);
    expect(calls).toBe(1);
  });
});
