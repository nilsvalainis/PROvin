/**
 * Eļļas maiņas intervāli no oficiālā dīlera servisa rindu tabulas.
 * Tikai dzinēja eļļa; kārbas / Haldex / tilta eļļa netiek skaitīta kā šīs sērijas punkts.
 *
 * 1. Starp divām fiksētām dzinēja eļļas maiņām rēķinām Δ km un Δ mēnešus atsevišķi.
 * 2. Solis starp divām fiksētām maiņām, kas pārsniedz OEM, ir „virs intervāla”
 *    (neitrāls pelēks), ne datu iztrūkums. Datu iztrūkums tikai tad, ja starp
 *    ierakstiem acīmredzami iztrūkst vismaz viena maiņa: Δ km vai Δ mēneši > 2×
 *    OEM (bez OEM: 2× 30 000 km / 24 mēn.), vai bez OEM statistisks izlecējs
 *    pret pārējiem dīlera soļiem (≥ 1,8 × mediāna un > 20 000 km).
 * 3. Vidējais rāda visus soļus, kas nav datu iztrūkums, arī „virs intervāla”.
 * 4. Zaļš: dīlera solis iekļaujas OEM. Neitrāls pelēks: dīlera datos solis ir
 *    garāks par OEM km VAI mēnešiem. Tas nav apgalvojums, ka eļļa nav mainīta.
 * 5. Pelēks svītrojums: datu iztrūkums. Bez OEM nav zaļa/sarkana.
 */

import {
  autoRecordsServiceWorkRowIsPrintable,
  formatServiceWorkOdometer,
  mergeAutoRecordsServiceWorksByOdometer,
  normalizeAutoRecordsServiceWorkRow,
  type AutoRecordsServiceWorkRow,
} from "@/lib/auto-records-service-works";
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";
import {
  formatOemOilCaption,
  oilIntervalKmTolerance,
  oilRatioTone,
  type OemOilInterval,
} from "@/lib/oem-oil-interval";

/** Drukas tintes toņi: tumšs smaragds / oksasinis, ne UI „kļūdas” sarkans. */
export const PDF_OIL_OK_HEX = "#0E4F42";
/** OEM-garāks solis: neitrāls šīfera tonis, ne sarkans/burgundy. */
export const PDF_OIL_OVER_HEX = "#7A828C";
export const PDF_OIL_OVER_TEXT_HEX = "#475569";
export const PDF_OIL_OK_WASH_HEX = "#E8EEEC";
export const PDF_OIL_NEUTRAL_HEX = "#7A828C";
export const PDF_OIL_HATCH_CSS =
  "repeating-linear-gradient(-55deg,#F3F4F6 0 3px,#C5CBD3 3px 4px)";

export const OIL_CLAIM_CAUTION_TITLE = "Svarīgi par apkopes datiem";

/** Teksta teikumi atsevišķi - katrs ir tulkojuma atslēga (`client-report-i18n.ts`). */
export const OIL_CLAIM_CAUTION_TEXT = {
  sources:
    "Apkopes ierakstus sniedz autorizētie dīleri un lieli servisu tīkli. Neatkarīgie servisi šos datus nesūta.",
  missingLabel: "Trūkstošs ieraksts.",
  missing:
    "Ja starp ierakstiem ir ilgāks laiks vai nobraukums, nekā paredz ražotājs, tas nepierāda, ka apkope nav veikta - tikai to, ka šajā datubāzē par to nav datu.",
  generalLabel: "Vispārīgi ieraksti.",
  general:
    "Ierakstus „apkope” vai „serviss” bez eļļas nosaukuma neskaitām kā eļļas maiņu, ja ražotāja plāns to neietver vai nav zināms.",
  generalPlannedMercedes:
    "Plānotās apkopes, kas vienmēr ietver eļļas maiņu (piem. Mercedes-Benz „Apkope A” / „Apkope B”), skaitām.",
  generalPlanned: "Plānotās apkopes, kas vienmēr ietver eļļas maiņu, skaitām.",
  recommendationLabel: "Ieteikums.",
  recommendation:
    "Salīdziniet ar servisa grāmatiņu un čekiem, un pirms pirkuma veiciet diagnostiku neatkarīgā servisā.",
} as const;

export type OilClaimCautionOpts = {
  /** Dīlera datu / Business PDF: bez ieteikumiem (Nils 22.11 - ieteikumi ir tikai AUDITS). */
  omitRecommendation?: boolean;
  /** Marka/modelis: Mercedes-Benz piemēru („Apkope A/B”) rāda tikai Mercedes auto. */
  makeModel?: string;
};

const MERCEDES_MAKE_RE = /mercedes|\bbenz\b|\bmb\b/i;

export function oilClaimCautionHtml(opts: OilClaimCautionOpts = {}): string {
  const T = OIL_CLAIM_CAUTION_TEXT;
  const p = (html: string) => `<p>${html}</p>`;
  const b = (label: string, body: string) =>
    p(`<b>${escapeHtml(label)}</b> ${escapeHtml(body)}`);
  const mercedes = MERCEDES_MAKE_RE.test(opts.makeModel ?? "");
  const general = `${T.general} ${mercedes ? T.generalPlannedMercedes : T.generalPlanned}`;
  const recommendation = opts.omitRecommendation ? "" : b(T.recommendationLabel, T.recommendation);
  return `<aside class="pdf-oil-int__caution">
    <p class="pdf-oil-int__caution-title">${escapeHtml(OIL_CLAIM_CAUTION_TITLE)}</p>
    ${p(escapeHtml(T.sources))}
    ${b(T.missingLabel, T.missing)}
    ${b(T.generalLabel, general)}
    ${recommendation}
  </aside>`;
}

/** Joslas skala PDF (tā pati kā konceptā). */
export const OIL_BAR_SCALE_KM = 30_000;

/** Dzinēja eļļas viskozitāte (0W-20, 5W30, 10W-40). 75W-90 u.c. ir kārba / tilts. */
const ENGINE_VISCOSITY_RE = /\b(?:0|5|10|15|20)w(?:16|20|30|40|50|60)\b/;

/**
 * Kārba / Haldex / tilts / ATF, ko izņem pirms dzinēja signāla meklēšanas.
 * Pēc fold: bez garumzīmēm, ö->o, „oel”->„ol”.
 */
