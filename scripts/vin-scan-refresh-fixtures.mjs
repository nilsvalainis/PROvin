#!/usr/bin/env node
/**
 * VIN SCAN "zelta VIN" fiksācijas - atkārtota lejupielāde no bezmaksas avotiem.
 *
 * Ko dara:
 *   Lejupielādē reālas atbildes no NHTSA vPIC, tjekbil.dk un esyn.dk par fiksētu VIN sarakstu,
 *   izņem personas datus un saglabā tās lib/vin-scan/__fixtures__/<avots>/<VIN>*.json.
 *   Testi lib/vin-scan/golden-fixtures.test.ts šīs atbildes laiž caur īstajiem parseriem.
 *
 * Kad palaist:
 *   Tikai ar roku, kad avots mainījis formātu vai gribam svaigus datus:
 *     node scripts/vin-scan-refresh-fixtures.mjs
 *   Pēc tam `npx vitest run lib/vin-scan/golden-fixtures.test.ts` - ja dati mainījušies,
 *   testu gaidītās vērtības jāpārskata ar roku (tā ir jēga: formāta maiņa nedrīkst paslīdēt garām).
 *
 * Noteikumi:
 *   - NEDARBINĀT CI (skripts beidzas, ja ir CI vide). Tas veic īstus tīkla pieprasījumus.
 *   - Tikai bezmaksas, atvērti galapunkti. Nekādu atslēgu, proxy vai CAPTCHA risinātāju.
 *   - Ne vairāk kā 3 VIN uz avotu, vismaz 2 s pauze starp pieprasījumiem.
 *   - Personas dati (īpašnieki, adreses, lietotāju ID, atskaišu attēli) tiek izņemti pirms saglabāšanas.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.CI) {
  console.error("vin-scan-refresh-fixtures: CI vidē netiek darbināts (īsti tīkla pieprasījumi).");
  process.exit(0);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "lib/vin-scan/__fixtures__");
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const PAUSE_MS = 2_000;

const NHTSA_VINS = ["WBA5R1C0XLFH42873", "TMBJH9NP9N7043581", "1HGCM82633A004352"];
const DK_VINS = ["WVWZZZ7NZEV015204", "VF12RFL1H49621453", "YV1DZ5251B2146640"];
/** Vienam atrastam tjekbil VIN papildus nolasām mileagelogs. */
const TJEKBIL_MILEAGE_VIN = "VF12RFL1H49621453";

/** Atslēgas, ko izņemam jebkurā dziļumā (personas dati vai tiem piesaistīti lauki). */
const DROP_KEYS = /^(ejer.*|owner.*|.*ownerName|navn_?ejer|adresse|address|coordinates|imageUrl|createdBy|cpr.*|personnummer)$/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let firstRequest = true;

async function get(url, headers = {}) {
  if (!firstRequest) await sleep(PAUSE_MS);
  firstRequest = false;
  const res = await fetch(url, { headers: { "user-agent": UA, ...headers } });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  console.log(`${res.status} ${url}`);
  return { status: res.status, body };
}

function scrub(value) {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (DROP_KEYS.test(k)) continue;
      out[k] = scrub(v);
    }
    return out;
  }
  return value;
}

async function save(source, name, url, res) {
  const dir = path.join(OUT, source);
  await mkdir(dir, { recursive: true });
  const fixture = {
    _meta: {
      url,
      status: res.status,
      fetchedAt: new Date().toISOString().slice(0, 10),
      note: "Reāla atbilde; personas dati izņemti ar scripts/vin-scan-refresh-fixtures.mjs",
    },
    body: scrub(res.body),
  };
  await writeFile(path.join(dir, `${name}.json`), `${JSON.stringify(fixture, null, 2)}\n`);
}

async function main() {
  for (const vin of NHTSA_VINS) {
    const url = `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`;
    await save("nhtsa", vin, url, await get(url));
  }

  const tjekbilHeaders = { accept: "application/json", referer: "https://www.tjekbil.dk/" };
  const kids = {};
  for (const vin of DK_VINS) {
    const url = `https://www.tjekbil.dk/api/v3/dmr/vin/${vin}`;
    const res = await get(url, tjekbilHeaders);
    await save("tjekbil", vin, url, res);
    const b = res.body && typeof res.body === "object" ? res.body : {};
    const kid = b.basic?.koeretoejId ?? b.extended?.general?.kid ?? (Number(b.extended?.carId) || null);
    if (kid) kids[vin] = kid;
  }
  if (kids[TJEKBIL_MILEAGE_VIN]) {
    const url = `https://www.tjekbil.dk/api/v3/vehicles/mileagelogs?dmrId=${kids[TJEKBIL_MILEAGE_VIN]}`;
    await save("tjekbil", `${TJEKBIL_MILEAGE_VIN}.mileagelogs`, url, await get(url, tjekbilHeaders));
  }

  for (const vin of DK_VINS) {
    const url = `https://findsynsrapport.esyn.dk/webapi/v1/chassis/${vin}`;
    const res = await get(url, { accept: "application/json" });
    await save("esyn", `${vin}.chassis`, url, res);
    const row = Array.isArray(res.body) ? res.body.find((r) => r?.chassisNumber === vin) ?? res.body[0] : null;
    if (res.status !== 200 || !row?.make) continue;
    const listUrl = `https://findsynsrapport.esyn.dk/webapi/v1/chassismake/${vin}/${encodeURIComponent(row.make)}`;
    await save("esyn", `${vin}.chassismake`, listUrl, await get(listUrl, { accept: "application/json" }));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
