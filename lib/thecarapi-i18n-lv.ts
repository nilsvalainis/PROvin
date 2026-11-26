/**
 * Izsoļu portāla (AUTO1 u.c.) i18n atslēgu un enum vērtību tulkojumi klienta PDF.
 * Ja tulkojuma nav, `humanizeToken()` pārvērš pēdējo segmentu lasāmā tekstā.
 * PDF nekad nedrīkst redzēt tekstu, kas sākas ar `global.`.
 *
 * Nākotnes vērtības: ja vārdnīcā nav tulkojuma, rezerve dod lasāmu tekstu UN reģistrē vērtību
 * (`thecarapiUntranslated()`, žurnālā viena rinda «[thecarapi-i18n] neiztulkots: ...» uz vērtību),
 * lai to var pievienot šai vārdnīcai. AI tulkošana netiek lietota (deterministisks PDF, bez maksas izsaukumiem).
 */

export type ThecarapiUntranslatedKind = "atslēga" | "vērtība" | "detaļa" | "zona" | "bojājums" | "i18n";

const UNTRANSLATED = new Map<string, { kind: ThecarapiUntranslatedKind; raw: string; shown: string }>();
const UNTRANSLATED_MAX = 500;

/** Reģistrē vērtību, kurai nav tulkojuma (rezerve jau dod lasāmu tekstu). */
export function noteThecarapiUntranslated(kind: ThecarapiUntranslatedKind, raw: string, shown: string): void {
  const value = raw.trim();
  if (!value || value.length > 80) return;
  const key = `${kind}:${value}`;
  if (UNTRANSLATED.has(key) || UNTRANSLATED.size >= UNTRANSLATED_MAX) return;
  UNTRANSLATED.set(key, { kind, raw: value, shown });
  if (process.env.NODE_ENV !== "test") console.warn(`[thecarapi-i18n] neiztulkots: ${kind} «${value}» -> «${shown}»`);
}

/** Visas šajā procesā sastaptās neiztulkotās vērtības (vārdnīcas papildināšanai). */
export function thecarapiUntranslated(): { kind: ThecarapiUntranslatedKind; raw: string; shown: string }[] {
  return [...UNTRANSLATED.values()];
}

export function resetThecarapiUntranslated(): void {
  UNTRANSLATED.clear();
}

const ZONES: Record<string, string> = {
  front: "Priekša",
  rear: "Aizmugure",
  back: "Aizmugure",
  left: "Kreisā puse",
  "left-side": "Kreisā puse",
  right: "Labā puse",
  "right-side": "Labā puse",
  roof: "Jumts",
  top: "Jumts",
  interior: "Salons",
  inside: "Salons",
  exterior: "Virsbūve (ārpuse)",
  body: "Virsbūve (ārpuse)",
  outside: "Virsbūve (ārpuse)",
  underbody: "Apakša",
  underside: "Apakša",
  engine: "Motora nodalījums",
  "engine-compartment": "Motora nodalījums",
  wheels: "Riteņi",
  glass: "Stikli",
  windows: "Stikli",
  trunk: "Bagāžnieks",
  technical: "Tehnika",
  "front-end": "Priekša",
  "rear-end": "Aizmugure",
  side: "Sāni",
  sides: "Sāni",
  "all-over": "Visa virsbūve",
  undercarriage: "Apakša",
  windscreen: "Stikli",
  windshield: "Stikli",
};

/** Zonu secība bojājumu tabulā. */
export const THECARAPI_ZONE_ORDER = [
  "Priekša",
  "Aizmugure",
  "Kreisā puse",
  "Labā puse",
  "Jumts",
  "Salons",
  "Virsbūve (ārpuse)",
];

type Gender = "m" | "f" | "pl";
type Noun = { lv: string; g: Gender };

const NOUNS: Record<string, Noun> = {
  bumper: { lv: "buferis", g: "m" },
  fender: { lv: "spārns", g: "m" },
  wing: { lv: "spārns", g: "m" },
  "side-panel": { lv: "sānu panelis", g: "m" },
  quarter: { lv: "spārns", g: "m" },
  door: { lv: "durvis", g: "pl" },
  doors: { lv: "durvis", g: "pl" },
  mirror: { lv: "spogulis", g: "m" },
  wheel: { lv: "ritenis", g: "m" },
  rim: { lv: "disks", g: "m" },
  tire: { lv: "riepa", g: "f" },
  tyre: { lv: "riepa", g: "f" },
  headlight: { lv: "lukturis", g: "m" },
  headlamp: { lv: "lukturis", g: "m" },
  light: { lv: "lukturis", g: "m" },
  lamp: { lv: "lukturis", g: "m" },
  taillight: { lv: "aizmugurējais lukturis", g: "m" },
  sill: { lv: "slieksnis", g: "m" },
  rocker: { lv: "slieksnis", g: "m" },
  pillar: { lv: "statnis", g: "m" },
  panel: { lv: "panelis", g: "m" },
  glass: { lv: "stikls", g: "m" },
  window: { lv: "logs", g: "m" },
  windshield: { lv: "vējstikls", g: "m" },
  windscreen: { lv: "vējstikls", g: "m" },
  seat: { lv: "sēdeklis", g: "m" },
  seats: { lv: "sēdekļi", g: "m" },
  hood: { lv: "motora pārsegs", g: "m" },
  bonnet: { lv: "motora pārsegs", g: "m" },
  roof: { lv: "jumts", g: "m" },
  trunk: { lv: "bagāžnieka vāks", g: "m" },
  tailgate: { lv: "bagāžnieka vāks", g: "m" },
  boot: { lv: "bagāžnieka vāks", g: "m" },
  "trunk-lid": { lv: "bagāžnieka vāks", g: "m" },
  grille: { lv: "reste", g: "f" },
  spoiler: { lv: "spoilers", g: "m" },
  handle: { lv: "rokturis", g: "m" },
  dashboard: { lv: "panelis", g: "m" },
  steering: { lv: "stūre", g: "f" },
  "steering-wheel": { lv: "stūre", g: "f" },
  carpet: { lv: "grīdas paklājs", g: "m" },
  headliner: { lv: "griestu apdare", g: "f" },
  upholstery: { lv: "polsterējums", g: "m" },
  exhaust: { lv: "izplūdes sistēma", g: "f" },
  axle: { lv: "ass", g: "f" },
  brake: { lv: "bremze", g: "f" },
  brakes: { lv: "bremzes", g: "pl" },
  disc: { lv: "disks", g: "m" },
  side: { lv: "puse", g: "f" },
  body: { lv: "virsbūve", g: "f" },
  underbody: { lv: "apakša", g: "f" },
  console: { lv: "konsole", g: "f" },
  sunroof: { lv: "lūka", g: "f" },
  antenna: { lv: "antena", g: "f" },
  "fog-light": { lv: "miglas lukturis", g: "m" },
  "license-plate": { lv: "numura zīme", g: "f" },
};

