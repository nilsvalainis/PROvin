/**
 * Eļļas intervālu komentāra deterministiskās piebildes (Nils 26.11.2026).
 *
 * 1. Ja kāds dīlera solis starp eļļas maiņām pārsniedz ražotāja intervālu (km vai mēneši, arī
 *    „Datu iztrūkums”), komentārā VIENMĒR jābūt teikumam, ka tas nenozīmē, ka eļļas maiņa nav
 *    veikta - tā var būt veikta neatkarīgā servisā.
 * 2. Ja pārsniegtajā periodā ir dīlera ieraksti bez detalizēta darbu apraksta („Apkope”, „Serviss”,
 *    „Apmeklējums”), pievieno teikumu, ka tie teorētiski var liecināt par eļļas maiņu (vienreiz, visi datumi kopā).
 *
 * Teikumus pievieno tieši pēc rindkopas par pārsniegumu (vai sadaļas „Eļļas maiņu regularitāte”
 * beigās), vienā rindkopā, un nekad divreiz. Bez verdikta un bez ieteikumiem.
 *
 * Agrāk šo teikumu rakstīja AI pēc prompta („Apkope var būt ārpus dīlera…”), bet #1118 (22.11)
 * prompts kļuva „tikai fakti, nekādu ieteikumu” un aizliedza „visticamāk apkopts citur” - teikums
 * pazuda. Tagad tas ir kods, ne prompta lūgums.
 */

import {
  autoRecordsServiceWorkRowIsPrintable,
  normalizeAutoRecordsServiceWorkRow,
  type AutoRecordsServiceWorkRow,
} from "@/lib/auto-records-service-works";
import { parseDotOrIsoDateToMs } from "@/lib/clean-date-str";
import {
  foldOilWorkText,
  isEngineOilChangeWork,
  type OilChangeIntervalPoint,
  type OilChangeIntervalSeries,
} from "@/lib/oil-change-intervals";

export type OilNoteLang = "lv" | "en" | "ru" | "de";

export const OIL_NOT_SKIPPED_NOTE: Record<OilNoteLang, string> = {
  lv: "Tas nenozīmē, ka eļļas maiņa nav veikta - tā var būt veikta neatkarīgā servisā, kas datus oficiālajā dīlera sistēmā neievada.",
  en: "This does not mean the oil change was not done - it may have been done at an independent workshop that does not enter data into the official dealer system.",
  ru: "Это не означает, что замена масла не проводилась - её могли выполнить в независимом сервисе, который не вносит данные в официальную дилерскую систему.",
  de: "Das bedeutet nicht, dass kein Ölwechsel durchgeführt wurde - er kann in einer freien Werkstatt erfolgt sein, die keine Daten in das offizielle Händlersystem einträgt.",
};

/** #1286 formulējums (26.11) - atpazīst un aizvieto, lai pēc pārģenerēšanas nekas nedublējas. */
const OIL_NOT_SKIPPED_NOTE_V1: readonly string[] = [
  "Tas nenozīmē, ka eļļas maiņa nav veikta - tā var būt veikta neatkarīgā servisā, kas datus dīlera sistēmai nenodod.",
  "This does not mean the oil change was not done - it may have been done at an independent workshop that does not pass data to the dealer system.",
  "Это не означает, что замена масла не проводилась - она могла быть выполнена в независимом сервисе, который не передаёт данные в дилерскую систему.",
  "Das bedeutet nicht, dass kein Ölwechsel durchgeführt wurde - er kann in einer freien Werkstatt erfolgt sein, die keine Daten an das Händlersystem übermittelt.",
];

/** Datumus rādām tikai, ja to ir maz (teikums paliek īss); citādi tikai skaitu. */
export const OIL_GENERIC_DATES_MAX = 4;

export type OilExceededInterval = {
  fromDate: string;
  toDate: string;
  /** Dīlera ieraksti bez darbu apraksta šajā periodā (datumi, hronoloģiski). */
  genericDates: string[];
  /** Iespējamās (nepierādītās) eļļas maiņas šajā periodā - eļļas filtra korpuss (Nils 27.11). */
  possibleDates?: string[];
  /**
   * Periods pēc pēdējās fiksētās eļļas maiņas līdz pēdējam dīlera ierakstam (S4 (4)), ne intervāls
   * starp maiņām. Skaitļi deterministiskajam pārsnieguma teikumam (Nils 27.11).
   */
  afterLastChange?: OilAfterLastChangeSpan;
};

export type OilAfterLastChangeSpan = {
  fromKm: number | null;
  toKm: number | null;
  /** Nobraukts kopš pēdējās maiņas (km). */
  km: number | null;
  /** Pagājušie mēneši kopš pēdējās maiņas. */
  months: number | null;
};

function lvSingular(n: number): boolean {
  return n % 10 === 1 && n % 100 !== 11;
}

