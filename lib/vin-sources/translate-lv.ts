/**
 * Dāņu (DMR / Færdselsstyrelsen) un igauņu (Transpordiamet / LKF) terminu tulkojumi latviski.
 * Deterministiska vārdnīca — AI komentārs balstās uz jau saprotamiem latviskiem faktiem,
 * bet RAW laukā vienmēr paliek oriģinālais teksts pārbaudei.
 */

const DA_TERMS: Record<string, string> = {
  // reģistrācijas statusi
  registreret: "reģistrēts",
  afmeldt: "noņemts no uzskaites",
  udmeldt: "izslēgts no reģistra",
  "registreret (har fået tilknyttet en gyldig registrering)": "reģistrēts (ir spēkā esoša reģistrācija)",
  afmeldt_uden_nummerplader: "noņemts no uzskaites bez numura zīmēm",
  // apskates
  godkendt: "izturēta",
  "godkendt med frist": "izturēta ar termiņu trūkumu novēršanai",
  "kan godkendes efter omsyn hos (om)synsvirksomhed": "jāveic atkārtota apskate",
  "kan ikke godkendes": "nav izturēta",
  omsyn: "atkārtota apskate",
  "første syn": "pirmā apskate",
  "periodisk syn": "periodiskā apskate",
  "registreringssyn": "reģistrācijas apskate",
  "toldsyn": "muitas apskate",
  // apdrošināšana
  aktiv: "aktīva",
  ophørt: "beigusies",
  // degviela
  benzin: "benzīns",
  diesel: "dīzelis",
  el: "elektrisks",
  "el/benzin": "hibrīds (benzīns)",
  "el/diesel": "hibrīds (dīzelis)",
  brint: "ūdeņradis",
  // izmantošanas veidi
  "privat personkørsel": "privāta pasažieru pārvadāšana",
  "erhvervsmæssig personkørsel": "komerciāla pasažieru pārvadāšana",
  "erhvervsmæssig personkørsel (taxi)": "komerciāla pasažieru pārvadāšana (TAKSOMETRS)",
  taxi: "TAKSOMETRS",
  "udlejning uden fører": "īre bez vadītāja (rent-a-car)",
  køreskole: "autoskola",
  ambulance: "ātrā palīdzība",
  "godstransport erhverv": "komerciāli kravu pārvadājumi",
  "privat godstransport": "privāti kravu pārvadājumi",
  // virsbūve
  stationcar: "universālis",
  personbil: "vieglā automašīna",
  varebil: "furgons",
  "stor personbil": "liela vieglā automašīna",
};

const ET_TERMS: Record<string, string> = {
  // statusi
  "kehtiv": "spēkā esošs",
  "registrist kustutatud": "izslēgts no reģistra",
  "arvel": "reģistrēts",
  "ajutiselt kustutatud": "uz laiku izslēgts",
  liiklusregistris: "ceļu satiksmes reģistrā",
  // ierobežojumi
  piirangud: "ierobežojumi",
  "piiranguid ei ole": "ierobežojumu nav",
  arestitud: "arestēts",
  pant: "ķīla",
  // izmantošana
  takso: "TAKSOMETRS",
  taksovedu: "taksometra pārvadājumi",
  õppesõiduk: "mācību auto (autoskola)",
  rendiauto: "īres auto",
  "operatiivsõiduk": "operatīvais transportlīdzeklis",
  "sõiduauto": "vieglā automašīna",
  // apskate
  "korras": "izturēta",
  "puudustega": "ar trūkumiem",
  "mittevastav": "nav izturēta",
  ülevaatus: "tehniskā apskate",
  läbisõit: "nobraukums",
  omanik: "īpašnieks",
  kasutaja: "lietotājs",
  kasutusajalugu: "izmantošanas vēsture",
};

/** Viena termina tulkojums; nezināmu tekstu atgriež neizmainītu. */
export function translateTermLv(value: string, lang: "da" | "et"): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const dict = lang === "da" ? DA_TERMS : ET_TERMS;
  const hit = dict[raw.toLowerCase()];
  return hit ?? raw;
}

/**
 * Terminu aizvietošana garākā tekstā (piem. apskates defektu aprakstā),
 * lai operators redz latviskus jēdzienus arī tur, kur nav precīzas sakritības.
 */
export function translateTextLv(value: string, lang: "da" | "et"): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const exact = translateTermLv(raw, lang);
  if (exact !== raw) return exact;

  const dict = lang === "da" ? DA_TERMS : ET_TERMS;
  let out = raw;
  for (const [term, lv] of Object.entries(dict)) {
    if (term.length < 4) continue;
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    out = out.replace(re, lv);
  }
  return out;
}

/** Termini, kas norāda uz komerciālu / intensīvu ekspluatāciju (TAXI u.tml.). */
const SPECIAL_USE_PATTERNS: { re: RegExp; label: string }[] = [
  { re: /taxi|takso/i, label: "TAKSOMETRS" },
  { re: /udlejning uden fører|rendiauto|rent-?a-?car/i, label: "Īres auto (bez vadītāja)" },
  { re: /køreskole|õppesõiduk|driving school/i, label: "Autoskolas mācību auto" },
  { re: /ambulance|operatiivsõiduk|politsei|brandbil/i, label: "Operatīvais transportlīdzeklis" },
  { re: /erhvervsmæssig person/i, label: "Komerciāla pasažieru pārvadāšana" },
  { re: /leasing|liising/i, label: "Līzings" },
  { re: /godstransport erhverv/i, label: "Komerciāli kravu pārvadājumi" },
];

/** Atrod īpašos statusus tekstā — 4. prasība („jebkādi ieraksti par TAXI vai tml.”). */
export function detectSpecialUseLabels(text: string): string[] {
  const found = new Set<string>();
  for (const { re, label } of SPECIAL_USE_PATTERNS) {
    if (re.test(text)) found.add(label);
  }
  return [...found];
}
