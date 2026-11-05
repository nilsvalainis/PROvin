/**
 * C10 pirms PDF: iekšējas piezīmes un AI noplūdes klienta drukātajos laukos.
 * Tekstu NEMAINA (operatora rakstīto klusām nelabojam), tikai atzīmē E līmenī,
 * lai operators to redz pirms PDF.
 *
 * Šabloni izvēlēti tā, lai nebūtu viltus trāpījumu:
 * - „ignorēt” tikai kā norāde (rindas / iekavu sākumā, pirms kola vai lielajiem burtiem),
 *   nevis „šo kļūdu nevajadzētu ignorēt” vai „ignorēts kļūdas kods”.
 * - TODO / XXX / TBD tikai lielajiem burtiem kā atsevišķs vārds (VIN „WVWZZZ…XXX123” neskaitās,
 *   jo blakus ir burti/cipari).
 * - Sveiciens tikai rindas sākumā ar komatu / izsaukuma zīmi.
 */
import type { FactCheckFlag } from "@/lib/unit-facts/types";

const NB = "(?<![\\p{L}\\p{N}])";
const NA = "(?![\\p{L}\\p{N}])";
/** Atsevišķs lielo burtu marķieris: blakus nav burtu, ciparu, defises vai zvaigznītes. */
const TOKEN_NB = "(?<![\\p{L}\\p{N}*\\-])";
const TOKEN_NA = "(?![\\p{L}\\p{N}*\\-])";

export type InternalNotePattern = { id: string; re: RegExp };

export const INTERNAL_NOTE_PATTERNS: readonly InternalNotePattern[] = [
  // Norāde „ignorēt …” / „Ignore …” rindas, iekavu vai saraksta sākumā, vai pirms kola.
  {
    id: "ignore_instruction",
    re: new RegExp(
      `(?:^|[\\n(\\[•*]|[-:]\\s)\\s*(?:ignorēt|ignorējiet|ignorē|ignore)${NA}|${NB}(?:ignorēt|ignore)\\s*[:!]`,
      "iu",
    ),
  },
  { id: "ignore_caps", re: new RegExp(`${NB}(?:IGNORĒT|IGNORE)${NA}`, "u") },
  { id: "lorem_ipsum", re: new RegExp(`${NB}(?:lorem|ipsum)${NA}`, "iu") },
  { id: "nav_pirkts", re: new RegExp(`${NB}nav\\s+pirkt[sa]${NA}`, "iu") },
  { id: "aiz_maksas", re: new RegExp(`${NB}aiz\\s+maksas${NA}`, "iu") },
  { id: "todo", re: new RegExp(`${TOKEN_NB}(?:TODO|XXX|TBD)${TOKEN_NA}`, "u") },
  { id: "fixme", re: new RegExp(`${NB}fixme${NA}`, "iu") },
  { id: "question_marks", re: /\?{3,}/ },
  { id: "nedrukat", re: new RegExp(`${NB}nedrukāt${NA}`, "iu") },
  { id: "piezime_sev", re: new RegExp(`${NB}piezīme\\s+sev${NA}`, "iu") },
  { id: "demo_data", re: new RegExp(`${NB}demonstrācijas\\s+dati${NA}`, "iu") },
  {
    id: "ai_first_person",
    re: new RegExp(`${NB}esmu\\s+(?:pabeidzis|pabeigusi|rūpīgi|izskatījis|izskatījusi)${NA}`, "iu"),
  },
  { id: "ai_greeting", re: /(?:^|\n)[ \t]*(?:sveiki|sveiks|labdien)[ \t]*[,!]/iu },
];

export type InternalNoteHit = { patternId: string; quote: string };

function quoteAround(text: string, index: number, length: number): string {
  const lineStart = text.lastIndexOf("\n", index - 1) + 1;
  const lineEndRaw = text.indexOf("\n", index + length);
  const lineEnd = lineEndRaw < 0 ? text.length : lineEndRaw;
  const start = Math.max(lineStart, index - 30);
  const end = Math.min(lineEnd, index + length + 40);
  const body = text.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > lineStart ? "…" : ""}${body}${end < lineEnd ? "…" : ""}`;
}

/** Visi iekšējo piezīmju trāpījumi vienā plain tekstā (pa vienam uz šablonu). */
export function findInternalNoteHits(plain: string): InternalNoteHit[] {
  const text = (plain ?? "").replace(/\r\n?/g, "\n");
  if (!text.trim()) return [];
  const hits: InternalNoteHit[] = [];
  for (const p of INTERNAL_NOTE_PATTERNS) {
    const m = p.re.exec(text);
    if (!m) continue;
    // Neskaitām sākuma atdalītāju (jaunu rindu / iekavu) kā daļu no citāta.
    const lead = m[0].length - m[0].replace(/^[\s\n(\[•*:-]+/, "").length;
    hits.push({ patternId: p.id, quote: quoteAround(text, m.index + lead, m[0].length - lead) });
  }
  return hits;
}

export type ClientPrintedTextField = { label: string; text: string };

/**
 * `c10_internal_note` (E): katram laukam un šablonam viens karodziņš ar lauka nosaukumu un citātu.
 * `text` jābūt jau plain (pēc HTML -> teksts).
 */
export function checkInternalNoteLeaks(fields: readonly ClientPrintedTextField[] | null | undefined): FactCheckFlag[] {
  const flags: FactCheckFlag[] = [];
  for (const f of fields ?? []) {
    for (const hit of findInternalNoteHits(f.text)) {
      flags.push({
        id: "c10_internal_note",
        kind: "leak_phrase",
        level: "E",
        message: `Iekšēja piezīme vai AI frāze klienta PDF laukā „${f.label}”: „${hit.quote}”. Izdzēs vai pārraksti pirms PDF.`,
        sentence: `${f.label}: ${hit.quote}`,
      });
    }
  }
  return flags;
}
