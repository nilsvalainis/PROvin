/**
 * CheckCar.vin pilnās (atvērtās) atskaites imports no operatora pārlūka.
 *
 * Userscript checkcar.vin lapā savāc lapas tekstu, HTML un foto URL grupas (pēc tuvākā bloka ar
 * datumu / izsoli). Serveris: teksts -> tas pats parseris kā PDF atskaitei (`parseCcVinReportText`);
 * ja tas neko neatrod (lapas struktūra atšķiras no PDF), elastīgs rezerves parseris meklē rindas ar
 * datumu + km / cenu / izsoli. Pilns teksts vienmēr nonāk `rawUnprocessedData` (tikai admin), lai
 * nekas nepazūd, kamēr parseris nav pieskaņots reālajai lapai.
 *
 * Tīrās funkcijas, bez tīkla. Serveris: `app/api/admin/checkcar-import/route.ts`.
 */

import { applyCcVinParsedReport } from "@/lib/cc-vin-report-apply";
import {
  countCcVinParsedRows,
  emptyCcVinParsedReport,
  parseCcVinReportText,
  type CcVinParsedReport,
} from "@/lib/cc-vin-report-parse";
import type { CcVinBlockState } from "@/lib/cc-vin-report";
import {
  checkcarReportDataToText,
  mergeCheckcarParsed,
  parseCheckcarReportData,
} from "@/lib/checkcar-report-data";
import {
  CC_VIN_MAX_PHOTOS,
  makeCcVinPhotoGroupId,
  normalizeCcVinPhotoGroups,
  syncCcVinPhotoGroupsAndFlat,
  type CcVinPhotoGroup,
} from "@/lib/cc-vin-photo-types";

/** Admin galerijas grupas prefikss. Klienta PDF to noņem (`checkcarPdfGroupTitle`). */
export const CHECKCAR_GROUP_PREFIX = "CheckCar.vin";

/** Teksta / HTML griesti (userscript apgriež pats, serveris noraida garāku). */
export const CHECKCAR_IMPORT_TEXT_MAX = 400_000;
export const CHECKCAR_IMPORT_HTML_MAX = 900_000;
export const CHECKCAR_IMPORT_GROUPS_MAX = 60;
export const CHECKCAR_IMPORT_URLS_MAX = 400;

/** `rawUnprocessedData` sadaļas marķieris - atkārtots imports aizstāj tikai savu sadaļu. */
export const CHECKCAR_RAW_MARKER = "=== CheckCar.vin pilnā atskaite";
const RAW_MAX = 200_000;

const VIN_RE = /[A-HJ-NPR-Z0-9]{17}/g;

/** Zināmās izsoles / tirdzniecības vietas (grupas nosaukumam un rezerves parserim). */
const AUCTION_NAMES: readonly [RegExp, string][] = [
  [/\bautobid\b/i, "Autobid"],
  [/\bopenlane\b|\badesa\b/i, "Openlane"],
  [/\bauto1\b/i, "AUTO1"],
  [/\bbca\b/i, "BCA"],
  [/\bcopart\b/i, "Copart"],
  [/\biaai\b|insurance auto auctions/i, "IAAI"],
  [/\bmanheim\b/i, "Manheim"],
  [/\bcaronsale\b/i, "CarOnSale"],
  [/\becarstrade\b/i, "eCarsTrade"],
  [/\btroostwijk\b/i, "Troostwijk"],
  [/\bmobile\.de\b/i, "mobile.de"],
  [/\bautoscout24\b/i, "AutoScout24"],
  [/\bautorola\b/i, "Autorola"],
  [/\bvwfs\b/i, "VWFS"],
];

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

export type CheckcarImportGroupInput = { label: string; urls: string[] };

export type CheckcarImportInput = {
  vin: string;
  text: string;
  html?: string;
  pageUrl?: string;
  groups?: CheckcarImportGroupInput[];
  /** Lapas datu stāvoklis (`__NUXT__` report.data) - visi ieraksti, arī nerenderētie (28.11). */
  data?: unknown;
};

export type CheckcarPhotoGroupPlan = { title: string; urls: string[] };

export type CheckcarParsedImport = {
  parsed: CcVinParsedReport;
  /** Rindas no elastīgā parsera (0, ja galvenais parseris atrada datus). */
  fallbackRows: number;
  groups: CheckcarPhotoGroupPlan[];
  rawText: string;
};

/* ----------------------------------------------------------------- teksts */

/** Redzamais teksts no HTML (ja userscript nevarēja nolasīt innerText). */
export function checkcarHtmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|td|th|h\d|section|article|dt|dd)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

