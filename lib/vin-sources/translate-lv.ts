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
  "betinget godkendt": "nosacīti izturēta",
  // Tas pats iznākums kā esyn kodam OOM („nav izturēta”) - formulējumam jāsakrīt abos avotos.
  "kan godkendes efter omsyn hos (om)synsvirksomhed": "nav izturēta, jāveic atkārtota apskate",
  "kan godkendes efter omsyn hos omsynsvirksomhed": "nav izturēta, jāveic atkārtota apskate",
  "kan godkendes efter omsyn hos synsvirksomhed": "nav izturēta, jāveic atkārtota apskate",
  "kan godkendes efter omsyn": "nav izturēta, jāveic atkārtota apskate",
  "kan ikke godkendes": "nav izturēta",
  omsyn: "atkārtota apskate",
  "første syn": "pirmā apskate",
  "periodisk syn": "periodiskā apskate",
  "registreringssyn": "reģistrācijas apskate",
  "registreringssyn uden ændring": "reģistrācijas apskate bez izmaiņām",
  toldsyn: "muitas apskate",
  "toldsyn import": "muitas apskate (imports)",
  periodisksyn: "periodiskā apskate",
  middel: "vidējs",
  god: "labs",
  dårlig: "slikts",
  daarlig: "slikts",
  "afmeldt (har fået fjernet en gyldig registrering)": "noņemts no uzskaites (noņemta spēkā esoša reģistrācija)",
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
  "privat personkørsel": "Privāti",
  "erhvervsmæssig personkørsel": "komerciāla pasažieru pārvadāšana",
  "erhvervsmæssig personkørsel (taxi)": "komerciāla pasažieru pārvadāšana (TAKSOMETRS)",
  taxi: "TAKSOMETRS",
  "udlejning uden fører": "īre bez vadītāja (rent-a-car)",
  køreskole: "autoskola",
  ambulance: "ātrā palīdzība",
  "godstransport erhverv": "komerciāli kravu pārvadājumi",
  "privat godstransport": "privāti kravu pārvadājumi",
  // piedziņa
  firehjulstrukket: "pilnpiedziņa",
  firehjulstrækket: "pilnpiedziņa",
  forhjulstrukket: "priekšējo riteņu piedziņa",
  forhjulstrækket: "priekšējo riteņu piedziņa",
  baghjulstrukket: "aizmugurējo riteņu piedziņa",
  baghjulstrækket: "aizmugurējo riteņu piedziņa",
  // virsbūve
  stationcar: "universālis",
  personbil: "vieglā automašīna",
  varebil: "furgons",
  "stor personbil": "liela vieglā automašīna",
  // --- apskates trūkumu GRUPAS (synsrapport virsraksti; jaunais ES 2014/45 formāts un vecais formāts) ---
  "identifikation af køretøjet": "transportlīdzekļa identifikācija",
  identifikation: "identifikācija",
  bremseudstyr: "bremžu iekārta",
  "bremseudstyr, driftsbremse": "bremžu iekārta, darba bremze",
  "bremseudstyr, parkeringsbremse": "bremžu iekārta, stāvbremze",
  "bremseudstyr, nødbremse": "bremžu iekārta, avārijas bremze",
  bremser: "bremzes",
  styreapparat: "stūres iekārta",
  styretøj: "stūres iekārta",
  udsyn: "redzamība",
  "udsyn (ruder, spejle, viskere)": "redzamība (stikli, spoguļi, tīrītāji)",
  "lygter, reflekser og elektrisk udstyr": "lukturi, atstarotāji un elektroiekārta",
  "lygter, reflekser, og elektrisk udstyr": "lukturi, atstarotāji un elektroiekārta",
  "aksler, hjul, dæk og affjedring": "asis, riteņi, riepas un balstiekārta",
  "aksler, hjul og affjedring": "asis, riteņi un balstiekārta",
  "aksler, og affjedring": "asis un balstiekārta",
  "aksler og affjedring": "asis un balstiekārta",
  "hjul og dæk": "riteņi un riepas",
  "chassis, eller ramme og dertil fastgjorte dele": "šasija vai rāmis un pie tā piestiprinātās daļas",
  "chassis og dertil fastgjorte dele": "šasija un pie tās piestiprinātās daļas",
  "bærende elementer": "nesošie elementi",
  "bærende dele": "nesošās daļas",
  karrosseri: "virsbūve",
  "andet udstyr": "cits aprīkojums",
  "øvrigt udstyr": "pārējais aprīkojums",
  "gener, udstødning": "ietekme uz vidi, izplūdes gāzes",
  "gener, støj": "ietekme uz vidi, troksnis",
  gener: "ietekme uz vidi",
  miljø: "vide",
  "motor og transmission": "motors un transmisija",
  // --- apakšgrupas ---
  tilstand: "stāvoklis",
  præstationer: "darbības rādītāji",
  affjedringsled: "balstiekārtas šarnīri",
  "fjedre og stabilisator": "atsperes un stabilizators",
  transmission: "transmisija",
  "motor med kompressionstænding": "kompresijas aizdedzes motors (dīzelis)",
  "motor med styret tænding": "dzirksteļaizdedzes motors (benzīns)",
  // --- trūkuma smagums ---
  "mindre fejl": "neliels trūkums",
  "væsentlig fejl": "būtisks trūkums",
  "farlig fejl": "bīstams trūkums",
  // --- standarta trūkumu teikumi (ES 2014/45 formulējumi; tulkojam teikumu kopumā, ne pa vārdam) ---
  "for kraftig tæring, som påvirker samlingernes styrke": "pārmērīga korozija, kas ietekmē savienojumu stiprību",
  "for stort slid i styrebolt og/eller bøsninger eller i affjedringsled":
    "pārmērīgs nodilums šarnīra tapā un/vai buksēs vai balstiekārtas šarnīros",
  "fjederkomponent er beskadiget eller har brud": "atsperes detaļa ir bojāta vai lūzusi",
  "utilstrækkelig bremsevirkning på et eller flere hjul":
    "nepietiekama bremzēšanas iedarbība uz vienu vai vairākiem riteņiem",
  "bremsen virker ikke på den ene side, eller ved bremseprøve på vej afviger køretøjet stærkt fra sin kurs under opbremsningen":
    "bremze nedarbojas vienā pusē, vai bremžu pārbaudē uz ceļa transportlīdzeklis bremzējot stipri novirzās no kursa",
  "støvmanchet beskadiget": "putekļu aizsargmanšete bojāta",
  "emissionskontroludstyr monteret af fabrikanten mangler eller er tydeligvis defekt":
    "ražotāja uzstādītā izmešu kontroles iekārta trūkst vai ir acīmredzami bojāta",
  "bærekugle i forhjulsophæng": "lodbalsts priekšējā piekarē",
  "ujævn bremsevirkning": "nevienmērīga bremzēšanas iedarbība",
  "for stor": "pārāk liela",
  "for stort": "pārāk liels",
  "i begge sider": "abās pusēs",
  // --- novietojums ---
  venstre: "kreisā puse",
  højre: "labā puse",
  aksel: "ass",
  foraksel: "priekšējā ass",
  bagaksel: "aizmugurējā ass",
  forhjul: "priekšējais ritenis",
  baghjul: "aizmugurējais ritenis",
  // --- trūkumu vārdnīca ---
  // lietvārda formā - dāņu īpašības vārds neseko latviešu dzimtei („bremžu caurule, korozija”)
  tæret: "korozija",
  gennemtæret: "caurrūsējums",
  tæring: "korozija",
  rust: "rūsa",
  utæt: "nehermētiskums",
  utæthed: "noplūde",
  olielækage: "eļļas noplūde",
  slør: "brīvkustība",
  defekt: "defekts",
  beskadiget: "bojājums",
  mangler: "trūkst",
  slidt: "nodilums",
  slid: "nodilums",
  bremsevirkning: "bremzēšanas iedarbība",
  bremserør: "bremžu caurule",
  bremseslange: "bremžu šļūtene",
  bremseskive: "bremžu disks",
  bremseskiver: "bremžu diski",
  bremseklods: "bremžu klucis",
  bremseklodser: "bremžu kluči",
  bremsekaliber: "bremžu suports",
  bremsetromle: "bremžu trumulis",
  bremsevæske: "bremžu šķidrums",
  driftsbremse: "darba bremze",
  parkeringsbremse: "stāvbremze",
  håndbremse: "rokas bremze",
  støddæmper: "amortizators",
  støddæmpere: "amortizatori",
  fjeder: "atspere",
  fjedre: "atsperes",
  stabilisator: "stabilizators",
  bærearm: "balstsvira",
  bærekugle: "lodbalsts",
  kugleled: "lodveida šarnīrs",
  styrekugle: "stūres šarnīrs",
  forhjulsophæng: "priekšējā piekare",
  baghjulsophæng: "aizmugurējā piekare",
  hjulleje: "riteņa gultnis",
  drivaksel: "pusass",
  bøsning: "bukse",
  bøsninger: "bukses",
  støvmanchet: "putekļu aizsargmanšete",
  manchet: "manšete",
  hjul: "ritenis",
  mønsterdybde: "protektora dziļums",
  udstødning: "izplūdes sistēma",
  udstødningsrør: "izplūdes caurule",
  lyddæmper: "trokšņa slāpētājs",
  partikelfilter: "daļiņu filtrs",
  katalysator: "katalizators",
  lygte: "lukturis",
  lygter: "lukturi",
  forlygte: "priekšējais lukturis",
  baglygte: "aizmugurējais lukturis",
  stoplygte: "bremžu signāllukturis",
  tågelygte: "miglas lukturis",
  nærlys: "tuvās gaismas",
  fjernlys: "tālās gaismas",
  positionslys: "gabarītgaismas",
  blinklys: "virzienrādītājs",
  nummerpladelys: "numura zīmes apgaismojums",
  forrude: "priekšējais stikls",
  visker: "stikla tīrītājs",
  viskere: "stikla tīrītāji",
  vinduesvisker: "stikla tīrītājs",
  sikkerhedssele: "drošības josta",
};