const ADJ: Record<string, Record<Gender, string>> = {
  front: { m: "priekšējais", f: "priekšējā", pl: "priekšējās" },
  rear: { m: "aizmugurējais", f: "aizmugurējā", pl: "aizmugurējās" },
  back: { m: "aizmugurējais", f: "aizmugurējā", pl: "aizmugurējās" },
  left: { m: "kreisais", f: "kreisā", pl: "kreisās" },
  right: { m: "labais", f: "labā", pl: "labās" },
  upper: { m: "augšējais", f: "augšējā", pl: "augšējās" },
  lower: { m: "apakšējais", f: "apakšējā", pl: "apakšējās" },
  inner: { m: "iekšējais", f: "iekšējā", pl: "iekšējās" },
  outer: { m: "ārējais", f: "ārējā", pl: "ārējās" },
  center: { m: "vidējais", f: "vidējā", pl: "vidējās" },
  middle: { m: "vidējais", f: "vidējā", pl: "vidējās" },
};

/** Vienas pozīcijas (ritenis, bremze) nosaukums: `front-left` -> «Priekšējais kreisais». */
const POSITIONS: Record<string, string> = {
  "front-left": "Priekšējais kreisais",
  "front-right": "Priekšējais labais",
  "rear-left": "Aizmugurējais kreisais",
  "rear-right": "Aizmugurējais labais",
  fl: "Priekšējais kreisais",
  fr: "Priekšējais labais",
  rl: "Aizmugurējais kreisais",
  rr: "Aizmugurējais labais",
  front: "Priekšējie",
  rear: "Aizmugurējie",
  spare: "Rezerves",
};

const DAMAGE_TYPES: Record<string, string> = {
  scratch: "Skrāpējums",
  scratches: "Skrāpējumi",
  dent: "Iespiedums",
  dents: "Iespiedumi",
  "missing-parts": "Trūkst detaļas",
  "missing-part": "Trūkst detaļas",
  missing: "Trūkst",
  crack: "Plaisa",
  cracked: "Plaisa",
  chip: "Šķemba",
  "stone-chip": "Akmens šķemba",
  "stone-chips": "Akmens šķembas",
  rust: "Rūsa",
  corrosion: "Korozija",
  "paint-damage": "Lakas bojājums",
  paint: "Lakas bojājums",
  broken: "Salūzis",
  deformation: "Deformācija",
  deformed: "Deformācija",
  worn: "Nodilums",
  wear: "Nodilums",
  stain: "Traips",
  stains: "Traipi",
  hole: "Caurums",
  tear: "Plīsums",
  torn: "Plīsums",
  burn: "Apdegums",
  "previous-repair": "Iepriekšējs remonts",
  repaired: "Iepriekšējs remonts",
  "bad-repair": "Nekvalitatīvs remonts",
  "hail-damage": "Krusas bojājums",
  hail: "Krusas bojājums",
  "accident-damage": "Avārijas bojājums",
  damaged: "Bojāts",
  "not-working": "Nedarbojas",
  defect: "Defekts",
  "glass-damage": "Stikla bojājums",
  "front-end": "Priekšpuses bojājums",
  "rear-end": "Aizmugures bojājums",
  side: "Sānu bojājums",
  "all-over": "Bojājumi visā virsbūvē",
  "minor-dent-scratches": "Nelieli iespiedumi un skrāpējumi",
  "minor-dents-scratches": "Nelieli iespiedumi un skrāpējumi",
  "normal-wear": "Normāls nolietojums",
  "normal-wear-and-tear": "Normāls nolietojums",
  mechanical: "Mehānisks bojājums",
  "mechanical-damage": "Mehānisks bojājums",
  undercarriage: "Apakšdaļas bojājums",
  rollover: "Apgāšanās",
  vandalism: "Vandālisms",
  flood: "Applūdis",
  water: "Ūdens bojājums",
  "water-flood": "Applūdis",
  fire: "Ugunsgrēka bojājums",
  "burn-engine": "Motora nodalījuma apdegums",
  "burn-interior": "Salona apdegums",
  "partial-repair": "Daļējs remonts",
  "replaced-vin": "Nomainīts VIN",
  biohazard: "Bioloģisks piesārņojums",
  "frame-damage": "Rāmja bojājums",
  "suspension-damage": "Balstiekārtas bojājums",
  "electrical-damage": "Elektrības bojājums",
  "engine-damage": "Dzinēja bojājums",
  "transmission-damage": "Ātrumkārbas bojājums",
  theft: "Zādzības bojājums",
  "theft-recovery": "Atgūts pēc zādzības",
  "glass-chip": "Stikla šķemba",
  "glass-crack": "Stikla plaisa",
  "windscreen-chip": "Vējstikla šķemba",
  "curb-damage": "Apmales bojājums",
  "rim-damage": "Diska bojājums",
  "paint-defect": "Lakas defekts",
  "paint-scratch": "Lakas skrāpējums",
  "paintwork-damage": "Lakas bojājums",
  pitting: "Šķembas",
  "stone-chipping": "Akmens šķembas",
  scuff: "Noberzums",
  scuffs: "Noberzumi",
  scuffed: "Noberzums",
  scrape: "Noberzums",
  bent: "Saliekts",
  "panel-gap": "Nevienmērīga sprauga",
  misaligned: "Nepareizi novietots",
  loose: "Vaļīgs",
  dirty: "Netīrs",
  faded: "Izbalējis",
  dull: "Matēts",
  "repair-needed": "Nepieciešams remonts",
  replacement: "Nepieciešama nomaiņa",
  corroded: "Korozija",
  "surface-rust": "Virsmas rūsa",
  welding: "Metināts",
  "panel-repair": "Paneļa remonts",
  unevenness: "Nelīdzenums",
};