/** Vai lapā redzams cits VIN, nevis prasītais (aizsargs pret nepareizu pasūtījumu). */
export function checkcarPageVinMismatch(text: string, pageUrl: string, vin: string): boolean {
  const want = vin.trim().toUpperCase();
  const inText = new Set([...text.toUpperCase().matchAll(VIN_RE)].map((m) => m[0]));
  const inUrl = new Set([...pageUrl.toUpperCase().matchAll(VIN_RE)].map((m) => m[0]));
  if (inText.size > 0 && !inText.has(want)) return true;
  if (inText.size === 0 && inUrl.size > 0 && !inUrl.has(want)) return true;
  return inText.size === 0 && inUrl.size === 0;
}

/* --------------------------------------------------------- datumi, izsoles */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function validDate(d: number, m: number, y: number): boolean {
  return y >= 1980 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

/** Pirmais datums tekstā -> `dd.mm.gggg` (dd/mm/gggg, dd.mm.gggg, gggg-mm-dd, „12 Mar 2024”). */
export function firstDateLv(raw: string): string {
  const text = raw || "";
  const candidates: { at: number; value: string }[] = [];
  for (const m of text.matchAll(/\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/g)) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    if (validDate(d, mo, y)) candidates.push({ at: m.index ?? 0, value: `${pad2(d)}.${pad2(mo)}.${y}` });
  }
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (validDate(d, mo, y)) candidates.push({ at: m.index ?? 0, value: `${pad2(d)}.${pad2(mo)}.${y}` });
  }
  for (const m of text.matchAll(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/g)) {
    const mo = MONTHS[(m[2] ?? "").slice(0, 4).toLowerCase()] ?? MONTHS[(m[2] ?? "").slice(0, 3).toLowerCase()];
    const d = Number(m[1]);
    const y = Number(m[3]);
    if (mo && validDate(d, mo, y)) candidates.push({ at: m.index ?? 0, value: `${pad2(d)}.${pad2(mo)}.${y}` });
  }
  for (const m of text.matchAll(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/g)) {
    const mo = MONTHS[(m[1] ?? "").slice(0, 4).toLowerCase()] ?? MONTHS[(m[1] ?? "").slice(0, 3).toLowerCase()];
    const d = Number(m[2]);
    const y = Number(m[3]);
    if (mo && validDate(d, mo, y)) candidates.push({ at: m.index ?? 0, value: `${pad2(d)}.${pad2(mo)}.${y}` });
  }
  candidates.sort((a, b) => a.at - b.at);
  return candidates[0]?.value ?? "";
}

/** Izsoles / tirdzniecības vietas nosaukums tekstā, ja zināms. */
export function auctionNameIn(raw: string): string {
  for (const [re, name] of AUCTION_NAMES) {
    if (re.test(raw || "")) return name;
  }
  return "";
}

/** Galerijas grupas nosaukums: „CheckCar.vin · Autobid · 12.03.2024”. */
export function checkcarPhotoGroupTitle(label: string, fallbackDate = ""): string {
  const auction = auctionNameIn(label);
  const date = firstDateLv(label) || fallbackDate;
  return [CHECKCAR_GROUP_PREFIX, auction, date].filter(Boolean).join(" · ").slice(0, 120);
}

/** Klienta PDF: bez avota nosaukuma („Autobid · 12.03.2024”). */
export function checkcarPdfGroupTitle(title: string): string {
  return title.replace(/^\s*CheckCar\.vin\s*(?:·\s*)?/i, "").trim();
}

/* ------------------------------------------------------- rezerves parseris */

const KM_RE = /(\d{1,3}(?:[ ., ]\d{3})+|\d{3,7})\s*km\b/i;
const MI_RE = /(\d{1,3}(?:[ ., ]\d{3})+|\d{3,7})\s*(?:mi|miles)\b/i;
const PRICE_RE =
  /(?:€|EUR|USD|\$|GBP|£)\s*(\d{1,3}(?:[ ., ]\d{3})+|\d{3,7})(?:[.,]\d{2})?|(\d{1,3}(?:[ ., ]\d{3})+|\d{3,7})(?:[.,]\d{2})?\s*(€|EUR|USD|GBP)/i;

function digits(raw: string): string {
  return raw.replace(/[^\d]/g, "");
}

function kmDisplay(raw: string): string {
  const d = digits(raw);
  return d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "";
}

function kmFrom(window: string): string {
  const km = window.match(KM_RE);
  if (km) return kmDisplay(km[1]!);
  const mi = window.match(MI_RE);
  if (mi) {
    const n = Number(digits(mi[1]!));
    if (Number.isFinite(n) && n > 0) return kmDisplay(String(Math.round(n * 1.609344)));
  }
  return "";
}

