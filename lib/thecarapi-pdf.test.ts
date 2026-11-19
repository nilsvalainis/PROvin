import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildCcVinPdfInnerHtml } from "@/lib/cc-vin-pdf-html";
import { countCcVinPdfVisibleRecords, countCcVinRecords, emptyCcVinBlock } from "@/lib/cc-vin-report";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import {
  buildThecarapiPdfGalleryHtml,
  buildThecarapiRecordsPdfHtml,
  selectThecarapiPdfPhotos,
  THECARAPI_PDF_GALLERY_MAX,
} from "@/lib/thecarapi-pdf";
import { buildThecarapiAdminRecords } from "@/lib/vin-scan/parse-thecarapi";
import type { ThecarapiStoredPhoto } from "@/lib/vin-scan/thecarapi-fields";

function fixture(name: string): unknown {
  const file = path.join(process.cwd(), "lib/vin-scan/__fixtures__/thecarapi", name);
  return JSON.parse(readFileSync(file, "utf8")) as unknown;
}

function photo(n: number, extra: Partial<ThecarapiStoredPhoto> = {}): ThecarapiStoredPhoto {
  return {
    id: `ih_ph_${n.toString(16).padStart(24, "0")}`,
    sourceUrl: `https://img-pa.auto1.com/img/${n}.jpg`,
    contentHash: n.toString(16).padStart(64, "a"),
    date: "2026-10-09",
    venue: "AUTO1",
    caption: "TheCarApi · AUTO1 · 2026-10-09",
    ...extra,
  };
}

describe("TheCarApi PDF bloks WBA6X310305V99966", () => {
  const records = buildThecarapiAdminRecords({
    historyJson: {
      auctions: [
        {
          site_name: "auto1",
          auction_id: "1326383403",
          mileage: 77387,
          current_final: 12268,
          start: 10000,
          first_seen: "2026-10-09",
          seller: "AUTO1 GmbH",
          location: "Berlin",
          archived: false,
        },
      ],
    },
    detailJson: fixture("detail-auto1-wrapped.json"),
  });

  it("sakārto laukus sadaļās, nezināmo liek «Citos datos», saites un tehnisko nedrukā", () => {
    const row = records[0];
    expect(row?.id).toBe("1326383403");
    expect(row?.date).toBe("2026-10-09");
    expect(row?.photoUrls).toHaveLength(29);
    expect(row?.rawDetail).toBeTruthy();

    const html = buildThecarapiRecordsPdfHtml(records);
    expect(html).toContain('<h3 class="pdf-dealer-cover__model">AUTO1</h3>');
    expect(html).toContain("Izsole 1326383403 · 09.10.2026");
    // v4: «Automašīnas pamatdati» tikai 9 lauki - pārdevējs un vieta netiek drukāti.
    expect(html).not.toContain("AUTO1 GmbH");
    expect(html).not.toContain("Berlin");
    expect(html).toContain("Cenas");
    expect(html).toContain("12 268 €");
    expect(html).toContain("10 000 €");
    expect(html).toContain("Nobraukums");
    expect(html).toContain("77 387 km");
    expect(html).toContain("Bojājumi");
    expect(html).toContain("Priekšējais bamperis");
    expect(html).toContain("skrāpējums");
    expect(html).toContain("Kreisās durvis");
    expect(html).not.toContain("Aprīkojums");
    expect(html).not.toContain("Navigācija");
    expect(html).toContain("Servisa vēsture");
    expect(html).toContain("Eļļa mainīta 2026-09");
    expect(html).toContain("Citi dati");
    expect(html.split("Citi dati")[1]).toContain("Keep zone");
    expect(html).not.toContain("TheCarApi");
    expect(html).not.toContain("main-1.jpg");
    expect(html).not.toContain("https://");
    expect(html).not.toContain("request_id");
    expect(html).not.toContain("null");

    const block = emptyCcVinBlock();
    block.thecarapiRecords = records;
    const section = buildCcVinPdfInnerHtml(block);
    expect(section).toContain("Priekšējais bamperis");
    expect(section).toContain("Keep zone");
    expect(section).not.toContain("TheCarApi");
  });

  it("galerija patur vismaz 100 bildes, rāda datumu un izlaiž cita avota dublikātu", () => {
    expect(THECARAPI_PDF_GALLERY_MAX).toBeGreaterThanOrEqual(100);
    const photos = Array.from({ length: 120 }, (_, n) => photo(n));
    const record = { ...records[0]!, photos };
    const kept = selectThecarapiPdfPhotos([record], {
      max: 100,
      usedKeys: new Set([`url:${photos[0]!.sourceUrl}`, `hash:${photos[5]!.contentHash}`]),
    });
    expect(kept).toHaveLength(100);
    expect(kept.some((item) => item.id === photos[0]!.id)).toBe(false);
    expect(kept.some((item) => item.id === photos[5]!.id)).toBe(false);
    expect(selectThecarapiPdfPhotos([record]).length).toBe(120);

    const urls = new Map(kept.slice(0, 2).map((item) => [item.id, `data:image/jpeg;base64,${item.id}`]));
    const html = buildThecarapiPdfGalleryHtml(kept.slice(0, 2), urls, new Map([[kept[0]!.sourceUrl, "Bojājums: aizmugurējais buferis"]]));
    expect(html).toContain("09.10.2026 · Bojājums: aizmugurējais buferis");
    expect(html).toContain("pdf-listing-photo-grid--tc");
    expect(html).not.toContain(kept[0]!.sourceUrl);
    expect(html).toContain(urls.get(kept[0]!.id));
    expect(html).not.toContain("TheCarApi");
  });

  it("izsoles detaļu bloks par to pašu izsoli, kas ir pārdošanas rindā, netiek skaitīts otrreiz", () => {
    const block = emptyCcVinBlock();
    block.sales = [{ date: "09.10.2026", venue: "AUTO1", odometer: "77 387", price: "12 268", status: "Izsole" }];
    block.thecarapiRecords = records;
    expect(countCcVinPdfVisibleRecords(block)).toBe(1);
    block.sales = [{ date: "01.05.2025", venue: "Openlane", odometer: "50 000", price: "9 000", status: "Izsole" }];
    expect(countCcVinPdfVisibleRecords(block)).toBe(2);
  });

  it("PDF virsraksta skaits ir redzamās rindas, ne nobraukums", () => {
    const block = emptyCcVinBlock();
    block.sales = [{ date: "09.10.2026", venue: "AUTO1", odometer: "77 387", price: "12 268", status: "Izsole" }];
    block.mileage = [{ date: "09.10.2026", odometer: "77387", country: "" }];
    expect(countCcVinRecords(block)).toBe(2);
    expect(countCcVinPdfVisibleRecords(block)).toBe(1);
    const html = buildClientReportDocumentHtml({
      payload: {
        sessionId: "manual_order_test",
        vin: "WBA6X310305V99966",
        created: Date.now(),
        amountTotal: 7999,
        currency: "eur",
        paymentStatus: "paid",
        listingUrl: null,
        customerEmail: null,
        customerPhone: null,
        customerName: null,
        contactMethod: null,
        notes: null,
        csdd: "",
        ltab: "",
        tirgus: "",
        citi: "",
        iriss: "",
        apskatesPlāns: "",
        tehniskoRiskuAnalize: "",
        cenasAtbilstiba: "",
        ccVinBlock: block,
      } as ClientReportPayload,
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(html).toContain("1 ieraksts");
    expect(html).not.toContain("2 ieraksti");
    expect(html).toContain("AUTO1");
  });
});
