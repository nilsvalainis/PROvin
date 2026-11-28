/**
 * 28.11 (Nils 3): papildu fakti faktu pārbaudei - kārbas kods / tips, jauda (kW / ZS), nobraukums pie konkrēta
 * datuma, dīlera servisa ierakstu skaits, izsoļu bojājumi pret «bojājumu nav».
 *
 * Tekstu NEMAINA - tikai karodziņi adminam. Konservatīvi: ja avoti paši nesakrīt vai teikums ir hipotētisks /
 * nosacījuma / salīdzinājums ar citu versiju, neatzīmē (27.11 likumi: noliegumi teikuma kontekstā, hipotētiski
 * teikumi un eļļas piebildes nekad nav kļūda).
 */
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { formatForensicsInt } from "@/lib/admin-ai-mileage-forensics";
import { auctionArchiveVehicleRows } from "@/lib/auction-archive-facts";
import { autoRecordsServiceWorkRowIsPrintable } from "@/lib/auto-records-service-works";
import type { CanonicalFacts } from "@/lib/canonical-facts-sheet";
import { extractOdometerReadingKms } from "@/lib/comment-contradiction-check";
import { isFactCheckExemptSentence } from "@/lib/fact-check-context";
import { findGearboxContradictions, resolveCanonicalGearbox } from "@/lib/gearbox-kind-guard";
import { getAutoRecordsOutvinBundle } from "@/lib/outvin-admin-sync";
import { buildThecarapiPdfModel } from "@/lib/thecarapi-pdf-model";
import { splitSentences } from "@/lib/unit-facts/check";
import type { FactCheckFlag } from "@/lib/unit-facts/types";

export type ExtraFactsInput = {
  text: string;
  field?: string;
  facts: CanonicalFacts;
  sourceBlocks?: WorkspaceSourceBlocks | null;
  vin?: string | null;
  /** AI konteksta teksts (kārbas pierādījumiem). */
  contextText?: string | null;
};

/** Salīdzinājums ar citu versiju / diapazons / piemērs - nav apgalvojums par šo auto. */
const VARIANT_OR_RANGE_RE =
  /versij|modifikācij|variant|jaudīgāk|vājāk|alternatīv|piemēr|salīdzin|\bno\s+\d{2,3}\s+līdz\s+\d|\d\s*(?:-|–|līdz)\s*\d{2,3}\s*(?:kw|zs|ps|hp)|\bvai\s+\d{2,3}\s*(?:kw|zs|ps|hp)|vismaz|aptuven|ap\s+\d/iu;
const NEGATION_RE = /(?<!\p{L})(?:nav|nevis|ne|bez)(?!\p{L})/iu;

/* ---------- kārba ---------- */

/** Kārbu kodi (VW/Audi DSG un AT burtu kodi, ZF, Mercedes, BMW, Ford/Volvo Powershift u.c.). */
const GEARBOX_CODE_RE =
  /(?<![A-Z0-9])(?:DQ\d{3}|DL\d{3}|0A[MW]|0C[WTK]|0B[5HK]|0D[9L]|02[EM]|09[GMPK]|AQ\d{3}|ZF\s?\d{1,2}HP\d{2}[A-Z]?|\d{1,2}HP\d{2}[A-Z]?|GA\d[A-Z]{1,2}\d{0,2}[A-Z]?|GS\d-\d{2}[A-Z]{1,4}|NAG\s?\d|722\.\d{1,2}|AWF\d{2}|AW\d{2}-\d{2}[A-Z]*|MPS6|6DCT\d{3}|7DCT\d{3}|DCT\d{3})(?![A-Z0-9])/gi;
const GEARBOX_SENTENCE_RE = /kārb|transmisij|dsg|s[\s-]?tronic|tiptronic|steptronic|gearbox|transmission|getriebe/iu;