const NON_ENGINE_OIL_CHUNK_RE =
  /(?:automatiskas?|parnesum(?:u|karbas?)?|karbas?|dsg|dct|cvt|haldex|aizmugurej\w*\s+tilt\w*|diferencial\w*|transfer(?:\s+case)?|getriebe|transmission|axle|atf|dexron|mercon|hidraulisk\w*|stures|power\s+steering)(?::?\s+(?:ellas?|oil|ol)(?:\s+(?:and|un|und)\s+filt\w*)?)*(?:\s+(?:maina|change|wechsel|filtr\w*))?|getriebeol\w*|haldexol\w*|achsol\w*|hinterachs\w*\s+ol\w*/g;

const ENGINE_OIL_NAME_RE =
  /(?:motor)?ellas?\s+maina|motorell|motorol|motoroil|motor\s+(?:oil|ol)|dzineja\s+ellas?|engine\s+oil|oil\s+change|olwechsel|oilwechsel|ol\s+service|oil\s+service|lube\s+(?:service|oil)|oil\s+and\s+filter/;

const ENGINE_OIL_FILTER_RE =
  /(?:motor)?ellas?\s+filtr|oil\s+filter|olfilter|motorolfilter/;

/**
 * Tikai NEPĀRPROTAMI ne-maiņas darbi ar vārdu „eļļa”: līmeņa pārbaude, noplūdes diagnostika,
 * spiediena devējs. Viss pārējais (arī eļļas filtra korpusa maiņa, ko dīleris parasti veic kopā
 * ar eļļas maiņu) paliek skaitā - esošo atpazīšanu nesašaurinām (Nils 22.11).
 * Pēc fold: bez garumzīmēm, ö->o, „oel”->„ol”.
 */
const NOT_OIL_CHANGE_CLAUSE_RE =
  /(?:motorol|motoroil|\bol|\boil|ellas?|motorellas?)[\s-]*(?:stand|level|limen\p{L}*|niveau)(?:\s+\p{L}+){0,2}\s+(?:pruf\p{L}*|kontroll\p{L}*|check\p{L}*|parbaud\p{L}*|gepruft)|olstand\p{L}*\s+(?:pruf\p{L}*|kontroll\p{L}*|gepruft)|(?:pruf\p{L}*|check\p{L}*|parbaud\p{L}*)\s+(?:\p{L}+\s+){0,2}(?:olstand|oil\s+level|ellas\s+limen\p{L}*)|(?:motorol|motoroil|\bol|\boil|ellas?|motorellas?)[\s-]*(?:verlust|leck\p{L}*|leak\p{L}*|undicht\p{L}*|noplud\p{L}*|suc(?:e|es|i)\b)|olverlust|olleck\p{L}*|olundicht\p{L}*|(?:\bol|\boil|ellas?)[\s-]*(?:druck|pressure|spiedien\p{L}*)[\s-]*(?:sensor\p{L}*|schalter|geber|switch|sender|devej\p{L}*)|oldruck(?:sensor|schalter|geber)\p{L}*/u;

/** Pati klauzula tomēr fiksē maiņu („Ölwechsel, Ölstand geprüft”) - tad to neizmet. */
const EXPLICIT_OIL_CHANGE_RE =
  /olwechsel|oilwechsel|oil\s+change|ol\s+service|oil\s+service|wechsel\p{L}*|ellas?\s+(?:un\s+filtra\s+)?maina|\d{1,2}w\d{2}/u;

function dropNotOilChangeClauses(folded: string): string {
  return folded
    .split(/[\n;,|]+|(?<=\p{L})\.\s+/u)
    .filter((clause) => !NOT_OIL_CHANGE_CLAUSE_RE.test(clause) || EXPLICIT_OIL_CHANGE_RE.test(clause))
    .join(" ; ");
}

/** Noklusētais OEM, ja ražotāja intervāls nav zināms. */
export const OIL_DEALER_GAP_KM = 30_000;
/** Noklusētais OEM laiks, ja ražotāja intervāls nav zināms. */
export const OIL_DEALER_GAP_MONTHS = 24;
/**
 * Datu iztrūkums starp divām fiksētām maiņām: solis lielāks par šo reizinātāju
 * pret OEM (km vai mēneši). 1× līdz 2× ir „virs intervāla”, ne iztrūkums.
 */
export const OIL_MISSING_CHANGE_FACTOR = 2;
/** Bez OEM: izlecējs pret dīlera soļu mediānu. */
export const OIL_OUTLIER_RATIO = 1.8;
export const OIL_OUTLIER_MIN_KM = 20_000;

export type OilIntervalKind = "start" | "observed" | "gap";
export type OilIntervalTone = "ok" | "warn" | "stretch" | "start" | "gap" | "neutral";

export type OilChangeIntervalPoint = {
  date: string;
  odometer: string;
  km: number | null;
  intervalKm: number | null;
  intervalMonths: number | null;
  kind: OilIntervalKind;
  /** Intervāla (km) krāsa pret OEM km. */
  tone: OilIntervalTone;
  /** Perioda krāsa pret OEM mēnešiem. */
  periodTone: OilIntervalTone;
};

/** Iespējama (nepierādīta) eļļas maiņa - eļļas filtra korpuss bez skaidras eļļas maiņas (Nils 27.11). */
export type OilPossibleChangePoint = { date: string; odometer: string; km: number | null };

export type OilChangeIntervalSeries = {
  points: OilChangeIntervalPoint[];
  /**
   * Iespējamās maiņas (nav `points` un nav intervālu aprēķinā - pārsniegumu tās neaizver).
   * Tabulā / grafikā ar atzīmi «Iespējama». Nav dienā / pie km, kur jau ir pierādīta maiņa.
   */
  possiblePoints?: OilPossibleChangePoint[];
  changeCount: number;
  /** Vidējais Δ km tikai no dīlera soļiem (gredzens). */
  ringIntervalKm: number | null;
  /** Vidējais Δ mēneši tikai no tiem pašiem soļiem, kas gredzenā. */
  ringIntervalMonths: number | null;
  ringStepCount: number;
  gapStepCount: number;
  ringNote: string;
  avgIntervalKm: number | null;
  avgIntervalMonths: number | null;
  minIntervalKm: number | null;
  maxIntervalKm: number | null;
  oem: OemOilInterval | null;
  ringTone: OilIntervalTone;
  periodChipTone: OilIntervalTone;
  coverSpanKm: number | null;
  coverOkKm: number;
  coverOverKm: number;
  coverGapKm: number;
  coverStartKm: number | null;
  coverEndKm: number | null;
  /**
   * Segums līdz šodienai: posms pēc pēdējās fiksētās eļļas maiņas ir „nav dīlera datu”.
   * Tikai, ja izsaucējs iedod atskaites laiku (`nowMs`); citādi paliek posms starp pirmo un pēdējo maiņu.
   */
  coverage?: OilCoverage | null;
};

