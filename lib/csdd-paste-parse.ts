/**
 * CSDD „Smart Paste” — tehniskie pamatdati + apskates datumi (augša) + apvienota nobraukuma tabula.
 */

import {
  CSDD_MILEAGE_COUNTRY_LV,
  emptyCsddFields,
  finalizeMileageHistory,
  normalizeOdometerFromPaste,
  type CsddFormFields,
  type CsddMileageRow,
} from "@/lib/admin-source-blocks";
import {
  extractRegistryStructuredFields,
  normalizeRoadTaxDisplay,
  parseLvRegistryBasics,
} from "@/lib/client-report-lv-parse";

/** Rindas, pēc kurām „Nākamās / Iepriekšējās apskates datums” vairs nedrīkst ņemt. */
const NEXT_INSPECTION_HEAD_BOUNDARY_RES = [
  /^\s*Iepriekšējās\s+apskates\s+dati\b/i,
  /^\s*Nobraukuma\s+vēsture/i,
  /^\s*Nobraukums\s+ārvalst/i,
];

function sliceTextBeforeNextInspectionHeadBoundary(text: string): string {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (!L.trim()) continue;
    for (const re of NEXT_INSPECTION_HEAD_BOUNDARY_RES) {
      if (re.test(L)) return lines.slice(0, i).join("\n");
    }
  }
  return text;
}

function extractNextInspectionDateIsoFromHead(headText: string): string | null {
  const lines = headText.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/Nākamās\s+apskates\s+datums\s*:\s*(.+)$/i);
    if (!m?.[1]) continue;
    const rest = m[1].trim();
    const dm = rest.match(/\d{2}\.\d{2}\.\d{4}/);
    if (dm) {
      const iso = lvDateToIso(dm[0]);
      return iso || null;
    }
    const isoM = rest.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoM) return `${isoM[1]}-${isoM[2]}-${isoM[3]}`;
  }
  return null;
}

export function isLikelyStructuredCsddPaste(rawText: string): boolean {
  if (rawText.length > 200) return true;
  return (
    /\bIepriekšējās\s+apskates\s+dati\b/i.test(rawText) ||
    /\bNobraukuma\s+vēsture/i.test(rawText) ||
    /\bNobraukums\s+ārvalst/i.test(rawText) ||
    /\bTehniskie\s+dati\b/i.test(rawText) ||
    /\bMarka\s*,\s*modelis\b/i.test(rawText)
  );
}

/** DD.MM.GGGG → YYYY-MM-DD (HTML date input). */
export function lvDateToIso(lv: string): string {
  const t = lv.trim();
  const m = t.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return "";
  const [, d, mo, y] = m;
  return `${y}-${mo}-${d}`;
}

/** CSDD datuma teksts → YYYY-MM-DD, ja iespējams. */
function looseLvDateToIso(s: string): string {
  const t = s.trim();
  const strict = lvDateToIso(t);
  if (strict) return strict;
  const m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += y < 50 ? 2000 : 1900;
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  const isoL = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoL) return `${isoL[1]}-${isoL[2]}-${isoL[3]}`;
  return "";
}

/**
 * Tehniskie lauki no ielīmēta CSDD teksta (atslēga:vērtība, TAB, regex).
 * Nākamās apskates datums paste laikā tiek ņemts no dokumenta augšas; iepriekšējās — no LV nobraukuma tabulas (applyCsddPasteToForm).
 */
