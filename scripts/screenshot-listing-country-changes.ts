/**
 * Before/after screenshot of Vēstures kopsavilkums when AutoDNA
 * Laikposma ieraksti list the same car in DE, NL and PL.
 *
 *   npx vite-node -c vitest.config.ts scripts/screenshot-listing-country-changes.ts before
 *   npx vite-node -c vitest.config.ts scripts/screenshot-listing-country-changes.ts after
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
import { SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import { simultaneousDeNlPlListingVendorBlock } from "@/lib/vendor-timeline-listing.fixture";

const label = process.argv[2] === "after" ? "after" : "before";
const outDir = process.env.ARTIFACT_DIR || "/opt/cursor/artifacts/screenshots";
mkdirSync(outDir, { recursive: true });

function payload(): ClientReportPayload {
  return {
    sessionId: "listing-country-shot",
    vin: "WVWZZZ1JZXW000001",
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
    manualVendorBlocks: [simultaneousDeNlPlListingVendorBlock()],
  } as ClientReportPayload;
}

const html = buildClientReportDocumentHtml({
  payload: payload(),
  portfolio: [],
  pdfInsights: [],
  dateFmt: new Intl.DateTimeFormat("lv-LV"),
  formatBytes: () => "0 B",
});

const htmlPath = join(outDir, `listing-country-changes-${label}.html`);
writeFileSync(htmlPath, html);
console.log(`HTML: ${htmlPath}`);
console.log(`import cards: ${(html.match(/pdf-life-item--import/g) ?? []).length}`);
console.log(`listed titles: ${(html.match(/Sludinājums/g) ?? []).length}`);
console.log(`Pārdošanai: ${(html.match(/Pārdošanai piedāvātas/g) ?? []).length}`);
console.log(`source: ${SOURCE_BLOCK_LABELS.autodna}`);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 920, height: 1400 },
  deviceScaleFactor: 2,
});
await page.setContent(html, { waitUntil: "load" });
const zone = page.locator(".pdf-lifecycle-zone").first();
await zone.waitFor({ state: "visible", timeout: 15_000 });
const pngPath = join(outDir, `listing-country-changes-${label}.png`);
await zone.screenshot({ path: pngPath });
await browser.close();
console.log(`PNG: ${pngPath}`);
console.log(`dir: ${dirname(pngPath)}`);
