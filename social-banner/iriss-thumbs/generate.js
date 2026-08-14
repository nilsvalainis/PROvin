/**
 * Ģenerē 4 IRISS YouTube thumbnail JPG (1280×720).
 *
 *   cd social-banner/iriss-thumbs
 *   node generate.js
 *
 * Izmanto Chrome no Applications (kā social-banner/generate.js).
 */

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

async function main() {
  let puppeteer;
  try {
    puppeteer = require('../node_modules/puppeteer');
  } catch {
    try {
      puppeteer = require('puppeteer');
    } catch {
      console.error('Puppeteer nav atrasts. Palaid: cd social-banner && npm install');
      process.exit(1);
    }
  }

  const htmlPath = path.join(__dirname, 'index.html');
  const outDir = path.join(__dirname, 'out');
  fs.mkdirSync(outDir, { recursive: true });

  const chromePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

  const launchOpts = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };
  if (fs.existsSync(chromePath)) launchOpts.executablePath = chromePath;

  const browser = await puppeteer.launch(launchOpts);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(htmlPath).href, {
      waitUntil: 'networkidle0',
      timeout: 120000,
    });
    await page.waitForFunction(
      () =>
        typeof window.html2canvas === 'function' &&
        typeof window.__exportAllThumbs === 'function',
      { timeout: 60000 }
    );
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });
    await new Promise((r) => setTimeout(r, 400));

    const files = await page.evaluate(async () => window.__exportAllThumbs());
    for (const file of files) {
      const base64 = file.dataUrl.replace(/^data:image\/jpeg;base64,/, '');
      const outPath = path.join(outDir, file.name);
      fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
      console.log('Saglabāts:', outPath);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
