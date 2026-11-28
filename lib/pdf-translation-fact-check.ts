/**
 * 28.11 (Nils 2): gatavā klienta PDF tulkojuma (EN/RU/DE) pārbaude pret LV versiju.
 *
 * Tulkojums nedrīkst mainīt faktus: nobraukumu (km), datumus, īpašnieku un negadījumu skaitu. LV teksts jau
 * pārbaudīts pret kanonisko faktu tabulu, tāpēc tulkojumu salīdzina ar LV oriģinālu tās pašas atslēgas robežās.
 * Tekstu NEMAINA, sūtīšanu NEBLOĶĒ - tikai brīdinājumi panelī.
 */
import type { ClientReportTargetLang } from "@/lib/client-report-i18n";
import type { FactCheckFlag } from "@/lib/unit-facts/types";

export type TranslationTextMap = Record<string, string>;

const DATE_RES: RegExp[] = [
  /(?<![\d.\/-])(\d{1,2})[./](\d{1,2})[./](\d{4})(?![\d])/g,
  /(?<![\d.\/-])(\d{4})-(\d{2})-(\d{2})(?![\d])/g,
];

/** Datumi → YYYY-MM-DD (DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD). */
export function extractNumericDates(text: string): { dates: string[]; rest: string } {
  const dates: string[] = [];
  let rest = text ?? "";
  rest = rest.replace(DATE_RES[0]!, (_m, d: string, mo: string, y: string) => {
    dates.push(`${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`);
    return " ";
  });
  rest = rest.replace(DATE_RES[1]!, (_m, y: string, mo: string, d: string) => {
    dates.push(`${y}-${mo}-${d}`);
    return " ";
  });
  return { dates, rest };
}

/** Lieli skaitļi (≥ 1 000): «120 000», «120.000», «120,000», «120000». Bez datumiem. */
export function extractLargeNumbers(text: string): number[] {
  const { rest } = extractNumericDates(text);
  const out: number[] = [];
  for (const m of rest.matchAll(/(?<![\d.,])(\d{1,3}(?:[   .,]\d{3})+|\d{4,7})(?![\d]|[.,]\d)/g)) {
    const n = Number(m[1]!.replace(/[^\d]/g, ""));
    if (n >= 1_000) out.push(n);
  }
  return out;
}

const WORD_NUMBERS: Record<string, number> = {
  // LV
  viens: 1, viena: 1, divi: 2, divas: 2, trīs: 3, četri: 4, četras: 4, pieci: 5, piecas: 5, seši: 6, septiņi: 7,
  // EN
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, single: 1,
  // RU
  один: 1, одна: 1, одного: 1, два: 2, две: 2, двух: 2, три: 3, трёх: 3, трех: 3, четыре: 4, четырёх: 4, пять: 5, шесть: 6,
  // DE
  ein: 1, eine: 1, einen: 1, einem: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7,
};
const NUM = `(\\d{1,2}|${Object.keys(WORD_NUMBERS).join("|")})`;

/** Skaitlis tieši pirms atslēgvārda (līdz 2 vārdiem starpā): «3 owners», «2 previous owners», «два владельца». */
const COUNT_NOUNS: Record<"owners" | "incidents", Record<"lv" | ClientReportTargetLang, string>> = {
  owners: {
    lv: "īpašniek\\p{L}*(?!\\p{L})(?!\\s+maiņ)",
    en: "owners?\\b|keepers?\\b",
    ru: "владел\\p{L}*|собственник\\p{L}*",
    de: "halter\\p{L}*|besitzer\\p{L}*|eigentümer\\p{L}*|vorbesitzer\\p{L}*",
  },
  incidents: {
    lv: "negadījum\\p{L}*|bojājumu\\s+ierakst\\p{L}*",
    en: "accidents?\\b|incidents?\\b|damage\\s+records?\\b|claims?\\b",
    ru: "дтп|авари\\p{L}*|происшеств\\p{L}*|страхов\\p{L}*\\s+случа\\p{L}*",
    de: "unfäll\\p{L}*|unfall\\p{L}*|schadensfäll\\p{L}*|schäden",
  },
};

