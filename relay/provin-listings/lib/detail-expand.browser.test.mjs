/**
 * Nils 20.11: Auto1 «Dati pēc VIN» - pārlūka tests ar sintētisku lapu (bez tīkla, bez Auto1 konta).
 * Saraksts pēc «+» klikšķa DOM parādās tikai pēc brīža; blakus solīšanas / pirkšanas pogas, kuras NEDRĪKST nospiest.
 * Palaišana: node --test lib/detail-expand.browser.test.mjs (vajag Chrome; ja nav - tests tiek izlaists).
 * CHROME_EXECUTABLE var norādīt citu ceļu (noklusēti /opt/google/chrome/chrome).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { fetchAuctionDetail } from "./detail-page.mjs";

const CHROME = process.env.CHROME_EXECUTABLE || "/opt/google/chrome/chrome";
let chromium = null;
try {
  ({ chromium } = await import("playwright-core"));
} catch {
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    chromium = null;
  }
}
const skip = !chromium || !fs.existsSync(CHROME) ? "nav Playwright vai Chrome" : false;

const URL = "https://www.auto1.com/en/app/merchant/car/DE1";
const VIN_ALL = Array.from({ length: 25 }, (_, i) => `VIN option ${i + 1}`);
const EQUIP = ["Navigation system", "Heated seats", "LED headlights", "Parking sensors", "Cruise control"];

const FIXTURE = `<!doctype html><html><head><meta charset="utf-8"><title>Skoda Kodiaq</title></head><body>
<header><button id="lang" aria-expanded="false" aria-haspopup="true" onclick="bad('lang')">EN</button></header>
<main>
  <h1>Skoda Kodiaq 2.0 TDI</h1>
  <ul class="facts">
    <li>Mileage: 120 000 km</li><li>First registration: 03/2019</li><li>Fuel type: Diesel</li><li>Gearbox: Automatic</li>
    <li>Power: 140 kW</li><li>Colour: Grey</li><li>Keys: 2</li><li>Seats: 7</li>
  </ul>
  <section id="vin">
    <h2>Car data according to identification number (VIN)</h2>
    <ul id="vin-list">${VIN_ALL.slice(0, 10).map((t) => `<li>${t}</li>`).join("")}</ul>
    <button id="vin-more" aria-expanded="false"><svg width="10" height="10"></svg>+</button>
  </section>
  <section id="equip">
    <h2>Equipment</h2>
    <button id="equip-toggle" aria-expanded="false" aria-label="Expand"><svg width="10" height="10"></svg></button>
    <div id="equip-body"></div>
  </section>
  <section id="bidding">
    <div>Current price: 12 500 €</div>
    <button onclick="bad('bid')">Bid now</button>
    <button aria-label="Increase bid" onclick="bad('bid+')">+</button>
    <button data-testid="instant-buy" onclick="bad('buy')">Buy now</button>
    <button aria-expanded="false" onclick="bad('gebot')">Gebot abgeben</button>
    <div role="button" onclick="bad('kaufen')">Jetzt kaufen</div>
  </section>
</main>
<script>
  window.__bad = [];
  function bad(x) { window.__bad.push(x); }
  const VIN_REST = ${JSON.stringify(VIN_ALL.slice(10))};
  const EQUIP = ${JSON.stringify(EQUIP)};
  document.getElementById("vin-more").addEventListener("click", (ev) => {
    const b = ev.currentTarget;
    // Pārējās pozīcijas DOM parādās tikai pēc klikšķa un ar aizturi (kā Auto1 SPA).
    setTimeout(() => {
      const rest = document.createElement("div");
      rest.id = "vin-rest";
      rest.innerHTML = VIN_REST.map((t) => "<div>" + t + "</div>").join("");
      b.before(rest);
      b.setAttribute("aria-expanded", "true");
      b.textContent = "-";
    }, 700);
  });
  document.getElementById("equip-toggle").addEventListener("click", (ev) => {
    const b = ev.currentTarget;
    setTimeout(() => {
      document.getElementById("equip-body").innerHTML = "<ul>" + EQUIP.map((t) => "<li>" + t + "</li>").join("") + "</ul>";
      b.setAttribute("aria-expanded", "true");
    }, 400);
  });
</script>
</body></html>`;

test("Auto1 detaļas: «+» izvērš «Dati pēc VIN» (25, ne 10) un aprīkojumu; solīšanas/pirkšanas pogas netiek spiestas", { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"], headless: true });
  try {
    const page = await browser.newPage();
    await page.route("**/*", (route) =>
      route.request().url() === URL ? route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: FIXTURE }) : route.abort(),
    );
    const out = await fetchAuctionDetail(page, "auto1", URL);
    assert.equal(out.status, "ok", out.note);
    const vin = out.detail.lists.find((l) => /according to identification number/i.test(l.heading));
    assert.ok(vin, "nav VIN saraksta");
    assert.equal(vin.items.length, 25, vin.items.join(" | "));
    assert.deepEqual(vin.items, VIN_ALL);
    const eq = out.detail.lists.find((l) => l.items.includes("Heated seats"));
    assert.ok(eq, "aprīkojums nav izvērsts");
    assert.equal(eq.items.length, 5);
    assert.deepEqual(await page.evaluate(() => window.__bad), []);
  } finally {
    await browser.close();
  }
});
