/**
 * Deterministisks CSDD tehniskās apskates nosegums ✨ promptam.
 * Aģentam nav jāmin, ko MK 295 jau ir pārbaudījis — to aprēķina kods.
 */
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";
import {
  emptyCsddFields,
  toPdfManualVendorBlocks,
  type CsddFormFields,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import {
  collectUnifiedMileageRows,
  parseMileageDateForSort,
  parseOdometerKm,
} from "@/lib/unified-mileage";

/** MK 295 44. p. logs — svaiga apskate, kas uz ceļa vairs nav jāpārbauda. */
export const TA_FRESH_MAX_DAYS = 90;

/** Ja nav nākamās apskates datuma, šis ir vājais „vēl spēkā” slieksnis. */
const TA_LIKELY_VALID_MAX_DAYS = 365;

export type TaCoverageLevel = "fresh" | "valid" | "expired" | "none";

export const TA_COVERED_WEAR_GROUPS_LV = [
  "bremzes (efektivitāte, stāvbremze, šļūtenes)",
  "stūre (brīvkustība, pārvads, pastiprinātājs)",
  "asis, riteņi, riepas, balstiekārta (sviras, bukses, lodbalsti, amortizatori, gultņi)",
  "apgaismojums un stiklu tīrītāji",
  "redzamas eļļas / degvielas noplūdes un dūmainība (MK 295 8. grupa)",
] as const;

export type TechnicalInspectionCoverage = {
  level: TaCoverageLevel;
  lastInspectionDate: string | null;
  lastInspectionAgeDays: number | null;
  nextInspectionDate: string | null;
  nextInspectionValid: boolean;
  kmSinceInspection: number | null;
  ratingLevel: 1 | 2 | 3 | null;
  maxDefectLevel: 1 | 2 | 3 | null;
  ratingLabel: string;
  vehicleAgeYears: number | null;
  minorDefectOnOlderCar: boolean;
  coveredGroups: readonly string[];
};

const MS_DAY = 86_400_000;

function dateMs(raw: string | undefined): number {
  if (!raw?.trim()) return Number.NEGATIVE_INFINITY;
  const ms = parseDotOrIsoDateToMs(raw);
  return ms > 0 ? ms : Number.NEGATIVE_INFINITY;
}

function formatLvDate(raw: string): string {
  const ms = dateMs(raw);
  if (!Number.isFinite(ms) || ms < 0) return raw.trim();
  return new Date(ms).toISOString().slice(0, 10);
}

function pickLastInspection(csdd: CsddFormFields): {
  date: string;
  ratingLevel: 1 | 2 | 3 | null;
  maxDefectLevel: 1 | 2 | 3 | null;
  ratingLabel: string;
  odometer: string;
} | null {
  const history = [...(csdd.technicalInspectionHistory ?? [])].filter((r) => r.date.trim());
  history.sort((a, b) => dateMs(b.date) - dateMs(a.date));
  const newest = history[0];
  const prev = csdd.prevInspectionDate.trim();
  const block = csdd.prevInspectionBlock;
  const blockDate = block.inspectionDateText.trim() || "";

  const candidates: Array<{ date: string; ratingLevel: 1 | 2 | 3 | null; maxDefectLevel: 1 | 2 | 3 | null; ratingLabel: string; odometer: string }> = [];
  if (newest) {
    candidates.push({
      date: newest.date,
      ratingLevel: newest.ratingLevel,
      maxDefectLevel: newest.maxDefectLevel,
      ratingLabel: newest.ratingLabel,
      odometer: "",
    });
  }
  if (prev) {
    candidates.push({
      date: prev,
      ratingLevel: block.ratingLevel,
      maxDefectLevel: null,
      ratingLabel: block.ratingLabel,
      odometer: block.odometer,
    });
  }
  if (blockDate) {
    candidates.push({
      date: blockDate,
      ratingLevel: block.ratingLevel,
      maxDefectLevel: null,
      ratingLabel: block.ratingLabel,
      odometer: block.odometer,
    });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => dateMs(b.date) - dateMs(a.date));
  const best = candidates[0];
  if (dateMs(best.date) < 0) return null;
  if (!best.odometer && block.odometer.trim()) best.odometer = block.odometer;
  return best;
}

function latestOdometerKm(blocks: WorkspaceSourceBlocks | undefined, csdd: CsddFormFields): number | null {
  if (blocks) {
    const rows = collectUnifiedMileageRows({
      csddForm: csdd,
      autoRecordsBlock: blocks.auto_records,
      ccVinBlock: blocks.cc_vin,
      manualVendorBlocks: toPdfManualVendorBlocks(blocks),
      citiAvotiBlock: blocks.citi_avoti,
      tirgusForm: blocks.tirgus,
    });
    let bestKm: number | null = null;
    let bestTime = Number.NEGATIVE_INFINITY;
    for (const row of rows) {
      const km = parseOdometerKm(row.odometer);
      if (km == null) continue;
      const time = parseMileageDateForSort(row.date);
      if (bestKm == null || time > bestTime || (time === bestTime && km > bestKm)) {
        bestKm = km;
        bestTime = time;
      }
    }
    if (bestKm != null) return bestKm;
  }
  const local = [...(csdd.mileageHistory ?? [])]
    .map((r) => ({ km: parseOdometerKm(r.odometer), t: parseMileageDateForSort(r.date) }))
    .filter((r) => r.km != null);
  local.sort((a, b) => b.t - a.t || (b.km ?? 0) - (a.km ?? 0));
  return local[0]?.km ?? null;
}

function kmAtOrNear(csdd: CsddFormFields, inspectionMs: number, hint: string): number | null {
  const hinted = parseOdometerKm(hint);
  if (hinted != null) return hinted;
  let best: { km: number; dist: number } | null = null;
  for (const row of csdd.mileageHistory ?? []) {
    const km = parseOdometerKm(row.odometer);
    const t = dateMs(row.date);
    if (km == null || t < 0) continue;
    const dist = Math.abs(t - inspectionMs);
    if (dist > 14 * MS_DAY) continue;
    if (!best || dist < best.dist) best = { km, dist };
  }
  return best?.km ?? null;
}

export function analyzeTechnicalInspectionCoverage(input: {
  csdd?: CsddFormFields | null;
  sourceBlocks?: WorkspaceSourceBlocks | null;
  nowMs?: number;
}): TechnicalInspectionCoverage {
  const csdd = input.csdd ?? emptyCsddFields();
  const nowMs = input.nowMs ?? Date.now();
  const last = pickLastInspection(csdd);
  const nextRaw = csdd.nextInspectionDate.trim();
  const nextMs = dateMs(nextRaw);
  const nextInspectionValid = nextMs > 0 && nextMs >= nowMs;
  const firstRegMs = dateMs(csdd.firstRegistration);
  const vehicleAgeYears =
    firstRegMs > 0 ? Math.max(0, Math.floor((nowMs - firstRegMs) / (365.25 * MS_DAY))) : null;

  if (!last) {
    return {
      level: "none",
      lastInspectionDate: null,
      lastInspectionAgeDays: null,
      nextInspectionDate: nextRaw || null,
      nextInspectionValid,
      kmSinceInspection: null,
      ratingLevel: null,
      maxDefectLevel: null,
      ratingLabel: "",
      vehicleAgeYears,
      minorDefectOnOlderCar: false,
      coveredGroups: [],
    };
  }

  const lastMs = dateMs(last.date);
  const ageDays = lastMs > 0 ? Math.floor((nowMs - lastMs) / MS_DAY) : null;
  const atKm = lastMs > 0 ? kmAtOrNear(csdd, lastMs, last.odometer) : null;
  const latestKm = latestOdometerKm(input.sourceBlocks ?? undefined, csdd);
  const kmSinceInspection =
    atKm != null && latestKm != null && latestKm >= atKm ? latestKm - atKm : null;

  let level: TaCoverageLevel = "expired";
  if (ageDays != null && ageDays <= TA_FRESH_MAX_DAYS) level = "fresh";
  else if (nextInspectionValid || (ageDays != null && ageDays <= TA_LIKELY_VALID_MAX_DAYS && !nextRaw)) {
    level = "valid";
  } else if (nextInspectionValid) {
    level = "valid";
  }

  const maxDefect = last.maxDefectLevel;
  const minorDefectOnOlderCar =
    (maxDefect === 1 || last.ratingLevel === 1) && vehicleAgeYears != null && vehicleAgeYears >= 15;

  return {
    level,
    lastInspectionDate: formatLvDate(last.date),
    lastInspectionAgeDays: ageDays,
    nextInspectionDate: nextRaw ? formatLvDate(nextRaw) : null,
    nextInspectionValid,
    kmSinceInspection,
    ratingLevel: last.ratingLevel,
    maxDefectLevel: maxDefect,
    ratingLabel: last.ratingLabel.trim(),
    vehicleAgeYears,
    minorDefectOnOlderCar,
    coveredGroups: TA_COVERED_WEAR_GROUPS_LV,
  };
}

function levelInstruction(c: TechnicalInspectionCoverage): string {
  if (c.level === "fresh") {
    return [
      "LĪMENIS: SVAIGA (≤ 3 mēneši). MK 295 nosegtie nodiluma mezgli 1. Tehnisko risku analīzē NEPARĀDĀS — ne kā risks, ne kā „bieži nepieciešama nomaiņa”.",
      "2. Ieteikumi: šie mezgli NAV atsevišķas rindkopas, ja vien operators to neprasa.",
      "Nedrīksti rakstīt, ka piekare/bremzes ir „kārtībā” kā fizisks fakts — tikai to, ka konkrētajā apskates datumā tās atbilda prasībām.",
    ].join(" ");
  }
  if (c.level === "valid") {
    return [
      "LĪMENIS: SPĒKĀ, BET NAV SVAIGA. Nosegtos mezglus nedrīkst pasniegt kā pirkuma risku ar apgalvojumu.",
      "Tie pārceļas uz 2. Ieteikumiem kā viena īsa rindiņa (ko redzēt/dzirdēt), nevesela rindkopa.",
      "Nedrīksti rakstīt, ka tie ir kārtībā, un nedrīksti rakstīt, ka tie ir bojāti.",
    ].join(" ");
  }
  if (c.level === "expired") {
    return "LĪMENIS: BEIGUSIES / NOVĒLOTA. TA nosegums neieslēdzas. Paliek RESOLVED HISTORICAL FINDINGS un parastā risku disciplīna.";
  }
  return "LĪMENIS: NAV DATU. TA nosegums neieslēdzas — neizdomā apskates rezultātu.";
}

/** Kompakts prompta bloks — tukšs tikai tad, ja nav pat CSDD formas. */
export function buildTechnicalInspectionCoverageBrief(input: {
  csdd?: CsddFormFields | null;
  sourceBlocks?: WorkspaceSourceBlocks | null;
  nowMs?: number;
}): string {
  const c = analyzeTechnicalInspectionCoverage(input);
  const lines: string[] = [
    "### CSDD tehniskās apskates nosegums (deterministisks — NEIZDOMĀ pretējo)",
    `- Pēdējā apskate: ${c.lastInspectionDate ?? "nav datos"}` +
      (c.lastInspectionAgeDays != null ? ` (pirms ${c.lastInspectionAgeDays} dienām)` : ""),
    `- Nākamā apskate: ${c.nextInspectionDate ?? "nav datos"}${c.nextInspectionValid ? " (spēkā)" : ""}`,
    `- Novērtējums: ${c.ratingLabel || "nav"}` +
      (c.ratingLevel != null ? ` (kopējais ${c.ratingLevel})` : "") +
      (c.maxDefectLevel != null ? `, augstākais defekts ${c.maxDefectLevel}` : ""),
  ];
  if (c.kmSinceInspection != null) {
    lines.push(`- Nobraukums kopš apskates: ${c.kmSinceInspection.toLocaleString("lv-LV").replace(/\u00a0/g, " ")} km`);
  }
  if (c.vehicleAgeYears != null) {
    lines.push(`- Auto vecums: ~${c.vehicleAgeYears} gadi`);
  }
  if (c.level !== "none") {
    lines.push(`- MK 295 nosegtās grupas: ${c.coveredGroups.join("; ")}`);
  }
  lines.push(`- ${levelInstruction(c)}`);
  if (c.minorDefectOnOlderCar) {
    lines.push(
      "- 1. līmeņa / maznozīmīgs trūkums uz 15+ gadus veca Latvijā ekspluatēta auto: VIENS teikums (uzmanība klātienē), nav dramatisks defekts un nav plaši jāapraksta.",
    );
  }
  lines.push(
    "- IZŅĒMUMS paliek spēkā: rūsa/korozija un cietās daļiņas / dūmainība — arī pēc tīras vēlākas TA paliek uzmanības punkts (skat. RESOLVED HISTORICAL FINDINGS).",
    "- Ziemas sāls klimats NAV TA nosegts nodilums. Ja promptā ir „Ziemas sāls / rūsas ekspozīcija” ar OBLIGĀTI — tipiskās vietas jāmin riskos un ieteikumos pat ja TA ir svaiga un tīra (TA neredz rūsu zem arku oderēm).",
  );
  return lines.join("\n");
}