const DAMAGE_DESCRIPTIONS: Record<string, string> = {
  "depth.deep-to-primer": "līdz gruntij",
  "depth.to-primer": "līdz gruntij",
  "depth.deep": "dziļš",
  "depth.superficial": "virspusējs",
  "depth.surface": "virspusējs",
  "depth.light": "viegls",
  "depth.to-metal": "līdz metālam",
  "depth.deep-to-metal": "līdz metālam",
  "depth.clear-coat": "laka",
  "depth.to-clear-coat": "laka",
  "depth.paint-only": "tikai lakā",
  "depth.to-paint": "līdz krāsas slānim",
  "depth.through-paint": "cauri krāsas slānim",
  "deep-to-primer": "līdz gruntij",
  superficial: "virspusējs",
  light: "viegls",
  medium: "vidējs",
  severe: "smags",
  heavy: "smags",
  minor: "neliels",
  major: "liels",
  "with-paint-damage": "ar lakas bojājumu",
  "without-paint-damage": "bez lakas bojājuma",
  moderate: "vidējs",
  small: "neliels",
  large: "liels",
  significant: "būtisks",
  cosmetic: "kosmētisks",
  structural: "konstruktīvs",
};

/**
 * Bojājuma dziļums / apraksts kā patstāvīgs teksts (izsoles kartītes «Izsoles apraksts»), ne kā piebilde
 * pie bojājuma tipa («Skrāpējums līdz gruntij»). Atslēga - `global.damages-v3.description.` aste.
 */
const DAMAGE_DESCRIPTIONS_STANDALONE: Record<string, string> = {
  "depth.deep-to-primer": "Dziļš, līdz gruntij",
  "depth.to-primer": "Līdz gruntij",
  "depth.deep": "Dziļš",
  "depth.superficial": "Virspusējs",
  "depth.surface": "Virspusējs",
  "depth.light": "Viegls",
  "depth.to-metal": "Līdz metālam",
  "depth.deep-to-metal": "Dziļš, līdz metālam",
  "depth.clear-coat": "Tikai lakas slānī",
  "depth.to-clear-coat": "Tikai lakas slānī",
  "depth.paint-only": "Tikai lakas slānī",
  "depth.to-paint": "Līdz krāsas slānim",
  "depth.through-paint": "Cauri krāsas slānim",
  "with-paint-damage": "Ar lakas bojājumu",
  "without-paint-damage": "Bez lakas bojājuma",
};

const BRAKES: Record<string, string> = {
  "type.disc": "Disku bremzes",
  "type.drum": "Trumuļa bremzes",
  "type.disc-brake": "Disku bremzes",
  "type.drum-brake": "Trumuļa bremzes",
  disc: "Disku bremzes",
  drum: "Trumuļa bremzes",
  "discCondition.not-measurable": "nav izmērāms",
  "discCondition.ok": "OK",
  "discCondition.good": "labs",
  "discCondition.worn": "nodilis",
  "discCondition.rusty": "sarūsējis",
  "not-measurable": "nav izmērāms",
};

const WHEELS: Record<string, string> = {
  "tireType.summer": "Vasaras",
  "tireType.winter": "Ziemas",
  "tireType.all-season": "Vissezonas",
  "tireType.allseason": "Vissezonas",
  summer: "Vasaras",
  winter: "Ziemas",
  "all-season": "Vissezonas",
  "tireCondition.as-good-as-new": "Kā jauna",
  "tireCondition.new": "Jauna",
  "tireCondition.good": "Laba",
  "tireCondition.used": "Lietota",
  "tireCondition.worn": "Nodilusi",
  "tireCondition.damaged": "Bojāta",
  "as-good-as-new": "Kā jauns",
  "rimType.alloy": "Alumīnija",
  "rimType.aluminium": "Alumīnija",
  "rimType.aluminum": "Alumīnija",
  "rimType.steel": "Tērauda",
  "rimType.steel-with-hubcap": "Tērauda ar uzliku",
  alloy: "Alumīnija",
  aluminium: "Alumīnija",
  aluminum: "Alumīnija",
  steel: "Tērauda",
};

