/**
 * 27.11.2026 (WVWZZZ3CZNE054721): 10 Openlane izsoles ar tām pašām 19 bildēm - katrai izsolei sava
 * pasūtījuma bilžu grupa ar tiem pašiem bilžu id. Klienta PDF drukāja 190 bildes (12 MB, 13 lapas).
 * Viena bilde (id / saite / satura hash) PDF galerijā drīkst būt tikai vienreiz.
 */
import { describe, expect, it } from "vitest";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import { LV_RESIDUE_PHOTO, lvResidueAuctionRecord, lvResiduePayload } from "@/lib/client-report-lv-residue.fixtures";

const URLS = ["https://images.example.test/a.jpeg", "https://images.example.test/b.jpeg", "https://images.example.test/c.jpeg"];

function payloadWithRepeatedAuctions(n: number): ClientReportPayload {
  const p = lvResiduePayload();
  const base = lvResidueAuctionRecord();
  const records = Array.from({ length: n }, (_, i) => ({
    ...base,
    id: String(1000 + i),
    date: `2026-10-${String(10 + i).padStart(2, "0")}`,
    photoDate: `2026-10-${String(10 + i).padStart(2, "0")}`,
    // Ierakstu bildēm ir savi id (PDF datiem nav), saites tās pašas.
    photos: URLS.map((u, j) => ({ id: `ih_ph_rec_${j}`, sourceUrl: u, contentHash: `hash${j}`, date: `2026-10-${10 + i}`, venue: "Openlane", caption: "" })),
  }));
  const groups = records.map((r, i) => ({
    id: `ih_phg_${i}`,
    title: `TheCarApi · Openlane · ${r.date}`,
    photos: URLS.map((u, j) => ({ id: `ih_ph_${j}`, sourceUrl: u, contentHash: `hash${j}` })),
  }));
  return {
    ...p,
    ccVinBlock: { ...p.ccVinBlock, thecarapiRecords: records, photoGroups: groups, photos: [] },
  } as unknown as ClientReportPayload;
}

function render(p: ClientReportPayload): string {
  return buildClientReportDocumentHtml({
    payload: p,
    portfolio: [],
    pdfInsights: [],
    dateFmt: new Intl.DateTimeFormat("lv-LV"),
    formatBytes: () => "0 B",
    ccVinPhotoDataUrls: new Map(URLS.map((_, j) => [`ih_ph_${j}`, LV_RESIDUE_PHOTO])),
    lang: "lv",
  });
}

const imgCount = (html: string) => html.split(`src="${LV_RESIDUE_PHOTO}"`).length - 1;

describe("izsoļu bildes PDF bez dublikātiem", () => {
  it("10 izsoles ar tām pašām 3 bildēm - galerijā 3 bildes, ne 30", () => {
    const one = imgCount(render(payloadWithRepeatedAuctions(1)));
    const ten = imgCount(render(payloadWithRepeatedAuctions(10)));
    expect(one).toBeGreaterThanOrEqual(3);
    expect(ten).toBe(one);
  });
});