function priceFrom(window: string): string {
  const m = window.match(PRICE_RE);
  if (!m) return "";
  const amount = digits(m[1] ?? m[2] ?? "");
  if (!amount) return "";
  const cur = /€|EUR/i.test(m[0]) ? "EUR" : /GBP|£/i.test(m[0]) ? "GBP" : "USD";
  return `${amount.replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ${cur}`;
}

/**
 * Lapas struktūra nav zināma: katrai rindai ar datumu skatāmies logu (rinda + 3 nākamās) un
 * ņemam km, cenu, izsoli. km -> nobraukums; izsole vai cena -> pārdošanas rinda.
 */
export function parseCheckcarFallback(text: string): CcVinParsedReport {
  const out = emptyCcVinParsedReport();
  const lines = text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const mileageSeen = new Set<string>();
  const salesSeen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const date = firstDateLv(lines[i]!);
    if (!date) continue;
    const window = lines.slice(i, i + 4).join(" | ");
    const nextDateAt = lines.slice(i + 1, i + 4).findIndex((l) => firstDateLv(l));
    const scoped = nextDateAt >= 0 ? lines.slice(i, i + 1 + nextDateAt).join(" | ") : window;
    const km = kmFrom(scoped);
    const price = priceFrom(scoped);
    const venue = auctionNameIn(scoped);
    if (km) {
      const key = `${date}|${digits(km)}`;
      if (!mileageSeen.has(key)) {
        mileageSeen.add(key);
        out.mileage.push({ date, odometer: digits(km), country: "" });
      }
    }
    if (venue || price) {
      const key = `${date}|${venue}|${digits(km)}`;
      if (!salesSeen.has(key)) {
        salesSeen.add(key);
        out.sales.push({
          date,
          venue,
          odometer: km,
          price,
          status: /not\s+sold|nepārdots|unsold/i.test(scoped) ? "Nav pārdots" : /\bsold\b|pārdots/i.test(scoped) ? "Pārdots" : "",
        });
      }
    }
  }
  if (out.mileage.length || out.sales.length) {
    out.notes.push("Atskaites lapa nolasīta ar elastīgo parseri - pārbaudi rindas pret avotu.");
  }
  return out;
}

/* ---------------------------------------------------------------- imports */

function cleanUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of raw) {
    if (typeof u !== "string") continue;
    const url = u.trim().split("#")[0] ?? "";
    if (!/^https:\/\//i.test(url) || url.length > 2000 || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= CHECKCAR_IMPORT_URLS_MAX) break;
  }
  return out;
}

/** Ievades grupas (label + urls) no JSON; bez URL grupas izmet. */
export function normalizeCheckcarGroups(raw: unknown): CheckcarImportGroupInput[] {
  if (!Array.isArray(raw)) return [];
  const out: CheckcarImportGroupInput[] = [];
  let total = 0;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as { label?: unknown; urls?: unknown };
    const label = typeof o.label === "string" ? o.label.replace(/\s+/g, " ").trim().slice(0, 600) : "";
    const urls = cleanUrls(o.urls).slice(0, Math.max(0, CHECKCAR_IMPORT_URLS_MAX - total));
    if (!urls.length) continue;
    total += urls.length;
    out.push({ label, urls });
    if (out.length >= CHECKCAR_IMPORT_GROUPS_MAX || total >= CHECKCAR_IMPORT_URLS_MAX) break;
  }
  return out;
}

/** Grupas ar vienādu nosaukumu apvieno (viena izsole var būt sadalīta vairākos DOM blokos). */
export function planCheckcarPhotoGroups(
  groups: readonly CheckcarImportGroupInput[],
  fallbackDate = "",
): CheckcarPhotoGroupPlan[] {
  const byTitle = new Map<string, string[]>();
  const seen = new Set<string>();
  for (const g of groups) {
    const title = checkcarPhotoGroupTitle(g.label, fallbackDate);
    const list = byTitle.get(title) ?? [];
    for (const url of g.urls) {
      if (seen.has(url)) continue;
      seen.add(url);
      list.push(url);
    }
    if (list.length) byTitle.set(title, list);
  }
  return [...byTitle.entries()].map(([title, urls]) => ({ title, urls }));
}

