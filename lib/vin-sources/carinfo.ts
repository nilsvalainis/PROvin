import "server-only";

/**
 * car.info - starptautisks agregators (Zviedrija un citi Nordics), pasūtījuma avota bloks.
 * Iet pa to pašu ceļu kā VIN SCAN: /en-se/vin/S/{VIN}, /sv-se, super-search (SE, DK, NO, FI),
 * tiešs fetch un, ja serveris ir bloķēts, Hetzner relejs. Bez CapSolver un bez konta.
 * Līdz 24.11.2026 šis bloks gāja tikai tieši no Vercel: nginx 403 tika nolasīts kā "VIN nav atrasts".
 */
import {
  createVinSourceContext,
  extractPageData,
  isVinSourcesBrowserAllowed,
  sleep,
} from "@/lib/vin-sources/browser";
import { fetchCarinfoPage, type CarinfoFetchTrace } from "@/lib/vin-scan/carinfo-fetch";
import { carinfoHtmlToBlockText, runCarinfoLookupWithPage } from "@/lib/vin-scan/carinfo-lookup";
import { parseCarinfoExtract, type CarinfoParsed } from "@/lib/vin-sources/carinfo-parse";
import { carinfoSwedenVinUrl } from "@/lib/vin-sources/carinfo-search";
import { extractPageFromHtml } from "@/lib/vin-sources/html-extract";
import { emptyVinSourceResult, type VinSourceFetchResult } from "@/lib/vin-sources/types";

const NOT_FOUND = "car.info šo VIN neatrada (Zviedrija, Dānija, Norvēģija, Somija)";

function resultFromParsed(vin: string, url: string, parsed: CarinfoParsed, raw: string): VinSourceFetchResult {
  const counts = `${parsed.mileage.length} nobraukuma ieraksti, ${parsed.timeline?.length ?? 0} notikumi`;
  return {
    source: "carinfo",
    vin,
    found: true,
    message: `Nolasīts no ${url} (${counts}${parsed.coverage ? `; ${parsed.coverage}` : ""})`,
    mileage: parsed.mileage,
    incidents: parsed.incidents,
    timeline: parsed.timeline ?? [],
    ownersSummary: parsed.ownersSummary,
    statusRecords: parsed.statusRecords,
    notes: parsed.notes,
    raw: raw.slice(0, 20_000),
    fetchedAt: new Date().toISOString(),
  };
}

/** Lapas HTML (no servera vai releja) pārvērsts avota bloka rezultātā. `null`, ja lapā nav publisku datu. */
export function carinfoResultFromHtml(vin: string, url: string, html: string): VinSourceFetchResult | null {
  const extracted = extractPageFromHtml(html);
  const text = carinfoHtmlToBlockText(html);
  const parsed = parseCarinfoExtract({ text, tables: extracted.tables, pairs: extracted.pairs });
  if (!parsed.found) return null;
  return resultFromParsed(vin, url, parsed, text);
}

/** Tikai lokālai izstrādei ar Playwright (Vercel pārlūka nav): pēdējā rezerve, ja serveris un relejs ir bloķēti. */
async function fetchCarInfoBrowser(vin: string): Promise<VinSourceFetchResult | null> {
  const { context, page } = await createVinSourceContext("carinfo");
  try {
    const url = carinfoSwedenVinUrl(vin);
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
    await sleep(2500);
    if (!res || res.status() >= 400) return null;
    const loaded = await extractPageData(page);
    const parsed = parseCarinfoExtract(loaded);
    return parsed.found ? resultFromParsed(vin, url, parsed, loaded.text) : null;
  } finally {
    await context.close().catch(() => undefined);
  }
}

export async function fetchCarInfo(vin: string): Promise<VinSourceFetchResult> {
  const trace: CarinfoFetchTrace = { relayReason: "" };
  const { parsed, page } = await runCarinfoLookupWithPage(vin, "", (url) => fetchCarinfoPage(url, trace));
  if (page) {
    const hit = carinfoResultFromHtml(vin, page.url, page.html);
    if (hit) return hit;
  }
  if (parsed.status !== "blocked") return emptyVinSourceResult("carinfo", vin, NOT_FOUND);
  if (isVinSourcesBrowserAllowed()) {
    const viaBrowser = await fetchCarInfoBrowser(vin).catch(() => null);
    if (viaBrowser) return viaBrowser;
  }
  return emptyVinSourceResult(
    "carinfo",
    vin,
    `car.info bloķē servera pieprasījumus${trace.relayReason ? ` (${trace.relayReason})` : ""} - atver ${carinfoSwedenVinUrl(vin)} pārlūkā`,
  );
}
