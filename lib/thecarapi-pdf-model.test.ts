import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { keyLabel, resetThecarapiUntranslated, thecarapiUntranslated, translateDamageType, translateI18n } from "@/lib/thecarapi-i18n-lv";
import { buildThecarapiPdfModel } from "@/lib/thecarapi-pdf-model";
import { buildThecarapiRecordsPdfHtml, THECARAPI_PDF_VEHICLE_LABELS, thecarapiPaintTone, thecarapiPdfVehicleRows } from "@/lib/thecarapi-pdf";
import { buildThecarapiAdminRecords } from "@/lib/vin-scan/parse-thecarapi";
import { thecarapiFieldsOf, type ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

function fixture(name: string): unknown {
  const file = path.join(process.cwd(), "lib/vin-scan/__fixtures__/thecarapi", name);
  return JSON.parse(readFileSync(file, "utf8")) as unknown;
}

const HISTORY = {
  auctions: [
    {
      site_name: "auto1",
      auction_id: "1326383403",
      detail_path: "/api/auction/auto1/1326383403",
      mileage: 226760,
      current_final: 11379,
      start: 9469,
      first_seen: "2026-10-07",
      archived: false,
      archived_at: null,
      auction_batch_id: 23671162,
    },
  ],
};

function fullRecord(): ThecarapiAdminRecord {
  const [row] = buildThecarapiAdminRecords({ historyJson: HISTORY, detailJson: fixture("detail-auto1-full-anon.json") });
  return row!;
}

/** Spec 7.1: šie fragmenti TheCarApi sadaļā nedrīkst parādīties. */
const FORBIDDEN = [
  "global.",
  "car_identification.",
  "vehicle_details.",
  "[0]",
  "null",
  "/auction-photo/",
  "/report-vault/",
  "https://",
  "sig=",
  "server_time",
  "provenance",
  "source_order",
  "eur_rates",
  "request_id",
  "TheCarApi",
  "\u2014",
  "\u2013",
];

/** Neatkarīgs spec 5. p. saraksts: tikai šie ceļi drīkst būt izslēgti. */
const SPEC_EXCLUDED =
  /(^|\.)(images|ImageUrls|DamageImageUrls|ServiceImageUrls|DocumentPhotos|ImageVaultImages|subAreaImages|Auto1GalleryV2|eur_rates|specification_provenance|meta|VinOcr|ZrtLabel)(\.|\[|$)|(^|\.)(server_time|success|request_id|contract_version|auction_sec_left|details_pending|created_at|updated_at|archived_at|data_updated_at|currency_code_id|auction_batch_id|source_auction_id|auction_id_str|picture_count|offer_link|detail_path|url|source_order)$|SpecEnrichment\.\w+\.(path|method)$|State$/;

/** Nils 19.11: aprīkojums PDF netiek drukāts - apzināti izslēgts (ne «Citos datos»). */
const EQUIPMENT_EXCLUDED = /(^|\.)(datEquipmentGroupsTranslated|equipmentGroupsTranslated|equipment_groups|equipmentGroups|equipment|equipmentList|options|extras|features|vehicleFeatures)(\.|\[|$)/i;

function textOf(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

describe("TheCarApi PDF modelis (AUTO1 pilnā forma, anonimizēts)", () => {
  const record = fullRecord();
  const model = buildThecarapiPdfModel(record);
  const html = buildThecarapiRecordsPdfHtml([record]);
  const text = textOf(html);

  it("HTML nav aizliegto fragmentu, saplacinātu ceļu un i18n atslēgu", () => {
    for (const bad of FORBIDDEN) expect(text, bad).not.toContain(bad);
    expect(html).not.toMatch(/\w\[\d+\]/);
    expect(text).not.toMatch(/\b[A-Za-z_]+\.[A-Za-z_]+\.[A-Za-z_]+/);
  });

  it("galvene, cenas ar €, nobraukums ar km, datumi DD.MM.YYYY", () => {
    expect(model.header).toBe("AUTO1 · Izsole 1326383403 · 09.10.2026 · Vācija (DE)");
    expect(model.prices).toEqual([
      { label: "Sākuma cena", value: "9 469 €" },
      { label: "Noslēguma cena", value: "11 379 €" },
      { label: "Pārdevēja prasītā cena", value: "9 369 €" },
    ]);
    // mileage + Auto1Details.km + vēstures mileage -> viena rinda.
    expect(model.mileage.filter((r) => r.label === "Nobraukums")).toEqual([
      { label: "Nobraukums", value: "226 760 km (izsolē 09.10.2026)" },
    ]);
    expect(model.mileage).toContainEqual({ label: "Servisa grāmatā pēdējais", value: "214 257 km, 27.03.2026" });
    expect(model.dates.length).toBeGreaterThan(0);
    for (const row of model.dates) expect(row.value).toMatch(/^\d{2}\.\d{2}\.\d{4}( \d{2}:\d{2})?$/);
    // Audits 23.11: katrai nozīmei sava rinda (nesapludina vienāda laika etiķetes).
    expect(model.dates).toContainEqual({ label: "Izsoles beigas", value: "09.10.2026 16:00" });
    expect(model.dates).toContainEqual({ label: "Pēdējo reizi redzēta", value: "09.10.2026 16:00" });
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("pamatdati cilvēciski latviski", () => {
    const basics = Object.fromEntries(model.basics.map((r) => [r.label, r.value]));
    expect(basics["Marka, modelis"]).toBe("BMW 2er 220d Gran Tourer Sport Line");
    expect(basics["Pirmā reģistrācija"]).toBe("23.11.2022");
    expect(basics["Virsbūve"]).toBe("Minivens");
    expect(basics["Degviela"]).toBe("Dīzelis");
    expect(basics["Dzinējs"]).toBe("1 995 cm³, 110 kW / 150 ZS");
    expect(basics["CO₂"]).toBe("136 g/km");
    expect(basics["Iepriekšējā lietošana"]).toBe("Uzņēmuma auto");
    expect(basics["Komerclietošana"]).toBe("jā");
    expect(basics["Auto statuss"]).toBe("Lietots");
    expect(model.basics.filter((r) => r.label === "VIN")).toHaveLength(1);
  });

  it("«Automašīnas pamatdati»: tikai 9 lauki šajā secībā, pārējie pamatdati netiek drukāti", () => {
    const rows = thecarapiPdfVehicleRows(model.basics);
    expect(rows.map((r) => r.label)).toEqual([...THECARAPI_PDF_VEHICLE_LABELS]);
    const section = html.slice(html.indexOf(">Automašīnas pamatdati<"), html.indexOf(">Cenas<"));
    for (const row of rows) expect(section).toContain(row.value);
    expect(section).toContain("Uzņēmuma auto");
    for (const hidden of ["Marka, modelis", "VIN", "Pirmā reģistrācija", "Dzinējs", "CO₂", "Virsbūve", "Degviela", "Krāsa", "Emisiju klase"]) {
      expect(text, hidden).not.toContain(hidden);
    }
    expect(text).not.toContain("BMW 2er");
    expect(text).not.toContain("1 995 cm³");
  });

  it("lakas biezums uz virsbūves shēmas: 11 mērījumi uz savām detaļām, zonas pēc sliktākā", () => {
    expect(html.match(/<svg class="pdf-paint-map"/g)).toHaveLength(1);
    expect(html.match(/data-paint-slot="/g)).toHaveLength(11);
    for (const slot of ["front-0", "roof-0", "rear-0", "left-0", "left-1", "left-2", "left-3", "right-0", "right-1", "right-2", "right-3"]) {
      expect(html, slot).toContain(`data-paint-slot="${slot}" data-tone="ok"`);
    }
    for (const zone of ["front", "roof", "rear", "left", "right"]) expect(html).toContain(`data-zone="${zone}" data-tone="ok"`);
    // Viss uz shēmas - atsevišķas lakas tabulas nav.
    const paint = html.slice(html.indexOf(">Lakas biezums<"), html.indexOf(">Bremzes<"));
    expect(paint).not.toContain("pdf-dealer-vehicle-kv");
    expect(paint).toContain("data:image/jpeg;base64,");
  });

  it("bojājumi: 3 rindas pa zonām, kopā 5, latviski", () => {
    expect(model.damages).toEqual([
      { zone: "Priekša", part: "Priekšējais buferis", type: "Skrāpējums līdz gruntij", size: "20-50 mm", quantity: "1", repair: "", notes: "" },
      { zone: "Aizmugure", part: "Aizmugurējais buferis", type: "Skrāpējums līdz gruntij", size: "20-50 mm", quantity: "3", repair: "", notes: "" },
      { zone: "Aizmugure", part: "Aizmugurējais buferis", type: "Trūkst detaļas", size: "", quantity: "1", repair: "", notes: "" },
    ]);
    expect(model.damagesTotal).toBe(5);
    expect(html).toContain("<span>Bojājumi</span><b>5</b>");
  });

  it("laka 11 zonas, bremzes 4, riepas 4, aprīkojums pa grupām, serviss", () => {
    expect(model.paint).toHaveLength(11);
    expect(model.paint[0]).toEqual({ label: "Motora pārsegs", value: "120", highlight: false, area: "hood" });
    expect(model.brakes?.rows).toHaveLength(4);
    expect(model.brakes?.rows[0]).toEqual(["Priekšējais kreisais", "Disku bremzes", "≥3 mm", "nav izmērāms", "OK"]);
    expect(model.wheels).toHaveLength(1);
    expect(model.wheels[0]!.title).toBe("Galvenais komplekts, 4 riteņi");
    expect(model.wheels[0]!.grid.rows[0]).toContain("4824 (48. ned. 2024)");
    expect(model.wheels[0]!.grid.rows[0]).toContain("Vasaras");
    expect(model.wheels[0]!.grid.rows[0]).toContain("Kā jauna");
    expect(model.wheels[0]!.grid.rows[0]).toContain("4 mm");
    const groups = model.equipment.map((g) => g.group);
    expect(groups).toContain("Gaismas");
    expect(groups).toContain("Drošība un asistenti");
    const items = model.equipment.flatMap((g) => g.items);
    expect(items).toContain("Headlight LED: LED projector");
    expect(items).toContain("Gāzes iekārta: nav");
    expect(items.filter((i) => /navigation/i.test(i))).toHaveLength(1);
    expect(items.filter((i) => i === "Sakabe")).toHaveLength(1);
    expect(model.service.summary).toBe("Pēdējais serviss 27.03.2026 pie 214 257 km · Servisa grāmata: papīra · Servisa ieraksti: daļēji");
    expect(model.documents).toEqual(["Servisa grāmata", "COC"]);
  });

  it("sadaļas ir spec secībā", () => {
    const order = ["Automašīnas pamatdati", "Cenas", "Nobraukums", "Datumi", "Bojājumi", "Lakas biezums", "Bremzes", "Riepas un diski", "Servisa vēsture", "Dokumenti", "Citi dati"];
    const at = order.map((t) => html.indexOf(`class="pdf-subhead">${t}`));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("vizuālā struktūra kā dīlera sadaļā: vāks, kopsavilkuma josla, kv tabulas, zonu kartītes, lakas krāsas", () => {
    expect(html).toContain('<div class="pdf-dealer-cover pdf-tc-cover">');
    expect(html).toContain('<h3 class="pdf-dealer-cover__model">AUTO1</h3>');
    const summary = html.slice(html.indexOf("pdf-svc-summary"), html.indexOf("</div></div>", html.indexOf("pdf-svc-summary")));
    expect(summary.match(/pdf-svc-summary__cell/g)).toHaveLength(4);
    for (const t of ["Noslēguma cena", "11 379 €", "Nobraukums", "226 760 km", "Izsoles datums", "09.10.2026", "Bojājumi"]) expect(summary).toContain(t);
    expect(html.match(/class="pdf-dealer-vehicle-kv"/g)!.length).toBeGreaterThanOrEqual(5);
    expect(html).toContain("izsolē 09.10.2026");
    expect(html.match(/pdf-svc-major pdf-tc-zone/g)).toHaveLength(2);
    expect(html).toContain("Skrāpējums līdz gruntij");
    expect(html).toContain('data-paint-slot="front-0" data-tone="ok"');
    expect(html).toMatch(/data-paint-slot="front-0"[^]*?>120 µm</);
    expect(text).toContain("≤160 µm rūpnīcas krāsojums");
    expect(text).toContain("161-300 µm iespējama pārkrāsošana");
    expect(html).toContain("&gt;300 µm iespējams špaktelis");
    expect(text).toContain("≥3 mm");
    expect(text).toContain("4824 (48. ned. 2024)");
    expect(html).toContain('<ul class="pdf-dealer-eq"><li>Servisa grāmata</li><li>COC</li></ul>');
    // Vecās v2 klases (čipi, cenu kāpnes, flīzes) vairs nav.
    for (const old of ["pdf-tc-chip", "pdf-tc-ladder", "pdf-tc-tiles", "pdf-tc-wheel", "pdf-tc-eq"]) expect(html).not.toContain(old);
  });

  it("aprīkojums netiek drukāts: nav virsraksta un nav neviena aprīkojuma vienuma", () => {
    expect(model.equipment.length).toBeGreaterThan(0);
    expect(html).not.toContain(">Aprīkojums<");
    expect(text).not.toContain("Aprīkojums");
    for (const item of model.equipment.flatMap((g) => g.items)) expect(text, item).not.toContain(item);
    for (const row of model.other) expect(`${row.label} ${row.value}`).not.toMatch(/equipment|aprīkojum/i);
  });

  it("lakas biezuma sliekšņi: ≤160 zaļš, 161-300 dzeltens, >300 sarkans", () => {
    expect(thecarapiPaintTone("160")).toBe("ok");
    expect(thecarapiPaintTone("161")).toBe("warn");
    expect(thecarapiPaintTone("300")).toBe("warn");
    expect(thecarapiPaintTone("301")).toBe("alert");
    expect(thecarapiPaintTone("nav")).toBe("neutral");
  });

  it("nekas nepazūd: katrs neizslēgtais lauks ir sadaļā, «Citos datos» vai ir dublikāts", () => {
    const values = new Map(thecarapiFieldsOf(record.raw).map((f) => [f.key, f.value]));
    const empty = (p: string): boolean => ["", "null", "{}", "-"].includes((values.get(p) ?? "").trim());
    for (const leaf of model.coverage) {
      if (!empty(leaf.path) && !SPEC_EXCLUDED.test(leaf.path) && !EQUIPMENT_EXCLUDED.test(leaf.path) && !/\[\d+\]\.(index|is_primary|served_url|remote_url)$/.test(leaf.path)) {
        expect(leaf.status, leaf.path).not.toBe("excluded");
      }
    }
    for (const row of model.other) {
      expect(text).toContain(row.label);
      expect(text).toContain(row.value);
    }
    expect(model.other).toContainEqual({ label: "Mystery flag", value: "Keep me" });
    // Vēstures atšķirīgās vērtības nepazūd (mergeThecarapiRaw history_*).
    expect(model.coverage.some((c) => c.path === "car_identification.Auto1Details.mystery_flag" && c.status === "other")).toBe(true);
  });

  it("bilžu kategorijas: bojājuma, servisa un dokumenta bildes", () => {
    expect(model.photoCategories["https://img-pa.auto1.com/img3b/test/BS00000_d1.jpg"]).toBe("Bojājums: aizmugurējais buferis");
    expect(model.photoCategories["https://img-pa.auto1.com/img3b/test/BS00000_d3.jpg"]).toBe("Bojājums: priekšējais buferis");
    expect(model.photoCategories["https://img-pa.auto1.com/img3b/test/BS00000_s1.jpg"]).toBe("Serviss");
  });

  it("vecs ieraksts bez raw: modelis no fields[] dod to pašu", () => {
    const old: ThecarapiAdminRecord = { ...record, raw: null, rawDetail: null, rawHistory: null, fields: thecarapiFieldsOf(record.raw) };
    const again = buildThecarapiPdfModel(old);
    expect(again.header).toBe(model.header);
    expect(again.damages).toEqual(model.damages);
    expect(again.prices).toEqual(model.prices);
    expect(again.paint).toHaveLength(11);
    expect(again.equipment.flatMap((g) => g.items)).toContain("Headlight LED: LED projector");
    const oldText = textOf(buildThecarapiRecordsPdfHtml([old]));
    for (const bad of FORBIDDEN) expect(oldText, bad).not.toContain(bad);
  });

  it("vēstures ieraksts bez detaļām: galvene, cena un nobraukums", () => {
    const [row] = buildThecarapiAdminRecords({
      historyJson: { auctions: [{ site_name: "openlane", auction_id: "OL-1", mileage: 120000, current_final: 8000, first_seen: "2025-05-02", archived_at: null }] },
    });
    const m = buildThecarapiPdfModel(row!);
    expect(m.header).toBe("Openlane · Izsole OL-1 · 02.05.2025");
    expect(m.prices).toEqual([{ label: "Noslēguma cena", value: "8 000 €" }]);
    expect(m.mileage[0]?.value).toBe("120 000 km (izsolē 02.05.2025)");
  });
});

describe("i18n rezerve", () => {
  it("nezināma atslēga -> pēdējais segments lasāmā tekstā", () => {
    expect(translateI18n("global.foo.bar-baz")).toBe("Bar baz");
    expect(translateI18n("global.damages-v3.size.length.gte-20mm-lt-50mm")).toBe("20-50 mm");
    expect(translateI18n("global.damages-v3.quantity.3")).toBe("3");
    expect(translateI18n("global.damages-v3.area.rear")).toBe("Aizmugure");
    expect(translateI18n("global.damages-v3.part.front-left-fender")).toBe("Priekšējais kreisais spārns");
    expect(translateI18n("global.wheels.tireCondition.as-good-as-new")).toBe("Kā jauna");
    expect(translateI18n("global.brakes.padThickness.gte-3mm")).toBe("≥3 mm");
    expect(translateI18n("global.equipment_groups.Headlight LED")).toBe("Headlight LED");
  });
});

describe("citas platformas (sintētiskas fixtures pēc publiskās dokumentācijas)", () => {
  const render = (file: string) => {
    const records = buildThecarapiAdminRecords({ historyJson: null, detailJson: fixture(file) });
    expect(records).toHaveLength(1);
    const model = buildThecarapiPdfModel(records[0]!);
    const html = buildThecarapiRecordsPdfHtml(records);
    return { record: records[0]!, model, html, text: textOf(html) };
  };
  const clean = (text: string, html: string): void => {
    for (const bad of FORBIDDEN) expect(text, bad).not.toContain(bad);
    expect(html).not.toContain("https://");
    // Nav saplacinātu ceļu (a.b.c vai a[0]) un neapstrādātu snake_case atslēgu.
    expect(text).not.toMatch(/\b[a-z]+_[a-z_]+\b/);
    expect(text).not.toMatch(/\b[a-z]+\.[a-z]+\.[a-z]+\b/i);
  };

  it("Openlane v1 (`data`, `prices.{amount}`, `auction` = bilžu konteiners)", () => {
    const { record, model, html, text } = render("detail-openlane-v1-synth.json");
    clean(text, html);
    expect(record.venue).toBe("Openlane");
    // Lots nav pazaudēts aiz `auction` bilžu konteinera.
    expect(record.id).toBe("11125938");
    expect(html).toContain('<h3 class="pdf-dealer-cover__model">Openlane</h3>');
    expect(model.basics).toContainEqual({ label: "Marka, modelis", value: "Kia Niro" });
    expect(model.basics).toContainEqual({ label: "Stūre", value: "Kreisā" });
    expect(model.prices).toContainEqual({ label: "Sākuma cena", value: "7 500 €" });
    expect(model.prices).toContainEqual({ label: "Noslēguma cena", value: "9 800 €" });
    expect(model.prices.some((r) => r.label === "Pēdējā cena")).toBe(false);
    expect(model.damages.map((d) => d.part)).toEqual(["Priekšējais buferis", "Aizmugurējās kreisās durvis"]);
    expect(model.documents).toEqual(expect.arrayContaining(["COC", "Reģistrācijas dokumenti", "Ārējo bojājumu atskaite", "Apkopes ieraksti"]));
    expect(model.service.entries?.columns).toEqual(["Nr.", "Datums", "Nobraukums", "Serviss", "Apraksts"]);
    // Remonta / servisa EUR summas netiek drukātas.
    expect(text).not.toContain("450");
    expect(text).not.toContain("289");
    expect(text).not.toContain("Heated seats");
  });

  it("BCA (`details`, `damages.{location,description,severity}`, `paint_measurements`)", () => {
    const { record, model, html, text } = render("detail-bca-synth.json");
    clean(text, html);
    expect(record.venue).toBe("BCA");
    expect(model.basics).toContainEqual({ label: "PVN režīms", value: "Peļņas daļas režīms (bez PVN)" });
    // PVN režīms pārcelts uz «Cenas»; pārdevējs un vieta netiek drukāti.
    const prices = html.slice(html.indexOf('pdf-subhead">Cenas<'), html.indexOf('pdf-subhead">Bojājumi<'));
    expect(prices).toContain("PVN režīms");
    expect(prices).toContain("Peļņas daļas režīms (bez PVN)");
    expect(text).not.toContain("Pārdevējs");
    expect(text).not.toContain("Atrašanās vieta");
    expect(model.damages).toContainEqual(expect.objectContaining({ zone: "Aizmugure", part: "Aizmugurējais buferis", type: "Iespiedums neliels" }));
    expect(model.paint.map((p) => p.value)).toEqual(["105", "245", "380"]);
    expect(html).toMatch(/data-paint-slot="right-2" data-tone="alert">[^]*?>380 µm</);
    expect(html).toMatch(/data-paint-slot="left-1" data-tone="warn">[^]*?>245 µm</);
    expect(html).toContain('data-zone="right" data-tone="alert"');
    expect(html).toContain('data-zone="roof" data-tone="neutral"');
    expect(text).not.toContain("Navigation system");
  });

  it("Copart (`data.primary_damage`, `run_and_drive`, `title_type`)", () => {
    const { record, model, html, text } = render("detail-copart-synth.json");
    clean(text, html);
    expect(record.venue).toBe("Copart");
    expect(model.basics).toContainEqual({ label: "Galvenais bojājums", value: "Priekšpuses bojājums" });
    expect(model.basics).toContainEqual({ label: "Papildu bojājums", value: "Nelieli iespiedumi un skrāpējumi" });
    expect(model.basics).toContainEqual({ label: "Dokumentu statuss", value: "Avārijas auto (salvage)" });
    expect(model.basics).toContainEqual({ label: "Iedarbojas un brauc", value: "jā" });
    // Pārcelts uz «Bojājumi» (pirms zonu kartītēm); pārdevējs, vieta, marka netiek drukāti.
    const damage = html.slice(html.indexOf('pdf-subhead">Bojājumi<'));
    for (const v of ["Galvenais bojājums", "Priekšpuses bojājums", "Papildu bojājums", "Nelieli iespiedumi un skrāpējumi", "Iedarbojas un brauc", "Dokumentu statuss", "Avārijas auto (salvage)"]) {
      expect(damage, v).toContain(v);
    }
    expect(html.indexOf('pdf-subhead">Bojājumi<')).toBeGreaterThan(0);
    expect(text).not.toContain("Atrašanās vieta");
    expect(text).not.toContain("Marka, modelis");
  });

  it("nekas nepazūd arī citām platformām", () => {
    for (const file of ["detail-openlane-v1-synth.json", "detail-bca-synth.json", "detail-copart-synth.json"]) {
      const { record, model, text } = render(file);
      for (const row of model.other) expect(text).toContain(row.label);
      const values = new Map(thecarapiFieldsOf(record.raw).map((f) => [f.key, f.value]));
      const empty = (p: string): boolean => ["", "null", "{}", "-"].includes((values.get(p) ?? "").trim());
      const lost = model.coverage.filter((c) => c.status === "excluded" && !empty(c.path) && !SPEC_EXCLUDED.test(c.path) && !EQUIPMENT_EXCLUDED.test(c.path));
      expect(lost.map((c) => c.path).filter((p) => !/(type_id|estimated_repair_costs|price_eur|option_reports|url)$|\.(index|is_primary)$/.test(p)), file).toEqual([]);
    }
  });
});

describe("neiztulkotās vērtības: lasāms teksts + reģistrs", () => {
  it("nezināma atslēga, bojājums un enum tiek reģistrēti vārdnīcas papildināšanai", () => {
    resetThecarapiUntranslated();
    expect(keyLabel("brand_new_portal_key")).toBe("Brand new portal key");
    expect(translateDamageType("hyper-scratch")).toBe("Hyper scratch");
    expect(translateDamageType("dent")).toBe("Iespiedums");
    const records = buildThecarapiAdminRecords({ historyJson: null, detailJson: fixture("detail-bca-synth.json") });
    buildThecarapiRecordsPdfHtml(records);
    const raw = thecarapiUntranslated().map((u) => `${u.kind}:${u.raw}`);
    expect(raw).toContain("atslēga:brand_new_portal_key");
    expect(raw).toContain("bojājums:hyper-scratch");
    expect(raw).toContain("atslēga:new_portal_field");
    expect(raw).toContain("vērtība:brand_new_enum_value");
    expect(raw).not.toContain("bojājums:dent");
  });
});