export function parseCheckcarImport(input: CheckcarImportInput): CheckcarParsedImport {
  const text = (input.text || "").trim() ? input.text : checkcarHtmlToText(input.html || "");
  const data = input.data == null ? null : parseCheckcarReportData(input.data);
  const main = mergeCheckcarParsed(parseCcVinReportText(text), data, text);
  let parsed = main;
  let fallbackRows = 0;
  if (main.sales.length === 0 && main.mileage.length === 0) {
    const fb = parseCheckcarFallback(text);
    fallbackRows = countCcVinParsedRows(fb);
    if (fallbackRows > 0) {
      parsed = {
        ...main,
        mileage: fb.mileage,
        sales: fb.sales,
        notes: [...main.notes, ...fb.notes],
      };
    }
  }
  const groups = planCheckcarPhotoGroups(normalizeCheckcarGroups(input.groups), parsed.reportDate);
  const dataText = checkcarReportDataToText(data);
  const rawText = [text.trim(), dataText].filter(Boolean).join("\n\n").slice(0, CHECKCAR_IMPORT_TEXT_MAX);
  return { parsed, fallbackRows, groups, rawText };
}

/** `rawUnprocessedData`: CheckCar sadaļa augšā, iepriekšējā CheckCar sadaļa aizstāta, pārējais paliek. */
export function mergeCheckcarRaw(prevRaw: string, rawText: string, today: string): string {
  const prev = prevRaw || "";
  const start = prev.indexOf(CHECKCAR_RAW_MARKER);
  let rest = prev;
  if (start >= 0) {
    const end = prev.indexOf("=== /CheckCar.vin", start);
    const endLine = end >= 0 ? prev.indexOf("\n", end) : -1;
    rest = (prev.slice(0, start) + (end >= 0 ? prev.slice(endLine >= 0 ? endLine + 1 : prev.length) : "")).trim();
  }
  const header = `${CHECKCAR_RAW_MARKER} (${today}) ===`;
  const footer = "=== /CheckCar.vin ===";
  const room = Math.max(0, RAW_MAX - header.length - footer.length - rest.length - 8);
  const section = `${header}\n${rawText.trim().slice(0, room)}\n${footer}`;
  return [section, rest].filter(Boolean).join("\n\n").slice(0, RAW_MAX);
}

/** Ieliek parsētos datus un RAW tekstu `cc_vin` blokā (operatora rindas paliek). */
export function applyCheckcarImportToBlock(
  prev: CcVinBlockState,
  imported: CheckcarParsedImport,
  today: string,
): CcVinBlockState {
  const merged = applyCcVinParsedReport(imported.parsed, prev);
  return {
    ...merged,
    rawUnprocessedData: mergeCheckcarRaw(prev.rawUnprocessedData, imported.rawText, today),
  };
}

export type CheckcarAttachPhoto = { title: string; id: string; sourceUrl: string };

/** Avota URL, kas jau ir galerijā (atkārtots imports tos nelejupielādē). */
export function knownCcVinSourceUrls(block: CcVinBlockState): string[] {
  const groups = normalizeCcVinPhotoGroups(block.photoGroups, block.photos);
  return groups.flatMap((g) => g.photos.map((p) => p.sourceUrl).filter((u): u is string => Boolean(u)));
}

/**
 * Augšupielādētos foto pievieno grupām pēc nosaukuma (jaunas grupas beigās).
 * Dublikātus pēc avota URL izlaiž; kopējais griesti `CC_VIN_MAX_PHOTOS`.
 */
export function attachCheckcarPhotos(
  block: CcVinBlockState,
  photos: readonly CheckcarAttachPhoto[],
): { block: CcVinBlockState; added: number } {
  const groups: CcVinPhotoGroup[] = normalizeCcVinPhotoGroups(block.photoGroups, block.photos).map((g) => ({
    ...g,
    photos: [...g.photos],
  }));
  const known = new Set(groups.flatMap((g) => g.photos.map((p) => p.sourceUrl).filter(Boolean)));
  const ids = new Set(groups.flatMap((g) => g.photos.map((p) => p.id)));
  let total = ids.size;
  let added = 0;
  for (const ph of photos) {
    if (total >= CC_VIN_MAX_PHOTOS) break;
    if (ids.has(ph.id) || (ph.sourceUrl && known.has(ph.sourceUrl))) continue;
    const title = ph.title.trim().slice(0, 120) || CHECKCAR_GROUP_PREFIX;
    let group = groups.find((g) => g.title === title);
    if (!group) {
      group = { id: makeCcVinPhotoGroupId(), title, photos: [] };
      groups.push(group);
    }
    group.photos.push({ id: ph.id, ...(ph.sourceUrl.startsWith("https://") ? { sourceUrl: ph.sourceUrl } : {}) });
    ids.add(ph.id);
    if (ph.sourceUrl) known.add(ph.sourceUrl);
    total += 1;
    added += 1;
  }
  if (added === 0) return { block, added };
  return { block: { ...block, ...syncCcVinPhotoGroupsAndFlat(groups) }, added };
}
