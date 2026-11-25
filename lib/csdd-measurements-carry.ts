import { normalizeCsddRawText } from "@/lib/csdd-extended-parse";

/**
 * CSDD tehnisko mērījumu teksts, ko saglabā, kad CSDD RAW aizvieto cits avots (Nils 25.11, BMW X6 TA 15.05.2026).
 *
 * e.csdd Smart-ID relejs dod sadaļu «Tehniskie dati» (CO2, patēriņš, Euro, CO/HC/Lambda, dūmainība vai atgāzu cietās
 * daļiņas) + «Bremžu vērtējums». Maksas SMS izziņas PDF šo sadaļu nesatur (tikai TA vēsturi). Agrāk PDF imports aizvietoja
 * RAW pilnībā, un mērījumi (parsē no RAW) pazuda. Tagad iepriekšējā RAW mērījumu rindas paliek `measurementsCarry`
 * ar TA datumu, pie kura tās mērītas; `parseCsddMeasurements` apvieno abus avotus.
 */
export type CsddMeasurementsCarry = {
  /** Pēdējās TA datums (DD.MM.YYYY), pie kura teksts iegūts; tukšs, ja nav zināms. */
  taDate: string;
  /** Tikai mērījumu rindas (bez TA vēstures). */
  text: string;
};

export const CSDD_MEASUREMENTS_CARRY_MAX_LEN = 4000;

/** Rindas, kas ir mērījumi «Tehniskie dati» sadaļā (nekad TA vēstures sadaļā). */
const MEASUREMENT_LINE_RE =
  /^\s*(?:CO2\b|Degviela\s?s\s+patēriņš|-\s*pilsētā|-\s*ārpus\s+pilsētas|[^:\n]*patēriņš\s+pie\s+maza\s+ātruma|Emisiju\s+standarts|CO\s*\(%\)|CO\s+paaugst|HC\s*\(ppm\)|Lambda|Dūmainības\s+koeficients|Atgāzu\s+cietās\s+daļiņas)/i;

/** Sadaļas, ar kurām «Tehniskie dati» beidzas. */
const SECTION_END_RE =
  /^\s*(?:Bremžu\s+vērtējums|Būtiski\s+bojājumi|Nobraukuma\s+vēsture|Tehnisko\s+apskašu\s+vēsture|Pēdējā\s+tehniskā\s+apskate|Transportlīdzekļa\s+reģistrācija|Aizliegumi|Reģistrācijas\s+dati|Detalizētais\s+vērtējums)\b/i;

/** «Tehniskie dati» mērījumu rindas + «Bremžu vērtējums» bloks no e.csdd teksta. Tukšs, ja tādu nav. */
export function extractCsddMeasurementsText(raw: string): string {
  const text = normalizeCsddRawText(raw ?? "");
  const lines = text.split("\n");
  const out: string[] = [];
  const start = lines.findIndex((l) => /^\s*Tehniskie\s+dati\s*$/i.test(l));
  if (start >= 0) {
    for (let i = start + 1; i < lines.length; i++) {
      const l = lines[i]!;
      if (SECTION_END_RE.test(l)) break;
      // Tukšas vērtības («CO (%):» bez skaitļa) neņem.
      if (MEASUREMENT_LINE_RE.test(l) && /[:\t][ \t]*\S/.test(l)) out.push(l.trim());
    }
  }
  const brakeStart = lines.findIndex((l) => /^\s*Bremžu\s+vērtējums/i.test(l));
  if (brakeStart >= 0) {
    const block: string[] = [lines[brakeStart]!.trim()];
    for (let i = brakeStart + 1; i < lines.length && i < brakeStart + 14; i++) {
      const l = lines[i]!.trim();
      if (!l) break;
      block.push(l);
    }
    if (block.length > 1) out.push("", ...block);
  }
  return out.join("\n").trim().slice(0, CSDD_MEASUREMENTS_CARRY_MAX_LEN);
}

/** DD.MM.YYYY -> YYYYMMDD skaitlis salīdzināšanai (0, ja nav datuma). */
export function csddDateKey(date: string): number {
  const m = String(date ?? "").trim().match(/^(\d{2})[./](\d{2})[./](\d{4})$/);
  return m ? Number(`${m[3]}${m[2]}${m[1]}`) : 0;
}

/**
 * Jaunais carry, kad RAW aizvieto ar `nextRaw`: ja iepriekšējā RAW bija mērījumi, kurus jaunais RAW nesatur - tie paliek
 * (ar iepriekšējās TA datumu); citādi paliek iepriekšējais carry. Ja jaunajā RAW mērījumi ir - carry vairs nevajag.
 */
export function nextCsddMeasurementsCarry(args: {
  prevRaw: string;
  prevTaDate: string;
  prevCarry: CsddMeasurementsCarry | undefined;
  nextRaw: string;
}): CsddMeasurementsCarry | undefined {
  const prevText = extractCsddMeasurementsText(args.prevRaw);
  const nextText = extractCsddMeasurementsText(args.nextRaw);
  if (prevText && prevText !== nextText) return { taDate: args.prevTaDate.trim(), text: prevText };
  return args.prevCarry?.text.trim() ? args.prevCarry : undefined;
}

export function parseCsddMeasurementsCarryStored(raw: unknown): CsddMeasurementsCarry | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const text = typeof o.text === "string" ? o.text.slice(0, CSDD_MEASUREMENTS_CARRY_MAX_LEN) : "";
  if (!text.trim()) return undefined;
  const taDate = typeof o.taDate === "string" ? o.taDate.trim().slice(0, 20) : "";
  return { taDate, text };
}