/**
 * Īsie dāņu vārdi (< 4 burti), ko tulkojam TIKAI apskates trūkumu tekstā (`translateTextLvChecked`).
 * Vispārīgā `translateTextLv` tos neaiztiek: „for” un „bag” citur ir prievārdi, ne novietojums.
 */
const DA_FAULT_SHORT_TERMS: Record<string, string> = {
  for: "priekšā",
  bag: "aizmugurē",
  dæk: "riepa",
};

const ET_TERMS: Record<string, string> = {
  // frāzes (garākā sakritība uzvar pār atsevišķiem vārdiem, piem. „korras”)
  "tehniliselt korras": "tehniski kārtībā",
  "võõrandamisest teatamine": "paziņojums par atsavināšanu",
  "majanduslikus mõttes hävinenud": "ekonomiski iznīcināts (norakstīts)",
  "ajutine registrist kustutamine": "pagaidu izslēgšana no reģistra",
  "registrist ajutine kustutamine": "pagaidu izslēgšana no reģistra",
  "ajutiselt registrist kustutatud": "uz laiku izslēgts no reģistra",
  "registrist kustutamine": "izslēgšana no reģistra",
  "registrisse kandmine": "reģistrācija",
  "registreerimine": "reģistrācija",
  liiklusõnnetus: "ceļu satiksmes negadījums",
  "registreerimistunnistuse vahetus": "reģistrācijas apliecības maiņa",
  "reg.tunnistuse vahetus": "reģistrācijas apliecības maiņa",
  "reg. tunnistuse vahetus": "reģistrācijas apliecības maiņa",
  "omaniku vahetus": "īpašnieka maiņa",
  "registreerimistunnistuse väljastamine": "reģistrācijas apliecības izsniegšana",
  "eestis registreerimine": "reģistrācija Igaunijā",
  registreerimistunnistus: "reģistrācijas apliecība",
  "esmane registreerimine": "pirmā reģistrācija",
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
  const raw = (value ?? "").normalize("NFC").trim();
  if (!raw) return "";
  const dict = lang === "da" ? DA_TERMS : ET_TERMS;
  const hit = dict[raw.toLowerCase()];
  return hit ?? raw;
}