export function parseCsddTechnicalFields(
  raw: string,
): Omit<CsddFormFields, "rawUnprocessedData" | "mileageHistory" | "nextInspectionDate" | "prevInspectionDate"> {
  const st = extractRegistryStructuredFields(raw);
  const basics = parseLvRegistryBasics(raw);

  const makeModel = (st.makeModel ?? basics.markModel ?? "").trim();

  let registrationNumber = (st.plateNumber ?? basics.regNr ?? "").trim();
  const regPlateM = raw.match(
    /Reģistrācijas\s+numurs:\s*([A-ZĀČĒĢĪĶĻŅŠŪŽ0-9\-]+?)(?=Pirmās|$)/i,
  );
  if (regPlateM?.[1]) {
    registrationNumber = regPlateM[1].replace(/\s+/g, "").trim();
  } else {
    const regEnd = raw.match(
      /Reģistrācijas\s+numurs:\s*([-A-ZĀČĒĢĪĶĻŅŠŪŽ0-9]+)\s*$/im,
    );
    if (regEnd?.[1]) registrationNumber = regEnd[1].trim();
  }

  const firstRegSrc = st.firstReg ?? basics.firstReg;
  const firstRegistration = firstRegSrc
    ? looseLvDateToIso(firstRegSrc) || firstRegSrc.trim()
    : "";

  let engineDisplacementCm3 = (st.engineDisplacementCm3 ?? "").trim();
  if (!engineDisplacementCm3) {
    const m = raw.match(/motora\s+tilpums\s*[:\s]*([\d\s.,]+)\s*(?:cm³|cm3|kub\.?\s*cm)/i);
    if (m) engineDisplacementCm3 = m[1].replace(/\s+/g, "").replace(",", ".");
  }

  let enginePowerKw = (st.enginePower ?? basics.powerKw ?? "").trim();
  const kwExplicit = raw.match(
    /Motora\s+maksimāl[āa]\s+jauda\s*\(\s*kW\s*\)\s*:\s*(\d+)/i,
  );
  const kwLookbehind = raw.match(
    /(?<=Motora\s+maksimāl[āa]\s+jauda\s*\(\s*kW\s*\)\s*:\s*)(\d+)/i,
  );
  if (kwExplicit?.[1]) {
    enginePowerKw = kwExplicit[1];
  } else if (kwLookbehind?.[1]) {
    enginePowerKw = kwLookbehind[1];
  }
  const fuelType = (st.fuelType ?? "").trim();
  const emissionStandard = (st.euroStandard ?? basics.euro ?? "").trim();

  let grossMassKg = (st.grossWeight ?? basics.grossMassKg ?? "").trim();
  if (grossMassKg) grossMassKg = grossMassKg.replace(/\s+/g, " ");

  let curbMassKg = (st.curbWeight ?? basics.curbWeightKg ?? "").trim();
  if (curbMassKg) curbMassKg = curbMassKg.replace(/\s+/g, " ");

  let roadTaxEur = st.roadTax ?? basics.roadTaxEur;
  roadTaxEur = roadTaxEur ? normalizeRoadTaxDisplay(roadTaxEur) : "";

  const registrationStatus = (st.status ?? "").trim();

  let opacityCoefficient = (st.smokeOpacity ?? basics.smokeOpacity ?? "").trim();
  if (opacityCoefficient) opacityCoefficient = opacityCoefficient.replace(/\s+/g, " ").slice(0, 80);

  let particulateMatter = (st.particulateMatter ?? "").trim();
  if (!particulateMatter) {
    const m = raw.match(/(?:atgāzu\s+)?cietās\s+daļiņas\s*[:\s]*([^\n]+)/i);
    if (m) particulateMatter = m[1].trim().slice(0, 120);
  }

  return {
    makeModel,
    registrationNumber,
    firstRegistration,
    engineDisplacementCm3,
    enginePowerKw,
    fuelType,
    emissionStandard,
    grossMassKg,
    curbMassKg,
    roadTaxEur,
    registrationStatus,
    opacityCoefficient,
    particulateMatter,
    comments: "",
  };
}

function isCsddSectionHeaderLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  return (
    /^Nobraukuma\s+vēsture/i.test(t) ||
    /^Nobraukums\s+ārvalst/i.test(t) ||
    /^Tehniskie\s+dati/i.test(t) ||
    /^Detalizētais\s+vērtējums/i.test(t) ||
    /^Novērtējums\s*:/i.test(t) ||
    /^Iepriekšējās\s+apskates\s+dati\b/i.test(t) ||
    /^Ceļa\s+nodoklis/i.test(t) ||
    /^Marka\s*,\s*modelis/i.test(t) ||
    /^Pirmās\s+reģistrācijas/i.test(t)
  );
}

function looksLikeSectionHeader(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/Nobraukuma\s+vēsture/i.test(t)) return false;
  if (isCsddSectionHeaderLine(line)) return true;
  if (/^(Tehniskie dati|Ceļa nodoklis)/i.test(t)) return true;
  return false;
}

/** Ārvalstu bloka iekšienē — LV sadaļas sākums jāpārtrauc pirms mēģinājuma parsēt rindu kā ārvalstu. */
function isNobraukumaVestureHeaderLine(line: string): boolean {
  return /Nobraukuma\s+vēsture/i.test(line.trim());
}

