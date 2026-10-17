/**
 * Eļļas intervālu PNG artefakti: pilns klienta PDF bloks + admin redaktora mock.
 *   npx vite-node -c vitest.config.ts scripts/capture-oil-ship-artifacts.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { mergePdfVisibility } from "@/lib/pdf-visibility";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import { buildOilChangeIntervalPdfHtml } from "@/lib/oil-change-intervals";
import { buildOilIntervalSeriesForBlock } from "@/lib/oil-change-interval-chart";
import { oilChangeIntervalAdminPreviewCss } from "@/lib/oil-change-interval-pdf-styles";

const outDir = process.env.ARTIFACT_DIR || "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });

function mockAutoRecords() {
  return {
    ...createDefaultSourceBlocks().auto_records,
    serviceWorks: [
      { date: "03.04.2016", odometer: "31400", location: "BMW Bonn", works: "Eļļas maiņa" },
      { date: "12.03.2018", odometer: "61200", location: "BMW Bonn", works: "Eļļas maiņa" },
      { date: "18.11.2022", odometer: "128500", location: "BMW Bonn", works: "Eļļas maiņa" },
      { date: "12.03.2024", odometer: "142220", location: "BMW Bonn", works: "Eļļas maiņa" },
    ],
    oilIntervalChart: {
      useSavedRows: false,
      highlightOverOem: true,
      oemKm: 30_000,
      oemMonths: 24,
      rows: [],
    },
    oilChangeIntervalNotes: "",
  };
}

function minimalPayload(): ClientReportPayload {
  return {
    sessionId: "oil_capture_mock",
    vin: "WBATESTVIN0000001",
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
    autoRecordsBlock: mockAutoRecords(),
    pdfVisibility: mergePdfVisibility({ auto_records: true }),
    isDemo: true,
  } as ClientReportPayload;
}

const pdfDoc = buildClientReportDocumentHtml({
  payload: minimalPayload(),
  portfolio: [],
  pdfInsights: [],
  dateFmt: new Intl.DateTimeFormat("lv-LV"),
  formatBytes: () => "0 B",
});

const pdfHtmlPath = join(outDir, "oil-ship-pdf-document.html");
writeFileSync(pdfHtmlPath, pdfDoc);

const block = mockAutoRecords();
const previewHtml = buildOilChangeIntervalPdfHtml(buildOilIntervalSeriesForBlock(block));

const adminShell = `<!DOCTYPE html><html lang="lv"><head><meta charset="utf-8"/>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;background:#eef0f4;color:#0f172a;padding:20px}
  .shell{max-width:1040px;margin:0 auto}
  .card{background:#fff;border:1px solid #e5e5ea;border-radius:12px;padding:14px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .lbl{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#86868b;margin:0 0 6px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{text-align:left;font-size:9px;text-transform:uppercase;color:#86868b;padding:4px 6px;border-bottom:1px solid #e5e5ea}
  td{padding:5px 6px;border-bottom:1px solid #f2f2f7}
  .inp{border:1px solid #d1d1d6;border-radius:8px;padding:4px 8px;width:100%;font-size:11px}
  .preview{border:1px dashed #d1d1d6;border-radius:10px;padding:10px;background:#fafafa}
  ${oilChangeIntervalAdminPreviewCss()}
</style></head><body>
<div class="shell"><p class="lbl">Mock pasūtījums — admin redaktors (bez klienta datiem)</p>
<div class="card"><p style="margin:0 0 10px;font-size:13px;font-weight:600">Eļļas maiņas intervāli</p>
<div class="grid">
<div>
<p class="lbl">Ražotāja intervāls</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
<input class="inp" value="30 000" readonly/><input class="inp" value="24" readonly/>
</div>
<table><thead><tr><th>Datums</th><th>km</th><th>Intervāls</th><th>Periods</th></tr></thead>
<tbody>
<tr><td><input class="inp" value="03.04.2016" readonly></td><td><input class="inp" value="31 400" readonly></td><td>Sākums</td><td></td></tr>
<tr><td><input class="inp" value="12.03.2018" readonly></td><td><input class="inp" value="61 200" readonly></td><td>29 800 km</td><td>23 mēn.</td></tr>
<tr><td><input class="inp" value="18.11.2022" readonly></td><td><input class="inp" value="128 500" readonly></td><td>67 300 km</td><td>56 mēn.</td></tr>
<tr><td><input class="inp" value="12.03.2024" readonly></td><td><input class="inp" value="142 220" readonly></td><td>13 720 km</td><td>16 mēn.</td></tr>
</tbody></table>
</div>
<div><p class="lbl">PDF priekšskatījums</p><div class="preview admin-oil-preview">${previewHtml}</div></div>
</div></div></div></body></html>`;

const adminHtmlPath = join(outDir, "oil-ship-admin-mock.html");
writeFileSync(adminHtmlPath, adminShell);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1200 }, deviceScaleFactor: 2 });

await page.setContent(pdfDoc, { waitUntil: "load" });
const oilBlock = page.locator(".pdf-oil-int").first();
await oilBlock.waitFor({ state: "visible", timeout: 15_000 });
const pdfPng = join(outDir, "oil-ship-pdf-block.png");
await oilBlock.screenshot({ path: pdfPng });
console.log("PDF block PNG:", pdfPng);

await page.setContent(adminShell, { waitUntil: "load" });
const adminCard = page.locator(".card").first();
await adminCard.waitFor({ state: "visible" });
const adminPng = join(outDir, "oil-ship-admin-editor.png");
await adminCard.screenshot({ path: adminPng });
console.log("Admin editor PNG:", adminPng);

await browser.close();
