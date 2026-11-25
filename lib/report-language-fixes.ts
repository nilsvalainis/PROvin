/**
 * 24.11 atskaites audits (c-saturs-un-tehnika.md, 1. sadaļa #18, #33, #34, #38, #41, #42, #43):
 * deterministiski valodas labojumi klienta tekstam - avotu teksta salipumi, neiztulkoti avotu vārdi,
 * avotu nosaukumu rakstība, saīsinājumi un decimāldaļas. Bez LLM; idempotenti (otrreiz neko nemaina).
 *
 * - `normalizeCsddDefectText` - CSDD TA defektu teksts («Dīzeļdegviela s pilēšana», «balstiekārtasšarnīrā»,
 *   pielīmēta cita defekta koda rinda «... pusē. 5.3.3.12. tilts. ...»);
 * - `splitEquipmentText` / `cleanEquipmentDescription` - aprīkojuma «S0» atliekas, salipušas rindas, drukas kļūdas;
 * - `formatModelDesignationCase` - BMW «320D» -> «320d» (tikai, ja marka zināma);
 * - `translateLeakedSourceTerms` - dāņu reģistra vārdi un lauku nosaukumi AI tekstā (LV/EN/RU/DE);
 * - `applyReportLanguageFixes` - viss kopā klienta AI tekstam (avotu rakstība, «t.s.», «2016.gāda», «~9.5 mēn.»).
 */

export type ReportFixLang = "lv" | "en" | "ru" | "de";

/* ---------- CSDD TA defekti ---------- */

/**
 * Salikteņu otrās daļas, ko CSDD teksts mēdz pielīmēt iepriekšējam vārdam bez atstarpes
 * («balstiekārtasšarnīrā», «pārvadašļūtene», «dzesēšanasšķidrums», «bremžušļūtenes»).
 * Tikai vārdu sākumi (celms) - galotne paliek, kā avotā.
 */
const CSDD_SECOND_WORD_STEMS = [
  "šarnīr",
  "šļūten",
  "šķidrum",
  "sprausl",
  "cauruļvad",
  "caurul",
  "stiprinājum",
  "savienojum",
  "gultn",
  "gultņ",
  "amortizator",
  "atsper",
  "uzgal",
  "manšet",
  "putekļusarg",
  "sūknī",
  "sūkn",
  "disk",
  "kluč",
  "tvertn",
  "lukturī",
  "lukturi",
  "lukturu",
  "spuldz",
];
/** Iepriekšējā vārda ģenitīva galotne (lai nesadala īstus salikteņus kā «dzinējsūknis»). */
const GENITIVE_TAIL = "(?:as|es|us|ņa|ža|ša|ļa|ra|ta|ka|ga|da|sa|na|la|ma|va|pa|ba|žu|šu|ņu|ļu|ru|tu|ku|gu|du|su|nu|lu|mu|vu|pu|bu|u|a|s)";
const GLUED_SECOND_WORD_RE = new RegExp(
  `(\\p{Ll}{3,}${GENITIVE_TAIL})(${CSDD_SECOND_WORD_STEMS.join("|")})`,
  "gu",
);
/** «Dīzeļdegviela s pilēšana» - ģenitīva «s» atdalīts ar atstarpi. */
const DETACHED_GENITIVE_S_RE = /(\p{L}{4,}[aeiu]) s(?= \p{Ll})/gu;
/** Pielīmēta cita defekta koda rinda: «... pusē. 5.3.3.12. tilts. ...». */
const GLUED_DEFECT_CODE_RE = /([.!?;])\s+(?=\d{1,2}\.\d{1,2}(?:\.\d{1,2}){1,3}\.?\s+\p{L})/gu;

export function normalizeCsddDefectText(raw: string): string {
  let s = (raw ?? "").replace(/ /g, " ");
  if (!s.trim()) return "";
  s = s.replace(DETACHED_GENITIVE_S_RE, "$1s");
  s = s.replace(GLUED_SECOND_WORD_RE, (m, first: string, second: string) => {
    // «bremžu» + «šļūtenes»: atdala; ja pirmā daļa pati par sevi ir pārāk īsa, atstāj.
    if (first.length < 4) return m;
    return `${first} ${second}`;
  });
  s = s.replace(GLUED_DEFECT_CODE_RE, "$1\n");
  s = s.replace(/[ \t]{2,}/g, " ");
  return s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .join("\n");
}

/* ---------- Aprīkojums ---------- */

