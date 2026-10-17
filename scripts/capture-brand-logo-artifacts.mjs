#!/usr/bin/env node
/**
 * Headless PNG captures for brand-logo QA (OEM PDF, client report PDF, admin row mock).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";

const OUT = "/opt/cursor/artifacts";
const TMP = "/tmp/provin-logo-artifacts";

async function main() {
  const { buildOemDealerDocumentHtml } = await import("../lib/pdf-dealer-oem.ts");
  const { emptyAutoRecordsBlock } = await import("../lib/admin-source-blocks.ts");
  const { emptyOneautoBlock } = await import("../lib/oneauto-block.ts");
  const { buildClientReportDocumentHtml } = await import("../lib/client-report-html.ts");
  const { emptyCsddFields } = await import("../lib/admin-source-blocks.ts");
  const { PDF_DEALER_LOGO_DATA_URI } = await import("../lib/pdf-source-brand-logos.ts");

  await mkdir(OUT, { recursive: true });
  await mkdir(TMP, { recursive: true });

  const oemHtml = buildOemDealerDocumentHtml({
    vin: "WBA5K51060D083631",
    makeModel: "BMW 535d",
    autoRecords: emptyAutoRecordsBlock(),
    oneauto: emptyOneautoBlock(),
  });

  const subaruWide = PDF_DEALER_LOGO_DATA_URI.subaru;
  const oemSubaruHtml = buildOemDealerDocumentHtml({
    vin: "JF2SKAJC8KH123456",
    makeModel: "Subaru Forester",
    autoRecords: emptyAutoRecordsBlock(),
    oneauto: emptyOneautoBlock(),
  });

  const clientHtml = buildClientReportDocumentHtml({
    payload: {
      sessionId: "logo_qa",
      vin: "WBA5K51060D083631",
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
      csddForm: { ...emptyCsddFields(), makeModel: "BMW 535d" },
      autoRecordsBlock: emptyAutoRecordsBlock(),
    },
    portfolio: [],
    pdfInsights: [],
    dateFmt: new Intl.DateTimeFormat("lv-LV"),
    formatBytes: () => "0 B",
  });

  const adminMock = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>
body{font-family:system-ui,sans-serif;background:#f5f5f7;padding:24px;margin:0;}
.row{display:flex;align-items:flex-start;gap:10px;padding:12px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;max-width:420px;}
.row+.row{margin-top:10px;}
.logo-slot{display:inline-flex;width:76px;height:40px;flex-shrink:0;align-items:center;justify-content:center;overflow:visible;}
.logo-slot img{object-fit:contain;}
.logo-slot img.wide{width:64px;max-height:100%;}
.logo-slot img.round{height:30px;width:30px;transform:scale(1.45);transform-origin:center;}
.title{font-size:17px;font-weight:600;color:#111827;}
.sub{font-size:13px;color:#6b7280;}
</style></head><body>
<p style="font-size:12px;color:#64748b;margin:0 0 12px;">IRISS saraksts: 76×40px logo slots</p>
<div class="row"><span class="logo-slot"><img class="round" src="/brand-logos/bmw.svg" alt="" width="30" height="30"/></span><div><div class="title">BMW 840i</div><div class="sub">WBA12345678901234</div></div></div>
<div class="row"><span class="logo-slot"><img class="wide" src="/brand-logos/audi-wide.svg" alt="" width="64" height="40"/></span><div><div class="title">Audi A6</div><div class="sub">WAUZZZ4G5DN123456</div></div></div>
<div class="row"><span class="logo-slot"><img class="wide" src="/brand-logos/subaru-wide.svg" alt="" width="64" height="40"/></span><div><div class="title">Subaru Forester</div><div class="sub">JF2SKAJC8KH123456</div></div></div>
<div class="row"><span class="logo-slot"><img class="round" src="/brand-logos/mercedes.svg" alt="" width="30" height="30"/></span><div><div class="title">Mercedes-Benz E 220</div><div class="sub">WDD2130041A123456</div></div></div>
<div class="row"><span class="logo-slot"><img class="round" src="/brand-logos/volkswagen.svg" alt="" width="30" height="30"/></span><div><div class="title">VW Golf</div><div class="sub">WVWZZZ1KZAW123456</div></div></div>
</body></html>`;

  await writeFile(join(TMP, "oem-bmw.html"), oemHtml, "utf8");
  await writeFile(join(TMP, "oem-subaru.html"), oemSubaruHtml, "utf8");
  await writeFile(join(TMP, "client-report.html"), clientHtml, "utf8");
  await writeFile(join(TMP, "admin-iriss-mock.html"), adminMock, "utf8");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });

  const shots = [
    { file: "oem-bmw.html", out: "oem-dealer-pdf-bmw-header.png", clip: { x: 0, y: 0, width: 900, height: 220 } },
    { file: "oem-subaru.html", out: "oem-dealer-pdf-subaru-wide-header.png", clip: { x: 0, y: 0, width: 900, height: 220 } },
    { file: "client-report.html", out: "client-report-pdf-source-logos.png", clip: { x: 0, y: 0, width: 900, height: 900 } },
  ];

  for (const s of shots) {
    await page.goto(`file://${join(TMP, s.file)}`, { waitUntil: "load" });
    await page.screenshot({ path: join(OUT, s.out), clip: s.clip });
    console.log("wrote", join(OUT, s.out));
  }

  const server = await import("node:http");
  const { createReadStream, existsSync } = await import("node:fs");
  const { extname } = await import("node:path");
  const publicRoot = join(import.meta.dirname, "..", "public");
  const httpServer = server.createServer((req, res) => {
    const urlPath = (req.url || "/").split("?")[0].replace(/^\//, "") || "index.html";
    let p = join(publicRoot, urlPath);
    if (req.url === "/admin-iriss-mock.html") p = join(TMP, "admin-iriss-mock.html");
    if (!existsSync(p)) {
      res.statusCode = 404;
      res.end("not found");
      return;
    }
    const ext = extname(p);
    const type =
      ext === ".html"
        ? "text/html"
        : ext === ".svg"
          ? "image/svg+xml"
          : "application/octet-stream";
    res.setHeader("Content-Type", type);
    createReadStream(p).pipe(res);
  });
  await new Promise((r) => httpServer.listen(8765, "127.0.0.1", r));
  await page.goto("http://127.0.0.1:8765/admin-iriss-mock.html", { waitUntil: "networkidle" });
  await page.screenshot({ path: join(OUT, "admin-iriss-brand-logos.png"), fullPage: true });
  console.log("wrote", join(OUT, "admin-iriss-brand-logos.png"));
  httpServer.close();
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
