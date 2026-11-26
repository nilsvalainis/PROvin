/**
 * Eļļas intervālu komentāra deterministiskās piebildes (Nils 26.11.2026).
 *
 * 1. Ja kāds dīlera solis starp eļļas maiņām pārsniedz ražotāja intervālu (km vai mēneši, arī
 *    „Datu iztrūkums”), komentārā VIENMĒR jābūt teikumam, ka tas nenozīmē, ka eļļas maiņa nav
 *    veikta - tā var būt veikta neatkarīgā servisā.
 * 2. Ja pārsniegtajā periodā ir dīlera ieraksti bez detalizēta darbu apraksta („Apkope”, „Serviss”,
 *    „Apmeklējums”), pievieno teikumu, ka uz eļļas maiņu teorētiski var norādīt kāds no tiem.
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
  lv: "Tas nenozīmē, ka eļļas maiņa nav veikta - tā var būt veikta neatkarīgā servisā, kas datus dīlera sistēmai nenodod.",
  en: "This does not mean the oil change was not done - it may have been done at an independent workshop that does not pass data to the dealer system.",
  ru: "Это не означает, что замена масла не проводилась - она могла быть выполнена в независимом сервисе, который не передаёт данные в дилерскую систему.",
  de: "Das bedeutet nicht, dass kein Ölwechsel durchgeführt wurde - er kann in einer freien Werkstatt erfolgt sein, die keine Daten an das Händlersystem übermittelt.",
};

/** Datumus rādām tikai, ja to ir maz (teikums paliek īss). */
export const OIL_GENERIC_DATES_MAX = 4;

export type OilExceededInterval = {
  fromDate: string;
  toDate: string;
  /** Dīlera ieraksti bez darbu apraksta šajā periodā (datumi, hronoloģiski). */
  genericDates: string[];
};

function genericCountLabel(n: number, dates: string[]): string {
  return dates.length > 0 && dates.length <= OIL_GENERIC_DATES_MAX ? `${n}: ${dates.join(", ")}` : String(n);
}

/** 2. piebilde: viens teikums vienam periodam. `period` - ja pārsniegto periodu ir vairāki. */
export function oilGenericRecordsNote(
  lang: OilNoteLang,
  dates: string[],
  period?: { fromDate: string; toDate: string } | null,
): string {
  const n = dates.length;
  const label = genericCountLabel(n, dates);
  const range = period ? `${period.fromDate}-${period.toDate}` : "";
  switch (lang) {
    case "en": {
      const head = period ? `In the period ${range}` : "In this period";
      return n === 1
        ? `${head} there is also a dealer record without a detailed description of work (${label}) - in theory it could also indicate an oil change, but we cannot confirm it.`
        : `${head} there are also dealer records without a detailed description of work (${label}) - in theory one of them could also indicate an oil change, but we cannot confirm it.`;
    }
    case "ru": {
      const head = period ? `В период ${range}` : "В этот период";
      return n === 1
        ? `${head} есть также запись дилера без подробного описания работ (${label}) - теоретически она может указывать и на замену масла, но подтвердить это мы не можем.`
        : `${head} есть также записи дилера без подробного описания работ (${label}) - теоретически на замену масла может указывать и одна из них, но подтвердить это мы не можем.`;
    }
    case "de": {
      const head = period ? `Im Zeitraum ${range}` : "In diesem Zeitraum";
      return n === 1
        ? `${head} gibt es auch einen Händlereintrag ohne detaillierte Arbeitsbeschreibung (${label}) - theoretisch könnte auch er auf einen Ölwechsel hinweisen, das können wir aber nicht bestätigen.`
        : `${head} gibt es auch Händlereinträge ohne detaillierte Arbeitsbeschreibung (${label}) - theoretisch könnte auch einer davon auf einen Ölwechsel hinweisen, das können wir aber nicht bestätigen.`;
    }
    default: {
      const head = period ? `Periodā ${range}` : "Šajā periodā";
      return n === 1
        ? `${head} ir arī dīlera ieraksts bez detalizēta darbu apraksta (${label}) - uz eļļas maiņu teorētiski var norādīt arī tas, bet to nevaram apliecināt.`
        : `${head} ir arī dīlera ieraksti bez detalizēta darbu apraksta (${label}) - uz eļļas maiņu teorētiski var norādīt arī kāds no tiem, bet to nevaram apliecināt.`;
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

const GENERIC_PRESENT_RE =
  /bez\s+detalizēta\s+darbu\s+apraksta|without\s+a\s+detailed\s+description\s+of\s+work|без\s+подробного\s+описания\s+работ|ohne\s+detaillierte\s+Arbeitsbeschreibung/iu;

function plainForCheck(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

export function oilNotSkippedNotePresent(text: string): boolean {
  const plain = plainForCheck(text);
  return NOT_SKIPPED_PRESENT_RE.some((re) => re.test(plain));
}

export function oilGenericRecordsNotePresent(text: string): boolean {
  return GENERIC_PRESENT_RE.test(plainForCheck(text));
}

/** Rindkopa, kas runā par pārsniegumu (pirmā). */
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

/**
 * Pievieno trūkstošās piebildes eļļas komentāram. Nemaina tekstu, ja pārsniegumu nav
 * vai piebildes jau ir. Strādā gan ar HTML (`<br><br>`), gan ar vienkāršu tekstu (tukša rinda).
 */
export function ensureOilIntervalNotes(
  text: string,
  intervals: readonly OilExceededInterval[],
  lang: OilNoteLang,
): string {
  const src = text ?? "";
  if (!src.trim() || intervals.length === 0) return src;
  const sentences: string[] = [];
  if (!oilNotSkippedNotePresent(src)) sentences.push(OIL_NOT_SKIPPED_NOTE[lang]);
  const withGeneric = intervals.filter((iv) => iv.genericDates.length > 0);
  if (withGeneric.length > 0 && !oilGenericRecordsNotePresent(src)) {
    const multi = intervals.length > 1;
    for (const iv of withGeneric) {
      sentences.push(oilGenericRecordsNote(lang, iv.genericDates, multi ? iv : null));
    }
  }
  if (sentences.length === 0) return src;

  const isHtml = /<br\s*\/?>|<\/?(?:p|strong|b|div)\b/i.test(src);
  const addition = isHtml ? escapeHtmlText(sentences.join(" ")) : sentences.join(" ");

  let anchor = -1;
  const exceed = EXCEED_RE.exec(src);
  if (exceed) anchor = exceed.index;
  else {
    const heading = REGULARITY_HEADING_RE.exec(src);
    if (heading) anchor = heading.index + heading[0].length;
  }
  if (anchor < 0) {
    const end = trimInsertPoint(src, src.length);
    return `${src.slice(0, end)}${isHtml ? "<br><br>" : "\n\n"}${addition}`;
  }
  const end = trimInsertPoint(src, paragraphEndAfter(src, anchor));
  return `${src.slice(0, end)} ${addition}${src.slice(end)}`;
}
