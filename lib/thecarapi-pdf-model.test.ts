import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { translateI18n } from "@/lib/thecarapi-i18n-lv";
import { buildThecarapiPdfModel } from "@/lib/thecarapi-pdf-model";
import { buildThecarapiRecordsPdfHtml } from "@/lib/thecarapi-pdf";
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
    expect(model.dates).toContainEqual({ label: "Izsoles beigas / pēdējo reizi redzēta", value: "09.10.2026 16:00" });
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

  it("bojājumi: 3 rindas pa zonām, kopā 5, latviski", () => {
    expect(model.damages).toEqual([
      { zone: "Priekša", part: "Priekšējais buferis", type: "Skrāpējums līdz gruntij", size: "20-50 mm", quantity: "1", repair: "", notes: "" },
      { zone: "Aizmugure", part: "Aizmugurējais buferis", type: "Skrāpējums līdz gruntij", size: "20-50 mm", quantity: "3", repair: "", notes: "" },
      { zone: "Aizmugure", part: "Aizmugurējais buferis", type: "Trūkst detaļas", size: "", quantity: "1", repair: "", notes: "" },
    ]);
    expect(model.damagesTotal).toBe(5);
    expect(text).toContain("Kopā bojājumi: 5");
  });

  it("laka 11 zonas, bremzes 4, riepas 4, aprīkojums pa grupām, serviss", () => {
    expect(model.paint).toHaveLength(11);
    expect(model.paint[0]).toEqual({ label: "Motora pārsegs", value: "120", highlight: false });
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
    const order = ["Pamatdati", "Cenas", "Nobraukums", "Datumi", "Bojājumi", "Aprīkojums", "Riepas un diski", "Servisa vēsture", "Citi dati"];
    const at = order.map((t) => html.indexOf(`>${t}<`));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("nekas nepazūd: katrs neizslēgtais lauks ir sadaļā, «Citos datos» vai ir dublikāts", () => {
    const values = new Map(thecarapiFieldsOf(record.raw).map((f) => [f.key, f.value]));
    const empty = (p: string): boolean => ["", "null", "{}", "-"].includes((values.get(p) ?? "").trim());
    for (const leaf of model.coverage) {
      if (!empty(leaf.path) && !SPEC_EXCLUDED.test(leaf.path) && !/\[\d+\]\.(index|is_primary|served_url|remote_url)$/.test(leaf.path)) {
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
