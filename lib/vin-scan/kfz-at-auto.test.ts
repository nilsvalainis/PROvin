/**
 * 26.11 (Nils): kfzgutachten.at §57a pārbaude visiem auto ar VIN + CSDD 1. reģ. datumu (releja Chrome).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { kfzDateFromRowUrl } from "@/lib/vin-scan/shared-scan";
import { vinScanSourceTimeoutMs } from "@/lib/vin-scan/source-timeouts";
import { vinScanRowTtlMs } from "@/lib/vin-scan/source-ttl";
import { isVinScanHealthFailure } from "@/lib/vin-scan/source-health-outcomes";
import { createVinScanFirstRegHint } from "@/lib/vin-scan/vehicle-hint";
import { parseVinScanIndicator } from "@/lib/order-vin-scan";
import { buildVinScanIndicator } from "@/lib/vin-scan/types";

const src = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

describe("kfz_at datums no tā paša skenējuma CSDD", () => {
  it("gaida CSDD ziņojumu; bez CSDD skenējumā - uzreiz tukšs", async () => {
    const hint = createVinScanFirstRegHint(true, { waitMs: 2_000 });
    const pending = hint.wait();
    hint.report("2004-08-20");
    hint.report("1999-01-01");
    await expect(pending).resolves.toBe("2004-08-20");
    await expect(createVinScanFirstRegHint(false).wait()).resolves.toBe("");
  });

  it("CSDD neatbild - pēc gaidīšanas tukšs (kfz_at tad «nav pārbaudīts»)", async () => {
    await expect(createVinScanFirstRegHint(true, { waitMs: 10 }).wait()).resolves.toBe("");
  });

  it("CSDD zonde paziņo datumu arī kļūdas / izlaišanas gadījumā (gaidītāji neiesprūst)", () => {
    const probes = src("lib/vin-scan/probes.ts");
    expect(probes).toMatch(/ctx\.reportFirstReg\?\.\(res\.found \? res\.data\.firstRegistrationIso : ""\)/);
    const run = src("lib/vin-scan/run.ts");
    expect((run.match(/if \(item\.id === "csdd"\) ctx\.reportFirstReg\?\.\(""\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

describe("keša un laika robežas", () => {
  it("iepriekšējās rindas saites datums (CSDD rinda no keša datumu nenes)", () => {
    expect(kfzDateFromRowUrl("https://kfzgutachten.at/?vin=WBAFB71080LV66575&date=20.08.2004")).toBe("20.08.2004");
    expect(kfzDateFromRowUrl("https://kfzgutachten.at/?vin=WBAFB71080LV66575&date=20.08.2004&provin=cs_live_x")).toBe("20.08.2004");
    expect(kfzDateFromRowUrl("https://kfzgutachten.at/?vin=WBAFB71080LV66575&date=")).toBe("");
    expect(kfzDateFromRowUrl(undefined)).toBe("");
  });

  it("limits ietver CSDD gaidīšanu + releja Chrome; atrastais glabājas 7 d", () => {
    expect(vinScanSourceTimeoutMs("kfz_at")).toBeGreaterThanOrEqual(15_000 + 47_000);
    expect(vinScanRowTtlMs("kfz_at", "found")).toBe(7 * 24 * 60 * 60 * 1000);
    expect(vinScanRowTtlMs("kfz_at", "browser_only")).toBe(0);
  });

  it("«nav pārbaudīts» (rinda / reCAPTCHA pauze) nav avota kļūda circuit breaker skaitā", () => {
    expect(isVinScanHealthFailure("browser_only", "kfzgutachten.at: nav pārbaudīts (pēc reCAPTCHA atteikuma pauze līdz 21:30) - izmanto pārlūka joslu")).toBe(false);
  });

  it("pasūtījuma ierakstā apskates patur numurzīmi un modeli (Citi avoti imports)", () => {
    const row = buildVinScanIndicator("kfz_at", "WBAFB71080LV66575", {
      status: "found",
      summary: "kfzgutachten.at: 1 atzinums (13.11.2015)",
      inspections: [{ date: "13.11.2015", plate: "W 44154Z", model: "BMW X5", result: "BMW X5 · W 44154Z" }],
    });
    const back = parseVinScanIndicator(JSON.parse(JSON.stringify(row)));
    expect(back?.inspections?.[0]).toMatchObject({ date: "13.11.2015", plate: "W 44154Z", model: "BMW X5" });
  });
});

describe("palaišana un drošība", () => {
  it("pasūtījuma VIN SCAN ņem datumu no pasūtījuma blokiem; automātika pēc apmaksas ielasa sarakstu blokos", () => {
    expect(src("lib/order-vin-scan-run.ts")).toMatch(/orderDraftKfzFirstRegDate\(draft\?\.workspace\?\.sourceBlocks, sessionId\)/);
    expect(src("lib/order-auto-intake.ts")).toMatch(/applyVinScanImportsToBlocks\(blocks, indicators, \{ vin \}\)/);
  });

  it("neko nepērk un reCAPTCHA neapiet: nav «Bestellen», grozu, risinātāju", () => {
    const page = src("relay/provin-listings/lib/vinsource-page.mjs");
    const kfz = page.slice(page.indexOf("async function readKfz"), page.indexOf("export async function readVinSource"));
    expect(kfz).not.toMatch(/orderButton|Bestellen|UpdateBasket|capsolver|2captcha|anticaptcha|grecaptcha/i);
    expect(kfz).toMatch(/#searchButton/);
    const probe = src("lib/vin-scan/probe-kfz-at.ts");
    expect(probe).not.toMatch(/capsolver|purchase|order/i);
  });
});