function pushLvRow(rows: CsddMileageRow[], date: string, odometerRaw: string): void {
  rows.push({
    date,
    odometer: normalizeOdometerFromPaste(odometerRaw),
    country: CSDD_MILEAGE_COUNTRY_LV,
  });
}

/**
 * „Nobraukuma vēsture LV” — viss fails, jebkāda bloku secība; var būt vairāki LV bloki.
 */
export function parseMileageHistoryLvBlock(text: string): CsddMileageRow[] {
  const lines = text.split(/\r?\n/);
  const rows: CsddMileageRow[] = [];

  let i = 0;
  while (i < lines.length) {
    if (/Nobraukuma\s+vēsture(?:\s+LV)?/i.test(lines[i])) {
      i++;
      while (i < lines.length) {
        const L0 = lines[i].trim();
        if (!L0) {
          i++;
          continue;
        }
        if (/^\s*(datums|odometrs|nobraukums)\b/i.test(L0)) {
          i++;
          continue;
        }
        if (looksLikeSectionHeader(L0) && !/^\d{2}\.\d{2}\.\d{4}/.test(L0)) break;

        const L = L0;
        const tabs = L.split("\t").map((c) => c.trim());
        if (tabs.length >= 2 && /^\d{2}\.\d{2}\.\d{4}$/.test(tabs[0])) {
          pushLvRow(rows, tabs[0], tabs[1] ?? "");
          i++;
          continue;
        }
        const sp = L.split(/\s+/).filter(Boolean);
        if (sp.length >= 2 && /^\d{2}\.\d{2}\.\d{4}$/.test(sp[0])) {
          pushLvRow(rows, sp[0], sp[1] ?? "");
          i++;
          continue;
        }
        break;
      }
      continue;
    }
    i++;
  }
  return rows;
}

/**
 * Ārvalstu rinda pēc normalizētas rindas. Grupas: 1 = datums, 2 = odometrs, 3 = visa atlikusī valsts (bez vārdnīcas validācijas).
 * `\s` aptver tabus; 3. grupa ir `.+` — saglabā LIELAJUS burtus un jebkuru CSDD tekstu.
 */
const ABROAD_LINE_REGEX =
  /^(\d{2}\.\d{2}\.\d{4})\s+(\d+)(?:\s*km)?\s+(.+)$/iu;

/**
 * NBSP/BOM noņemšana + tikai atstarpju apkopošana starp CIPARIEM (piem. „161 524” → „161524”).
 * Nav globālas „visas \s+ → viena atstarpe”, lai nesaplūstu struktūra starp odometru / „km” / valsti.
 */
function collapseSpacesBetweenDigits(s: string): string {
  let out = s;
  let prev = out;
  do {
    prev = out;
    out = out.replace(/(\d)\s+(?=\d)/g, "$1");
  } while (out !== prev);
  return out;
}

function normalizeMileageLineForAbroadRegex(line: string): string {
  return collapseSpacesBetweenDigits(line.replace(/[\u00A0\uFEFF]/g, " ").trim());
}

function parseAbroadSpaceLine(sp: string[]): {
  date: string;
  odometer: string;
  country: string;
} | null {
  if (sp.length < 2 || !/^\d{2}\.\d{2}\.\d{4}$/.test(sp[0] ?? "")) return null;
  const date = sp[0]!;
  const odometer = normalizeOdometerFromPaste(sp[1] ?? "");
  if (sp.length === 2) return { date, odometer, country: "" };
  if (sp[2]!.toLowerCase() === "km") {
    if (sp.length >= 4) return { date, odometer, country: sp.slice(3).join(" ").trim() };
    return { date, odometer, country: "" };
  }
  return { date, odometer, country: sp.slice(2).join(" ").trim() };
}

/**
 * „Nobraukums ārvalstīs” — viss fails, jebkāda secība pret LV; var būt vairāki ārvalstu bloki.
 */
