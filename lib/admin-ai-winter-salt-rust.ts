/**
 * Deterministiska ziemas sāls / rūsas ekspozīcija ✨ promptam.
 * Aģentam nav jāmin, vai Q7 pēc 10 gadiem Latvijā jāskata arkas —
 * to aprēķina kods. Neizdomā, ka rūsa jau ir.
 */
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";
import {
  CSDD_MILEAGE_COUNTRY_LV,
  csddFormHasContent,
  emptyCsddFields,
  vinRegistryBlockHasContent,
  type CsddFormFields,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";

const MS_DAY = 86_400_000;
const MS_YEAR = 365.25 * MS_DAY;

/** Latvija / Lietuva / Igaunija — ziemas sāls klimats. */
const WINTER_SALT_COUNTRY_RE =
  /latvij|lietuv|igaun|estonia|lithuania|\blatvia\b/i;

const YEARS_IN_REGION_TEXT_RE =
  /(\d{1,2})\s*gad(?:us|i|u)\s+(?:Latvij|Lietuv|Igaun)/i;
const REGION_YEARS_FLIP_RE =
  /(?:Latvij|Lietuv|Igaun)[āaēe].{0,24}(\d{1,2})\s*gad/i;

/**
 * SUV / krosovers / universālis — arkām un sliekšņiem sāls sasniedz ātrāk.
 * Q7, X5, Touareg u.c. kā modeļa kodi, ne tikai vārds „SUV”.
 */
const SUV_CROSSOVER_WAGON_RE =
  /\b(?:Q[3578]|SQ[578]|X[1-7]|GLA|GLB|GLC|GLE|GLS|GLK|ML\s*\d|TOUAREG|TIGUAN|ATLAS|CAYENNE|MACAN|XC(?:40|60|70|90)|DISCOVERY|EVOQUE|DEFENDER|KODIAQ|KAROQ|ATECA|TARRACO|OUTLANDER|PAJERO|LAND\s*CRUISER|PRADO|CR-?V|RAV4|HIGHLANDER|TUCSON|SANTA\s*FE|SORENTO|SPORTAGE|FORESTER|OUTBACK|CX-[579]|QASHQAI|X-?TRAIL|KUGA|EQUINOX|COMPASS|CHEROKEE|WRANGLER|SUV|APVIDUS|KROSOVER|CROSSOVER|UNIVERS[AĀ]L|AVANT|VARIANT|TOURING|ALLROAD|ALLTRACK)\b/i;

export const WINTER_SALT_TYPICAL_SPOTS_LV = [
  "riteņu arkas (arī zem plastmasas oderēm)",
  "sliekšņu apakšējās malas, kur lido akmeņi no riteņiem",
  "bagāžnieka vāka mala ap numura zīmes apgaismojumu",
  "apakšdaļa un sliekšņu iekšpuse",
] as const;

export type WinterSaltRustAnalysis = {
  required: boolean;
  inWinterSaltRegion: boolean;
  yearsInRegion: number | null;
  vehicleAgeYears: number | null;
  isSuvCrossoverWagon: boolean;
  makeModel: string;
  typicalSpots: readonly string[];
};

export function winterSaltRustRequiredInPrompt(prompt: string): boolean {
  return /Ziemas sāls \/ rūsas ekspozīcija[\s\S]{0,1200}Statuss: OBLIGĀTI/i.test(
    prompt ?? "",
  );
}

function dateMs(raw: string | undefined): number {
  if (!raw?.trim()) return Number.NEGATIVE_INFINITY;
  const ms = parseDotOrIsoDateToMs(raw);
  return ms > 0 ? ms : Number.NEGATIVE_INFINITY;
}

function yearsBetween(thenMs: number, nowMs: number): number | null {
  if (!Number.isFinite(thenMs) || thenMs < 0) return null;
  return Math.max(0, Math.floor((nowMs - thenMs) / MS_YEAR));
}

function isWinterSaltCountry(raw: string | undefined): boolean {
  const t = (raw ?? "").trim();
  if (!t) return false;
  if (t === CSDD_MILEAGE_COUNTRY_LV) return true;
  return WINTER_SALT_COUNTRY_RE.test(t);
}

function collectHaystack(input: {
  csdd: CsddFormFields;
  sourceBlocks?: WorkspaceSourceBlocks | null;
  extraHaystack?: string;
}): string {
  const listing = input.sourceBlocks?.listing_analysis;
  return [
    input.csdd.makeModel,
    input.csdd.comments,
    input.csdd.previousRegistrationCountry,
    listing?.listingPasteRaw,
    listing?.listingSalesContext,
    listing?.photoAnalysis,
    listing?.sellerPortrait,
    input.extraHaystack,
  ]
    .filter((s): s is string => Boolean(s?.trim()))
    .join("\n");
}

function parseYearsFromText(hay: string): number | null {
  const a = YEARS_IN_REGION_TEXT_RE.exec(hay);
  const b = REGION_YEARS_FLIP_RE.exec(hay);
  const n = Number(a?.[1] ?? b?.[1] ?? "");
  if (!Number.isFinite(n) || n < 1 || n > 40) return null;
  return n;
}

function parseYearHint(raw: string): number | null {
  const iso = /^(\d{4})/.exec(raw.trim());
  if (iso) {
    const y = Number(iso[1]);
    if (y >= 1985 && y <= 2100) return y;
  }
  const dotted = /(\d{2})\.(\d{2})\.(\d{4})/.exec(raw);
  if (dotted) {
    const y = Number(dotted[3]);
    if (y >= 1985 && y <= 2100) return y;
  }
  return null;
}

function earliestWinterSaltMs(csdd: CsddFormFields): number | null {
  const times: number[] = [];
  for (const row of csdd.ownerRegistrationEvents ?? []) {
    const ms = dateMs(row.date);
    if (ms > 0) times.push(ms);
  }
  for (const row of csdd.technicalInspectionHistory ?? []) {
    const ms = dateMs(row.date);
    if (ms > 0) times.push(ms);
  }
  for (const row of csdd.mileageHistory ?? []) {
    const country = row.country.trim();
    if (country && !isWinterSaltCountry(country)) continue;
    const ms = dateMs(row.date);
    if (ms > 0) times.push(ms);
  }
  const firstReg = dateMs(csdd.firstRegistration);
  const importedFromElsewhere = Boolean(csdd.previousRegistrationCountry.trim()) &&
    !isWinterSaltCountry(csdd.previousRegistrationCountry);
  if (firstReg > 0 && !importedFromElsewhere) times.push(firstReg);
  if (times.length === 0) return null;
  return Math.min(...times);
}

function inWinterSaltRegion(
  csdd: CsddFormFields,
  sourceBlocks: WorkspaceSourceBlocks | null | undefined,
  hay: string,
): boolean {
  if (csddFormHasContent(csdd)) return true;
  if (vinRegistryBlockHasContent(sourceBlocks?.mnt_ee) || vinRegistryBlockHasContent(sourceBlocks?.lkf_ee)) {
    return true;
  }
  return WINTER_SALT_COUNTRY_RE.test(hay);
}

export function analyzeWinterSaltRust(input: {
  csdd?: CsddFormFields | null;
  sourceBlocks?: WorkspaceSourceBlocks | null;
  extraHaystack?: string;
  nowMs?: number;
}): WinterSaltRustAnalysis {
  const csdd = input.csdd ?? emptyCsddFields();
  const nowMs = input.nowMs ?? Date.now();
  const hay = collectHaystack({
    csdd,
    sourceBlocks: input.sourceBlocks,
    extraHaystack: input.extraHaystack,
  });
  const makeModel = csdd.makeModel.trim();
  const isSuvCrossoverWagon = SUV_CROSSOVER_WAGON_RE.test(`${makeModel}\n${hay}`);
  const region = inWinterSaltRegion(csdd, input.sourceBlocks ?? null, hay);

  const firstRegYear = parseYearHint(csdd.firstRegistration);
  const vehicleAgeYears =
    firstRegYear != null
      ? Math.max(0, new Date(nowMs).getUTCFullYear() - firstRegYear)
      : yearsBetween(dateMs(csdd.firstRegistration), nowMs);

  const fromDates = yearsBetween(earliestWinterSaltMs(csdd) ?? Number.NEGATIVE_INFINITY, nowMs);
  const fromText = parseYearsFromText(hay);
  const yearsInRegion =
    fromDates != null && fromText != null ? Math.max(fromDates, fromText) : (fromDates ?? fromText);

  const required =
    region &&
    ((yearsInRegion != null && yearsInRegion >= 3) ||
      (vehicleAgeYears != null && vehicleAgeYears >= 8) ||
      isSuvCrossoverWagon);

  return {
    required,
    inWinterSaltRegion: region,
    yearsInRegion,
    vehicleAgeYears,
    isSuvCrossoverWagon,
    makeModel,
    typicalSpots: WINTER_SALT_TYPICAL_SPOTS_LV,
  };
}

/** Kompakts prompta bloks — tukšs, ja ekspozīcija nav obligāta. */
export function buildWinterSaltRustBrief(input: {
  csdd?: CsddFormFields | null;
  sourceBlocks?: WorkspaceSourceBlocks | null;
  extraHaystack?: string;
  nowMs?: number;
}): string {
  const c = analyzeWinterSaltRust(input);
  if (!c.required) return "";
  const lines: string[] = [
    "### Ziemas sāls / rūsas ekspozīcija (deterministisks — NEIZDOMĀ pretējo)",
    "- Statuss: OBLIGĀTI",
  ];
  if (c.makeModel) lines.push(`- Marka/modelis: ${c.makeModel}`);
  if (c.yearsInRegion != null) lines.push(`- Gadi ziemas sāls reģionā (LV/LT/EE): ~${c.yearsInRegion}`);
  if (c.vehicleAgeYears != null) lines.push(`- Auto vecums: ~${c.vehicleAgeYears} gadi`);
  if (c.isSuvCrossoverWagon) {
    lines.push("- Virsbūves klase: SUV / krosovers / universālis — arkām un sliekšņiem sāls sasniedz ātrāk.");
  }
  lines.push(
    "- OBLIGĀTI „1. Tehnisko risku analīze”: viena rindkopa — tipisks klimata risks no ziemas sāls, NE pierādīts defekts. Cinkota virsbūve (Audi u.c.) to NEATCEĻ. Svaiga vai tīra TA to NEATCEĻ — TA neredz rūsu zem arku oderēm un sliekšņu apakšā.",
    `- OBLIGĀTI „2. Ieteikumi klātienes apskatei”: nosauc vietas vārdā — ${c.typicalSpots.join("; ")}.`,
    "- Anti-atkārtošanās šo tēmu NEATSAUC. Neizdomā, ka rūsa jau ir fiksēta — saki, ka tā jāmeklē šajās vietās.",
  );
  return lines.join("\n");
}