function compact(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function extractGearboxCodes(text: string): string[] {
  const out = new Set<string>();
  for (const m of (text ?? "").matchAll(new RegExp(GEARBOX_CODE_RE.source, "gi"))) out.add(compact(m[0]));
  return [...out];
}

function gearboxCodesMatch(a: string, b: string): boolean {
  const x = compact(a).replace(/^ZF/, "");
  const y = compact(b).replace(/^ZF/, "");
  if (!x || !y) return false;
  return x === y || (x.length >= 4 && y.startsWith(x)) || (y.length >= 4 && x.startsWith(y));
}

function loadedGearboxRaws(sourceBlocks: WorkspaceSourceBlocks, vin?: string | null): string[] {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  const ar = blocks.auto_records;
  const raws = [
    ar.outvinReport?.vehicleInfo?.transmission ?? "",
    getAutoRecordsOutvinBundle(ar, vin ?? "").vehicleInfo.transmission ?? "",
  ];
  const records = blocks.cc_vin?.thecarapiRecords;
  if (records && records.length > 0) {
    try {
      const row = auctionArchiveVehicleRows(records).find((r) => r.k === "Ātrumkārba" && !r.missing);
      if (row?.v) raws.push(row.v);
    } catch {
      /* bojāts izsoles ieraksts */
    }
  }
  return raws.map((r) => r.trim()).filter(Boolean);
}

function checkGearbox(input: ExtraFactsInput, sentences: string[], push: (f: FactCheckFlag) => void): void {
  if (!input.sourceBlocks) return;
  const loadedCodes = loadedGearboxRaws(input.sourceBlocks, input.vin).flatMap(extractGearboxCodes);
  if (loadedCodes.length > 0) {
    for (const s of sentences) {
      if (!GEARBOX_SENTENCE_RE.test(s) || isFactCheckExemptSentence(s) || VARIANT_OR_RANGE_RE.test(s)) continue;
      const wrong = extractGearboxCodes(s).filter((c) => !loadedCodes.some((l) => gearboxCodesMatch(c, l)));
      if (wrong.length === 0) continue;
      push({
        id: "powertrain_gearbox_code",
        kind: "powertrain_gearbox",
        level: "W",
        message: `Avotos kārbas kods ir ${[...new Set(loadedCodes)].join(", ")}, teksts nosauc ${wrong.join(", ")}.`,
        sentence: s,
      });
    }
  }
  const gb = resolveCanonicalGearbox({ sourceBlocks: input.sourceBlocks, vin: input.vin, contextText: null });
  if (gb.family === "unknown" || gb.conflict) return;
  for (const hit of findGearboxContradictions(input.text, gb)) {
    if (isFactCheckExemptSentence(hit.sentence) || NEGATION_RE.test(hit.sentence) || VARIANT_OR_RANGE_RE.test(hit.sentence)) continue;
    push({
      id: "powertrain_gearbox_kind",
      kind: "powertrain_gearbox",
      level: "W",
      message: `Avotos kārba ir ${gb.labelLv || gb.family}, teksts saka „${hit.match}”.`,
      sentence: hit.sentence,
    });
  }
}

/* ---------- jauda ---------- */

/** Avota jaudas lauks → kW (CSDD «140», dīleris «140 kW», «190 PS», «190 hp»). */
export function parsePowerKw(raw: string, bareIsKw = true): number | null {
  const t = (raw ?? "").replace(",", ".").trim();
  if (!t) return null;
  const kw = t.match(/(\d{2,3}(?:\.\d)?)\s*kw/i);
  if (kw) return Number(kw[1]);
  const hp = t.match(/(\d{2,4})\s*(?:ps|hp|zs|bhp|cv|ch|л\.?\s*с)/i);
  if (hp) return Math.round(Number(hp[1]) / 1.36);
  if (bareIsKw) {
    const n = t.match(/^(\d{2,3}(?:\.\d)?)$/);
    if (n) return Number(n[1]);
  }
  return null;
}

function loadedPowerKw(sourceBlocks: WorkspaceSourceBlocks, vin?: string | null): number | null {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  const vals = [
    parsePowerKw(blocks.csdd.enginePowerKw, true),
    parsePowerKw(blocks.auto_records.outvinReport?.vehicleInfo?.power ?? "", false),
    parsePowerKw(getAutoRecordsOutvinBundle(blocks.auto_records, vin ?? "").vehicleInfo.power ?? "", false),
  ].filter((n): n is number => n != null && n >= 20 && n <= 900);
  if (vals.length === 0) return null;
  // Avoti paši nesakrīt (piem. cita dzinēja versija dīlerī) - nav ar ko salīdzināt.
  if (Math.max(...vals) - Math.min(...vals) > 3) return null;
  return vals[0]!;
}

const POWER_MENTION_RE = /(?<![\d.,])(\d{2,3})\s*(kW|ZS|PS|HP|zs|ps|hp|zirgspēk\p{L}*)(?!\p{L})/gu;

function checkPower(input: ExtraFactsInput, sentences: string[], push: (f: FactCheckFlag) => void): void {
  if (!input.sourceBlocks) return;
  const kw = loadedPowerKw(input.sourceBlocks, input.vin);
  if (kw == null) return;
  for (const s of sentences) {
    if (isFactCheckExemptSentence(s) || VARIANT_OR_RANGE_RE.test(s)) continue;
    for (const m of s.matchAll(POWER_MENTION_RE)) {
      const n = Number(m[1]);
      const unit = m[2]!.toLowerCase();
      const ok =
        unit === "kw"
          ? Math.abs(n - kw) <= Math.max(2, kw * 0.02)
          : Math.abs(n - kw * 1.36) <= Math.max(4, kw * 0.03) || Math.abs(n - kw * 1.341) <= Math.max(4, kw * 0.03);
      if (ok) continue;
      push({
        id: "power_output",
        kind: "power_output",
        level: "W",
        message: `Avotos jauda ${Math.round(kw)} kW (~${Math.round(kw * 1.36)} ZS), teksts saka ${n} ${m[2]}.`,
        sentence: s,
      });
    }
  }
}

/* ---------- nobraukums pie datuma ---------- */

const DATE_DMY_RE = /(?<![\d.])(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})(?![\d])/g;
/** Teikums par nobraukto attālumu vai periodu, ne par rādījumu. */
const DISTANCE_RE = /nobrauc\p{L}*|nobraukt\p{L}*|pieaug\p{L}*|starpīb\p{L}*|kopš|laikā|vidēj\p{L}*|gadā|intervāl\p{L}*|pēc\s+\d|ik\s+pēc|līdz\s+\d/iu;