export function parseMileageAbroadBlock(text: string): CsddMileageRow[] {
  const lines = text.split(/\r?\n/);
  const rows: CsddMileageRow[] = [];

  let i = 0;
  while (i < lines.length) {
    if (/Nobraukums\s+ārvalstīs/i.test(lines[i])) {
      i++;
      while (i < lines.length) {
        const L0 = lines[i].trim();
        if (!L0) {
          i++;
          continue;
        }
        if (isNobraukumaVestureHeaderLine(L0)) break;
        if (/^\s*(datums|odometrs|avots|valsts|nobraukums)\b/i.test(L0)) {
          i++;
          continue;
        }
        if (looksLikeSectionHeader(L0) && !/^\d{2}\.\d{2}\.\d{4}/.test(L0)) break;

        const L = normalizeMileageLineForAbroadRegex(L0);

        const match = L.match(ABROAD_LINE_REGEX);
        if (match) {
          const date = match[1] ?? "";
          const odometerRaw = match[2] ?? "";
          const country = match[3] != null && match[3] !== "" ? match[3].trim() : "";
          rows.push({
            date,
            odometer: normalizeOdometerFromPaste(odometerRaw),
            country,
          });
          i++;
          continue;
        }

        const tabs = L0.split("\t").map((c) => c.trim());
        if (tabs.length >= 2 && /^\d{2}\.\d{2}\.\d{4}$/.test(tabs[0])) {
          const country =
            tabs.length >= 3 ? tabs.slice(2).join(" ").trim() : "";
          rows.push({
            date: tabs[0],
            odometer: normalizeOdometerFromPaste(tabs[1] ?? ""),
            country,
          });
          i++;
          continue;
        }
        const sp = L.split(/\s+/).filter(Boolean);
        const fromSp = parseAbroadSpaceLine(sp);
        if (fromSp) {
          rows.push({
            date: fromSp.date,
            odometer: fromSp.odometer,
            country: fromSp.country,
          });
          i++;
          continue;
        }
        break;
      }
      continue;
    }
    i++;
  }
  return rows;
}

export type CsddPasteParseResult = {
  mileageHistory: CsddMileageRow[];
  nextInspectionIso: string | null;
  /** Iepriekšējās apskates datums — no „Nobraukuma vēsture LV” pirmās (augšējās) rindas. */
  prevInspectionIso: string | null;
};

/** Iepriekšējās apskates datums = pirmās rindas datums LV nobraukuma tabulā (CSDD augšā). */
function extractPrevInspectionIsoFromLvFirstRow(raw: string): string | null {
  const lv = parseMileageHistoryLvBlock(raw);
  const d = lv[0]?.date?.trim();
  if (!d) return null;
  const iso = looseLvDateToIso(d);
  return iso || null;
}

export function parseCsddPaste(raw: string): CsddPasteParseResult {
  const fromLvBlock = parseMileageHistoryLvBlock(raw);
  const lvRecords: CsddMileageRow[] = fromLvBlock.map((row) => ({
    date: row.date,
    odometer: row.odometer,
    country: CSDD_MILEAGE_COUNTRY_LV,
  }));
  const foreignRecords = parseMileageAbroadBlock(raw);
  const totalMileage = [...lvRecords, ...foreignRecords];
  const mileageHistory = finalizeMileageHistory(totalMileage);
  const headForDates = sliceTextBeforeNextInspectionHeadBoundary(raw);
  const nextInspectionIso = extractNextInspectionDateIsoFromHead(headForDates);
  const prevInspectionIso = extractPrevInspectionIsoFromLvFirstRow(raw);
  return {
    mileageHistory,
    nextInspectionIso,
    prevInspectionIso,
  };
}

/**
 * Katrs raw lauka mainījums: forma tiek atiestatīta uz parsēto (tīrīšana no vecajiem laukiem).
 */
export function applyCsddPasteToForm(
  current: CsddFormFields,
  rawText: string,
  parsed: CsddPasteParseResult,
): CsddFormFields {
  const tech = parseCsddTechnicalFields(rawText);
  let nextInspectionDate = "";
  let prevInspectionDate = "";
  if (parsed.nextInspectionIso) {
    nextInspectionDate = parsed.nextInspectionIso;
  } else if (!isLikelyStructuredCsddPaste(rawText)) {
    nextInspectionDate = current.nextInspectionDate;
  }
  if (parsed.prevInspectionIso) {
    prevInspectionDate = parsed.prevInspectionIso;
  } else if (!isLikelyStructuredCsddPaste(rawText)) {
    prevInspectionDate = current.prevInspectionDate;
  }

  return {
    ...emptyCsddFields(),
    ...tech,
    rawUnprocessedData: rawText,
    nextInspectionDate,
    prevInspectionDate,
    mileageHistory: parsed.mileageHistory,
    comments: current.comments,
  };
}
