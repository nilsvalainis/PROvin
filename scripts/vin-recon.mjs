#!/usr/bin/env node
/**
 * Recon rīks VIN avotu izpētei: dump formas lauki, iframe'i, XHR endpointi, HTML, screenshot.
 * Lietošana: node scripts/vin-recon.mjs <source> [--headed] [--vin VIN]
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCES = {
  mnt: "https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf",
  lkf: "https://lkf.ee/et/kahjukontroll",
  fstyr: "https://www.fstyr.dk/privat/syn/find-synsrapport",
  nummerplade: "https://www.nummerplade.net/",
  tjekbil: "https://www.tjekbil.dk/",
  carinfo: "https://www.car.info/",
};

const args = process.argv.slice(2);
const source = args[0];
const headed = args.includes("--headed");
const vinIdx = args.indexOf("--vin");
const vin = vinIdx >= 0 ? args[vinIdx + 1] : null;

if (!source || !SOURCES[source]) {
  console.error(`Lietošana: node scripts/vin-recon.mjs <${Object.keys(SOURCES).join("|")}> [--headed] [--vin VIN]`);
  process.exit(1);
}

const outDir = path.join(process.cwd(), "tmp", "vin-recon", source);
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: !headed, args: ["--disable-blink-features=AutomationControlled"] });
const context = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  locale: "en-US",
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();

const net = [];
page.on("request", (req) => {
  const type = req.resourceType();
  if (["image", "font", "stylesheet", "media"].includes(type)) return;
  net.push({ phase: "req", type, method: req.method(), url: req.url(), postData: req.postData()?.slice(0, 2000) ?? null });
});
page.on("response", async (res) => {
  const type = res.request().resourceType();
  if (["image", "font", "stylesheet", "media"].includes(type)) return;
  net.push({ phase: "res", type, status: res.status(), url: res.url(), contentType: res.headers()["content-type"] ?? null });
});

console.log(`→ ${SOURCES[source]}`);
await page.goto(SOURCES[source], { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);

const inspect = async (frame, label) => {
  const info = await frame.evaluate(() => {
    const q = (sel) => Array.from(document.querySelectorAll(sel));
    return {
      url: location.href,
      title: document.title,
      inputs: q("input,select,textarea").map((el) => ({
        tag: el.tagName,
        type: el.getAttribute("type"),
        name: el.getAttribute("name"),
        id: el.id || null,
        placeholder: el.getAttribute("placeholder"),
        ariaLabel: el.getAttribute("aria-label"),
        value: el.getAttribute("type") === "hidden" ? String(el.value).slice(0, 80) : null,
        visible: !!(el.offsetWidth || el.offsetHeight),
      })),
      buttons: q("button,input[type=submit],a.btn,[role=button]")
        .map((el) => ({ tag: el.tagName, name: el.getAttribute("name"), id: el.id || null, text: (el.textContent || el.value || "").trim().slice(0, 60) }))
        .filter((b) => b.text || b.name),
      forms: q("form").map((f) => ({ id: f.id || null, action: f.getAttribute("action"), method: f.getAttribute("method") })),
      iframes: q("iframe").map((f) => ({ src: f.getAttribute("src"), id: f.id || null, title: f.getAttribute("title") })),
      hasRecaptcha: !!document.querySelector(".g-recaptcha,[data-sitekey],iframe[src*='recaptcha']"),
      hasTurnstile: !!document.querySelector(".cf-turnstile,iframe[src*='turnstile'],iframe[src*='challenges.cloudflare']"),
      nextData: (() => {
        const el = document.getElementById("__NEXT_DATA__");
        return el ? String(el.textContent).slice(0, 500) : null;
      })(),
    };
  });
  console.log(`\n=== ${label} ===`);
  console.log(`url: ${info.url}`);
  console.log(`title: ${info.title}`);
  console.log(`recaptcha: ${info.hasRecaptcha} | turnstile: ${info.hasTurnstile} | __NEXT_DATA__: ${!!info.nextData}`);
  console.log("redzamie lauki:");
  for (const i of info.inputs.filter((x) => x.visible || x.type !== "hidden")) {
    console.log(`  ${i.tag}[${i.type}] name=${i.name} id=${i.id} ph=${i.placeholder} aria=${i.ariaLabel} visible=${i.visible}`);
  }
  console.log("pogas:");
  for (const b of info.buttons.slice(0, 25)) console.log(`  ${b.tag} id=${b.id} name=${b.name} "${b.text}"`);
  console.log("iframes:");
  for (const f of info.iframes) console.log(`  ${f.id} ${f.title} ${String(f.src).slice(0, 120)}`);
  return info;
};

const main = await inspect(page, "main frame");
const frames = [];
for (const f of page.frames()) {
  if (f === page.mainFrame()) continue;
  const url = f.url();
  if (!url || url === "about:blank" || /recaptcha|gstatic|google|doubleclick|hotjar|facebook/.test(url)) continue;
  try {
    frames.push(await inspect(f, `iframe ${url}`));
  } catch (e) {
    console.log(`iframe ${url} — inspect neizdevās: ${e.message}`);
  }
}

const SEARCH = {
  mnt: async () => {
    await page.fill("#soidukOtsingForm\\:vinKood", vin);
    await page.click("#soidukOtsingForm button:has-text('Otsin')").catch(() => page.click("button:has-text('Otsin')"));
    await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => {});
  },
  lkf: async () => {
    const input = page.locator("input[type=text],input:not([type])").first();
    await input.fill(vin);
    console.log("→ LKF: ja ir reCAPTCHA, nospied to browserī tagad (gaidu 90s)...");
    await page.waitForTimeout(headed ? 90000 : 5000);
  },
  nummerplade: async () => {
    await page.fill("input[aria-label*='Nummerplade'],input[placeholder*='nummerplade']", vin);
    await page.keyboard.press("Enter");
    await page.waitForLoadState("networkidle", { timeout: 45000 }).catch(() => {});
  },
  tjekbil: async () => {
    await page.goto(`https://www.tjekbil.dk/stelnummer/${vin}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(6000);
  },
  fstyr: async () => {
    await page.waitForTimeout(3000);
  },
  carinfo: async () => {
    await page.goto(`https://www.car.info/en-se/license-plate/VIN/${vin}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(6000);
  },
};

if (vin && SEARCH[source]) {
  console.log(`\n→ Meklēju VIN ${vin}...`);
  try {
    await SEARCH[source]();
  } catch (e) {
    console.log(`meklēšana kļūda: ${e.message}`);
  }
  await page.waitForTimeout(2500);
  console.log(`rezultāta URL: ${page.url()}`);
  const text = await page.evaluate(() => document.body.innerText.replace(/\n{3,}/g, "\n\n").slice(0, 4000));
  console.log("--- lapas teksts (4000 z.) ---");
  console.log(text);
  await writeFile(path.join(outDir, "result.html"), await page.content(), "utf8");
  await writeFile(path.join(outDir, "result.txt"), text, "utf8");
  await page.screenshot({ path: path.join(outDir, "result.png"), fullPage: true });
  const apiCalls = net.filter((n) => n.phase === "res" && ["xhr", "fetch"].includes(n.type));
  console.log("--- XHR/fetch pēc meklēšanas ---");
  for (const c of apiCalls) console.log(`  ${c.status} ${c.contentType?.slice(0, 30)} ${c.url.slice(0, 160)}`);
}

await writeFile(path.join(outDir, "page.html"), await page.content(), "utf8");
await page.screenshot({ path: path.join(outDir, "page.png"), fullPage: true });
await writeFile(path.join(outDir, "network.json"), JSON.stringify(net, null, 2), "utf8");
await writeFile(path.join(outDir, "inspect.json"), JSON.stringify({ main, frames }, null, 2), "utf8");

console.log(`\nSaglabāts: ${outDir}`);
console.log(`XHR/fetch/doc pieprasījumi: ${net.filter((n) => n.phase === "req" && ["xhr", "fetch", "document"].includes(n.type)).length}`);

if (headed) {
  console.log("Headed režīms: browsers paliek atvērts 60s manuālai izpētei...");
  await page.waitForTimeout(60000);
}
await browser.close();