function dayKey(d: string, m: string, y: string): string {
  const year = y.length === 2 ? `20${y}` : y;
  return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function rowDayKey(date: string): string | null {
  const t = (date ?? "").trim();
  const dmy = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dmy) return dayKey(dmy[1]!, dmy[2]!, dmy[3]!);
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

function checkKmAtDate(input: ExtraFactsInput, sentences: string[], push: (f: FactCheckFlag) => void): void {
  const readings = input.facts.mileageReadings ?? [];
  if (readings.length === 0) return;
  const byDay = new Map<string, { km: number; source: string }[]>();
  for (const r of readings) {
    const k = rowDayKey(r.date);
    if (!k) continue;
    byDay.set(k, [...(byDay.get(k) ?? []), { km: r.km, source: r.source }]);
  }
  for (const s of sentences) {
    if (isFactCheckExemptSentence(s) || DISTANCE_RE.test(s)) continue;
    const dates = [...s.matchAll(new RegExp(DATE_DMY_RE.source, "g"))].map((m) => dayKey(m[1]!, m[2]!, m[3]!));
    const kms = extractOdometerReadingKms(s);
    // Tikai viennozīmīgi pāri: tikpat datumu, cik km (secībā).
    if (dates.length === 0 || dates.length !== kms.length) continue;
    dates.forEach((day, i) => {
      const rows = byDay.get(day);
      const km = kms[i]!;
      if (!rows || rows.length === 0) return; // datums nav avotos - to atzīmē `unsourced_date`
      if (rows.some((r) => Math.abs(r.km - km) <= Math.max(150, r.km * 0.01))) return;
      const closest = rows.reduce((a, b) => (Math.abs(b.km - km) < Math.abs(a.km - km) ? b : a));
      const [y, m, d] = day.split("-");
      push({
        id: "km_at_date",
        kind: "km_at_date",
        level: Math.abs(closest.km - km) > 2_000 ? "E" : "W",
        message: `${d}.${m}.${y} avotā (${closest.source}) ${formatForensicsInt(closest.km)} km, teksts saka ${formatForensicsInt(km)} km.`,
        sentence: s,
      });
    });
  }
}

/* ---------- servisa ierakstu skaits ---------- */

const COUNT_WORDS: Record<string, number> = {
  viens: 1, viena: 1, divi: 2, divas: 2, trīs: 3, četri: 4, četras: 4, pieci: 5, piecas: 5, seši: 6, sešas: 6,
  septiņi: 7, septiņas: 7, astoņi: 8, astoņas: 8, deviņi: 9, deviņas: 9, desmit: 10,
};
const SERVICE_COUNT_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(\\d{1,3}|${Object.keys(COUNT_WORDS).join("|")})\\s+(?:\\p{L}+\\s+)?(?:servisa|dīlera|apkopes)\\s+(?:ierakst|apmeklējum|vizīt)\\p{L}*`,
  "giu",
);
/** Teikums par periodu / citu avotu / daļu - skaitam nav jāsakrīt ar visu dīlera vēsturi. */
const SERVICE_SCOPE_RE =
  /kopš|pēc\s|pirms\s|līdz\s|pēdēj|pirmaj|no\s+tiem|starp|(?:19|20)\d{2}|autodna|carvertical|carfax|izsol|sludinājum|vismaz|ap\s|aptuven|vairāk\s+nekā|mazāk\s+nekā/iu;

function checkServiceCount(input: ExtraFactsInput, sentences: string[], push: (f: FactCheckFlag) => void): void {
  if (!input.sourceBlocks) return;
  const rows = (mergeSourceBlocksWithDefaults(input.sourceBlocks).auto_records.serviceWorks ?? []).filter(
    autoRecordsServiceWorkRowIsPrintable,
  );
  if (rows.length === 0) return;
  const visits = new Set(rows.map((r) => r.date.trim() || `${r.odometer}|${r.location}`)).size;
  for (const s of sentences) {
    if (isFactCheckExemptSentence(s) || SERVICE_SCOPE_RE.test(s)) continue;
    for (const m of s.matchAll(new RegExp(SERVICE_COUNT_RE.source, "giu"))) {
      const raw = m[1]!.toLocaleLowerCase("lv");
      const n = /^\d+$/.test(raw) ? Number(raw) : COUNT_WORDS[raw];
      if (n == null || n === rows.length || n === visits) continue;
      push({
        id: "service_count",
        kind: "service_count",
        level: "W",
        message: `Teksts saka ${n} servisa ierakstus, dīlera datos ${rows.length}${visits !== rows.length ? ` (${visits} apmeklējumi)` : ""}.`,
        sentence: s,
      });
    }
  }
}

/* ---------- izsoļu bojājumi ---------- */

/** Izsoles (TheCarApi) lielākais bojājumu skaits vienā izsolē. */
export function auctionDamageMax(sourceBlocks: WorkspaceSourceBlocks | null | undefined): number {
  if (!sourceBlocks) return 0;
  const records = mergeSourceBlocksWithDefaults(sourceBlocks).cc_vin?.thecarapiRecords ?? [];
  let max = 0;
  for (const r of records) {
    try {
      max = Math.max(max, buildThecarapiPdfModel(r).damages.length);
    } catch {
      /* bojāts ieraksts */
    }
  }
  return max;
}

/** «bojājumu nav», «bez bojājumiem», «bojājumi nav fiksēti» (ne negadījumi / atlīdzības - tie ir citi fakti). */
const NO_BODY_DAMAGE_RE =
  /(?<!\p{L})nav(?!\p{L})[^.!?\n]{0,40}bojājum\p{L}*|bojājum\p{L}*[^.!?\n]{0,30}(?<!\p{L})nav(?!\p{L})|(?<!\p{L})bez\s+(?:\p{L}+\s+)?bojājum\p{L}*/iu;
/** Īpašība, neziņa, nosacījums, norāde - nav apgalvojums, ka bojājumu nav. */
const DAMAGE_EXEMPT_RE =
  /nav\s+(?:zināms|skaidrs|redzam|pārbaudīt|norādīt\p{L}*\s+(?:summ|apmēr|cēlon))|(?:konstruktīv|strukturāl|kritisk|būtisk|nopietn|smag|lielu?)\p{L}*\s+(?:\S+\s+){0,2}bojājum|bojājum\p{L}*\s+(?:\S+\s+){0,3}nav\s+(?:kritisk|būtisk|nopietn|smag|liel|strukturāl|kosmētisk)|(?<!\p{L})(?:vai|lai|ja)\s|jāpārbauda|pārliecin|ieteicam|summ|€|\beur\b/iu;
/** Teikums nosauc citu avotu (ne izsoli) - izsoles bojājumi uz to neattiecas. */
const OTHER_SOURCE_RE = /\bltab\b|\bocta\b|\bcsdd\b|\bcsng\b|autodna|carvertical|carfax|dīler|reģistr|apdrošin|sludinājum/iu;

function checkAuctionDamage(input: ExtraFactsInput, sentences: string[], push: (f: FactCheckFlag) => void): void {
  // Citi bojājumu ieraksti jau dod `no_damage_claim` (E) - šis tikai izsoļu gadījumam, ko tas nesedz.
  if ((input.facts.damageEvidence?.total ?? 0) > 0) return;
  const max = auctionDamageMax(input.sourceBlocks);
  if (max === 0) return;
  for (const s of sentences) {
    if (!NO_BODY_DAMAGE_RE.test(s) || isFactCheckExemptSentence(s) || DAMAGE_EXEMPT_RE.test(s)) continue;
    const auctionScoped = /izsol/iu.test(s);
    if (!auctionScoped && OTHER_SOURCE_RE.test(s)) continue;
    push({
      id: "auction_damage_denied",
      kind: "auction_damage",
      level: auctionScoped ? "E" : "W",
      message: `Teksts saka, ka bojājumu nav, bet izsolē norādīti ${max} bojājum${max === 1 ? "s" : "i"} (izsoļu sadaļa PDF).`,
      sentence: s,
    });
  }
}

/* ---------- kopā ---------- */

export function checkExtraFacts(input: ExtraFactsInput): FactCheckFlag[] {
  const text = (input.text ?? "").trim();
  if (!text) return [];
  const sentences = splitSentences(text);
  const out: FactCheckFlag[] = [];
  const seen = new Set<string>();
  const push = (f: FactCheckFlag) => {
    const k = `${f.id}|${f.sentence}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(f);
  };
  checkGearbox(input, sentences, push);
  checkPower(input, sentences, push);
  checkKmAtDate(input, sentences, push);
  checkServiceCount(input, sentences, push);
  checkAuctionDamage(input, sentences, push);
  return out;
}