function countsOf(text: string, kind: "owners" | "incidents", lang: "lv" | ClientReportTargetLang): number[] {
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${NUM}\\s+(?:[\\p{L}-]+\\s+){0,2}?(?:${COUNT_NOUNS[kind][lang]})`, "giu");
  const out: number[] = [];
  for (const m of (text ?? "").matchAll(re)) {
    const raw = m[1]!.toLocaleLowerCase();
    const n = /^\d+$/.test(raw) ? Number(raw) : WORD_NUMBERS[raw];
    if (n != null) out.push(n);
  }
  return out;
}

function multisetMissing(a: readonly (number | string)[], b: readonly (number | string)[]): (number | string)[] {
  const left = new Map<string, number>();
  for (const x of b) left.set(String(x), (left.get(String(x)) ?? 0) + 1);
  const out: (number | string)[] = [];
  for (const x of a) {
    const k = String(x);
    const c = left.get(k) ?? 0;
    if (c > 0) left.set(k, c - 1);
    else out.push(x);
  }
  return out;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

function fmtInt(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

const KEY_LABELS: [RegExp, string][] = [
  [/^main\.tehniskoRiskuAnalize$/, "Tehnisko risku analīze"],
  [/^main\.apskatesPlāns$/, "Apskates plāns"],
  [/^main\.iriss$/, "Kopsavilkums"],
  [/^main\.cenasAtbilstiba$/, "Cenas atbilstība"],
  [/^main\.mileageComment$/, "Nobraukuma komentārs"],
  [/^main\.internalComment$/, "Negadījumu komentārs"],
  [/^main\./, "Avota komentārs"],
  [/^csddForm\./, "CSDD"],
  [/^tirgusForm\./, "Sludinājums"],
  [/^manualLtabBlock\./, "LTAB"],
  [/^autoRecordsBlock\./, "Dīleris"],
  [/^ccVinBlock\./, "Izsoles"],
  [/^asvBlock\./, "ASV"],
  [/^citiAvoti\./, "Citi avoti"],
  [/^listingAnalysis\./, "Sludinājuma analīze"],
  [/^vendor\./, "Avots"],
  [/^banner\./, "Kartīte"],
  [/^dealerSignal\./, "Signāli"],
];

/** Tulkojamā lauka atslēga → LV nosaukums paneļa ziņai. */
export function translationKeyLabel(key: string): string {
  return KEY_LABELS.find(([re]) => re.test(key))?.[1] ?? key;
}

const LANG_LABEL: Record<ClientReportTargetLang, string> = { en: "EN", ru: "RU", de: "DE" };

/**
 * Salīdzina katru tulkoto lauku ar LV oriģinālu.
 * - Skaitlis / datums tulkojumā, kura nav LV - E (izdomāts vai mainīts fakts).
 * - LV skaitlis / datums, kura nav tulkojumā - W (pazudis; datums var būt izrakstīts vārdiem).
 * - Īpašnieku / negadījumu skaits atšķiras - E.
 */
export function checkTranslatedPdfTexts(input: {
  lv: TranslationTextMap;
  translated: TranslationTextMap;
  lang: ClientReportTargetLang;
  labelOf?: (key: string) => string;
}): FactCheckFlag[] {
  const flags: FactCheckFlag[] = [];
  const L = LANG_LABEL[input.lang] ?? input.lang.toUpperCase();
  for (const [key, lvText] of Object.entries(input.lv)) {
    const tr = input.translated[key];
    if (typeof tr !== "string" || !tr.trim() || !lvText.trim() || tr.trim() === lvText.trim()) continue;
    const label = input.labelOf?.(key) ?? translationKeyLabel(key);
    const sentence = tr.trim().slice(0, 400);
    const push = (id: string, level: FactCheckFlag["level"], message: string) =>
      flags.push({ id: `translation_${id}`, kind: "translation_mismatch", level, message: `${L} tulkojums «${label}»: ${message}`, sentence });

    const lvDates = extractNumericDates(lvText).dates;
    const trDates = extractNumericDates(tr);
    const addedDates = multisetMissing(trDates.dates, lvDates);
    if (addedDates.length) push("date_added", "E", `datums ${addedDates.map((d) => fmtDate(String(d))).join(", ")} nav LV tekstā.`);
    // Datums var būt izrakstīts vārdiem («15 March 2020») - pazudis tikai, ja arī gads pazudis.
    const lostDates = multisetMissing(lvDates, trDates.dates).filter((d) => !tr.includes(String(d).slice(0, 4)));
    if (lostDates.length) push("date_lost", "W", `LV datums ${lostDates.map((d) => fmtDate(String(d))).join(", ")} tulkojumā nav.`);

    const lvNums = extractLargeNumbers(lvText);
    const trNums = extractLargeNumbers(tr);
    const added = multisetMissing(trNums, lvNums);
    // Gadi tulkojumā no datumiem vārdiem («March 2020») nav izdomāti skaitļi.
    const addedReal = added.filter((n) => !(Number(n) >= 1950 && Number(n) <= 2100 && lvDates.some((d) => String(d).startsWith(String(n)))));
    if (addedReal.length) push("number_added", "E", `skaitlis ${addedReal.map((n) => fmtInt(Number(n))).join(", ")} nav LV tekstā (nobraukums / gads mainīts?).`);
    const lost = multisetMissing(lvNums, trNums);
    if (lost.length) push("number_lost", "W", `LV skaitlis ${lost.map((n) => fmtInt(Number(n))).join(", ")} tulkojumā nav.`);

    for (const kind of ["owners", "incidents"] as const) {
      const a = countsOf(lvText, kind, "lv");
      const b = countsOf(tr, kind, input.lang);
      if (a.length === 0 || b.length === 0) continue;
      const diff = multisetMissing(b, a);
      if (diff.length === 0) continue;
      push(
        kind,
        "E",
        `${kind === "owners" ? "īpašnieku" : "negadījumu"} skaits tulkojumā ${diff.join(", ")}, LV tekstā ${a.join(", ")}.`,
      );
    }
  }
  return flags;
}