/** Bieži enum. Atslēga ir mazajiem burtiem. */
const ENUMS: Record<string, string> = {
  not_new_car: "Lietots",
  new_car: "Jauns",
  used: "Lietots",
  "company-car": "Uzņēmuma auto",
  company_car: "Uzņēmuma auto",
  "rental-car": "Nomas auto",
  rental: "Nomas auto",
  taxi: "Taksometrs",
  "driving-school": "Autoskola",
  leasing: "Līzings",
  "private-car": "Privāts auto",
  private: "Privāts",
  paper: "Papīra",
  digital: "Digitāla",
  electronic: "Elektroniska",
  none: "Nav",
  no: "Nē",
  yes: "Jā",
  some: "Daļēji",
  partial: "Daļēji",
  full: "Pilna",
  complete: "Pilna",
  diesel: "Dīzelis",
  petrol: "Benzīns",
  gasoline: "Benzīns",
  electric: "Elektrība",
  hybrid: "Hibrīds",
  "plug-in-hybrid": "Uzlādējams hibrīds",
  lpg: "Gāze (LPG)",
  cng: "Gāze (CNG)",
  manual: "Manuāla",
  automatic: "Automātiska",
  "semi-automatic": "Pusautomātiska",
  van: "Minivens",
  minivan: "Minivens",
  mpv: "Minivens",
  sedan: "Sedans",
  saloon: "Sedans",
  hatchback: "Hečbeks",
  "station-wagon": "Universālis",
  estate: "Universālis",
  wagon: "Universālis",
  suv: "Apvidus (SUV)",
  coupe: "Kupeja",
  convertible: "Kabriolets",
  cabrio: "Kabriolets",
  pickup: "Pikaps",
  transporter: "Furgons",
  black: "Melna",
  white: "Balta",
  silver: "Sudraba",
  grey: "Pelēka",
  gray: "Pelēka",
  blue: "Zila",
  red: "Sarkana",
  green: "Zaļa",
  brown: "Brūna",
  beige: "Bēša",
  yellow: "Dzeltena",
  orange: "Oranža",
  ok: "OK",
  cloth: "Auduma",
  fabric: "Auduma",
  leather: "Āda",
  "partial-leather": "Daļēji āda",
  alcantara: "Alkantara",
  good: "Labs",
  unknown: "Nav zināms",
  "not-measurable": "Nav izmērāms",
  warning: "Brīdinājums",
  bad: "Slikts",
  front: "Priekšējā",
  rear: "Aizmugurējā",
  "all-wheel": "Pilnpiedziņa",
  awd: "Pilnpiedziņa",
  "4x4": "Pilnpiedziņa",
  fwd: "Priekšpiedziņa",
  rwd: "Aizmugurpiedziņa",
  "service-book": "Servisa grāmata",
  service_book: "Servisa grāmata",
  coc: "COC",
  "coc-document": "COC",
  "registration-document": "Reģistrācijas apliecība",
  registration: "Reģistrācijas apliecība",
  "registration-certificate": "Reģistrācijas apliecība",
  invoice: "Rēķins",
  "inspection-report": "Tehniskās apskates protokols",
  "tuv-report": "Tehniskās apskates protokols",
  // TheCarApi v1 (publiskā dokumentācija 11.2026)
  left: "Kreisā",
  right: "Labā",
  lhd: "Kreisā",
  rhd: "Labā",
  stated: "Norādīts avotā",
  equipment: "Pēc aprīkojuma",
  flag: "Pēc avota atzīmes",
  model_name: "Pēc modeļa nosaukuma",
  "model-name": "Pēc modeļa nosaukuma",
  model_rule: "Pēc modeļa noteikuma",
  "model-rule": "Pēc modeļa noteikuma",
  internal_damage_report: "Salona bojājumu atskaite",
  "internal-damage-report": "Salona bojājumu atskaite",
  external_damage_report: "Ārējo bojājumu atskaite",
  "external-damage-report": "Ārējo bojājumu atskaite",
  maintenance_records: "Apkopes ieraksti",
  "maintenance-records": "Apkopes ieraksti",
  battery_health_report: "Akumulatora stāvokļa atskaite",
  "battery-health-report": "Akumulatora stāvokļa atskaite",
  option_report: "Aprīkojuma atskaite",
  "option-report": "Aprīkojuma atskaite",
  inspection_report: "Pārbaudes atskaite",
  report: "Atskaite",
  available: "Pieejams",
  unavailable: "Nav pieejams",
  sold: "Pārdots",
  unsold: "Nav pārdots",
  active: "Aktīva",
  ended: "Beigusies",
  closed: "Slēgta",
  cancelled: "Atcelta",
  canceled: "Atcelta",
  withdrawn: "Atsaukta",
  pending: "Gaida",
  margin: "Peļņas daļas režīms (bez PVN)",
  "margin-scheme": "Peļņas daļas režīms (bez PVN)",
  regular: "Ar PVN",
  "vat-deductible": "PVN atskaitāms",
  "vat-qualifying": "PVN atskaitāms",
  net: "Bez PVN",
  gross: "Ar PVN",
  export: "Eksportam",
  salvage: "Avārijas auto (salvage)",
  clean: "Tīrs",
  "clean-title": "Tīrs",
  "certificate-of-destruction": "Utilizācijas apliecība",
  rebuilt: "Atjaunots",
  "non-repairable": "Neremontējams",
  "run-and-drive": "Iedarbojas un brauc",
  "starts-only": "Tikai iedarbojas",
  "does-not-start": "Neiedarbojas",
  dealer: "Dīleris",
  fleet: "Autoparks",
  lease: "Līzings",
  "lease-return": "Līzinga atgriezts",
  "rental-return": "Nomas atgriezts",
  manufacturer: "Ražotājs",
  insurance: "Apdrošinātājs",
  "former-taxi": "Bijušais taksometrs",
  demo: "Demonstrācijas auto",
  "demonstration-car": "Demonstrācijas auto",
  "electric-hybrid": "Hibrīds",
  "mild-hybrid": "Viegls hibrīds",
  hydrogen: "Ūdeņradis",
  ethanol: "Etanols",
  limousine: "Sedans",
  "off-road": "Apvidus",
  cabriolet: "Kabriolets",
  roadster: "Rodsters",
  "small-car": "Mazais auto",
  "panel-van": "Furgons",
  bus: "Mikroautobuss",
  minibus: "Mikroautobuss",
  violet: "Violeta",
  purple: "Violeta",
  gold: "Zelta",
  bronze: "Bronzas",
  "dark-blue": "Tumši zila",
  "light-blue": "Gaiši zila",
  "dark-grey": "Tumši pelēka",
  anthracite: "Antracīta",
  "multi-colour": "Daudzkrāsaina",
  other: "Cita",
  excellent: "Teicams",
  "very-good": "Ļoti labs",
  fair: "Apmierinošs",
  poor: "Slikts",
  average: "Vidējs",
  "not-available": "Nav pieejams",
  "not-applicable": "Nav attiecināms",
  missing: "Trūkst",
  present: "Ir",
  absent: "Nav",
};

const COUNTRIES: Record<string, string> = {
  DE: "Vācija",
  AT: "Austrija",
  BE: "Beļģija",
  NL: "Nīderlande",
  FR: "Francija",
  IT: "Itālija",
  ES: "Spānija",
  PT: "Portugāle",
  PL: "Polija",
  CZ: "Čehija",
  SK: "Slovākija",
  HU: "Ungārija",
  SI: "Slovēnija",
  HR: "Horvātija",
  RO: "Rumānija",
  BG: "Bulgārija",
  DK: "Dānija",
  SE: "Zviedrija",
  NO: "Norvēģija",
  FI: "Somija",
  EE: "Igaunija",
  LV: "Latvija",
  LT: "Lietuva",
  LU: "Luksemburga",
  CH: "Šveice",
  GB: "Lielbritānija",
  UK: "Lielbritānija",
  IE: "Īrija",
  GR: "Grieķija",
  US: "ASV",
  KR: "Dienvidkoreja",
  JP: "Japāna",
};

