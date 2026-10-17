/**
 * car.info VIN SCAN: vispirms /sv-se/vin/S/{VIN} (tiešs JSON/HTML no servera),
 * tad /en-se. Super-search iet pa CARINFO_SEARCH_LOCALES (SE, DK, NO, FI).
 * Numurs tikai ja VIN lapas un super-search auto neatrada.
 * Bez CapSolver un bez proxy. Relejs ir rezerve, ja visas tiešās lapas ir bloķētas.
 */
import { extractPageFromHtml, isCloudflareChallengeHtml, looksLikeCloudflareWafBlock } from "@/lib/vin-sources/html-extract";
import { parseCarinfoExtract } from "@/lib/vin-sources/carinfo-parse";
import {
  CARINFO_SEARCH_LOCALES,
  carinfoSuperSearchUrl,
  carinfoSvVinUrl,
  carinfoSwedenPlateUrl,
  carinfoSwedenVinUrl,
  parseCarinfoSearchBody,
} from "@/lib/vin-sources/carinfo-search";
import { isValidScanPlate } from "@/lib/vin-scan/plates";
import type { VinScanParse, VinScanVehicle } from "@/lib/vin-scan/types";

export type CarinfoPageResponse = { status: number; text: string };

const NONE = "car.info šo VIN neatrada";
const BLOCKED = "car.info bloķē serveri - atver pārlūkā";

export function carinfoResponseBlocked(status: number, text: string): boolean {
  if (status === 0 || status === 403 || status === 429 || status === 503) return true;
  return isCloudflareChallengeHtml(text, status) || looksLikeCloudflareWafBlock(text, status);
}

function kmLv(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function vehicleFromCarinfoText(text: string): VinScanVehicle | undefined {
  const prose =
    /\b(?:is an?|är en)\s+(?:[a-zåäö]+\s+)?([A-Z][A-Za-z0-9-]+)\s+([A-Z0-9][A-Za-z0-9-]*)\s+(?:from|från)\s+(\d{4})/i.exec(
      text,
    );
  if (prose) return { make: prose[1] ?? "", model: prose[2] ?? "", year: prose[3] ?? "" };
  const titled =
    /\b([A-Z][A-Za-z0-9-]{2,})\s+([A-Z0-9][A-Za-z0-9-]*)\b[^\n]{0,48}?\b((?:19|20)\d{2})\b/.exec(text);
  if (!titled) return undefined;
  return { make: titled[1] ?? "", model: titled[2] ?? "", year: titled[3] ?? "" };
}

function summaryFromParsed(text: string, parsed: ReturnType<typeof parseCarinfoExtract>): string {
  const vehicle = vehicleFromCarinfoText(text);
  const name = [vehicle?.make, vehicle?.model].filter(Boolean).join(" ");
  const dated = parsed.mileage.filter((row) => row.date).sort((a, b) => b.date.localeCompare(a.date));
  const km = dated[0]?.odometer || parsed.mileage[0]?.odometer || "";
  const owners = parsed.ownersSummary.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  const bits = [name, vehicle?.year, km ? `${kmLv(km)} km` : "", owners].filter(Boolean);
  return bits.join(", ") || "Ir car.info";
}

function htmlToBlockText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h1|h2|h3|td|th|dt|dd|table)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;|&#x0*a0;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function carinfoScanFromPage(status: number, html: string): VinScanParse {
  if (carinfoResponseBlocked(status, html)) {
    return { status: "blocked", summary: BLOCKED };
  }
  if (status === 404) return { status: "none", summary: NONE };
  if (status >= 400) return { status: "unknown", summary: `car.info HTTP ${status}` };
  const extracted = extractPageFromHtml(html);
  const text = htmlToBlockText(html);
  if (/vin.{0,20}(not found|no result)|page not found/i.test(text)) {
    return { status: "none", summary: NONE };
  }
  const parsed = parseCarinfoExtract({ text, tables: extracted.tables, pairs: extracted.pairs });
  if (!parsed.found) return { status: "none", summary: "car.info lapā nav publisku datu par šo VIN" };
  const mileage = parsed.mileage.filter((row, index, all) => {
    const key = `${row.date}|${row.odometer}`;
    return all.findIndex((other) => `${other.date}|${other.odometer}` === key) === index;
  });
  const detail = [parsed.ownersSummary, parsed.statusRecords, ...parsed.notes].filter(Boolean).join("\n");
  const sweden = /transportstyrelsen|sverige|sweden/i.test(text);
  return {
    status: "found",
    summary: summaryFromParsed(text, { ...parsed, mileage }),
    detail,
    vehicle: vehicleFromCarinfoText(text),
    mileage: mileage.map((row) => ({ date: row.date, odometer: row.odometer })),
    flags: sweden ? { registrationCountry: "SE" } : undefined,
  };
}

/**
 * sv-se VIN lapa vispirms (no servera bieži 200, kamēr en-se ir nginx 403), tad en-se.
 * Super-search JSON ir nākamais, ja VIN lapa auto neatrada vai bija bloķēta.
 * Lokāles ir tās pašas, ko car.info HTTP avots: SE, DK, NO, FI. Pirmais trāpījums apstājas.
 * Numura lapa tikai pēc tīras iztrūkuma atbildes, un tikai ja SE numurs ir derīgs.
 * Bloķēts tiek atgriezts tikai tad, ja neviena lapa auto neatrada un neviena nebija tīrs "nav".
 */
export async function runCarinfoLookup(
  vin: string,
  plate: string,
  fetchPage: (url: string) => Promise<CarinfoPageResponse>,
): Promise<VinScanParse> {
  const svUrl = carinfoSvVinUrl(vin);
  const enUrl = carinfoSwedenVinUrl(vin);
  const seen = new Set<string>();
  let sawBlocked = false;
  let sawMiss = false;

  async function read(url: string): Promise<VinScanParse | null> {
    if (seen.has(url)) return null;
    seen.add(url);
    const page = await fetchPage(url);
    const parsed = carinfoScanFromPage(page.status, page.text);
    if (parsed.status === "blocked") {
      sawBlocked = true;
      return null;
    }
    if (parsed.status === "found") return { ...parsed, openUrl: url };
    if (parsed.status === "unknown" && page.status === 200) return { ...parsed, openUrl: url };
    if (parsed.status === "none" || page.status === 404) sawMiss = true;
    return null;
  }

  for (const url of [svUrl, enUrl]) {
    const parsed = await read(url);
    if (parsed) return parsed;
  }

  const searchTime = Date.now();
  for (const locale of CARINFO_SEARCH_LOCALES) {
    const searchUrl = carinfoSuperSearchUrl(locale, vin, searchTime);
    const search = await fetchPage(searchUrl);
    if (carinfoResponseBlocked(search.status, search.text)) {
      sawBlocked = true;
      continue;
    }
    const hit = parseCarinfoSearchBody(search.text, vin);
    if (!hit?.href) continue;
    const parsed = await read(hit.href);
    if (parsed) return parsed;
  }

  if (isValidScanPlate("se", plate) && sawMiss) {
    const plateUrl = carinfoSwedenPlateUrl(plate);
    const parsed = await read(plateUrl);
    if (parsed) return parsed;
  }

  if (sawBlocked && !sawMiss) return { status: "blocked", summary: BLOCKED, openUrl: svUrl };
  return { status: "none", summary: NONE, openUrl: sawMiss ? enUrl : svUrl };
}
