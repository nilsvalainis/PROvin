/**
 * Automātiski renderē social-banner/index.html → banner.jpg (1200×630).
 *
 * Lietojums:
 *   cd social-banner
 *   npm install
 *   node generate.js
 */

const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

async function main() {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    console.error(
      'Puppeteer nav instalēts. Palaid:\n  cd social-banner && npm install\n'
    );
    process.exit(1);
  }

  const htmlPath = path.join(__dirname, 'index.html');
  const outPath = path.join(__dirname, 'banner.jpg');

  if (!fs.existsSync(htmlPath)) {
    console.error('Nav atrasts index.html:', htmlPath);
    process.exit(1);
  }

  const fileUrl = pathToFileURL(htmlPath).href;
  console.log('Atver:', fileUrl);

  const chromePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

  const launchOpts = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };
  if (fs.existsSync(chromePath)) {
    launchOpts.executablePath = chromePath;
  }

  const browser = await puppeteer.launch(launchOpts);

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });

    await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 120000 });

    // Gaida Tailwind CDN + html2canvas + fonti
    await page.waitForFunction(
      () =>
        typeof window.html2canvas === 'function' &&
        typeof window.__renderBannerJpg === 'function',
      { timeout: 60000 }
    );

    // Ļauj fontiem ielādēties
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready;
    });
    await new Promise((r) => setTimeout(r, 400));

    const dataUrl = await page.evaluate(async () => window.__renderBannerJpg());

    if (!dataUrl || !dataUrl.startsWith('data:image/jpeg')) {
      throw new Error('Nepareizs canvas output no __renderBannerJpg()');
    }

    const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
    fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));

    const stats = fs.statSync(outPath);
    console.log(`Saglabāts: ${outPath} (${Math.round(stats.size / 1024)} KB)`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