/** Atslēgu nosaukumi «Citi dati» un citām sadaļām. Atslēga ir normalizēta: mazie burti bez `_`/`-`. */
const KEY_LABELS: Record<string, string> = {
  doorcount: "Durvju skaits",
  doors: "Durvju skaits",
  seatcount: "Sēdvietu skaits",
  seats: "Sēdvietu skaits",
  countryoforigin: "Izcelsmes valsts",
  countryofregistration: "Reģistrācijas valsts",
  carcountry: "Valsts",
  carcountryextended: "Valsts",
  country: "Valsts",
  handoverkeycount: "Atslēgu skaits",
  keycount: "Atslēgu skaits",
  totalownercalculated: "Īpašnieku skaits",
  owners: "Īpašnieku skaits",
  ownercount: "Īpašnieku skaits",
  inspectionexpirydate: "Tehniskā apskate derīga līdz",
  nextinspection: "Nākamā tehniskā apskate",
  accidents: "Negadījumi",
  hadaccident: "Negadījumi",
  accidentfree: "Bez negadījumiem",
  originalengine: "Oriģinālais dzinējs",
  emissionclass: "Emisiju klase",
  euronorm: "Emisiju klase",
  emissionstandard: "Emisiju klase",
  drivetrain: "Piedziņa",
  drivetype: "Piedziņa",
  cylinders: "Cilindri",
  gears: "Pārnesumu skaits",
  gearcount: "Pārnesumu skaits",
  weight: "Svars",
  location: "Atrašanās vieta",
  city: "Pilsēta",
  seller: "Pārdevējs",
  sellername: "Pārdevējs",
  sellertype: "Pārdevēja tips",
  status: "Statuss",
  isactive: "Aktīva izsole",
  archived: "Avota arhīvā",
  vat: "PVN",
  vatdeductible: "PVN atskaitāms",
  vatreclaimable: "PVN atskaitāms",
  currency: "Valūta",
  bidcount: "Solījumu skaits",
  bids: "Solījumu skaits",
  interiorcolor: "Salona krāsa",
  interiorcolour: "Salona krāsa",
  interiortype: "Salona apdare",
  upholstery: "Salona apdare",
  metallic: "Metālika",
  modelyear: "Modeļa gads",
  highlights: "Izceltie punkti",
  highlight: "Izceltais punkts",
  note: "Piezīme",
  notes: "Piezīmes",
  comment: "Komentārs",
  comments: "Komentāri",
  description: "Apraksts",
  remarks: "Piezīmes",
  taxi: "Taksometrs",
  rental: "Nomas auto",
  imported: "Importēts",
  reimported: "Reimportēts",
  nonsmoker: "Nesmēķētāja auto",
  smoker: "Smēķētāja auto",
  pets: "Mājdzīvnieki",
  hasbeenrepainted: "Pārkrāsots",
  repainted: "Pārkrāsots",
  hasbeenrepaired: "Remontēts",
  warranty: "Garantija",
  warrantyuntil: "Garantija līdz",
  euplatform: "Platforma",
  platform: "Platforma",
  sitename: "Platforma",
  marketpricesbycountry: "Tirgus cena",
  title: "Nosaukums",
  makeid: "Markas kods",
  modelid: "Modeļa kods",
  enginecode: "Dzinēja kods",
  engine: "Dzinējs",
  enginetype: "Dzinēja tips",
  power: "Jauda",
  torque: "Griezes moments",
  consumption: "Patēriņš",
  fuelconsumption: "Degvielas patēriņš",
  range: "Nobraukums ar uzlādi",
  batterycapacity: "Akumulatora ietilpība",
  name: "Nosaukums",
  type: "Tips",
  value: "Vērtība",
  date: "Datums",
  count: "Skaits",
  total: "Kopā",
  quantity: "Daudzums",
  category: "Kategorija",
  condition: "Stāvoklis",
  conditiongrade: "Stāvokļa vērtējums",
  grade: "Vērtējums",
  rating: "Vērtējums",
  score: "Vērtējums",
  hasservicebook: "Servisa grāmata",
  servicebook: "Servisa grāmata",
  smell: "Smaka",
  odour: "Smaka",
  odor: "Smaka",
  warninglights: "Brīdinājuma lampiņas",
  airbags: "Drošības spilveni",
  lastservicedate: "Pēdējais serviss",
  lastservicemileage: "Pēdējā servisa nobraukums",
  lastservicekm: "Pēdējā servisa nobraukums",
  servicebooktype: "Servisa grāmata",
  servicerecords: "Servisa ieraksti",
  servicehistory: "Servisa vēsture",
  timingbeltchanged: "Zobsiksna mainīta",
  timingbelt: "Zobsiksna",
  // TheCarApi v1 (publiskā dokumentācija 11.2026) un citas platformas
  cleanmake: "Marka",
  cleanmodel: "Modelis",
  registrationyear: "Reģistrācijas gads",
  fuelgroup: "Degviela",
  gearboxgroup: "Ātrumkārba",
  steering: "Stūre",
  drivetrainsource: "Piedziņa noteikta",
  drivetrainsystem: "Piedziņas sistēma",
  drivetrainselectable: "Pieslēdzama pilnpiedziņa",
  cocavailable: "COC dokuments",
  registrationdocsavailable: "Reģistrācijas dokumenti",
  isv5present: "V5 dokuments",
  licenseplate: "Numura zīme",
  paperwork: "Dokumenti",
  inspectionreports: "Pārbaudes atskaites",
  carreports: "Auto atskaites",
  damagecomment: "Bojājumu komentārs",
  damageservicecomment: "Bojājumu servisa komentārs",
  technicalissues: "Tehniskās problēmas",
  hastechnicalissues: "Tehniskas problēmas",
  isdamaged: "Bojāts",
  technicalinspection: "Tehniskā apskate",
  technicalinspectiondate: "Tehniskā apskate",
  othernotes: "Citas piezīmes",
  profile: "Profils",
  specs: "Specifikācija",
  kbdiagnosis: "KB diagnostika",
  kbinspection: "KB pārbaude",
  panelmarks: "Paneļu atzīmes",
  checkedcontrols: "Pārbaudītie punkti",
  livepriceprice: "Tiešsaistes cena",
  fetchedat: "Cena pārbaudīta",
  source: "Avots",
  estimatedvalue: "Aplēstā vērtība",
  mileagekm: "Nobraukums",
  company: "Serviss",
  workshop: "Serviss",
  vattype: "PVN režīms",
  vatstatus: "PVN režīms",
  taxtype: "PVN režīms",
  runanddrive: "Iedarbojas un brauc",
  rundrive: "Iedarbojas un brauc",
  primarydamage: "Galvenais bojājums",
  secondarydamage: "Papildu bojājums",
  keysavailable: "Atslēgas",
  haskeys: "Atslēgas",
  titletype: "Dokumentu statuss",
  saletitle: "Dokumentu statuss",
  buildsheetseries: "Sērija",
  series: "Sērija",
  previoususe: "Iepriekšējā lietošana",
  usage: "Lietošana",
  lotnumber: "Lota numurs",
  lot: "Lota numurs",
  stocknumber: "Krājuma numurs",
  region: "Reģions",
  postcode: "Pasta indekss",
  zip: "Pasta indekss",
  street: "Iela",
  address: "Adrese",
  severity: "Smagums",
  panel: "Panelis",
  thickness: "Biezums",
  odometerunit: "Nobraukuma mērvienība",
  enginecapacity: "Dzinēja tilpums",
  margin: "Peļņas daļas režīms",
  exportprice: "Eksporta cena",
  netprice: "Cena bez PVN",
  grossprice: "Cena ar PVN",
  auctiontype: "Izsoles veids",
  saletype: "Pārdošanas veids",
  saleschannel: "Pārdošanas kanāls",
  conditionreport: "Stāvokļa atskaite",
  lastseen: "Pēdējo reizi redzēta",
  firstseen: "Pirmoreiz redzēta",
};