/** Aktuāls nobraukuma rādījums no jebkura avota (sludinājums, CSDD, VIN SCAN, dīleris). */
export type OilCurrentReading = { km: number; dateMs: number };

export type OilCoverage = {
  /** `km`, ja zināms aktuāls nobraukums; citādi `time` (mēneši) - km pēc pēdējā ieraksta nav zināmi. */
  basis: "km" | "time";
  ok: number;
  over: number;
  /** Datu iztrūkums starp fiksētajām maiņām. */
  gap: number;
  /** Posms no pēdējās fiksētās maiņas līdz šodienai / aktuālajam nobraukumam. */
  tail: number;
  total: number;
  firstDate: string;
  lastDate: string;
  /** Mēneši no pēdējās fiksētās maiņas līdz šodienai. */
  tailMonths: number | null;
  currentKm: number | null;
};

/** Cik svaigam jābūt cita avota rādījumam, lai to uzskatītu par aktuālo nobraukumu. */
export const OIL_CURRENT_READING_MAX_AGE_DAYS = 92;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseKm(odometer: string): number | null {
  const digits = odometer.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function monthsBetween(fromMs: number, toMs: number): number | null {
  if (!fromMs || !toMs || toMs < fromMs) return null;
  const days = (toMs - fromMs) / (24 * 60 * 60 * 1000);
  if (days < 20) return null;
  return Math.round(days / 30.437);
}

function groupDigits(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
}

function avg(xs: number[]): number | null {
  return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
}

/** Salīdzināšanai: NFKD, bez diakritikas, vācu oe->o, viskozitāte 5w-30 -> 5w30. */
export function foldOilWorkText(raw: string): string {
  const folded = raw
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/oel/g, "ol")
    .replace(/\s+/g, " ")
    .trim();
  return folded.replace(/\b(\d{1,2})\s*[-]?\s*w\s*[-]?\s*(\d{2,3})\b/g, "$1w$2");
}

/**
 * Mercedes-Benz ASSYST plānotās apkopes „Service A” / „Service B” (arī „Wartung A/B”, „Serviceumfang A/B”,
 * „A-Service”, „B-Service”, LV tulkojumā „Apkope A/B”, ar „plus” vai bez). Pēc ražotāja plāna ABAS apkopes
 * VIENMĒR ietver dzinēja eļļas un eļļas filtra maiņu, tāpēc tās skaitām kā eļļas maiņu ar augstu ticamību
 * (Nils 23.11.2026). „Service A/C” (kondicionieris) un parasts teikums („a service”) neatbilst.
 * Citu ražotāju vispārīgos nosaukumus (Volvo „Service 1/2/3”, Opel „Service Plus” u.c.) šeit NELIEKAM:
 * tie ne vienmēr ietver eļļu. BMW „Oil service” / „Motoröl-Service” un VW/Audi „Inspektion mit Ölwechsel” /
 * „Ölwechsel-Service” jau atpazīst `ENGINE_OIL_NAME_RE`.
 */
const MANUFACTURER_AB_OIL_SERVICE_RE =
  /(?:^|[^\p{L}\p{N}])(?:service|wartung|serviceumfang|wartungsumfang|apkope|apkopes\s+veids|maintenance\s+service)[\s:]+[ab](?:\s*(?:\+|plus))?(?![\p{L}\p{N}])(?!\s*[/-]\s*c(?![\p{L}]))|(?:^|[^\p{L}\p{N}])[ab]-(?:service|wartung)(?![\p{L}])/u;

/** Vai teksts satur ražotāja A/B apkopi, kas pēc plāna ietver dzinēja eļļas maiņu (sk. `MANUFACTURER_AB_OIL_SERVICE_RE`). */
export function isManufacturerOilServiceWork(works: string): boolean {
  const folded = foldOilWorkText(works);
  return Boolean(folded) && MANUFACTURER_AB_OIL_SERVICE_RE.test(folded);
}

/**
 * Stellantis (Peugeot / Citroën / Opel / Fiat) plānotā apkope „Travaux systématiques d'entretien” /
 * „Systematische Wartungsarbeiten” / LV „Sistemātiskie apkopes darbi” pēc ražotāja plāna ietver
 * dzinēja eļļas un eļļas filtra maiņu - skaitām kā eļļas maiņu (kā Mercedes „Apkope A/B”; audits 23.11).
 */
const STELLANTIS_SYSTEMATIC_SERVICE_RE =
  /travaux\s+systematiques?|systematische\s+wartungsarbeit\w*|sistematisk\w*\s+(?:tehniskas\s+)?apkopes\s+darb\w*|systematic\s+maintenance\s+work\w*/u;

function engineOilSignalInFolded(folded: string): boolean {
  if (!folded) return false;
  if (STELLANTIS_SYSTEMATIC_SERVICE_RE.test(folded)) return true;
  if (ENGINE_OIL_NAME_RE.test(folded)) return true;
  if (MANUFACTURER_AB_OIL_SERVICE_RE.test(folded)) return true;
  if (ENGINE_OIL_FILTER_RE.test(folded)) return true;
  if (ENGINE_VISCOSITY_RE.test(folded)) return true;
  return false;
}

/**
 * Eļļas filtra korpuss / vāks / modulis / to blīve (Nils 27.11, S8: «fiksējam, bet kā pilnībā nepierādītu»).
 * Šī pozīcija viena pati NAV pierādīta eļļas maiņa (BMW X3 04.04.2025: korpuss 3 nedēļas pēc maiņas);
 * tā ir «iespējama eļļas maiņa» (`isPossibleOilChangeWork`). Ja tajā pašā ierakstā ir arī eļļa / eļļas
 * filtrs / viskozitāte - maiņa paliek pierādīta. Pēc fold: bez garumzīmēm, ö->o, ä->a.
 */
