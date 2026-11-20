/**
 * Auto1 vērtības klienta skatā: avots dod angliski un ASV formātā ("Available", "12/21/2020", "130,129 km").
 * Klientam rāda latviski: vārdi pārtulkoti, datums DD.MM.GGGG, tūkstoši ar atstarpi.
 */

const WORDS_LV: Record<string, string> = {
  available: "Ir",
  "not available": "Nav",
  unavailable: "Nav",
  yes: "Jā",
  no: "Nē",
  none: "Nav",
  some: "Daļēji",
  partial: "Daļēji",
  partially: "Daļēji",
  complete: "Pilna",
  full: "Pilna",
  unknown: "Nav zināms",
  "not specified": "Nav norādīts",
  "n/a": "-",
  // Auto1 servisa grāmata / tehniskie dati (Nils 20.11: nepārtulkoti angļu teksti).
  "digital service book": "Digitālā servisa grāmata",
  "service book": "Servisa grāmata",
  "complete service book": "Pilna servisa grāmata",
  "partial service book": "Daļēja servisa grāmata",
  "no service book": "Nav servisa grāmatas",
  diesel: "Dīzelis",
  petrol: "Benzīns",
  gasoline: "Benzīns",
  electric: "Elektriskais",
  hybrid: "Hibrīds",
  "plug-in hybrid": "Uzlādējams hibrīds",
  lpg: "Gāze (LPG)",
  cng: "Gāze (CNG)",
  manual: "Manuālā",
  automatic: "Automātiskā",
  duplex: "Automātiskā (divsajūgu)",
  "semi-automatic": "Pusautomātiskā",
  sedan: "Sedans",
  saloon: "Sedans",
  "station wagon": "Universālis",
  estate: "Universālis",
  hatchback: "Hečbeks",
  coupe: "Kupeja",
  convertible: "Kabriolets",
  van: "Furgons",
  minivan: "Minivens",
  pickup: "Pikaps",
};

/** Krāsu / salona vārdi (vērtībā var būt vairāki: «Gray Metallic (Original)»). */
const PHRASE_LV: Array<[RegExp, string]> = [
  [/\(original\)/gi, "(oriģināls)"],
  [/\bpartial leather\b/gi, "Daļēji āda"],
  [/\bleather\b/gi, "Āda"],
  [/\b(fabric|cloth)\b/gi, "Audums"],
  [/\bvelour\b/gi, "Velūrs"],
  [/\bmetallic\b/gi, "metālika"],
  [/\bmatte?\b/gi, "matēta"],
  [/\b(gr[ae]y)\b/gi, "Pelēka"],
  [/\bblack\b/gi, "Melna"],
  [/\bwhite\b/gi, "Balta"],
  [/\bsilver\b/gi, "Sudraba"],
  [/\bblue\b/gi, "Zila"],
  [/\bred\b/gi, "Sarkana"],
  [/\bgreen\b/gi, "Zaļa"],
  [/\bbrown\b/gi, "Brūna"],
  [/\bbeige\b/gi, "Bēša"],
  [/\byellow\b/gi, "Dzeltena"],
  [/\borange\b/gi, "Oranža"],
  [/\bgold\b/gi, "Zelta"],
  [/\b(violet|purple)\b/gi, "Violeta"],
];

/** Tikai krāsas / salona vērtībām: visi vārdi ir zināmi (citādi atstāj avota tekstu neskartu). */
function phraseToLv(value: string): string | null {
  let out = value;
  for (const [re, lv] of PHRASE_LV) out = out.replace(re, lv);
  if (out === value) return null;
  // Ja palika angļu vārdi (piem. «Mythos Black» - modeļa krāsas nosaukums), avotu nemaina.
  const source = new Set((value.toLowerCase().match(/[a-z]+/g) ?? []) as string[]);
  const left = (out.match(/[A-Za-zĀ-ž]+/g) ?? []).filter((w) => source.has(w.toLowerCase()));
  return left.length ? null : out;
}

/** Mērvienības: «140 kW / 190 HP» -> «140 kW / 190 ZS», «1,968 ccm» -> «1968 cm³», «184g/km» -> «184 g/km». */
function unitsToLv(value: string): string | null {
  let m = /^(\d+)\s*kW\s*\/\s*(\d+)\s*(?:HP|PS|hp|ps)$/.exec(value);
  if (m) return `${m[1]} kW / ${m[2]} ZS`;
  m = /^(\d{1,2}[,.]\d{3}|\d{3,5})\s*(?:ccm|cm3|cc)$/i.exec(value);
  if (m) return `${m[1]!.replace(/[,.]/g, "")} cm³`;
  m = /^(\d+)\s*g\s*\/\s*km$/i.exec(value);
  if (m) return `${m[1]} g/km`;
  return null;
}

/** «12/2027» (mēnesis/gads) -> «12.2027». */
function monthYearToLv(value: string): string | null {
  const m = /^(\d{1,2})\/(\d{4})$/.exec(value);
  if (!m) return null;
  const month = Number(m[1]);
  if (month < 1 || month > 12) return null;
  return `${String(month).padStart(2, "0")}.${m[2]}`;
}

/** ASV datums M/D/GGGG -> DD.MM.GGGG. Citus formātus neaiztiek. */
function usDateToLv(value: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${m[3]}`;
}

/** "130,129 km" / "130.129 km" -> "130 129 km" (tikai veseli skaitļi ar tūkstošu atdalītāju). */
function groupedNumberToLv(value: string): string | null {
  const m = /^(\d{1,3}(?:[,.]\d{3})+)(\s*km)?$/i.exec(value);
  if (!m) return null;
  const digits = m[1]!.replace(/[,.]/g, "");
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped}${m[2] ? " km" : ""}`;
}

export function irissPdDisplayValue(raw: string): string {
  const value = raw.trim();
  if (!value) return value;
  const word = WORDS_LV[value.toLowerCase()];
  if (word) return word;
  return usDateToLv(value) ?? monthYearToLv(value) ?? groupedNumberToLv(value) ?? unitsToLv(value) ?? phraseToLv(value) ?? value;
}