export function normKey(key: string): string {
  return key.replace(/^history_/, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

/** `rain_sensor_wipers` / `profileDepth` / `as-good-as-new` -> «Rain sensor wipers» / «Profile depth». */
export function humanizeToken(raw: string): string {
  const s = raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "";
  const lower = /^[A-Z0-9 ]+$/.test(s) && s.length > 4 ? s.toLowerCase() : s;
  return lower.charAt(0).toUpperCase() + lower.slice(1).toLowerCase().replace(/\b(led|abs|esp|asr|dsc|usb|gps|tv|dvd|cd|mp3|isofix|coc|vin|bmw|dab|hud|acc|lpg|cng)\b/g, (m) => m.toUpperCase());
}

function sizeText(rest: string): string {
  const between = /gte-(\d+(?:\.\d+)?)(mm|cm)-lt-(\d+(?:\.\d+)?)(mm|cm)/.exec(rest);
  if (between) return `${between[1]}-${between[3]} ${between[4]}`;
  const lt = /(?:^|\.|-)lt-(\d+(?:\.\d+)?)(mm|cm)/.exec(rest);
  if (lt) return `līdz ${lt[1]} ${lt[2]}`;
  const gte = /(?:^|\.|-)gte?-(\d+(?:\.\d+)?)(mm|cm)/.exec(rest);
  if (gte) return `no ${gte[1]} ${gte[2]}`;
  return "";
}

function thicknessText(last: string): string {
  const gte = /^gte?-(\d+(?:\.\d+)?)(mm)$/.exec(last);
  if (gte) return `≥${gte[1]} mm`;
  const lt = /^lt-(\d+(?:\.\d+)?)(mm)$/.exec(last);
  if (lt) return `<${lt[1]} mm`;
  const between = /^gte-(\d+)mm-lt-(\d+)mm$/.exec(last);
  if (between) return `${between[1]}-${between[2]} mm`;
  return "";
}

/** `rear-bumper` -> «Aizmugurējais buferis». */
export function translatePart(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (!key) return "";
  if (NOUNS[key]) return capitalize(NOUNS[key].lv);
  if (POSITIONS[key]) return POSITIONS[key];
  const tokens = key.split("-").filter(Boolean);
  // Lietvārds var būt divi tokeni (side-panel, fog-light).
  for (let take = 2; take >= 1; take -= 1) {
    if (tokens.length < take) continue;
    const nounKey = tokens.slice(tokens.length - take).join("-");
    const noun = NOUNS[nounKey];
    if (!noun) continue;
    const adjs = tokens.slice(0, tokens.length - take);
    if (!adjs.every((t) => ADJ[t])) continue;
    const words = [...adjs.map((t) => ADJ[t]![noun.g]), noun.lv];
    return capitalize(words.join(" "));
  }
  const shown = humanizeToken(raw);
  noteThecarapiUntranslated("detaļa", raw, shown);
  return shown;
}

/** Bojājuma zona no `area` atslēgas vai detaļas nosaukuma. */
export function translateZone(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (ZONES[key]) return ZONES[key];
  const shown = humanizeToken(raw);
  noteThecarapiUntranslated("zona", raw, shown);
  return shown;
}

export function zoneFromPart(rawPart: string): string {
  const key = rawPart.trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (/(^|-)(roof|sunroof)(-|$)/.test(key)) return ZONES.roof!;
  if (/(seat|dashboard|steering|carpet|headliner|upholstery|console|interior)/.test(key)) return ZONES.interior!;
  if (/(^|-)(front|hood|bonnet|windshield|windscreen|grille)(-|$)/.test(key)) {
    if (/(^|-)left(-|$)/.test(key) && /(door|fender|wing|mirror|sill)/.test(key)) return ZONES.left!;
    if (/(^|-)right(-|$)/.test(key) && /(door|fender|wing|mirror|sill)/.test(key)) return ZONES.right!;
    return ZONES.front!;
  }
  if (/(^|-)(rear|back|trunk|tailgate|boot)(-|$)/.test(key)) {
    if (/(^|-)left(-|$)/.test(key) && /(door|fender|wing|side-panel|quarter)/.test(key)) return ZONES.left!;
    if (/(^|-)right(-|$)/.test(key) && /(door|fender|wing|side-panel|quarter)/.test(key)) return ZONES.right!;
    return ZONES.rear!;
  }
  if (/(^|-)left(-|$)/.test(key)) return ZONES.left!;
  if (/(^|-)right(-|$)/.test(key)) return ZONES.right!;
  return "";
}

export function translatePosition(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
  if (POSITIONS[key]) return POSITIONS[key];
  return translatePart(raw);
}

function enumKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[_\s/]+/g, "-").replace(/-+/g, "-");
}