const OIL_FILTER_HOUSING_RE =
  /(?:motor)?ellas?\s+filtr\p{L}*\s+(?:korpus\p{L}*|vak\p{L}*|vacin\p{L}*|modul\p{L}*)(?:\s+blive\p{L}*)?|(?:motor)?ol[\s-]*filter[\s-]*(?:gehause|deckel|modul|dichtung)\p{L}*|(?:engine\s+)?oil\s+filter\s+(?:housing|cover|module|casing|cap)(?:\s+(?:gasket|seal)\p{L}*)?|(?:корпус|крышк|модул)\p{L}*\s+(?:масляного\s+фильтра|фильтра\s+масла)/gu;

function engineOilClauses(folded: string): string {
  NON_ENGINE_OIL_CHUNK_RE.lastIndex = 0;
  return dropNotOilChangeClauses(folded.replace(NON_ENGINE_OIL_CHUNK_RE, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Vai rinda fiksē dzinēja eļļas maiņu (ne kārbu / tiltu / ATF atsevišķi, ne tikai eļļas filtra korpusu). */
export function isEngineOilChangeWork(works: string): boolean {
  const folded = foldOilWorkText(works);
  if (!folded) return false;
  OIL_FILTER_HOUSING_RE.lastIndex = 0;
  return engineOilSignalInFolded(engineOilClauses(folded).replace(OIL_FILTER_HOUSING_RE, " "));
}

/**
 * Iespējama (nepierādīta) eļļas maiņa: ierakstā ir eļļas filtra korpuss / vāks / modulis, bet nav
 * skaidras eļļas vai eļļas filtra maiņas. Tabulā / grafikā to rāda ar atzīmi «Iespējama», intervālus
 * pēc tās NErēķina (pārsniegumu tā «neaizver»), komentārā - «iespējams, veikta arī eļļas maiņa, bet tas nav pierādīts».
 */
export function isPossibleOilChangeWork(works: string): boolean {
  const folded = foldOilWorkText(works);
  if (!folded || isEngineOilChangeWork(works)) return false;
  OIL_FILTER_HOUSING_RE.lastIndex = 0;
  return OIL_FILTER_HOUSING_RE.test(engineOilClauses(folded));
}

/** Iespējamo eļļas maiņu rindas (hronoloģiski, viena dienā / pie viena km). */
export function collectPossibleOilChangeRows(
  rows: readonly AutoRecordsServiceWorkRow[],
): AutoRecordsServiceWorkRow[] {
  const raw = (rows ?? [])
    .map(normalizeAutoRecordsServiceWorkRow)
    .filter((r) => autoRecordsServiceWorkRowIsPrintable(r) && isPossibleOilChangeWork(r.works))
    .sort((a, b) => (parseRowMs(a.date) || Infinity) - (parseRowMs(b.date) || Infinity));
  const out: AutoRecordsServiceWorkRow[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    const day = row.date.trim();
    const km = row.odometer.replace(/\D/g, "");
    if ((day && seen.has(`d:${day}`)) || (km && seen.has(`k:${km}`))) continue;
    if (day) seen.add(`d:${day}`);
    if (km) seen.add(`k:${km}`);
    out.push(row);
  }
  return out;
}

function parseRowMs(date: string): number {
  return parseDotOrIsoDateToMs(date) || 0;
}

export function collectEngineOilChangeRows(
  rows: readonly AutoRecordsServiceWorkRow[],
): AutoRecordsServiceWorkRow[] {
  const oilRaw = (rows ?? [])
    .map(normalizeAutoRecordsServiceWorkRow)
    .filter((r) => autoRecordsServiceWorkRowIsPrintable(r) && isEngineOilChangeWork(r.works));
  const oil = mergeAutoRecordsServiceWorksByOdometer(oilRaw);
  const sorted = [...oil].sort((a, b) => {
    const ta = parseRowMs(a.date);
    const tb = parseRowMs(b.date);
    if (ta !== tb) {
      if (!ta) return 1;
      if (!tb) return -1;
      return ta - tb;
    }
    const na = parseKm(a.odometer) ?? 0;
    const nb = parseKm(b.odometer) ?? 0;
    return na - nb;
  });
  const out: AutoRecordsServiceWorkRow[] = [];
  const seen = new Set<string>();
  for (const row of sorted) {
    const day = row.date.trim();
    const km = row.odometer.replace(/\D/g, "");
    const key = `${day}|${km}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // Vienāds nobraukums = tā pati eļļas maiņa (0 km starpā), arī ja ieraksti ir ar dažādiem datumiem
    // (piem. rēķins vēlāk). Paliek agrākais datums; citādi viena maiņa tiktu skaitīta divreiz.
    if (km && out.some((r) => r.odometer.replace(/\D/g, "") === km)) continue;
    if (day) {
      const sameDay = out.findIndex((r) => r.date.trim() === day);
      if (sameDay >= 0) {
        const prevKm = parseKm(out[sameDay]!.odometer) ?? 0;
        const nextKm = parseKm(row.odometer) ?? 0;
        if (nextKm >= prevKm) out[sameDay] = row;
        continue;
      }
    }
    out.push(row);
  }
  return out;
}

function oemLimitKm(oem: OemOilInterval | null): number {
  return oem?.km && oem.km > 0 ? oem.km : OIL_DEALER_GAP_KM;
}

function oemLimitMonths(oem: OemOilInterval | null): number {
  return oem?.months && oem.months > 0 ? oem.months : OIL_DEALER_GAP_MONTHS;
}

/** Acīmredzami iztrūkstoša maiņa: solis > 2× OEM km vai > 2× OEM mēneši. */
export function isHardDataGap(
  km: number | null,
  months: number | null,
  oem: OemOilInterval | null = null,
): boolean {
  const kmLimit = oemLimitKm(oem) * OIL_MISSING_CHANGE_FACTOR;
  const monthLimit = oemLimitMonths(oem) * OIL_MISSING_CHANGE_FACTOR;
  if (km != null && km > kmLimit) return true;
  if (months != null && months > monthLimit) return true;
  return false;
}

function ratioTone(value: number | null, oem: number | null | undefined): OilIntervalTone {
  return oilRatioTone(value, oem);
}

/** Km solis pret OEM ar pielaidi (3 % vai 750 km); `tolerance` - cita pielaide (0 = bez pielaides). */
function kmRatioTone(value: number | null, oemKm: number | null | undefined, tolerance?: number): OilIntervalTone {
  return oilRatioTone(value, oemKm, tolerance ?? oilIntervalKmTolerance(oemKm));
}

export function classifyOilIntervalKind(
  km: number | null,
  months: number | null,
  poolKm: readonly number[],
  oem: OemOilInterval | null = null,
): OilIntervalKind {
  if (isHardDataGap(km, months, oem)) return "gap";
  if (oem) return "observed";
  if (km == null) return "observed";
  if (poolKm.length < 2) return "observed";
  const med = median([...poolKm]);
  if (med == null || med <= 0) return "observed";
  if (km >= OIL_OUTLIER_MIN_KM && km >= med * OIL_OUTLIER_RATIO) return "gap";
  return "observed";
}

function stepIsOverOem(p: OilChangeIntervalPoint): boolean {
  return p.kind === "observed" && (p.tone === "stretch" || p.periodTone === "stretch");
}

function buildAvgNote(ringSteps: number, gapSteps: number, changeCount: number): string {
  if (changeCount <= 1) {
    return "Fiksēta viena eļļas maiņa. Intervālu nevar rēķināt.";
  }
  if (ringSteps === 0) {
    return "Vidējo intervālu nevar rēķināt. Intervāli starp fiksētajām maiņām ir pārāk gari vai neregulāri, lai tos uzskatītu par dīlera eļļas intervālu.";
  }
  if (gapSteps === 0) {
    return ringSteps === 1
      ? "Vidējais rāda vienīgo intervālu ar nepārtrauktiem dīlera datiem."
      : `Vidējais no visiem ${ringSteps} intervāliem ar dīlera datiem.`;
  }
  const ringLabel = ringSteps === 1 ? "1 intervāla" : `${ringSteps} intervāliem`;
  const gapLabel = gapSteps === 1 ? "1 intervāls nav iekļauts" : `${gapSteps} intervāli nav iekļauti`;
  return `Vidējie rādītāji rēķināti tikai no ${ringLabel}, kur dīlera eļļas maiņas seko cita citai. ${gapLabel}, jo starp tiem ir datu iztrūkums.`;
}

export function buildOilChangeIntervalSeries(
  rows: readonly AutoRecordsServiceWorkRow[],
  oem: OemOilInterval | null = null,
  opts?: {
    nowMs?: number | null;
    current?: OilCurrentReading | null;
    /** Km pielaide pret OEM (noklusējums 3 % / 750 km); 0 - kad komentārs pats saka «pārsniedz» (BF 27.11). */
    kmTolerance?: number;
  },
): OilChangeIntervalSeries {
  const oilRows = collectEngineOilChangeRows(rows);
  const raw: Omit<OilChangeIntervalPoint, "kind" | "tone" | "periodTone">[] = [];
  let prevKm: number | null = null;
  let prevMs = 0;

  for (const row of oilRows) {
    const km = parseKm(row.odometer);
    const ms = parseDotOrIsoDateToMs(row.date);
    let intervalKm: number | null = null;
    let intervalMonths: number | null = null;
    const isFirst = raw.length === 0;
    if (!isFirst) {
      if (km != null && prevKm != null && km > prevKm) intervalKm = km - prevKm;
      if (ms && prevMs) intervalMonths = monthsBetween(prevMs, ms);
    }
    raw.push({
      date: row.date.trim(),
      odometer: row.odometer.trim(),
      km,
      intervalKm: isFirst ? null : intervalKm,
      intervalMonths: isFirst ? null : intervalMonths,
    });
    if (km != null) prevKm = km;
    if (ms) prevMs = ms;
  }

  const poolKm = raw
    .filter((p) => p.intervalKm != null && !isHardDataGap(p.intervalKm, p.intervalMonths, oem))
    .map((p) => p.intervalKm!);

  const points: OilChangeIntervalPoint[] = raw.map((p, i) => {
    if (i === 0) {
      return { ...p, kind: "start", tone: "start", periodTone: "start" };
    }
    const kind = classifyOilIntervalKind(p.intervalKm, p.intervalMonths, poolKm, oem);
    if (kind === "gap") {
      return { ...p, kind, tone: "gap", periodTone: "gap" };
    }
    return {
      ...p,
      kind,
      tone: kmRatioTone(p.intervalKm, oem?.km, opts?.kmTolerance),
      periodTone: ratioTone(p.intervalMonths, oem?.months),
    };
  });

  const ringKm = points.filter((p) => p.kind === "observed" && p.intervalKm != null).map((p) => p.intervalKm!);
  const ringMonths = points
    .filter((p) => p.kind === "observed" && p.intervalMonths != null)
    .map((p) => p.intervalMonths!);
  const allKm = points.filter((p) => p.intervalKm != null).map((p) => p.intervalKm!);
  const ringStepCount = points.filter((p) => p.kind === "observed").length;
  const gapStepCount = points.filter((p) => p.kind === "gap").length;
  const ringIntervalKm = avg(ringKm);
  const ringIntervalMonths = avg(ringMonths);
  const withKm = points.filter((p) => p.km != null);
  const coverStartKm = withKm[0]?.km ?? null;
  const coverEndKm = withKm[withKm.length - 1]?.km ?? null;
  const coverSpanKm =
    coverStartKm != null && coverEndKm != null && coverEndKm > coverStartKm
      ? coverEndKm - coverStartKm
      : null;
  const coverOkKm = points
    .filter((p) => p.kind === "observed" && !stepIsOverOem(p) && p.intervalKm != null)
    .reduce((a, p) => a + (p.intervalKm ?? 0), 0);
  const coverOverKm = points
    .filter((p) => stepIsOverOem(p) && p.intervalKm != null)
    .reduce((a, p) => a + (p.intervalKm ?? 0), 0);
  const coverGapKm =
    coverSpanKm != null ? Math.max(0, coverSpanKm - coverOkKm - coverOverKm) : 0;

  const provenDays = new Set(points.map((p) => p.date).filter(Boolean));
  const provenKm = new Set(points.map((p) => p.km).filter((k): k is number => k != null));
  const possiblePoints: OilPossibleChangePoint[] = collectPossibleOilChangeRows(rows)
    .map((r) => ({ date: r.date.trim(), odometer: r.odometer.trim(), km: parseKm(r.odometer) }))
    .filter((p) => !(p.date && provenDays.has(p.date)) && !(p.km != null && provenKm.has(p.km)));

  return {
    points,
    possiblePoints,
    changeCount: points.length,
    ringIntervalKm,
    ringIntervalMonths,
    ringStepCount,
    gapStepCount,
    ringNote: buildAvgNote(ringStepCount, gapStepCount, points.length),
    avgIntervalKm: ringIntervalKm,
    avgIntervalMonths: ringIntervalMonths,
    minIntervalKm: ringKm.length ? Math.min(...ringKm) : allKm.length ? Math.min(...allKm) : null,
    maxIntervalKm: ringKm.length ? Math.max(...ringKm) : allKm.length ? Math.max(...allKm) : null,
    oem,
    ringTone: kmRatioTone(ringIntervalKm, oem?.km),
    periodChipTone: ratioTone(ringIntervalMonths, oem?.months),
    coverSpanKm,
    coverOkKm,
    coverOverKm,
    coverGapKm,
    coverStartKm,
    coverEndKm,
    coverage: buildOilCoverage(
      { points, coverSpanKm, coverOkKm, coverOverKm, coverGapKm, coverEndKm },
      opts?.nowMs ?? null,
      opts?.current ?? null,
    ),
  };
}

function wholeMonthsBetween(fromMs: number, toMs: number): number {
  if (!fromMs || !toMs || toMs <= fromMs) return 0;
  return Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000) / 30.437);
}

function buildOilCoverage(
  s: Pick<
    OilChangeIntervalSeries,
    "points" | "coverSpanKm" | "coverOkKm" | "coverOverKm" | "coverGapKm" | "coverEndKm"
  >,
  nowMs: number | null,
  current: OilCurrentReading | null,
): OilCoverage | null {
  if (!nowMs || s.points.length < 2) return null;
  const dated = s.points.filter((p) => parseDotOrIsoDateToMs(p.date));
  const first = dated[0];
  const last = dated[dated.length - 1];
  if (!first || !last) return null;
  const firstMs = parseDotOrIsoDateToMs(first.date);
  const lastMs = parseDotOrIsoDateToMs(last.date);
  if (!firstMs || !lastMs || lastMs <= firstMs || nowMs < lastMs) return null;
  const tailMonths = wholeMonthsBetween(lastMs, nowMs);
  const base = { firstDate: first.date, lastDate: last.date, tailMonths };

  const fresh =
    current != null &&
    current.km > 0 &&
    current.dateMs >= nowMs - OIL_CURRENT_READING_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  if (fresh && s.coverSpanKm != null && s.coverEndKm != null && current!.km >= s.coverEndKm) {
    const tail = current!.km - s.coverEndKm;
    return {
      basis: "km",
      ok: s.coverOkKm,
      over: s.coverOverKm,
      gap: s.coverGapKm,
      tail,
      total: s.coverSpanKm + tail,
      currentKm: current!.km,
      ...base,
    };
  }

  // Km pēc pēdējā ieraksta nav zināmi: rēķinām pēc laika no pirmās fiksētās maiņas līdz šodienai.
  const spanMonths = wholeMonthsBetween(firstMs, lastMs);
  if (spanMonths <= 0) return null;
  const sumMonths = (pick: (p: OilChangeIntervalPoint) => boolean) =>
    s.points.filter(pick).reduce((a, p) => a + (p.intervalMonths ?? 0), 0);
  const over = Math.min(spanMonths, sumMonths((p) => stepIsOverOem(p)));
  const ok = Math.min(spanMonths - over, sumMonths((p) => p.kind === "observed" && !stepIsOverOem(p)));
  return {
    basis: "time",
    ok,
    over,
    gap: Math.max(0, spanMonths - ok - over),
    tail: tailMonths,
    total: spanMonths + tailMonths,
    currentKm: null,
    ...base,
  };
}

function pctOfScale(km: number): number {
  return Math.max(0, Math.min(100, (km / OIL_BAR_SCALE_KM) * 100));
}

function intervalKmCell(p: OilChangeIntervalPoint): string {
  if (p.kind === "start") return `<span class="pdf-oil-int__start">Sākums</span>`;
  if (p.intervalKm == null) return "";
  const km = `${groupDigits(p.intervalKm)} km`;
  if (p.kind === "gap") {
    return `<span class="pdf-oil-int__dim">${escapeHtml(km)}</span><div class="pdf-oil-int__gap-tag">Datu iztrūkums</div>`;
  }
  if (p.tone === "stretch") return `<b class="pdf-oil-int__over">${escapeHtml(km)}</b>`;
  return `<b>${escapeHtml(km)}</b>`;
}

function periodCell(p: OilChangeIntervalPoint): string {
  if (p.kind === "start" || p.intervalMonths == null) return "";
  if (p.kind === "gap") {
    return `<span class="pdf-oil-int__dim">${escapeHtml(`${p.intervalMonths} mēn.`)}</span>`;
  }
  if (p.periodTone === "stretch") {
    return `<span class="pdf-oil-int__over">${escapeHtml(`${p.intervalMonths} mēn.`)}</span>`;
  }
  return escapeHtml(`${p.intervalMonths} mēn.`);
}

function oemTickHtml(oem: OemOilInterval | null): string {
  if (!oem) return "";
  return `<i class="pdf-oil-int__tk" style="left:${pctOfScale(oem.km)}%"></i>`;
}

function oemBandHtml(oem: OemOilInterval | null): string {
  if (!oem || oem.kmMin == null || oem.kmMin >= oem.km) return "";
  const left = pctOfScale(oem.kmMin);
  const width = pctOfScale(oem.km) - left;
  return `<i class="pdf-oil-int__band" style="left:${left}%;width:${width}%"></i>`;
}

function stepBarHtml(p: OilChangeIntervalPoint, oem: OemOilInterval | null): string {
  const tick = oemTickHtml(oem);
  const band = oemBandHtml(oem);
  if (p.kind === "start") {
    return `<div class="pdf-oil-int__bw"><span class="pdf-oil-int__seg pdf-oil-int__seg--dot"></span></div>`;
  }
  if (p.kind === "gap") {
    return `<div class="pdf-oil-int__bw">${tick}<span class="pdf-oil-int__seg pdf-oil-int__seg--hatch" style="width:100%"></span></div>`;
  }
  const cls = stepIsOverOem(p) ? "over" : p.tone === "ok" ? "ok" : "neutral";
  if (p.intervalKm == null) {
    return `<div class="pdf-oil-int__bw">${tick}<span class="pdf-oil-int__seg pdf-oil-int__seg--${cls} pdf-oil-int__seg--dot"></span></div>`;
  }
  const w = pctOfScale(Math.min(p.intervalKm, OIL_BAR_SCALE_KM));
  if (oem && p.tone === "stretch") {
    const tp = pctOfScale(oem.km);
    const rest = Math.max(0, w - tp);
    return `<div class="pdf-oil-int__bw">${band}${tick}<span class="pdf-oil-int__seg pdf-oil-int__seg--ok" style="width:${tp}%"></span><span class="pdf-oil-int__seg pdf-oil-int__seg--over" style="width:${rest}%"></span></div>`;
  }
  return `<div class="pdf-oil-int__bw">${band}${tick}<span class="pdf-oil-int__seg pdf-oil-int__seg--${cls}" style="width:${w}%"></span></div>`;
}

type CoverParts = { ok: number; over: number; gap: number; total: number };

/** Daļas joslai: ar `coverage` - līdz šodienai (iztrūkums + posms pēc pēdējās maiņas), citādi tikai fiksētais posms. */
function coverParts(series: OilChangeIntervalSeries): CoverParts {
  const c = series.coverage;
  if (c && c.total > 0) return { ok: c.ok, over: c.over, gap: c.gap + c.tail, total: c.total };
  return {
    ok: series.coverOkKm,
    over: series.coverOverKm,
    gap: series.coverGapKm,
    total: series.coverSpanKm ?? 0,
  };
}

function coverPercents(series: OilChangeIntervalSeries): {
  pOk: number;
  pOver: number;
  pGap: number;
  pCover: number;
} {
  const { ok, gap, total } = coverParts(series);
  if (total <= 0) return { pOk: 0, pOver: 0, pGap: 0, pCover: 0 };
  let pGap = Math.round((gap / total) * 100);
  // 100 % tikai tad, ja iztrūkuma tiešām nav: noapaļošana nedrīkst paslēpt posmu bez datiem.
  if (gap > 0 && pGap === 0) pGap = 1;
  const pOk = Math.min(100 - pGap, Math.round((ok / total) * 100));
  const pOver = series.oem ? Math.max(0, 100 - pGap - pOk) : 0;
  return { pOk, pOver, pGap, pCover: 100 - pGap };
}

function oemRefHtml(oem: OemOilInterval | null): string {
  if (!oem) {
    return `<div class="pdf-oil-int__ref">Ražotāja intervāls nav droši zināms. Ievērošanu nevērtējam. Joslas rāda tikai, cik kilometru dīlera dati apliecina.</div>`;
  }
  const cap = formatOemOilCaption(oem);
  const extra =
    oem.kmMin != null && oem.kmMin < oem.km
      ? " Gaišā zona ir pieļaujamās robežas, melnā atzīme ir augšējā robeža."
      : " Melnā atzīme joslā ir šis intervāls.";
  return `<div class="pdf-oil-int__ref"><b>${escapeHtml(cap)}</b>${escapeHtml(extra)}</div>`;
}

function coverageHtml(series: OilChangeIntervalSeries): string {
  if (
    series.coverSpanKm == null ||
    series.coverSpanKm <= 0 ||
    series.coverStartKm == null ||
    series.coverEndKm == null
  ) {
    return "";
  }
  const parts = coverParts(series);
  if (parts.total <= 0) return "";
  const { pOk, pOver, pGap, pCover } = coverPercents(series);
  const oem = series.oem;
  const okW = (parts.ok / parts.total) * 100;
  const overW = (parts.over / parts.total) * 100;
  const gapW = (parts.gap / parts.total) * 100;
  const seg = oem
    ? `<i class="pdf-oil-int__cov-ok" style="width:${okW}%"></i><i class="pdf-oil-int__cov-over" style="width:${overW}%"></i>`
    : `<i class="pdf-oil-int__cov-neutral" style="width:${okW}%"></i>`;
  const key = oem
    ? `<span><i class="pdf-oil-int__sw pdf-oil-int__sw--ok"></i><b>${pOk}%</b> dīlera datos atbilst intervālam</span><span><i class="pdf-oil-int__sw pdf-oil-int__sw--over"></i><b>${pOver}%</b> dīlera datos virs intervāla</span><span><i class="pdf-oil-int__sw pdf-oil-int__sw--hatch"></i><b>${pGap}%</b> nav dīlera datu</span>`
    : `<span><i class="pdf-oil-int__sw pdf-oil-int__sw--neutral"></i><b>${pCover}%</b> ${series.coverage?.basis === "time" ? "laika ar dīlera datiem" : "nobraukuma ar dīlera datiem"}</span><span><i class="pdf-oil-int__sw pdf-oil-int__sw--hatch"></i><b>${pGap}%</b> nav dīlera datu</span>`;
  // Fakts bez vērtējuma: kuru posmu ieraksti aptver un no kura datuma ierakstu vairs nav.
  // Tas nav apgalvojums, ka apkopes nav veiktas (auto varēja stāvēt vai apkopts citur).
  const c = series.coverage;
  const kmSpan = `${groupDigits(series.coverStartKm)}-${groupDigits(series.coverEndKm)} km`;
  const head = c
    ? `Dīlera eļļas maiņu ieraksti aptver ${kmSpan} · ${c.firstDate}-${c.lastDate}`
    : `Dīlera eļļas maiņu ieraksti aptver ${kmSpan}`;
  const notes: string[] = [];
  if (c) {
    if (c.tailMonths != null && c.tailMonths >= 1) {
      notes.push(`Dīlera datos eļļas maiņas ierakstu nav pēc ${c.lastDate} (${c.tailMonths} mēn.).`);
    }
    notes.push(
      c.basis === "km" && c.currentKm != null
        ? `Procenti rēķināti pēc nobraukuma līdz ${groupDigits(c.currentKm)} km.`
        : "Procenti rēķināti pēc laika līdz šodienai.",
    );
  } else {
    notes.push("Procenti attiecas tikai uz šo posmu.");
  }
  return `<div class="pdf-oil-int__cov">${seg}<i class="pdf-oil-int__cov-hatch" style="width:${gapW}%"></i></div>
    <div class="pdf-oil-int__covkey">${key}</div>
    <p class="pdf-oil-int__summary">${escapeHtml(head)}<span>${escapeHtml(notes.join(" "))}</span></p>`;
}

function kpiValue(raw: string): string {
  return escapeHtml(raw);
}

/** Tabulas atzīme iespējamai (nepierādītai) eļļas maiņai. PDF citās valodās tulko HTML tulkotājs. */
export const OIL_POSSIBLE_TAG_LV = "Iespējama";
export const OIL_POSSIBLE_TABLE_NOTE_LV =
  "«Iespējama» - eļļas filtra korpusa maiņa: iespējams, veikta arī eļļas maiņa, bet tas nav pierādīts. Intervālos to neskaitām.";

/** PDF: KPI, nobraukuma segums, tabula ar joslām pret OEM. */
export function buildOilChangeIntervalPdfHtml(
  series: OilChangeIntervalSeries,
  cautionOpts: OilClaimCautionOpts = {},
): string {
  if (series.points.length === 0) return "";
  const avgKm =
    series.ringIntervalKm != null ? `${groupDigits(series.ringIntervalKm)} km` : "Nav";
  const avgMonths =
    series.ringIntervalMonths != null ? `${series.ringIntervalMonths} mēn.` : "Nav";
  const kpis = `<div class="pdf-oil-int__kpis">
      <div class="pdf-oil-int__kpi"><b>${kpiValue(String(series.changeCount))}</b><span>fiksētas maiņas</span></div>
      <div class="pdf-oil-int__kpi"><b>${kpiValue(avgKm)}</b><span>vidējais intervāls</span></div>
      <div class="pdf-oil-int__kpi"><b>${kpiValue(avgMonths)}</b><span>vidējais laiks</span></div>
    </div>`;
  const proven = series.points.map((p) => {
    const kmLabel = p.odometer ? formatServiceWorkOdometer(p.odometer) : "";
    return {
      ms: parseDotOrIsoDateToMs(p.date) || 0,
      html: `<tr class="pdf-oil-int__row pdf-oil-int__row--${p.tone}">
        <td>${escapeHtml(p.date)}</td>
        <td>${escapeHtml(kmLabel)}</td>
        <td>${intervalKmCell(p)}</td>
        <td>${periodCell(p)}</td>
        <td>${stepBarHtml(p, series.oem)}</td>
      </tr>`,
    };
  });
  const possible = series.possiblePoints ?? [];
  const possibleRows = possible.map((p) => {
    const kmLabel = p.odometer ? formatServiceWorkOdometer(p.odometer) : "";
    return {
      ms: parseDotOrIsoDateToMs(p.date) || 0,
      html: `<tr class="pdf-oil-int__row pdf-oil-int__row--possible">
        <td>${escapeHtml(p.date)}</td>
        <td>${escapeHtml(kmLabel)}</td>
        <td><div class="pdf-oil-int__gap-tag">${OIL_POSSIBLE_TAG_LV}</div></td>
        <td></td>
        <td><div class="pdf-oil-int__bw"><span class="pdf-oil-int__seg pdf-oil-int__seg--neutral pdf-oil-int__seg--dot"></span></div></td>
      </tr>`,
    };
  });
  // Iespējamās maiņas starp pierādītajām pēc datuma (stabils: tajā pašā dienā pierādītā pirmā).
  const rows = [...proven, ...possibleRows]
    .map((r, i) => ({ ...r, i }))
    .sort((a, b) => (a.ms && b.ms && a.ms !== b.ms ? a.ms - b.ms : a.i - b.i))
    .map((r) => r.html)
    .join("");
  const possibleNote = possible.length > 0 ? `<div class="pdf-oil-int__ref">${escapeHtml(OIL_POSSIBLE_TABLE_NOTE_LV)}</div>` : "";
  return `<div class="pdf-oil-int">
    <p class="pdf-subhead">Eļļas maiņas intervāli</p>
    ${kpis}
    ${coverageHtml(series)}
    ${oemRefHtml(series.oem)}
    <table class="pdf-oil-int__table">
      <thead><tr><th>Datums</th><th>Nobraukums</th><th>Intervāls</th><th>Periods</th><th>Pret ražotāja intervālu</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${possibleNote}
    ${oilClaimCautionHtml(cautionOpts)}
  </div>`;
}

function groupOilKm(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export type OilStepRange = { steps: number[]; minKm: number; maxKm: number };

/**
 * 26.11 (WDD2122931A366915): visi km soļi starp tabulas maiņām (arī tie, kas vidējā nav iekļauti),
 * lai AI tekstā diapazons būtu tieši tas, ko rāda tabula (nevis «11 200-25 000», ja tabulā 7 607 un 47 560).
 */
export function oilIntervalStepRange(series: Pick<OilChangeIntervalSeries, "points">): OilStepRange | null {
  const steps = series.points.map((p) => p.intervalKm).filter((v): v is number => v != null && v > 0);
  if (steps.length === 0) return null;
  return { steps, minKm: Math.min(...steps), maxKm: Math.max(...steps) };
}

/** Viena faktu rinda AI promptam: precīzais intervālu diapazons un visi intervāli tabulas secībā. */
export function formatOilStepRangeFactLine(series: Pick<OilChangeIntervalSeries, "points">): string {
  const r = oilIntervalStepRange(series);
  if (!r) return "";
  const all = r.steps.map((s) => `${groupOilKm(s)} km`).join(", ");
  return `Intervāli starp dzinēja eļļas maiņām (tā pati tabula kā PDF): no ${groupOilKm(r.minKm)} km līdz ${groupOilKm(r.maxKm)} km; visi intervāli: ${all}. Cits diapazons AIZLIEGTS; ja raksti diapazonu, tas ir tieši ${groupOilKm(r.minKm)}-${groupOilKm(r.maxKm)} km.`;
}

/** Īsā faktu lapas rinda: «Intervāli starp dzinēja eļļas maiņām (tabula): 7 607-47 560 km». */
export function formatOilStepRangeShortLv(series: Pick<OilChangeIntervalSeries, "points">): string {
  const r = oilIntervalStepRange(series);
  if (!r) return "";
  return `Intervāli starp dzinēja eļļas maiņām (tabula): ${r.minKm === r.maxKm ? groupOilKm(r.minKm) : `${groupOilKm(r.minKm)}-${groupOilKm(r.maxKm)}`} km`;
}
