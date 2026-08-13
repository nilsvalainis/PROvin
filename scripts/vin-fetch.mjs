#!/usr/bin/env node
/**
 * PROVIN iekšējais VIN vākšanas rīks: publiskie bezmaksas valsts reģistru avoti.
 *
 *   npm run vin:fetch -- <VIN> [--regmark 123ABC] [--sources tjekbil,mnt,lkf] [--headless] [--quiet]
 *
 * Avoti:
 *   tjekbil  DK Motorregister + apskates + odometrs + Bilbogen ķīlas (HTTP JSON, ātrs)
 *   mnt      EE Transpordiamet taustakontroll (vajag redzamu browseri — invisible reCAPTCHA)
 *   lkf      EE Liikluskindlustuse Fond kahjukontroll (reCAPTCHA v2 ķeksis)
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createContext } from "./vin-sources/browser.mjs";
import { fetchTjekbil } from "./vin-sources/tjekbil.mjs";
import { fetchMnt } from "./vin-sources/mnt.mjs";
import { fetchLkf } from "./vin-sources/lkf.mjs";
import { buildFacts } from "./vin-sources/normalize.mjs";
import { renderReport } from "./vin-sources/report.mjs";

const positional = [];
const flags = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (!arg.startsWith("--")) {
    positional.push(arg);
    continue;
  }
  const next = argv[i + 1];
  if (next && !next.startsWith("--")) {
    flags[arg.slice(2)] = next;
    i += 1;
  } else {
    flags[arg.slice(2)] = true;
  }
}

const vin = positional[0];
const regMark = typeof flags.regmark === "string" ? flags.regmark : "";
const headless = flags.headless === true;
const quiet = flags.quiet === true;
const sources = String(flags.sources ?? "tjekbil,mnt,lkf")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!vin || !/^[A-HJ-NPR-Z0-9]{11,17}$/i.test(vin)) {
  console.error("Lietošana: npm run vin:fetch -- <VIN> [--regmark 123ABC] [--sources tjekbil,mnt,lkf] [--headless]");
  process.exit(1);
}
const VIN = vin.toUpperCase();

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = path.join(process.cwd(), "tmp", "vin-reports", VIN, stamp);
await mkdir(outDir, { recursive: true });

const log = (...m) => !quiet && console.log(...m);
const results = [];

if (sources.includes("tjekbil")) {
  log("→ tjekbil.dk (DK reģistrs)...");
  try {
    const r = await fetchTjekbil(VIN);
    results.push(r);
    log(`  ${r.found ? `atrasts: ${[r.vehicle?.make, r.vehicle?.model].filter(Boolean).join(" ")} · ${r.regNr}` : r.note}`);
  } catch (e) {
    log(`  kļūda: ${e.message}`);
    results.push({ source: "tjekbil.dk", found: false, note: `kļūda: ${e.message}` });
  }
}

const browserSources = sources.filter((s) => s === "mnt" || s === "lkf");
if (browserSources.length) {
  const { context, page } = await createContext({ profile: "vin", headless });
  try {
    if (browserSources.includes("mnt")) {
      log("→ eteenindus.mnt.ee (EE Transpordiamet)...");
      try {
        const r = await fetchMnt(page, VIN, { regMark });
        results.push(r);
        log(`  ${r.found ? `atrasts: ${Object.keys(r.fields).length} lauki` : r.note}`);
      } catch (e) {
        log(`  kļūda: ${e.message}`);
        results.push({ source: "eteenindus.mnt.ee", found: false, note: `kļūda: ${e.message}` });
      }
    }
    if (browserSources.includes("lkf")) {
      log("→ lkf.ee (EE liikluskahjude kontroll)...");
      try {
        const r = await fetchLkf(page, regMark || VIN);
        results.push(r);
        log(`  ${r.found ? "atlīdzību ieraksti atrasti" : (r.note ?? "nav datu")}`);
      } catch (e) {
        log(`  kļūda: ${e.message}`);
        results.push({ source: "lkf.ee", found: false, note: `kļūda: ${e.message}` });
      }
    }
  } finally {
    await context.close();
  }
}

const facts = buildFacts(results);
const report = renderReport(VIN, facts, { regMark });

await writeFile(path.join(outDir, "raw.json"), JSON.stringify({ vin: VIN, regMark, fetchedAt: new Date().toISOString(), results }, null, 2), "utf8");
await writeFile(path.join(outDir, "facts.json"), JSON.stringify(facts, null, 2), "utf8");
await writeFile(path.join(outDir, "report.md"), report, "utf8");

console.log(`\n${report}`);
console.log(`\nSaglabāts: ${outDir}`);