export function translateDamageDescription(raw: string): string {
  const key = enumKey(raw);
  return DAMAGE_DESCRIPTIONS[key] ?? "";
}

/** Tikai vārdnīcas trāpījums (bez rezerves). */
export function knownDamageType(raw: string): string {
  return DAMAGE_TYPES[enumKey(raw)] ?? "";
}

export function translateDamageType(raw: string): string {
  const known = knownDamageType(raw);
  if (known) return known;
  const shown = humanizeToken(raw);
  noteThecarapiUntranslated("bojājums", raw, shown);
  return shown;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function countryName(code: string): string {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return code.trim();
  const name = COUNTRIES[c];
  return name ? `${name} (${c})` : c;
}

export function isI18nKey(raw: string): boolean {
  return /^global\.[\w.-]+/i.test(raw.trim());
}

/** Kura i18n saime (`area`, `part`, `type`, `description`, `size`, `quantity`, `sub-area`) ir šai vērtībai. */
export function i18nFamily(raw: string): { domain: string; family: string; rest: string } | null {
  const m = /^global\.([\w-]+)\.([^.]+)(?:\.(.*))?$/i.exec(raw.trim());
  if (!m) return null;
  return { domain: m[1]!.toLowerCase(), family: m[2]!, rest: m[3] ?? "" };
}

/** `global.damages-v3.size.length.gte-20mm-lt-50mm` -> «20-50 mm». Rezerve: pēdējais segments lasāmā tekstā. */
export function translateI18n(raw: string): string {
  const value = raw.trim();
  const fam = i18nFamily(value);
  if (!fam) return value;
  const { domain, family, rest } = fam;
  const last = (rest || family).split(".").pop() ?? "";
  if (domain.startsWith("damages")) {
    if (family === "area" || family === "zone") return translateZone(rest || last);
    if (family === "part" || family === "sub-area" || family === "subarea" || family === "parts") return translatePart(last);
    if (family === "type" || family === "types") return translateDamageType(last);
    if (family === "description") return DAMAGE_DESCRIPTIONS[rest] ?? DAMAGE_DESCRIPTIONS[last] ?? humanizeToken(last).toLowerCase();
    if (family === "size") return sizeText(rest) || humanizeToken(last);
    if (family === "quantity") return /^\d+$/.test(last) ? last : humanizeToken(last);
  }
  if (domain === "brakes") {
    return BRAKES[`${family}.${rest}`] ?? BRAKES[rest] ?? (thicknessText(last) || humanizeToken(last));
  }
  if (domain === "wheels" || domain === "tires" || domain === "tyres") {
    return WHEELS[`${family}.${rest}`] ?? WHEELS[rest] ?? (thicknessText(last) || humanizeToken(last));
  }
  if (domain === "equipment_groups" || domain === "equipment-groups" || family === "equipment_groups") {
    return (rest || last).trim();
  }
  const generic = DAMAGE_DESCRIPTIONS[rest] ?? ENUMS[last.toLowerCase()];
  if (generic) return generic;
  const derived = thicknessText(last) || sizeText(rest);
  if (derived) return derived;
  const shown = humanizeToken(last);
  noteThecarapiUntranslated("i18n", value, shown);
  return shown;
}

/**
 * Izsoles brīvā teksta laukā (apraksts, komentārs) nonākusi i18n atslēga (`global.damages-v3.description.depth.deep-to-primer`)
 * -> saprotams LV teksts («Dziļš, līdz gruntij»). Nezināmai atslēgai - pēdējās daļas lasāms teksts, nekad pati atslēga.
 * Ne-atslēgu teksts paliek kā ir.
 */
export function thecarapiFreeText(raw: string): string {
  const value = raw.replace(/\s+/g, " ").trim();
  if (!isI18nKey(value)) return value;
  const fam = i18nFamily(value);
  if (fam && fam.domain.startsWith("damages") && fam.family === "description") {
    const last = (fam.rest || fam.family).split(".").pop() ?? "";
    const known = DAMAGE_DESCRIPTIONS_STANDALONE[fam.rest] ?? DAMAGE_DESCRIPTIONS_STANDALONE[last] ?? DAMAGE_DESCRIPTIONS[fam.rest] ?? DAMAGE_DESCRIPTIONS[last];
    if (known) return capitalize(known);
    const shown = humanizeToken(last);
    noteThecarapiUntranslated("i18n", value, shown);
    return shown;
  }
  const out = capitalize(translateI18n(value).trim());
  if (out && !isI18nKey(out) && !/^global\./i.test(out)) return out;
  return humanizeToken(value.split(".").pop() ?? "");
}

/** Enum vērtība (`NOT_NEW_CAR`, `company-car`, `paper`). Ja nav zināma, atgriež tukšu. */
export function translateEnum(raw: string): string {
  const key = raw.trim().toLowerCase();
  return ENUMS[key] ?? ENUMS[key.replace(/_/g, "-")] ?? ENUMS[enumKey(key)] ?? WHEELS[key] ?? "";
}

export function looksLikeEnum(raw: string): boolean {
  const v = raw.trim();
  if (!v || v.length > 40) return false;
  return /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)+$/.test(v) || /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(v);
}

export function keyLabel(key: string): string {
  const n = normKey(key);
  const known = KEY_LABELS[n];
  if (known) return known;
  const shown = humanizeToken(key.replace(/^history_/, ""));
  noteThecarapiUntranslated("atslēga", key.replace(/^history_/, ""), shown);
  return shown;
}