function ruForm(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function formatKmInt(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatNoteDate(d: string): string {
  const t = (d ?? "").trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  return iso ? `${iso[3]}.${iso[2]}.${iso[1]}` : t;
}

/**
 * Pārsnieguma teikums periodam pēc pēdējās fiksētās eļļas maiņas (Nils 27.11): AI raksta «visi
 * intervāli iekļaujas» (tas attiecas uz intervāliem starp maiņām), bet pārsniegts ir periods pēc
 * pēdējās maiņas - to nosauc skaidri, pirms piebildēm. Skaitļi no datiem.
 */
export function oilAfterLastChangeNote(
  lang: OilNoteLang,
  iv: Pick<OilExceededInterval, "fromDate" | "toDate" | "afterLastChange">,
): string | null {
  const span = iv.afterLastChange;
  if (!span || !iv.fromDate || !iv.toDate) return null;
  const km = span.km != null && span.km > 0 ? span.km : null;
  const months = span.months != null && span.months > 0 ? span.months : null;
  if (km == null && months == null) return null;
  const unit = lang === "ru" ? "км" : "km";
  const at = (date: string, k: number | null) => `${formatNoteDate(date)}${k != null && k > 0 ? `, ${formatKmInt(k)} ${unit}` : ""}`;
  const from = at(iv.fromDate, span.fromKm);
  const to = at(iv.toDate, span.toKm);
  const kmS = km != null ? `${formatKmInt(km)} ${unit}` : "";
  switch (lang) {
    case "en": {
      const mS = months != null ? `${months} ${months === 1 ? "month" : "months"}` : "";
      const what = km != null && months != null ? `${kmS} were driven over ${mS}` : km != null ? `${kmS} were driven` : `${mS} passed`;
      return `Since the last recorded oil change (${from}) up to the last dealer record (${to}), ${what} - this exceeds the manufacturer interval.`;
    }
    case "ru": {
      const mS = months != null ? `${months} ${ruForm(months, "месяц", "месяца", "месяцев")}` : "";
      const what =
        km != null && months != null
          ? `пройдено ${kmS} за ${mS}`
          : km != null
            ? `пройдено ${kmS}`
            : `${ruForm(months!, "прошёл", "прошло", "прошло")} ${mS}`;
      return `С последней зафиксированной замены масла (${from}) до последней записи дилера (${to}) ${what} - это превышает интервал производителя.`;
    }
    case "de": {
      const mS = months != null ? `${months} ${months === 1 ? "Monat" : "Monaten"}` : "";
      const mNom = months != null ? `${months} ${months === 1 ? "Monat" : "Monate"}` : "";
      const what =
        km != null && months != null
          ? `wurden in ${mS} ${kmS} gefahren`
          : km != null
            ? `wurden ${kmS} gefahren`
            : `${months === 1 ? "ist" : "sind"} ${mNom} vergangen`;
      return `Seit dem letzten erfassten Ölwechsel (${from}) bis zum letzten Händlereintrag (${to}) ${what} - das überschreitet das Herstellerintervall.`;
    }
    default: {
      const mS = months != null ? (lvSingular(months) ? `pagājis ${months} mēnesis` : `pagājuši ${months} mēneši`) : "";
      const kmPart = km != null ? `nobraukti ${kmS}` : "";
      const what = [kmPart, mS].filter(Boolean).join(" un ");
      return `Kopš pēdējās fiksētās eļļas maiņas (${from}) līdz pēdējam dīlera ierakstam (${to}) ${what} - tas pārsniedz ražotāja intervālu.`;
    }
  }
}

/** Mūsu pārsnieguma teikuma sākums (4 valodas) - atpazīšanai un izņemšanai pirms atkārtotas ievietošanas. */
const AFTER_LAST_CHANGE_SENTENCE_RE =
  /(?:Kopš\s+pēdējās\s+fiksētās\s+eļļas\s+maiņas|Since\s+the\s+last\s+recorded\s+oil\s+change|С\s+последней\s+зафиксированной\s+замены\s+масла|Seit\s+dem\s+letzten\s+erfassten\s+Ölwechsel)\s*\(/giu;

export function oilAfterLastChangeNotePresent(text: string): boolean {
  return new RegExp(AFTER_LAST_CHANGE_SENTENCE_RE.source, "iu").test(plainForCheck(text));
}

/**
 * 3. piebilde (Nils 27.11, S8: «fiksējam, bet kā pilnībā nepierādītu»): pārsniegtajā periodā ir eļļas
 * filtra korpusa maiņa bez skaidras eļļas maiņas. VIENS teikums visiem periodiem kopā.
 */
export function oilPossibleChangeNote(lang: OilNoteLang, dates: readonly string[], periodCount = 1): string {
  const n = dates.length;
  // Datumi iekavās, ja to ir maz; citādi skaits ar vārdu («5 eļļas filtra korpusa maiņas»), ne «(5)» (Nils 27.11).
  const listed = n <= OIL_GENERIC_DATES_MAX;
  const dl = listed ? ` (${dates.join(", ")})` : "";
  const many = periodCount > 1;
  switch (lang) {
    case "en": {
      const one = n === 1;
      const noun = one ? "an oil filter housing replacement" : listed ? "oil filter housing replacements" : `${n} oil filter housing replacements`;
      return `${many ? "In these periods" : "In this period"} there ${one ? "is" : "are"} also ${noun}${dl} - an oil change may also have been done, but this is not proven.`;
    }
    case "ru": {
      const noun = listed
        ? n === 1 ? "замена корпуса масляного фильтра" : "замены корпуса масляного фильтра"
        : `${n} ${ruForm(n, "замена", "замены", "замен")} корпуса масляного фильтра`;
      return `${many ? "В эти периоды" : "В этот период"} есть также ${noun}${dl} - возможно, было заменено и масло, но это не доказано.`;
    }
    case "de": {
      const noun = listed
        ? n === 1 ? "einen Austausch des Ölfiltergehäuses" : "Austausche des Ölfiltergehäuses"
        : `${n} Austausche des Ölfiltergehäuses`;
      return `${many ? "In diesen Zeiträumen" : "In diesem Zeitraum"} gibt es auch ${noun}${dl} - möglicherweise wurde auch ein Ölwechsel durchgeführt, das ist aber nicht belegt.`;
    }
    default: {
      const one = listed ? n === 1 : lvSingular(n);
      const noun = `${listed ? "" : `${n} `}${one ? "eļļas filtra korpusa maiņa" : "eļļas filtra korpusa maiņas"}`;
      return `${many ? "Šajos periodos" : "Šajā periodā"} ir arī ${noun}${dl} - iespējams, veikta arī eļļas maiņa, bet tas nav pierādīts.`;
    }
  }
}

/**
 * 2. piebilde: VIENS teikums visiem pārsniegtajiem periodiem kopā (Nils 26.11, #1291).
 * 27.11 (Nils): bezpersoniski, bez «mēs» («…taču ierakstos tas nav apstiprināts»). Vecais formulējums
 * («bet to nevaram apliecināt») tiek atpazīts pēc «bez detalizēta darbu apraksta» un aizstāts.
 * `periodCount` - cik pārsniegto periodu ir ar šādiem ierakstiem (1 -> «Šajā periodā»).
 */
export function oilGenericRecordsNote(lang: OilNoteLang, dates: readonly string[], periodCount = 1): string {
  const n = dates.length;
  // Datumi iekavās, ja to ir maz; citādi skaits ar vārdu («13 dīlera ieraksti»), ne «(13)» (Nils 27.11).
  const listed = n <= OIL_GENERIC_DATES_MAX;
  const dl = listed ? ` (${dates.join(", ")})` : "";
  const num = listed ? "" : `${n} `;
  const many = periodCount > 1;
  switch (lang) {
    case "en": {
      const one = n === 1;
      return `${many ? "In these periods" : "In this period"} there ${one ? "is also a dealer record" : `are also ${num}dealer records`} without a detailed description of work${dl} - ${one ? "it" : "they"} may theoretically indicate an oil change, but ${one ? "the record does" : "the records do"} not confirm it.`;
    }
    case "ru": {
      const one = listed ? n === 1 : ruForm(n, "1", "2", "5") === "1";
      const noun = listed ? (one ? "запись дилера" : "записи дилера") : `${n} ${ruForm(n, "запись", "записи", "записей")} дилера`;
      return `${many ? "В эти периоды" : "В этот период"} есть также ${noun} без подробного описания работ${dl} - теоретически ${one ? "она может" : "они могут"} свидетельствовать о замене масла, однако ${one ? "в записи" : "в записях"} это не подтверждено.`;
    }
    case "de": {
      const one = n === 1;
      return `${many ? "In diesen Zeiträumen" : "In diesem Zeitraum"} gibt es auch ${one ? "einen Händlereintrag" : `${num}Händlereinträge`} ohne detaillierte Arbeitsbeschreibung${dl} - theoretisch ${one ? "kann er" : "können sie"} auf einen Ölwechsel hindeuten, ${one ? "der Eintrag bestätigt" : "die Einträge bestätigen"} das jedoch nicht.`;
    }
    default: {
      const one = listed ? n === 1 : lvSingular(n);
      return `${many ? "Šajos periodos" : "Šajā periodā"} ir arī ${num}${one ? "dīlera ieraksts" : "dīlera ieraksti"} bez detalizēta darbu apraksta${dl} - ${one ? "tas" : "tie"} teorētiski var liecināt par eļļas maiņu, taču ${one ? "ierakstā" : "ierakstos"} tas nav apstiprināts.`;
    }
  }
}

/**
 * Vispārīgs dīlera ieraksts bez darbu saraksta: tikai vārdi „apkope / serviss / apmeklējums”
 * (un to EN/DE/RU atbilsmes), bez detaļām. Eļļas maiņa (arī Mercedes „Apkope A/B”) šeit neietilpst.
 */
const GENERIC_RECORD_WORDS = new Set([
  "apkope", "apkopes", "apkopi", "serviss", "servisa", "servisu", "apmeklejums", "apmeklejuma",
  "vizite", "ieraksts", "tehniska", "tehniskā", "karteja", "planota", "periodiska", "regulara",
  "darbi", "veikta", "veikti",
  // BF 27.11 (S4 (3)): plānotās apkopes veids bez detaļām («SERVICE MAJOR» -> «Lielā apkope»).
  "liela", "lielā", "maza", "mazā", "starpposma", "pilna", "pamata", "ikgadeja", "gada",
  "major", "minor", "intermediate", "interim", "full", "basic", "small", "big", "large", "annual",
  "grosse", "kleine", "jahres", "zwischen",
  "большое", "малое", "полное", "промежуточное",
  "service", "servicing", "maintenance", "visit", "workshop", "inspection", "routine", "regular",
  "scheduled", "periodic", "general", "check", "work", "done",
  "wartung", "inspektion", "werkstattbesuch", "besuch", "kundendienst", "durchgefuhrt",
  "обслуживание", "техобслуживание", "техническое", "то", "визит", "сервис", "плановое", "посещение",
]);

export function isGenericDealerRecordWork(works: string): boolean {
  const raw = (works ?? "").trim();
  if (!raw) return false;
  if (isEngineOilChangeWork(raw)) return false;
  const folded = foldOilWorkText(raw)
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!folded) return false;
  const words = folded.split(" ");
  if (words.length > 4) return false;
  return words.every((w) => GENERIC_RECORD_WORDS.has(w));
}

function pointOverOem(p: OilChangeIntervalPoint): boolean {
  if (p.kind === "gap") return true;
  return p.kind === "observed" && (p.tone === "stretch" || p.periodTone === "stretch");
}

/**
 * Pārsniegtie intervāli (dīlera solis > OEM km vai mēneši, vai datu iztrūkums) ar vispārīgajiem
 * ierakstiem, kas ir STARP abām eļļas maiņām. `series` jābūt bez `highlightOverOem` izslēgšanas.
 */
export function findExceededOilIntervals(
  series: OilChangeIntervalSeries,
  sourceRows: readonly AutoRecordsServiceWorkRow[],
): OilExceededInterval[] {
  const generic = (sourceRows ?? [])
    .map(normalizeAutoRecordsServiceWorkRow)
    .filter((r) => autoRecordsServiceWorkRowIsPrintable(r) && isGenericDealerRecordWork(r.works))
    .map((r) => ({ date: r.date.trim(), ms: parseDotOrIsoDateToMs(r.date) || 0 }))
    .filter((r) => r.ms > 0)
    .sort((a, b) => a.ms - b.ms);
  const out: OilExceededInterval[] = [];
  for (let i = 1; i < series.points.length; i++) {
    const p = series.points[i]!;
    if (!pointOverOem(p)) continue;
    const prev = series.points[i - 1]!;
    const fromMs = parseDotOrIsoDateToMs(prev.date) || 0;
    const toMs = parseDotOrIsoDateToMs(p.date) || 0;
    const seen = new Set<string>();
    const genericDates: string[] = [];
    if (fromMs && toMs) {
      for (const g of generic) {
        if (g.ms <= fromMs || g.ms >= toMs || seen.has(g.date)) continue;
        seen.add(g.date);
        genericDates.push(g.date);
      }
    }
    out.push({ fromDate: prev.date, toDate: p.date, genericDates });
  }
  return out;
}

/** Jau ir 1. piebilde (jebkurā no 4 valodām, arī AI vai operatora formulējumā). */
const NOT_SKIPPED_PRESENT_RE = [
  /(?:nenozīmē|nenozime|nepierāda|ne(?:\s+ir)?\s+pierādījums|nav\s+pierādījums)[^.!?]{0,140}?(?:eļļ|apkop)[^.!?]{0,80}?(?:nav\s|netika|netiek|izlaist|nav$)/iu,
  /(?:does\s+not\s+mean|doesn['’]t\s+mean|is\s+not\s+proof|does\s+not\s+prove|no\s+proof)[^.!?]{0,140}?(?:oil|service)[^.!?]{0,80}?(?:not|skipped|missed|wasn)/iu,
  /(?:не\s+означает|не\s+доказывает|не\s+является\s+доказательством)[^.!?]{0,140}?(?:масл|обслуж|замен)/iu,
  /(?:bedeutet\s+nicht|beweist\s+nicht|kein\s+Beweis)[^.!?]{0,140}?(?:Öl|Wartung|Service|Inspektion)/iu,
];
/** Tajā pašā teikumā jābūt arī neatkarīgajam servisam - citādi piebilde nav pilna (Nils 26.11). */
const INDEPENDENT_SERVICE_RE =
  /neatkarīg|citā\s+servis|cit(?:ur|os)\s+servis|ārpus\s+(?:oficiālā\s+)?dīler|independent|elsewhere|outside\s+(?:the\s+)?(?:official\s+)?dealer|независим|друг(?:ом|ой)\s+(?:сервис|мастерск)|вне\s+дилер|freien\s+Werkstatt|unabhängig|anderswo|außerhalb/iu;

const GENERIC_PRESENT_RE =
  /bez\s+detalizēt\p{L}*\s+darb\p{L}*\s+aprakst\p{L}*|without\s+(?:a\s+)?detailed\s+(?:description\s+of\s+work|work\s+description)|без\s+(?:подробного|детального)\s+описания\s+работ|ohne\s+(?:detaillierte|genaue)\s+Arbeitsbeschreibung/iu;

function plainForCheck(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

export function oilNotSkippedNotePresent(text: string): boolean {
  const plain = plainForCheck(text);
  return NOT_SKIPPED_PRESENT_RE.some((re) => {
    const m = new RegExp(re.source, "giu");
    for (const hit of plain.matchAll(m)) {
      const from = Math.max(plain.lastIndexOf(". ", hit.index ?? 0), plain.lastIndexOf("\n", hit.index ?? 0), 0);
      const endDot = plain.slice((hit.index ?? 0) + hit[0].length).search(/[.!?](?=\s|$)/u);
      const to = endDot < 0 ? plain.length : (hit.index ?? 0) + hit[0].length + endDot;
      if (INDEPENDENT_SERVICE_RE.test(plain.slice(from, to + 1))) return true;
    }
    return false;
  });
}

export function oilGenericRecordsNotePresent(text: string): boolean {
  return GENERIC_PRESENT_RE.test(plainForCheck(text));
}

/** 3. piebilde (jebkurā valodā): eļļas filtra korpuss + «nav pierādīts». */
const POSSIBLE_PRESENT_RE =
  /eļļas\s+filtra\s+korpus\p{L}*(?:[^.!?]|[.!?](?!\s)){0,120}?nav\s+pierādīt\p{L}*|oil\s+filter\s+housing(?:[^.!?]|[.!?](?!\s)){0,120}?not\s+proven|корпус\p{L}*\s+масляного\s+фильтра(?:[^.!?]|[.!?](?!\s)){0,120}?не\s+доказано|Ölfiltergehäuse\p{L}*(?:[^.!?]|[.!?](?!\s)){0,120}?nicht\s+belegt/iu;

export function oilPossibleChangeNotePresent(text: string): boolean {
  return POSSIBLE_PRESENT_RE.test(plainForCheck(text));
}

/** Apgalvojošs pārsnieguma vārds (ne «ne-pārsniedz»): LV / EN / RU / DE. */
const EXCEED_CLAIM_RE =
  /(?<![\p{L}])(?:pārsniedz\p{L}*|pārsniedza|pārsniegt\p{L}*|pārsniegum\p{L}*|exceed(?:s|ed|ing)?|превыша\p{L}*|превысил\p{L}*|überschreit\p{L}*|überschritt\p{L}*)(?![\p{L}])/giu;
/** Noliegums tieši pirms (līdz 3 vārdiem) vai «… nav» tieši pēc. */
const EXCEED_NEG_BEFORE_RE =
  /(?:^|[^\p{L}])(?:nav|netika|netiek|nebija|neviens|nevienā|nevienu|nekad|bez|not|never|no|none|without|doesn['’]t|didn['’]t|isn['’]t|wasn['’]t|не|нет|ни|nicht|kein\p{L}*|nie)(?:\s+\p{L}+){0,3}\s*$/iu;
const EXCEED_NEG_AFTER_RE = /^\s*(?:\p{L}+\s+){0,1}(?:nav|nebija|netika|nav\s+fiksēt\p{L}*)(?![\p{L}])/iu;

/**
 * Vai komentārs apgalvo, ka kāds intervāls pārsniedz ražotāja intervālu (BF 27.11, S4 (1)).
 * Noliegumi («nepārsniedz», «nav pārsniegts», «does not exceed», «pārsniegumu nav») - nē.
 */
export function oilTextClaimsExceeded(text: string): boolean {
  const plain = plainForCheck(text ?? "").replace(/&nbsp;/g, " ");
  for (const sentence of plain.split(/(?<=[.!?])\s+|\n+/u)) {
    for (const m of sentence.matchAll(new RegExp(EXCEED_CLAIM_RE.source, "giu"))) {
      const at = m.index ?? 0;
      if (EXCEED_NEG_BEFORE_RE.test(sentence.slice(0, at))) continue;
      if (EXCEED_NEG_AFTER_RE.test(sentence.slice(at + m[0].length))) continue;
      return true;
    }
  }
  return false;
}

/** Rindkopa, kas runā par pārsniegumu (ņem pēdējo). */
const EXCEED_RE =
  /pārsniedz|pārsniegum|pārsniegt|garāks\s+par\s+ražotāja|virs\s+(?:ražotāja\s+)?intervāla|datu\s+iztrūkum|exceed|longer\s+than\s+the\s+manufacturer|above\s+the\s+(?:manufacturer\s+)?interval|data\s+gap|превыша|дольше|пробел\s+в\s+данных|überschreit|überschritt|länger\s+als|Datenlücke/iu;

const REGULARITY_HEADING_RE =
  /eļļas\s+maiņu\s+regularitāte|oil\s+change\s+regularity|регулярность\s+замены\s+масла|regelmäßigkeit\s+der\s+ölwechsel/iu;

/** Rindkopu atdalītājs: tukša rinda, `<br><br>`, `</p>`. */
const PARA_BREAK_RE = /(?:\s|&nbsp;)*(?:\n[ \t]*\n|<br\s*\/?>(?:\s|&nbsp;)*<br\s*\/?>|<\/p>)/giu;

function paragraphEndAfter(text: string, from: number): number {
  PARA_BREAK_RE.lastIndex = from;
  const m = PARA_BREAK_RE.exec(text);
  return m ? m.index : text.length;
}

function trimInsertPoint(text: string, at: number): number {
  let i = at;
  for (;;) {
    const before = text.slice(0, i);
    const m = /(?:\s|&nbsp;)+$/u.exec(before);
    if (!m || m[0].length === 0) return i;
    i -= m[0].length;
  }
}

function escapeHtmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Valoda no paša teksta (ja izsaucējs to nezina, piem. „source” valoda). */
export function detectOilNoteLang(text: string): OilNoteLang {
  const plain = plainForCheck(text);
  if (/[а-яё]/iu.test(plain)) return "ru";
  if (/[āčēģīķļņšūž]/iu.test(plain)) return "lv";
  if (/[äöüß]|\b(?:und|der|die|das|nicht|Ölwechsel|Herstellerintervall)\b/u.test(plain)) return "de";
  return "en";
}

/** Teikuma beigas: punkts, aiz kura atstarpe / rindas beigas / HTML (ne datums „02.02.2011”). */
const SENTENCE_END_RE = /[.!?](?=\s|$|<|&nbsp;)/gu;
/** Teikuma sākums pirms indeksa: iepriekšējā teikuma beigas, `<br>`, `<p>`, jauna rinda vai sākums. */
function sentenceStartBefore(text: string, at: number): number {
  const head = text.slice(0, at);
  let start = 0;
  for (const m of head.matchAll(/[.!?](?:\s|&nbsp;)+|<br\s*\/?>|<p[^>]*>|<\/strong>|\n/giu)) {
    start = (m.index ?? 0) + m[0].length;
  }
  return start;
}

function sentenceEndAfter(text: string, at: number): number {
  SENTENCE_END_RE.lastIndex = at;
  const m = SENTENCE_END_RE.exec(text);
  return m ? m.index + 1 : text.length;
}

/** Atsevišķs 1. piebildes teikums (kanoniskais, vecais vai tulkots) - sākas ar piebildes frāzi. */
const NOT_SKIPPED_SENTENCE_START_RE =
  /(?:Tas\s+nenozīmē|Tas\s+nepierāda|This\s+does\s+not\s+mean|This\s+doesn['’]t\s+mean|Это\s+не\s+означает|Das\s+bedeutet\s+nicht|Dies\s+bedeutet\s+nicht)\b/giu;

/**
 * Izņem jau ievietotās piebildes (abos formulējumos, arī tulkotas un atkārtotas pie katra perioda),
 * lai tās ieliktu no jauna VIENREIZ. Paša AI teikuma daļu („…, bet nenozīmē, ka…”) neaiztiek.
 */
export function stripInsertedOilNotes(text: string): string {
  let out = text;
  for (const exact of [...Object.values(OIL_NOT_SKIPPED_NOTE), ...OIL_NOT_SKIPPED_NOTE_V1]) {
    out = out.split(exact).join("");
  }
  const cut = (re: RegExp, fromMarker: boolean) => {
    for (let guard = 0; guard < 50; guard++) {
      re.lastIndex = 0;
      const m = re.exec(out);
      if (!m) return;
      const start = fromMarker ? sentenceStartBefore(out, m.index) : m.index;
      if (!fromMarker && start !== sentenceStartBefore(out, m.index)) {
        // Frāze ir teikuma vidū - tā ir paša teksta daļa, ne piebilde.
        return;
      }
      const end = sentenceEndAfter(out, m.index + m[0].length);
      out = out.slice(0, start) + out.slice(end);
    }
  };
  cut(new RegExp(GENERIC_PRESENT_RE.source, "iu"), true);
  cut(new RegExp(POSSIBLE_PRESENT_RE.source, "iu"), true);
  cut(NOT_SKIPPED_SENTENCE_START_RE, false);
  cut(new RegExp(AFTER_LAST_CHANGE_SENTENCE_RE.source, "giu"), false);
  return out
    .replace(/[ \t]{2,}/g, " ")
    .replace(/(?:&nbsp;|[ \t])+(<br\s*\/?>)/gi, "$1")
    .replace(/(?:<br\s*\/?>(?:\s|&nbsp;)*){3,}/gi, "<br><br>")
    .replace(/\n[ \t]*(?:\n[ \t]*){2,}/g, "\n\n")
    .replace(/(?:\s|&nbsp;|<br\s*\/?>)+$/gi, "");
}

/** Vai EXCEED_RE atradums ir apgalvojums (ne «nepārsniedz», «nav pārsniegts», «does not exceed»). */
function exceedHitIsAffirmative(text: string, at: number, len: number): boolean {
  if (at > 0 && /\p{L}/u.test(text[at - 1]!)) return false; // «ne|pārsniedz», «über…» vārda vidū
  const sStart = sentenceStartBefore(text, at);
  const prefix = plainForCheck(text.slice(sStart, at));
  if (EXCEED_NEG_BEFORE_RE.test(prefix)) return false;
  const after = plainForCheck(text.slice(at + len, sentenceEndAfter(text, at + len)));
  return !EXCEED_NEG_AFTER_RE.test(after);
}

/** Pēdējā APGALVOJOŠĀ pārsnieguma vārda pozīcija (vai -1). Noliegumi enkuru nedod (Nils 27.11). */
function lastAffirmativeExceedAt(text: string, from = 0): number {
  let at = -1;
  for (const m of text.matchAll(new RegExp(EXCEED_RE.source, "giu"))) {
    const i = m.index ?? 0;
    if (i < from) continue;
    if (exceedHitIsAffirmative(text, i, m[0].length)) at = i;
  }
  return at;
}

/** Rindkopa / virsraksts par pēdējo ierakstu vai pēdējo eļļas maiņu (4 valodas). */
const LAST_RECORD_RE =
  /(?:pēdēj\p{L}*|last|latest|последн\p{L}*|letzte\p{L}*)\s+(?:\p{L}+\s+){0,2}?(?:ieraksts|ieraksta|ierakstam|eļļas\s+maiņa|entry|record|oil\s+change|запись|записи|замена\s+масла|eintrag|ölwechsel)/giu;
/** Teikums tieši par periodu pēc pēdējās maiņas. */
const SINCE_LAST_RE =
  /kopš\s+pēdēj|pēc\s+pēdēj|since\s+the\s+last|after\s+the\s+last|с\s+(?:момента\s+)?последн|после\s+последн|seit\s+dem\s+letzten|nach\s+dem\s+letzten/iu;

/** Rindkopu sākumi (0 un katra atdalītāja beigas). */
function paragraphStarts(text: string): number[] {
  const out = [0];
  for (const m of text.matchAll(new RegExp(PARA_BREAK_RE.source, "giu"))) out.push((m.index ?? 0) + m[0].length);
  return out;
}

function paragraphStartBefore(text: string, at: number): number {
  let start = 0;
  for (const p of paragraphStarts(text)) if (p <= at) start = p;
  return start;
}

/**
 * Periods pēc pēdējās maiņas: (a) kur teksts to jau nosauc kā pārsniegumu (pozīcija), (b) rindkopa
 * par pēdējo ierakstu (pēdējā tāda), citādi pēdējā rindkopa.
 */
function locateAfterLastChange(text: string): { namedAt: number; paragraphAt: number } {
  let lastRecordAt = -1;
  for (const m of text.matchAll(new RegExp(LAST_RECORD_RE.source, "giu"))) lastRecordAt = m.index ?? lastRecordAt;
  const paragraphAt = lastRecordAt >= 0 ? paragraphStartBefore(text, lastRecordAt) : paragraphStartBefore(text, Math.max(0, text.length - 1));
  let namedAt = -1;
  for (const m of text.matchAll(new RegExp(EXCEED_RE.source, "giu"))) {
    const i = m.index ?? 0;
    if (!exceedHitIsAffirmative(text, i, m[0].length)) continue;
    const sentence = text.slice(sentenceStartBefore(text, i), sentenceEndAfter(text, i + m[0].length));
    if (i >= paragraphAt || SINCE_LAST_RE.test(plainForCheck(sentence))) namedAt = i;
  }
  return { namedAt, paragraphAt };
}

/**
 * Pievieno piebildes eļļas komentāram: VIENREIZ, atsevišķā rindkopā tieši pēc (pēdējās) rindkopas
 * par pārsniegumu, vai sadaļas „Eļļas maiņu regularitāte” beigās. Nemaina tekstu, ja pārsniegumu nav.
 * Strādā gan ar HTML (`<br><br>`), gan ar vienkāršu tekstu (tukša rinda).
 *
 * Nils 27.11: enkurs ir tikai APGALVOTS pārsniegums («neviens nepārsniedz» nav enkurs). Ja pārsniegts
 * ir periods pēc pēdējās eļļas maiņas, piebildes iet pēc rindkopas par pēdējo ierakstu; ja teksts šo
 * periodu kā pārsniegumu nenosauc, pirms piebildēm nāk deterministisks teikums ar skaitļiem
 * («Kopš pēdējās fiksētās eļļas maiņas (…) līdz pēdējam dīlera ierakstam (…) nobraukti … - tas
 * pārsniedz ražotāja intervālu.»), lai «Šajā periodā» attiektos uz konkrētu periodu.
 */
export function ensureOilIntervalNotes(
  text: string,
  intervals: readonly OilExceededInterval[],
  lang: OilNoteLang,
): string {
  const original = text ?? "";
  if (!original.trim() || intervals.length === 0) return original;
  const src = stripInsertedOilNotes(original);
  const sentences: string[] = [];

  const tail = intervals.find((iv) => iv.afterLastChange);
  const tailLoc = tail ? locateAfterLastChange(src) : null;
  if (tail && tailLoc && tailLoc.namedAt < 0) {
    const s = oilAfterLastChangeNote(lang, tail);
    if (s) sentences.push(s);
  }

  if (!oilNotSkippedNotePresent(src)) sentences.push(OIL_NOT_SKIPPED_NOTE[lang]);
  const withGeneric = intervals.filter((iv) => iv.genericDates.length > 0);
  if (withGeneric.length > 0 && !oilGenericRecordsNotePresent(src)) {
    const dates = [...new Set(withGeneric.flatMap((iv) => iv.genericDates))];
    sentences.push(oilGenericRecordsNote(lang, dates, withGeneric.length));
  }
  const withPossible = intervals.filter((iv) => (iv.possibleDates?.length ?? 0) > 0);
  if (withPossible.length > 0 && !oilPossibleChangeNotePresent(src)) {
    const dates = [...new Set(withPossible.flatMap((iv) => iv.possibleDates ?? []))];
    sentences.push(oilPossibleChangeNote(lang, dates, withPossible.length));
  }
  if (sentences.length === 0) {
    const norm = (t: string) => t.replace(/\s|&nbsp;|<br\s*\/?>/gi, "");
    return norm(src) === norm(original) ? original : src;
  }

  const isHtml = /<br\s*\/?>|<\/?(?:p|strong|b|div)\b/i.test(src);
  const addition = isHtml ? escapeHtmlText(sentences.join(" ")) : sentences.join(" ");
  const sep = isHtml ? "<br><br>" : "\n\n";

  let anchor = lastAffirmativeExceedAt(src);
  if (tailLoc) {
    // Pārsniegtais periods ir pēdējais hronoloģiski - piebildes pēc tā rindkopas (vai pēc vēlāka apgalvojuma).
    const tailAnchor = tailLoc.namedAt >= 0 ? tailLoc.namedAt : tailLoc.paragraphAt;
    anchor = Math.max(anchor, tailAnchor);
  }
  if (anchor < 0) {
    const heading = REGULARITY_HEADING_RE.exec(src);
    if (heading) anchor = heading.index + heading[0].length;
  }
  if (anchor < 0) return `${src}${sep}${addition}`;
  const end = trimInsertPoint(src, paragraphEndAfter(src, anchor));
  const rest = src.slice(end).replace(/^(?:\s|&nbsp;)*(?:<br\s*\/?>(?:\s|&nbsp;)*){1,2}|^\s*\n\s*\n?/i, "");
  return rest.trim() ? `${src.slice(0, end)}${sep}${addition}${sep}${rest}` : `${src.slice(0, end)}${sep}${addition}`;
}

/** LV «solis» locījumi -> «intervāls» tajā pašā locījumā (abi vīriešu dzimtē, saskaņojums nemainās). */
const LV_STEP_TO_INTERVAL: Record<string, string> = {
  solis: "intervāls",
  soļa: "intervāla",
  solim: "intervālam",
  soli: "intervālu",
  solī: "intervālā",
  soļi: "intervāli",
  soļu: "intervālu",
  soļiem: "intervāliem",
  soļus: "intervālus",
  soļos: "intervālos",
};

const LV_STEP_RE = /(?<!\p{L})(?:(nobraukuma|Nobraukuma)\s+)?(solis|soļa|solim|soli|solī|soļi|soļu|soļiem|soļus|soļos|Solis|Soļa|Solim|Soli|Solī|Soļi|Soļu|Soļiem|Soļus|Soļos)(?!\p{L})/gu;

/**
 * Nils 26.11 (#1291): eļļas tekstos «solis / soļi / soļu diapazons / nobraukuma solis» neizklausās labi -
 * vienmēr «intervāls / intervāli (starp eļļas maiņām)». Deterministisks labojums AI un rediģētam tekstam.
 */
export function replaceOilStepWordingLv(text: string): string {
  return (text ?? "").replace(LV_STEP_RE, (_m, prefix: string | undefined, word: string) => {
    const lower = word.toLowerCase();
    const repl = LV_STEP_TO_INTERVAL[lower] ?? word;
    const capital = (prefix ? prefix[0] === "N" : word[0] !== lower[0]);
    return capital ? repl[0]!.toUpperCase() + repl.slice(1) : repl;
  });
}
