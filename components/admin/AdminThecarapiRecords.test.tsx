import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { AdminThecarapiRecords, thecarapiAdminPaintTone } from "@/components/admin/AdminThecarapiRecords";
import { buildThecarapiPdfModel, thecarapiLeafValues } from "@/lib/thecarapi-pdf-model";
import { renderHtml, renderText } from "@/lib/test-render";
import { buildThecarapiAdminRecords } from "@/lib/vin-scan/parse-thecarapi";
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

const VIN = "WBA5R1C00LFH42875";

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(process.cwd(), "lib/vin-scan/__fixtures__/thecarapi", name), "utf8")) as unknown;
}

function withPhotos(record: ThecarapiAdminRecord, date: string, max = 6): ThecarapiAdminRecord {
  return {
    ...record,
    photos: record.photoUrls.slice(0, max).map((url, i) => ({
      id: `ih_ph_${String(i).padStart(24, "0")}`,
      sourceUrl: url,
      contentHash: `h${i}`,
      date,
      venue: record.venue,
      caption: `TheCarApi · ${record.venue} · ${date}`,
    })),
  };
}

function auto1(): ThecarapiAdminRecord {
  const [row] = buildThecarapiAdminRecords({ historyJson: null, detailJson: fixture("detail-auto1-full-anon.json") });
  return withPhotos(row!, "2026-10-09");
}

function decode(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
}

describe("AdminThecarapiRecords", () => {
  it("rāda visus modeļa laukus pa sadaļām, ne tikai PDF 9 pamatdatus", () => {
    const record = auto1();
    const model = buildThecarapiPdfModel(record);
    const text = decode(renderText(<AdminThecarapiRecords vin={VIN} records={[record]} />));
    expect(model.basics.length).toBeGreaterThan(9);
    for (const row of [...model.basics, ...model.prices, ...model.mileage, ...model.dates, ...model.other]) {
      expect(text).toContain(row.label);
      expect(text).toContain(row.value);
    }
    for (const d of model.damages) expect(text).toContain(d.part || "-");
    for (const p of model.paint) expect(text).toContain(p.label);
    for (const g of model.equipment) for (const item of g.items) expect(text).toContain(item);
    for (const title of ["Pamatdati", "Cenas", "Nobraukums", "Datumi", "Bojājumi", "Lakas biezums", "Citi dati", "Bildes"]) {
      expect(text).toContain(title);
    }
  });

  it("nekas nepazūd: izslēgtie (tehniskie) lauki ir «Tehniskie lauki» sarakstā", () => {
    const record = auto1();
    const model = buildThecarapiPdfModel(record);
    const html = decode(renderHtml(<AdminThecarapiRecords vin={VIN} records={[record]} />));
    const excluded = model.coverage.filter((c) => c.status === "excluded").map((c) => c.path);
    expect(excluded.length).toBeGreaterThan(0);
    expect(html).toContain(`Tehniskie lauki (${excluded.length})`);
    for (const p of excluded) expect(html).toContain(`${p}: `);
    expect(thecarapiLeafValues(record).map((l) => l.path)).toEqual(model.coverage.map((c) => c.path));
  });

  it("katrai bildei datums, atveras pilnā izmērā", () => {
    const record = auto1();
    const html = renderHtml(<AdminThecarapiRecords vin={VIN} records={[record]} />);
    expect(html).toContain(`Bildes (${record.photos.length})`);
    expect(html).toContain("/api/admin/sources/thecarapi/photo?vin=");
    expect(html.match(/09\.10\.2026/g)?.length ?? 0).toBeGreaterThanOrEqual(record.photos.length);
    expect(html).toContain(`data-photo-id="${record.photos[0]!.id}"`);
    const missing = record.photoUrls.length - record.photos.length;
    expect(missing).toBeGreaterThan(0);
    expect(html).toContain(`Nav saglabātas: ${missing} bildes`);
  });

  it("vairākas izsoles - katra savā aizvērtā blokā", () => {
    const [ol] = buildThecarapiAdminRecords({ historyJson: null, detailJson: fixture("detail-openlane-v1-synth.json") });
    const html = renderHtml(<AdminThecarapiRecords vin={VIN} records={[auto1(), ol!]} />);
    expect(html.match(/data-testid="tc-admin-lot"/g)).toHaveLength(2);
    expect(html).not.toMatch(/<details open=""[^>]*data-testid="tc-admin-lot"/);
    expect(html).toContain("2 izsoles");
  });

  it("vecs ieraksts tikai ar fields: lauki redzami, trūkstošās sadaļas sarkanā", () => {
    const old: ThecarapiAdminRecord = {
      site: "auto1",
      id: "A1-100",
      date: "2024-03-15",
      venue: "AUTO1",
      photoDate: "",
      photoUrls: [],
      fields: [
        { key: "seller", label: "Pārdevējs", value: "AUTO1 GmbH" },
        { key: "mystery_flag", label: "mystery_flag", value: "keep-me" },
      ],
      raw: null,
      rawHistory: null,
      rawDetail: null,
      rawImages: null,
      photos: [],
    };
    const text = renderText(<AdminThecarapiRecords vin={VIN} records={[old]} />);
    expect(text).toContain("AUTO1 GmbH");
    expect(text.toLowerCase()).toContain("keep");
    expect(renderHtml(<AdminThecarapiRecords vin={VIN} records={[old]} />)).toContain('text-red-700">nav datu');
  });

  it("lakas tonis kā PDF", () => {
    expect(thecarapiAdminPaintTone("120")).toBe("ok");
    expect(thecarapiAdminPaintTone("250")).toBe("warn");
    expect(thecarapiAdminPaintTone("400")).toBe("alert");
    expect(thecarapiAdminPaintTone("-")).toBe("neutral");
  });
});