const EQUIPMENT_LV: Record<string, string> = {
  rainsensorwipers: "Lietus sensors",
  rainsensor: "Lietus sensors",
  servosteering: "Stūres pastiprinātājs",
  powersteering: "Stūres pastiprinātājs",
  towbar: "Sakabe",
  trailerhitch: "Sakabe",
  navigation: "Navigācija",
  navigationsystem: "Navigācija",
  abs: "ABS",
  esp: "ESP",
  cruisecontrol: "Kruīza kontrole",
  adaptivecruisecontrol: "Adaptīvā kruīza kontrole",
  parkingsensors: "Parkošanās sensori",
  parkdistancecontrol: "Parkošanās sensori",
  rearparkingsensors: "Aizmugurējie parkošanās sensori",
  frontparkingsensors: "Priekšējie parkošanās sensori",
  heatedseats: "Apsildāmi sēdekļi",
  seatheating: "Apsildāmi sēdekļi",
  airconditioning: "Kondicionieris",
  climatecontrol: "Klimata kontrole",
  alloywheels: "Vieglmetāla diski",
  bluetooth: "Bluetooth",
  ledheadlights: "LED lukturi",
  xenonheadlights: "Ksenona lukturi",
  xenon: "Ksenona lukturi",
  panoramicroof: "Panorāmas jumts",
  panoramaroof: "Panorāmas jumts",
  sunroof: "Lūka",
  leatherseats: "Ādas sēdekļi",
  leather: "Ādas salons",
  rearcamera: "Atpakaļskata kamera",
  reversingcamera: "Atpakaļskata kamera",
  camera: "Kamera",
  startstop: "Start-stop sistēma",
  startstopsystem: "Start-stop sistēma",
  isofix: "ISOFIX",
  electricwindows: "Elektriskie logi",
  powerwindows: "Elektriskie logi",
  centrallocking: "Centrālā atslēga",
  keyless: "Bezatslēgas piekļuve",
  keylessentry: "Bezatslēgas piekļuve",
  lpg: "Gāzes iekārta",
  gassystem: "Gāzes iekārta",
  cng: "Gāzes iekārta (CNG)",
  headupdisplay: "Projekcijas displejs (HUD)",
  sportsseats: "Sporta sēdekļi",
  sportseats: "Sporta sēdekļi",
  electricseats: "Elektriski regulējami sēdekļi",
  heatedsteeringwheel: "Apsildāma stūre",
  multifunctionsteeringwheel: "Multifunkcionāla stūre",
  foglights: "Miglas lukturi",
  lanedeparturewarning: "Joslas uzraudzība",
  laneassist: "Joslas uzraudzība",
  blindspotassist: "Aklās zonas uzraudzība",
  blindspotmonitor: "Aklās zonas uzraudzība",
  electricmirrors: "Elektriski spoguļi",
  heatedmirrors: "Apsildāmi spoguļi",
  radio: "Radio",
  dab: "DAB radio",
  usb: "USB",
  applecarplay: "Apple CarPlay",
  androidauto: "Android Auto",
  alarm: "Signalizācija",
  immobilizer: "Imobilaizers",
  fourwheeldrive: "Pilnpiedziņa",
  allwheeldrive: "Pilnpiedziņa",
  metallicpaint: "Metālika krāsa",
  metallic: "Metālika krāsa",
  roofrails: "Jumta reliņi",
  tintedwindows: "Tonēti stikli",
  ambientlighting: "Salona apgaismojums",
  electrictailgate: "Elektrisks bagāžnieka vāks",
  parkingassist: "Parkošanās asistents",
  automaticheadlights: "Automātiskie lukturi",
  lightsensor: "Gaismas sensors",
};

export function translateEquipment(raw: string): string {
  const n = normKey(raw);
  return EQUIPMENT_LV[n] ?? EQUIPMENT_LV[raw] ?? (/[a-z]_[a-z]/.test(raw) || /^[a-z]+[A-Z]/.test(raw) ? humanizeToken(raw) : raw.trim());
}

/** VehicleFeatures `= nē`, kas klientam ir nozīmīgi. */
export function isSignificantMissingFeature(raw: string): boolean {
  return /(lpg|cng|gas|autogas)/i.test(raw);
}

export const EQUIPMENT_CATEGORY_ORDER = [
  "Drošība un asistenti",
  "Gaismas",
  "Komforts un salons",
  "Multimēdijs",
  "Diski un riepas",
  "Dzinējs un transmisija",
  "Citi",
] as const;

export function equipmentCategory(text: string): (typeof EQUIPMENT_CATEGORY_ORDER)[number] {
  const s = text.toLowerCase();
  if (/(wheel|\brim|tire|tyre|alloy|disk|riep)/.test(s) && !/steering|stūre/.test(s)) return "Diski un riepas";
  if (/(navig|radio|audio|multimedia|bluetooth|usb|display|phone|carplay|android|sound|speaker|\bdab\b|infotain|\btv\b|dvd|\bcd\b|hifi|hi-fi|connect)/.test(s)) return "Multimēdijs";
  if (/(seat|sēdek|climate|klimat|air.?cond|kondic|window|logi|mirror|spogu|steering|stūre|leather|sunroof|lūka|comfort|interior|salon|keyless|lock|armrest|ventil|upholster|ambient|tailgate|bagāžn|roof rail|reliņ)/.test(s)) return "Komforts un salons";
  if (/(headlight|headlamp|light|lamp|xenon|ksenon|\bled\b|lukturi|gaism|fog)/.test(s)) return "Gaismas";
  if (/(assist|airbag|\babs\b|\besp\b|camera|kamera|park|sensor|lane|joslas|cruise|kruīz|brake|isofix|alarm|signaliz|immobil|imobil|safety|blind|aklās|collision|warning|distance|drošīb|tpms|pressure)/.test(s)) return "Drošība un asistenti";
  if (/(engine|gear|transmission|drive|4x4|tow|sakabe|start.?stop|exhaust|turbo|dzinēj|piedziņ|hitch|suspension|chassis|stūres pastipr|servo)/.test(s)) return "Dzinējs un transmisija";
  return "Citi";
}

/** Aprīkojuma grupas, kuru nosaukums neko nepievieno vienībai (to aizstāj kategorija). */
export function isGenericEquipmentGroup(group: string): boolean {
  return /^(assistance|assistants?|safety|security|seats?|navigation|wheels?|rims?|comfort|convenience|interior|exterior|multimedia|audio|entertainment|infotainment|lights?|lighting|other|misc|miscellaneous|equipment|options|extras|technology|climate|standard|optional|special equipment|serial equipment)$/i.test(
    group.trim(),
  );
}