/** Hronoloģijas notikums: pirmais burts un teksts pēc kolona ar lielo. */
export function capitalizeRegistryEvent(event: string): string {
  const t = event.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
  if (!t) return "";
  const i = t.search(/\p{L}/u);
  if (i < 0) return t;
  let out = t.slice(0, i) + t.charAt(i).toLocaleUpperCase("lv") + t.slice(i + 1);
  out = out.replace(/:\s+(\p{L})/u, (_m, letter: string) => `: ${letter.toLocaleUpperCase("lv")}`);
  return out;
}

/** Fakta vērtība: pirmais burts, pēc komata un iekavās. */
export function capitalizeFactValue(value: string): string {
  let t = capitalizeRegistryEvent(value);
  if (!t) return "";
  t = t.replace(/,\s+(\p{L})/gu, (_m, letter: string) => `, ${letter.toLocaleUpperCase("lv")}`);
  t = t.replace(/\(\s*(\p{L})/gu, (_m, letter: string) => `(${letter.toLocaleUpperCase("lv")}`);
  t = t.replace(/·\s+(\p{L})/gu, (_m, letter: string) => `· ${letter.toLocaleUpperCase("lv")}`);
  return t;
}

/**
 * Terminu aizvietošana garākā tekstā (piem. apskates defektu aprakstā),
 * lai operators redz latviskus jēdzienus arī tur, kur nav precīzas sakritības.
 */
export function translateTextLv(value: string, lang: "da" | "et"): string {
  // Avotu teksts var būt NFD („o” + kombinējošā tilde) - vārdnīca ir NFC.
  const raw = (value ?? "").normalize("NFC").trim();
  if (!raw) return "";
  const exact = translateTermLv(raw, lang);
  if (exact !== raw) return exact;

  const { re, byKey } = textTermMatcher(lang, false);
  return raw.replace(re, (m) => byKey.get(termKey(m)) ?? m);
}

/**
 * Tas pats, kas `translateTextLv`, bet pasaka, vai iztulkots VISS teksts: `complete` ir true tikai tad,
 * ja ārpus vārdnīcas terminiem nepaliek neviens burts (cipari un pieturzīmes drīkst palikt).
 * Klienta atskaitē pustulkotu teikumu nerādām - izsaucējs pie `complete: false` rāda oriģinālu.
 * Dāņu valodai papildus tulko īsos novietojuma vārdus („for”, „bag”).
 */
export function translateTextLvChecked(value: string, lang: "da" | "et"): { text: string; complete: boolean } {
  const raw = (value ?? "").normalize("NFC").trim();
  if (!raw) return { text: "", complete: true };
  const { re, byKey } = textTermMatcher(lang, true);
  let rest = "";
  let last = 0;
  const text = raw.replace(re, (m, offset: number) => {
    const hit = byKey.get(termKey(m));
    if (hit == null) return m;
    rest += raw.slice(last, offset);
    last = offset + m.length;
    return hit;
  });
  rest += raw.slice(last);
  return { text, complete: !/\p{L}/u.test(rest) };
}

function termKey(match: string): string {
  return match.toLocaleLowerCase().replace(/\s+/g, " ");
}

const textTermMatchers = new Map<string, { re: RegExp; byKey: Map<string, string> }>();

/**
 * Viena regulārā izteiksme visiem terminiem: garākie pirmie (frāze pirms atsevišķa vārda),
 * Unicode robežas (\b nestrādā pirms/pēc „õ”, „ü”, „ø”), viena caurlaide - jau iztulkotais
 * latviskais teksts netiek tulkots vēlreiz.
 */
function textTermMatcher(lang: "da" | "et", withShortFaultTerms: boolean): { re: RegExp; byKey: Map<string, string> } {
  const cacheKey = `${lang}:${withShortFaultTerms ? "fault" : "text"}`;
  const cached = textTermMatchers.get(cacheKey);
  if (cached) return cached;
  const dict = lang === "da" ? DA_TERMS : ET_TERMS;
  const byKey = new Map<string, string>();
  for (const [term, lv] of Object.entries(dict)) {
    if (term.length < 4) continue;
    byKey.set(term.toLocaleLowerCase(), lv);
  }
  if (withShortFaultTerms && lang === "da") {
    for (const [term, lv] of Object.entries(DA_FAULT_SHORT_TERMS)) byKey.set(term, lv);
  }
  const alternation = [...byKey.keys()]
    .sort((a, b) => b.length - a.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+"))
    .join("|");
  const built = { re: new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternation})(?![\\p{L}\\p{N}])`, "giu"), byKey };
  textTermMatchers.set(cacheKey, built);
  return built;
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
