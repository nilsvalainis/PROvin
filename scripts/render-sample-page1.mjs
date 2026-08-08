import path from "path";
import fs from "fs";
import http from "http";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const samples = ["provin-mini-piemers", "provin-audits-piemers", "provin-dilera-dati-piemers"];

const mime = {
  ".mjs": "text/javascript",
  ".js": "text/javascript",
  ".pdf": "application/pdf",
  ".html": "text/html",
  ".map": "application/json",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const p = decodeURIComponent(url.pathname);
  if (p === "/render.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!doctype html><html><body style="margin:0;background:#fff"><canvas id="c"></canvas>
<script type="module">
import * as pdfjs from '/node_modules/pdfjs-dist/build/pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/build/pdf.worker.min.mjs';
const params = new URLSearchParams(location.search);
const name = params.get('name');
const pdf = await pdfjs.getDocument({ url: '/public/samples/' + name + '.pdf', useSystemFonts: true }).promise;
const pg = await pdf.getPage(1);
const base = pg.getViewport({ scale: 1 });
const targetWidth = 2000;
const viewport = pg.getViewport({ scale: targetWidth / base.width });
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d', { alpha: false });
canvas.width = Math.floor(viewport.width);
canvas.height = Math.floor(viewport.height);
ctx.fillStyle = '#fff';
ctx.fillRect(0,0,canvas.width,canvas.height);
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';
await pg.render({ canvasContext: ctx, viewport, intent: 'print' }).promise;
window.__done = { w: canvas.width, h: canvas.height };
</script></body></html>`);
    return;
  }
  const filePath = path.join(root, p.replace(/^\//, ""));
  if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("no");
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
console.log("port", port);

const browser = await chromium.launch();
try {
  for (const name of samples) {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.error("pageerror", name, e.message));
    page.on("console", (m) => console.log("console", name, m.type(), m.text()));
    await page.goto(`http://127.0.0.1:${port}/render.html?name=${encodeURIComponent(name)}`, {
      waitUntil: "networkidle",
      timeout: 60000,
    });
    await page.waitForFunction(() => window.__done, null, { timeout: 90000 });
    const dim = await page.evaluate(() => window.__done);
    const outPng = path.join(root, "public/samples", `${name}-page1.png`);
    await page.locator("#c").screenshot({ path: outPng, type: "png" });
    console.log("OK", name, dim, fs.statSync(outPng).size);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
