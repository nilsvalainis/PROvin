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
};

/**
 * 3. piebilde (Nils 27.11, S8: «fiksējam, bet kā pilnībā nepierādītu»): pārsniegtajā periodā ir eļļas
 * filtra korpusa maiņa bez skaidras eļļas maiņas. VIENS teikums visiem periodiem kopā.
 */
export function oilPossibleChangeNote(lang: OilNoteLang, dates: readonly string[], periodCount = 1): string {
  const n = dates.length;
  const label = n <= OIL_GENERIC_DATES_MAX ? dates.join(", ") : String(n);
  const many = periodCount > 1;
  const one = n === 1;
  switch (lang) {
    case "en":
      return `${many ? "In these periods" : "In this period"} there ${one ? "is also an oil filter housing replacement" : "are also oil filter housing replacements"} (${label}) - an oil change may also have been done, but this is not proven.`;
    case "ru":
      return `${many ? "В эти периоды" : "В этот период"} есть также ${one ? "замена корпуса масляного фильтра" : "замены корпуса масляного фильтра"} (${label}) - возможно, было заменено и масло, но это не доказано.`;
    case "de":
      return `${many ? "In diesen Zeiträumen" : "In diesem Zeitraum"} gibt es auch ${one ? "einen Austausch des Ölfiltergehäuses" : "Austausche des Ölfiltergehäuses"} (${label}) - möglicherweise wurde auch ein Ölwechsel durchgeführt, das ist aber nicht belegt.`;
    default:
      return `${many ? "Šajos periodos" : "Šajā periodā"} ir arī ${one ? "eļļas filtra korpusa maiņa" : "eļļas filtra korpusa maiņas"} (${label}) - iespējams, veikta arī eļļas maiņa, bet tas nav pierādīts.`;
  }
}

/**
 * 2. piebilde: VIENS teikums visiem pārsniegtajiem periodiem kopā (Nils 26.11, #1291).
 * `periodCount` - cik pārsniegto periodu ir ar šādiem ierakstiem (1 -> «Šajā periodā»).
 */
export function oilGenericRecordsNote(lang: OilNoteLang, dates: readonly string[], periodCount = 1): string {
  const n = dates.length;
  const label = n <= OIL_GENERIC_DATES_MAX ? dates.join(", ") : String(n);
  const many = periodCount > 1;
  const one = n === 1;
  switch (lang) {
    case "en":
      return `${many ? "In these periods" : "In this period"} there ${one ? "is also a dealer record" : "are also dealer records"} without a detailed description of work (${label}) - in theory ${one ? "it" : "they"} could indicate an oil change, but we cannot confirm this.`;
    case "ru":
      return `${many ? "В эти периоды" : "В этот период"} есть также ${one ? "запись дилера" : "записи дилера"} без подробного описания работ (${label}) - теоретически ${one ? "она может" : "они могут"} свидетельствовать о замене масла, но подтвердить это мы не можем.`;
    case "de":
      return `${many ? "In diesen Zeiträumen" : "In diesem Zeitraum"} gibt es auch ${one ? "einen Händlereintrag" : "Händlereinträge"} ohne detaillierte Arbeitsbeschreibung (${label}) - theoretisch ${one ? "kann er" : "können sie"} auf einen Ölwechsel hindeuten, das können wir aber nicht bestätigen.`;
    default:
      return `${many ? "Šajos periodos" : "Šajā periodā"} ir arī ${one ? "dīlera ieraksts" : "dīlera ieraksti"} bez detalizēta darbu apraksta (${label}) - ${one ? "tas" : "tie"} teorētiski var liecināt par eļļas maiņu, bet to nevaram apliecināt.`;
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
  return out
    .replace(/[ \t]{2,}/g, " ")
    .replace(/(?:&nbsp;|[ \t])+(<br\s*\/?>)/gi, "$1")
    .replace(/(?:<br\s*\/?>(?:\s|&nbsp;)*){3,}/gi, "<br><br>")
    .replace(/\n[ \t]*(?:\n[ \t]*){2,}/g, "\n\n")
    .replace(/(?:\s|&nbsp;|<br\s*\/?>)+$/gi, "");
}

/**
 * Pievieno piebildes eļļas komentāram: VIENREIZ, atsevišķā rindkopā tieši pēc (pēdējās) rindkopas
 * par pārsniegumu, vai sadaļas „Eļļas maiņu regularitāte” beigās. Nemaina tekstu, ja pārsniegumu nav.
 * Strādā gan ar HTML (`<br><br>`), gan ar vienkāršu tekstu (tukša rinda).
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

  let anchor = -1;
  for (const m of src.matchAll(new RegExp(EXCEED_RE.source, "giu"))) anchor = m.index ?? anchor;
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
