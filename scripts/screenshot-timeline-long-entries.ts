/**
 * Before/after of Vēstures kopsavilkums when AutoDNA Laikposma rows
 * carry a long description (variant B: short title row + full-width body).
 *
 *   npx vite-node -c vitest.config.ts scripts/screenshot-timeline-long-entries.ts before
 *   npx vite-node -c vitest.config.ts scripts/screenshot-timeline-long-entries.ts after
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { chromium } from "playwright";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import { longTimelineEntriesVendorBlock } from "@/lib/timeline-long-entries.fixture";

const label = process.argv[2] === "after" ? "after" : "before";
const outDir = process.env.ARTIFACT_DIR || "/opt/cursor/artifacts/screenshots";
mkdirSync(outDir, { recursive: true });

function payload(): ClientReportPayload {
  return {
    sessionId: "timeline-long-entries-shot",
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
    manualVendorBlocks: [longTimelineEntriesVendorBlock()],
  } as ClientReportPayload;
}

const html = buildClientReportDocumentHtml({
  payload: payload(),
  portfolio: [],
  pdfInsights: [],
  dateFmt: new Intl.DateTimeFormat("lv-LV"),
  formatBytes: () => "0 B",
});

const htmlPath = join(outDir, `timeline_long_entries_${label}.html`);
writeFileSync(htmlPath, html);
console.log(`HTML: ${htmlPath}`);
console.log(`life cards: ${(html.match(/pdf-life-card__grid/g) ?? []).length}`);
console.log(`body blocks: ${(html.match(/pdf-life-card__body/g) ?? []).length}`);
console.log(`more buttons: ${(html.match(/pdf-life-card__more/g) ?? []).length}`);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 920, height: 1600 },
  deviceScaleFactor: 2,
});
await page.setContent(html, { waitUntil: "load" });
const zone = page.locator(".pdf-lifecycle-zone").first();
await zone.waitFor({ state: "visible", timeout: 15_000 });

const webZonePath = join(outDir, `timeline_long_entries_web_${label}.png`);
await zone.screenshot({ path: webZonePath });
console.log(`WEB ZONE: ${webZonePath}`);

const longCard = page.locator(".pdf-life-card", { hasText: "atjaunoti pēc īpašnieka maiņas" }).first();
await longCard.waitFor({ state: "visible", timeout: 15_000 });
const webCardPath = join(outDir, `timeline_long_entries_web_card_${label}.png`);
await longCard.screenshot({ path: webCardPath });
console.log(`WEB CARD: ${webCardPath}`);

await page.emulateMedia({ media: "print" });
const printZonePath = join(outDir, `timeline_long_entries_print_${label}.png`);
await zone.screenshot({ path: printZonePath });
console.log(`PRINT ZONE: ${printZonePath}`);

const printCardPath = join(outDir, `timeline_long_entries_print_card_${label}.png`);
await longCard.screenshot({ path: printCardPath });
console.log(`PRINT CARD: ${printCardPath}`);

await browser.close();
console.log(`dir: ${dirname(webZonePath)}`);