const EQUIPMENT_TYPO_FIXES: Array<[RegExp, string]> = [
  [/\bTyire\b/g, "Tyre"],
  [/\bLt\/aly\b/gi, "Light alloy"],
  [/\bSmoker\s*[´'`ʼ́]\s*s\b/g, "Smoker's"],
  [/\bSicht\s+Packet\b/gi, "Sicht Paket"],
  [/\bW\.runfla\b/gi, "wheels, runflat"],
  [/\bDouble\s+Spoke\b/g, "double-spoke"],
];

/** Viena aprīkojuma apraksta tīrīšana: «S0» atliekas, avota drukas kļūdas, dubultas atstarpes. */
export function cleanEquipmentDescription(raw: string): string {
  let s = (raw ?? "").replace(/ /g, " ").trim();
  if (!s) return "";
  // Kombinējošā akūta zīme («Smoker ́s») - avota artefakts.
  s = s.replace(/\s?́/g, "'").replace(/\s'\s?s\b/g, "'s");
  for (const [re, rep] of EQUIPMENT_TYPO_FIXES) s = s.replace(re, rep);
  // «S0300alpinweiss 3» -> «300 alpinweiss 3»; «S0205 Steptronic» -> «205 Steptronic».
  s = s.replace(/^S0?([0-9][0-9A-Z]{2})(?=\p{L}|\s|$)/u, "$1 ");
  // Beigās pielipusi «S0» bez koda («Steptronic transmissionS0»).
  s = s.replace(/(\p{Ll})S0$/u, "$1");
  s = s.replace(/[ \t]{2,}/g, " ").trim();
  return s;
}

/**
 * Salipušas aprīkojuma rindas («205Steptronic transmissionS02NPM Lt/aly W. ...») -> atsevišķas pozīcijas.
 * Dala pirms «S0» + trīs zīmju BMW SA koda, ja tas ir pielīmēts teksta vidū.
 */
export function splitEquipmentText(raw: string): string[] {
  const t = (raw ?? "").replace(/ /g, " ").trim();
  if (!t) return [];
  const parts = t
    .split(/(?<=[\p{L})])(?=S0[0-9][0-9A-Z]{2})|(?<=\p{Ll})S0(?=[0-9][0-9A-Z]{2}(?:\p{Lu}|\s))/u)
    .map((p) => cleanEquipmentDescription(p))
    .filter(Boolean);
  return parts.length > 0 ? parts : [];
}

/* ---------- Modeļa apzīmējums ---------- */

/**
 * BMW modeļu apzīmējumā degvielas burts ir mazais («320d», «530i», «M550i», «X5 xDrive30d»).
 * CSDD / izsoles raksta lielajiem burtiem («320D»). Labo tikai, ja marka ir BMW (cita marka - atstāj).
 */
export function formatModelDesignationCase(make: string, model: string): string {
  const m = (model ?? "").trim();
  if (!m) return m;
  if (!/^\s*bmw\b/i.test(make ?? "")) return m;
  return m
    .replace(/\b(M?\d{3})(D|I|E|DX|IX|XD|XI)\b/g, (_x, num: string, suf: string) => `${num}${suf.toLowerCase()}`)
    .replace(/\bXDRIVE(\d{2})([DIE])\b/gi, (_x, n: string, f: string) => `xDrive${n}${f.toLowerCase()}`)
    .replace(/\bXDRIVE\b/g, "xDrive");
}

/** Brīvā tekstā: «BMW 320D» -> «BMW 320d». */
function fixBmwDesignationsInText(text: string): string {
  return text.replace(/\b(BMW\s+)(M?\d{3})(D|I|E)\b/g, (_x, pre: string, num: string, f: string) => `${pre}${num}${f.toLowerCase()}`);
}

/* ---------- Neiztulkoti avotu vārdi (dāņu DMR / tjekbil) ---------- */

type Tr = Record<ReportFixLang, string>;
const LEAKED_TERMS: Array<{ re: RegExp; tr: Tr }> = [
  // Lauku nosaukumi nekad nav klienta teksts - noņem kopā ar kolu.
  { re: /\bkoeretoej[A-Z]\w*\s*:\s*/g, tr: { lv: "", en: "", ru: "", de: "" } },
  { re: /\(\s*status\s*:\s*Ejerskifte\s*\)/gi, tr: { lv: "(īpašnieka maiņa)", en: "(change of owner)", ru: "(смена владельца)", de: "(Halterwechsel)" } },
  { re: /\bEjerskifte\b/gi, tr: { lv: "īpašnieka maiņa", en: "change of owner", ru: "смена владельца", de: "Halterwechsel" } },
  { re: /\bBetinget\s+godkendt\b/gi, tr: { lv: "nosacīti izturēta", en: "conditionally passed", ru: "условно пройден", de: "bedingt bestanden" } },
  { re: /\(\s*Afmeldt\s*\)/gi, tr: { lv: "(noņemts no uzskaites)", en: "(deregistered)", ru: "(снят с учёта)", de: "(abgemeldet)" } },
  { re: /\bAfmeldt\b/g, tr: { lv: "noņemts no uzskaites", en: "deregistered", ru: "снят с учёта", de: "abgemeldet" } },
  // «LB Bilsyn ApS - Bov(ophørt)» - uzņēmuma statuss.
  { re: /\s*\(\s*ophørt\s*\)/gi, tr: { lv: " (uzņēmums slēgts)", en: " (company closed)", ru: " (компания закрыта)", de: " (Firma geschlossen)" } },
  { re: /\bophørt\b/gi, tr: { lv: "beigusies", en: "ended", ru: "прекращено", de: "beendet" } },
  { re: /\bPrivat\s+personkørsel\b/gi, tr: { lv: "privāta lietošana", en: "private use", ru: "частное использование", de: "private Nutzung" } },
  { re: /\bErhvervsmæssig\s+personkørsel\b/gi, tr: { lv: "komerciāla pasažieru pārvadāšana", en: "commercial passenger transport", ru: "коммерческие пассажирские перевозки", de: "gewerbliche Personenbeförderung" } },
  { re: /\bPeriodisk\s+syn\b/gi, tr: { lv: "periodiskā apskate", en: "periodic inspection", ru: "периодический техосмотр", de: "Hauptuntersuchung" } },
];

export function translateLeakedSourceTerms(text: string, lang: ReportFixLang = "lv"): string {
  if (!text) return text;
  let out = text;
  for (const { re, tr } of LEAKED_TERMS) out = out.replace(re, tr[lang]);
  return out;
}

/* ---------- Avotu nosaukumu rakstība (pēc 1. lapas logo) ---------- */

/** Viena rakstība visur: «carVertical», «autoDNA», «ss.com» (kā 1. lapas logo). */
export function normalizeSourceNameSpelling(text: string): string {
  if (!text) return text;
  return text
    .replace(/(?<![\w./@-])car\s?vertical(?![\w.@/-])/gi, "carVertical")
    .replace(/(?<![\w./@-])auto\s?dna(?![\w.@/-])/gi, "autoDNA")
    .replace(/(?<![\w./@-])ss\.lv(?![\w/])/gi, "ss.com");
}

/* ---------- Kopā ---------- */

/**
 * Klienta AI teksta valodas labojumi (idempotenti). Var saņemt arī drošu PDF HTML (tikai `strong` / `span`
 * u.tml.) - regulārās izteiksmes neskar tagu atribūtus.
 */
export function applyReportLanguageFixes(text: string, lang: ReportFixLang = "lv"): string {
  if (!text) return text;
  let out = translateLeakedSourceTerms(text, lang);
  out = normalizeSourceNameSpelling(out);
  out = fixBmwDesignationsInText(out);
  if (lang === "lv") {
    // «t.s.» / «t. s.» (nepareizs saīsinājums) -> «tostarp».
    out = out.replace(/(?<![\p{L}.])t\.\s?s\.(?!\p{L})/gu, "tostarp");
    // «2016.gāda» / «2016. gāda» / «2017.gads» -> «2016. gada» / «2017. gads».
    out = out.replace(/\b((?:19|20)\d{2})\.\s*gād(a|ā|s|u)\b/g, (_m, y: string, end: string) => `${y}. gad${end}`);
    out = out.replace(/\b((?:19|20)\d{2})\.(gad(?:s|a|ā|u|os|iem))\b/g, "$1. $2");
    // «~9.5 mēn.» / «2.0 l» -> komats (LV decimāldaļa); datumus un versijas neskar (vajag mērvienību aiz).
    out = out.replace(
      /(?<![\d.])(\d{1,3})\.(\d{1,2})(?=\s?(?:mēn|gad|g\.|l\b|%|kW|h\b|stund|dien|nedēļ))/gu,
      "$1,$2",
    );
  }
  return out;
}
