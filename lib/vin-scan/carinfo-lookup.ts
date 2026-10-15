/**
 * car.info VIN SCAN: primāri /en-se/vin/S/{VIN}, numurs tikai ja VIN lapa auto neatrada.
 * Bez CapSolver un bez proxy. Bloķētu atbildi izsaucējs var aizstāt ar releju.
 */
import { extractPageFromHtml, isCloudflareChallengeHtml, looksLikeCloudflareWafBlock } from "@/lib/vin-sources/html-extract";
import { parseCarinfoExtract } from "@/lib/vin-sources/carinfo-parse";
import {
  carinfoSuperSearchUrl,
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
  const m = /\bis an?\s+(?:[a-z]+\s+)?([A-Z][A-Za-z0-9-]+)\s+([A-Z0-9][A-Za-z0-9-]*)\s+from\s+(\d{4})/i.exec(text);
  if (!m) return undefined;
  return { make: m[1] ?? "", model: m[2] ?? "", year: m[3] ?? "" };
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

function sameCarinfoUrl(a: string, b: string): boolean {
  try {
    const left = new URL(a);
    const right = new URL(b);
    return left.origin === right.origin && left.pathname === right.pathname;
  } catch {
    return a === b;
  }
}

/**
 * VIN lapa vispirms. Super-search tikai ja Zviedrijas VIN lapa ir 404 (citas Nordics).
 * Numura lapa tikai pēc tam, un tikai ja SE numurs ir derīgs.
 */
export async function runCarinfoLookup(
  vin: string,
  plate: string,
  fetchPage: (url: string) => Promise<CarinfoPageResponse>,
): Promise<VinScanParse> {
  const vinUrl = carinfoSwedenVinUrl(vin);
  const vinPage = await fetchPage(vinUrl);
  const vinParsed = carinfoScanFromPage(vinPage.status, vinPage.text);
  if (vinParsed.status === "found" || vinParsed.status === "unknown" || vinParsed.status === "blocked") {
    return { ...vinParsed, openUrl: vinUrl };
  }

  const searchUrl = carinfoSuperSearchUrl("en-se", vin, Date.now());
  const search = await fetchPage(searchUrl);
  if (!carinfoResponseBlocked(search.status, search.text)) {
    const hit = parseCarinfoSearchBody(search.text, vin);
    if (hit?.href && !sameCarinfoUrl(hit.href, vinUrl)) {
      const page = await fetchPage(hit.href);
      const parsed = carinfoScanFromPage(page.status, page.text);
      if (parsed.status === "found" || parsed.status === "unknown" || parsed.status === "blocked") {
        return { ...parsed, openUrl: hit.href };
      }
    }
  }

  if (isValidScanPlate("se", plate)) {
    const plateUrl = carinfoSwedenPlateUrl(plate);
    const page = await fetchPage(plateUrl);
    const parsed = carinfoScanFromPage(page.status, page.text);
    if (parsed.status === "found" || parsed.status === "unknown" || parsed.status === "blocked") {
      return { ...parsed, openUrl: plateUrl };
    }
  }

  return { status: "none", summary: NONE, openUrl: vinUrl };
}
