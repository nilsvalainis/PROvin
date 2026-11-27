/**
 * Dīlera transportlīdzekļa vispārīgās vērtības (kārba, virsbūve, piedziņa, degviela,
 * krāsa, salons) → atskaites valoda. Modeļa nosaukumus, VIN un rūpnīcas kodus neatskār.
 */
import type { ClientReportLang } from "@/lib/client-report-i18n";
import { normalizeCountryName } from "@/lib/country-names-lv";
import type { OutvinVehicleInfo } from "@/lib/outvin-dealer-types";

type LangMap = Record<ClientReportLang, string>;

const EXACT: { keys: string[]; out: LangMap }[] = [
  {
    keys: ["automatic", "automatik", "automatiskā", "automātiskā", "автоматическая"],
    out: { lv: "automātiskā", en: "automatic", ru: "автоматическая", de: "Automatik" },
  },
  {
    keys: ["automatic transmission", "automatikgetriebe", "automātiskā ātrumkārba", "автоматическая коробка"],
    out: {
      lv: "automātiskā ātrumkārba",
      en: "automatic transmission",
      ru: "автоматическая коробка передач",
      de: "Automatikgetriebe",
    },
  },
  {
    // «MANU» - VW dīlera saīsinājums (27.11, WVWZZZ3CZNE054721).
    keys: ["manual", "manu", "schaltgetriebe", "mehāniskā", "механическая"],
    out: { lv: "mehāniskā", en: "manual", ru: "механическая", de: "Schaltgetriebe" },
  },
  {
    keys: ["manual transmission", "mehāniskā ātrumkārba", "механическая коробка"],
    out: {
      lv: "mehāniskā ātrumkārba",
      en: "manual transmission",
      ru: "механическая коробка передач",
      de: "Schaltgetriebe",
    },
  },
  {
    keys: [
      "7-speed automatic dual-clutch transmission",
      "7 speed automatic dual clutch transmission",
      "7-pakāpju automātiskā divsajūgu",
    ],
    out: {
      lv: "7 pakāpju automātiskā divsajūgu ātrumkārba",
      en: "7-speed automatic dual-clutch transmission",
      ru: "7-ступенчатая автоматическая коробка с двумя сцеплениями",
      de: "7-Gang-Doppelkupplungsgetriebe",
    },
  },
  {
    keys: [
      "continuously variable",
      "continuously variable transmission",
      "continuously variable (cvt)",
      "continuously variable transmission (cvt)",
      "cvt",
      "variators",
      "variators (cvt)",
      "вариатор",
      "stufenlos",
      "stufenloses getriebe",
    ],
    out: {
      lv: "Variators (CVT)",
      en: "continuously variable (CVT)",
      ru: "вариатор (CVT)",
      de: "stufenloses Getriebe (CVT)",
    },
  },
  {
    keys: ["dual-clutch", "dual clutch", "dct", "dsg", "doppelkupplung", "divsajūgu"],
    out: { lv: "divsajūgu", en: "dual-clutch", ru: "с двумя сцеплениями", de: "Doppelkupplung" },
  },
  {
    keys: ["front-wheel drive", "front wheel drive", "fwd", "front", "priekšējā piedziņa", "передний привод", "vorderradantrieb"],
    out: {
      lv: "priekšējā piedziņa",
      en: "front-wheel drive",
      ru: "передний привод",
      de: "Vorderradantrieb",
    },
  },
  {
    keys: ["rear-wheel drive", "rear wheel drive", "rwd", "heck", "aizmugurējā piedziņa", "задний привод", "hinterradantrieb"],
    out: {
      lv: "aizmugurējā piedziņa",
      en: "rear-wheel drive",
      ru: "задний привод",
      de: "Hinterradantrieb",
    },
  },
  {
    keys: ["all-wheel drive", "all wheel drive", "awd", "4wd", "allr", "pilnpiedziņa", "полный привод", "allradantrieb"],
    out: { lv: "pilnpiedziņa", en: "all-wheel drive", ru: "полный привод", de: "Allradantrieb" },
  },
  {
    keys: ["coupe", "coupé", "kupeja", "купе"],
    out: { lv: "kupeja", en: "coupe", ru: "купе", de: "Coupé" },
  },
  {
    keys: ["sedan", "saloon", "limousine", "lim", "sedans", "stufenheck", "седан"],
    out: { lv: "sedans", en: "sedan", ru: "седан", de: "Limousine" },
  },
  {
    keys: ["estate", "wagon", "touring", "tou", "univers", "universālis", "универсал", "kombi"],
    out: { lv: "universālis", en: "estate", ru: "универсал", de: "Kombi" },
  },
  {
    keys: ["suv", "sav", "apvidus", "внедорожник", "geländewagen"],
    // „Apvidus” viens pats ir īpašības vārds bez lietvārda (Nils 22.11) - „apvidus auto (SUV)”.
    out: { lv: "apvidus auto (SUV)", en: "SUV", ru: "внедорожник", de: "SUV" },
  },
  {
    keys: ["off-road vehicle", "off road vehicle", "offroad vehicle", "apvidus auto"],
    out: { lv: "Apvidus auto", en: "off-road vehicle", ru: "внедорожник", de: "Geländewagen" },
  },
  {
    keys: ["hatchback", "hečbeks", "хэтчбек"],
    out: { lv: "hečbeks", en: "hatchback", ru: "хэтчбек", de: "Schrägheck" },
  },
  {
    keys: ["petrol", "gasoline", "benzin", "benzīns", "бензин"],
    out: { lv: "benzīns", en: "petrol", ru: "бензин", de: "Benzin" },
  },
  {
    keys: ["diesel", "dīzelis", "дизель"],
    out: { lv: "dīzelis", en: "diesel", ru: "дизель", de: "Diesel" },
  },
  {
    keys: ["hybrid", "hibrīds", "гибрид"],
    out: { lv: "hibrīds", en: "hybrid", ru: "гибрид", de: "Hybrid" },
  },
  {
    keys: ["electric", "elektro", "электрический", "elektroantrieb"],
    out: { lv: "elektrisks", en: "electric", ru: "электрический", de: "Elektro" },
  },
  // 26.11 (WDD2122931A366915): Ziemeļvalstu / DE / NL reģistru virsbūves vārdi («Virsbūve: Personbil»).
  {
    keys: ["personbil", "pkw", "personenkraftwagen", "personenwagen", "personenauto", "passenger car", "vieglais automobilis", "легковой автомобиль"],
    out: { lv: "vieglais automobilis", en: "passenger car", ru: "легковой автомобиль", de: "Pkw" },
  },
  {
    keys: ["stationcar", "stationsvogn", "stasjonsvogn", "stationwagen", "stationwagon", "station wagon", "herrgårdsvagn"],
    out: { lv: "universālis", en: "estate", ru: "универсал", de: "Kombi" },
  },
  {
    keys: ["halvkombi", "kombikupé", "kombi coupé", "kombicoupé", "fließheck", "schrägheck"],
    out: { lv: "hečbeks", en: "hatchback", ru: "хэтчбек", de: "Schrägheck" },
  },
  {
    keys: ["cabriolet", "kabriolet", "cabrio", "convertible", "kabriolets", "кабриолет"],
    out: { lv: "kabriolets", en: "convertible", ru: "кабриолет", de: "Cabriolet" },
  },
  {
    keys: ["varebil", "varevogn", "skåpbil", "lieferwagen", "kastenwagen", "bestelwagen", "bestelauto", "furgons", "фургон"],
    out: { lv: "furgons", en: "van", ru: "фургон", de: "Kastenwagen" },
  },
  {
    keys: ["flerbrugskøretøj", "fleksibil", "großraumlimousine", "mpv", "monovolume", "minivan", "minivens", "минивэн"],
    out: { lv: "minivens", en: "MPV", ru: "минивэн", de: "Van" },
  },
  {
    keys: ["left-hand drive", "left hand drive", "lhd", "ll", "kreisā stūre", "левый руль", "linkslenker"],
    out: { lv: "kreisā stūre", en: "left-hand drive", ru: "левый руль", de: "Linkslenker" },
  },
  {
    keys: ["right-hand drive", "right hand drive", "rhd", "rl", "labā stūre", "правый руль", "rechtslenker"],
    out: { lv: "labā stūre", en: "right-hand drive", ru: "правый руль", de: "Rechtslenker" },
  },
];

const TOKEN: { re: RegExp; out: LangMap }[] = [
  // Salikumi vispirms (citādi „Āda combination”, „Balts PEARL” - jaukts EN/LV, Nils 22.11).
  {
    re: /\b(?:leather|leder) combination\b|\blederkombination\b/gi,
    out: { lv: "ādas kombinācija", en: "leather combination", ru: "комбинированная кожа", de: "Lederkombination" },
  },
  { re: /\bcombination\b/gi, out: { lv: "kombinācija", en: "combination", ru: "комбинация", de: "Kombination" } },
  {
    re: /\bwhite pearl\b|\bpearl white\b/gi,
    out: { lv: "perlamutra balts", en: "pearl white", ru: "белый перламутр", de: "Perlweiß" },
  },
  { re: /\bpearl(?:escent)?\b/gi, out: { lv: "perlamutra", en: "pearl", ru: "перламутр", de: "Perleffekt" } },
  { re: /\bmetallic(?:lack)?\b/gi, out: { lv: "metāliskā", en: "metallic", ru: "металлик", de: "Metallic" } },
  { re: /\bleder\b/gi, out: { lv: "āda", en: "leather", ru: "кожа", de: "Leder" } },
  { re: /\bzimt-?braun\b/gi, out: { lv: "kanēļbrūns", en: "cinnamon brown", ru: "коричный", de: "zimtbraun" } },
  { re: /\bschwarz\b/gi, out: { lv: "melns", en: "black", ru: "чёрный", de: "schwarz" } },
  { re: /\banthrazit\b/gi, out: { lv: "antracīts", en: "anthracite", ru: "антрацит", de: "Anthrazit" } },
  { re: /\bfabric\b/gi, out: { lv: "audums", en: "fabric", ru: "ткань", de: "Stoff" } },
  { re: /\bimitation leather\b/gi, out: { lv: "mākslīgā āda", en: "imitation leather", ru: "искусственная кожа", de: "Kunstleder" } },
  { re: /\bmicrofiber\b/gi, out: { lv: "mikrošķiedra", en: "microfiber", ru: "микрофибра", de: "Mikrofaser" } },
  { re: /\bleather\b/gi, out: { lv: "āda", en: "leather", ru: "кожа", de: "Leder" } },
  { re: /\bstandard finish\b/gi, out: { lv: "standarta apdare", en: "standard finish", ru: "стандартное покрытие", de: "Standardlackierung" } },
  { re: /\banthracite\b/gi, out: { lv: "antracīts", en: "anthracite", ru: "антрацит", de: "Anthrazit" } },
  { re: /\bnight black\b/gi, out: { lv: "nakts melns", en: "night black", ru: "ночной чёрный", de: "Nachtschwarz" } },
  { re: /\bblack\b/gi, out: { lv: "melns", en: "black", ru: "чёрный", de: "schwarz" } },
  { re: /\bwhite\b/gi, out: { lv: "balts", en: "white", ru: "белый", de: "weiß" } },
  { re: /\bgrey\b|\bgray\b/gi, out: { lv: "pelēks", en: "grey", ru: "серый", de: "grau" } },
  { re: /\bsilver\b/gi, out: { lv: "sudrabs", en: "silver", ru: "серебристый", de: "silber" } },
  { re: /\bblue\b/gi, out: { lv: "zils", en: "blue", ru: "синий", de: "blau" } },
  { re: /\bred\b/gi, out: { lv: "sarkans", en: "red", ru: "красный", de: "rot" } },
  { re: /\bgreen\b/gi, out: { lv: "zaļš", en: "green", ru: "зелёный", de: "grün" } },
  { re: /\bbrown\b/gi, out: { lv: "brūns", en: "brown", ru: "коричневый", de: "braun" } },
  { re: /\bbeige\b/gi, out: { lv: "bežs", en: "beige", ru: "бежевый", de: "beige" } },
  { re: /\borange\b/gi, out: { lv: "oranžs", en: "orange", ru: "оранжевый", de: "orange" } },
  { re: /\byellow\b/gi, out: { lv: "dzeltens", en: "yellow", ru: "жёлтый", de: "gelb" } },
  { re: /\b(\d{1,2})[- ]speed\b/gi, out: { lv: "$1 pakāpju", en: "$1-speed", ru: "$1-ступенчатая", de: "$1-Gang" } },
  { re: /\bdual-clutch\b|\bdual clutch\b/gi, out: { lv: "divsajūgu", en: "dual-clutch", ru: "с двумя сцеплениями", de: "Doppelkupplung" } },
  { re: /\bautomatic\b/gi, out: { lv: "automātiskā", en: "automatic", ru: "автоматическая", de: "Automatik" } },
  { re: /\btransmission\b/gi, out: { lv: "ātrumkārba", en: "transmission", ru: "коробка передач", de: "Getriebe" } },
  { re: /\bcoupe\b|\bcoupé\b/gi, out: { lv: "kupeja", en: "coupe", ru: "купе", de: "Coupé" } },
];

/**
 * 26.11 (WDD2122931A366915 «Krāsa: Svart»): krāsu vārdi zviedru, dāņu, norvēģu, vācu un nīderlandiešu valodā.
 * Tikai krāsas / salona laukiem (`translateColorLikeValue`), lai «rot», «sort» u.c. neskartu citus laukus.
 */
const COLOR_WORD = (words: string): RegExp => new RegExp(`(?<!\\p{L})(?:${words})(?!\\p{L})`, "giu");
const COLOR_TOKEN: { re: RegExp; out: LangMap }[] = [
  { re: COLOR_WORD("svart|sort|schwarz|zwart"), out: { lv: "melns", en: "black", ru: "чёрный", de: "schwarz" } },
  { re: COLOR_WORD("vit|hvid|hvit|weiß|weiss|wit"), out: { lv: "balts", en: "white", ru: "белый", de: "weiß" } },
  { re: COLOR_WORD("grå|grau|grijs"), out: { lv: "pelēks", en: "grey", ru: "серый", de: "grau" } },
  { re: COLOR_WORD("silver|sølv|silber|zilver"), out: { lv: "sudrabs", en: "silver", ru: "серебристый", de: "silber" } },
  { re: COLOR_WORD("blå|blau|blauw"), out: { lv: "zils", en: "blue", ru: "синий", de: "blau" } },
  { re: COLOR_WORD("röd|rød|rot|rood"), out: { lv: "sarkans", en: "red", ru: "красный", de: "rot" } },
  { re: COLOR_WORD("grön|grøn|grønn|grün|groen"), out: { lv: "zaļš", en: "green", ru: "зелёный", de: "grün" } },
  { re: COLOR_WORD("brun|braun|bruin"), out: { lv: "brūns", en: "brown", ru: "коричневый", de: "braun" } },
  { re: COLOR_WORD("gul|gelb|geel"), out: { lv: "dzeltens", en: "yellow", ru: "жёлтый", de: "gelb" } },
  { re: COLOR_WORD("orange|oranje"), out: { lv: "oranžs", en: "orange", ru: "оранжевый", de: "orange" } },
  { re: COLOR_WORD("beige|beis"), out: { lv: "bežs", en: "beige", ru: "бежевый", de: "beige" } },
  { re: COLOR_WORD("lilla|violett|violet|paars"), out: { lv: "violets", en: "purple", ru: "фиолетовый", de: "violett" } },
  { re: COLOR_WORD("guld|gull|gold|goud"), out: { lv: "zelta", en: "gold", ru: "золотистый", de: "gold" } },
  { re: COLOR_WORD("metallic|metallik|metalliclack|metalen"), out: { lv: "metāliskā", en: "metallic", ru: "металлик", de: "Metallic" } },
];

function applyColorTokens(raw: string, lang: ClientReportLang): string {
  let t = raw;
  for (const row of COLOR_TOKEN) t = t.replace(row.re, row.out[lang]);
  return t;
}

const CODE_RE = /^(?:[A-Z0-9][A-Z0-9./-]{1,14})$/;
const VIN_RE = /^[A-HJ-NPR-Z0-9]{11,17}$/i;
const DATE_RE = /^(?:\d{1,2}\.\d{1,2}\.\d{4}|\d{4}(?:-\d{2}(?:-\d{2})?)?)$/;
const KEEP_FIELDS = new Set<keyof OutvinVehicleInfo>([
  "model",
  "modelSeries",
  "vinCode",
  "engineCode",
  "engineNumber",
  "integrationLevel",
  "currentILevel",
  "developmentCode",
  "modelCode",
  "productionDate",
  "firstRegistration",
  "warrantyStartDate",
  "colorCode",
  "interiorCode",
  "displacement",
]);

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function normKey(s: string): string {
  return collapse(s).toLowerCase().replace(/[’']/g, "").replace(/ё/g, "е");
}

function looksLikeCode(s: string): boolean {
  const t = collapse(s);
  if (!t) return true;
  if (DATE_RE.test(t) || VIN_RE.test(t)) return true;
  if (CODE_RE.test(t) && /\d/.test(t)) return true;
  return false;
}

/** Zirgspēku vienība jebkurā reģistrā: „Zs”, „zs”, „ZS”, „PS”, „ps”, „hp”, „HP”, „bhp”. kW netiek skarts. */
const HORSEPOWER_UNIT_RE = /(?<!\p{L})(?:zs|ps|b?hp)(?!\p{L})/giu;

/** „121 hp / 122 PS” - viena jauda divās vienībās; ZS / PS / л.с. ir metriskā (PS) vērtība. */
const HP_AND_PS_RE = /(\d+(?:[.,]\d+)?)\s*b?hp\s*\/\s*(\d+(?:[.,]\d+)?)\s*ps\b|(\d+(?:[.,]\d+)?)\s*ps\s*\/\s*(\d+(?:[.,]\d+)?)\s*b?hp\b/i;

function localizePower(raw: string, lang: ClientReportLang): string {
  let t = collapse(raw);
  // A21 (Business audits 23.11): „90 kW (121 ZS / 122 ZS)” -> „90 kW (122 ZS)” - latviski ZS ir metriskie PS.
  // Angliski paliek „hp” vērtība (citādi sanāk „121 hp / 122 hp”).
  t = t.replace(HP_AND_PS_RE, (_m, hp1, ps1, ps2, hp2) => (lang === "en" ? `${hp1 ?? hp2} hp` : `${ps1 ?? ps2} PS`));
  // „180 KW” / „180 kw” - SI vienība vienmēr „kW” (krieviski tālāk „кВт”).
  t = t.replace(/(?<!\p{L})kw(?!\p{L})/giu, "kW");
  if (lang === "lv") t = t.replace(HORSEPOWER_UNIT_RE, "ZS");
  if (lang === "ru") {
    t = t.replace(/(?<!\p{L})kW(?!\p{L})/gu, "кВт");
    t = t.replace(HORSEPOWER_UNIT_RE, "л.с.");
  }
  if (lang === "de") t = t.replace(HORSEPOWER_UNIT_RE, "PS");
  if (lang === "en") t = t.replace(HORSEPOWER_UNIT_RE, "hp");
  return t;
}

/** Laukiem, kuros pustulkojums („Continuously Variable ātrumkārba”) izskatās kā kļūda. */
const PARTIAL_TRANSLATION_GUARD_FIELDS = new Set<string>(["transmission", "drive", "body", "vehicleType", "fuel"]);

/**
 * true, ja tulkotajā tekstā palikuši oriģinālie angļu vārdi (≥3 burti, ne saīsinājumi kā CVT/DSG),
 * t.i. sanācis pustulkojums.
 */
function isHalfTranslated(original: string, out: string): boolean {
  if (out === original) return false;
  const origWords = new Set((original.match(/(?<!\p{L})[A-Za-z]{3,}(?!\p{L})/gu) ?? []).map((w) => w.toLowerCase()));
  const outWords = out.match(/(?<!\p{L})[A-Za-z]{3,}(?!\p{L})/gu) ?? [];
  return outWords.some((w) => w !== w.toUpperCase() && origWords.has(w.toLowerCase()));
}

function exactHit(raw: string, lang: ClientReportLang): string | null {
  const key = normKey(raw);
  let best: (typeof EXACT)[number] | null = null;
  for (const row of EXACT) {
    if (row.keys.some((k) => normKey(k) === key)) {
      if (!best || row.keys[0]!.length > best.keys[0]!.length) best = row;
    }
  }
  return best ? best.out[lang] : null;
}

function applyTokens(raw: string, lang: ClientReportLang): string {
  let t = raw;
  for (const row of TOKEN) t = t.replace(row.re, row.out[lang]);
  return collapse(t);
}

/**
 * „Automātiskā (7 pakāpju automātiskā ātrumkārba)” -> „Automātiskā (7 pakāpju)”: iekavās neatkārto
 * ārējo vārdu un „ātrumkārba” (Nils 22.11). Ja pēc tīrīšanas nekas nepaliek - iekavas saturs nemainās.
 */
function dedupeInnerAgainstOuter(outer: string, inner: string, lang: ClientReportLang): string {
  const o = collapse(outer).toLocaleLowerCase();
  if (!o || !collapse(inner).toLocaleLowerCase().includes(o)) return inner;
  const gearbox = { lv: "ātrumkārba", en: "transmission", ru: "коробка передач", de: "Getriebe" }[lang];
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cleaned = collapse(
    inner.replace(new RegExp(esc(collapse(outer)), "iu"), "").replace(new RegExp(esc(gearbox), "iu"), ""),
  );
  return cleaned || inner;
}

/**
 * Krāsa / salons: „PALLADIUMSILBER - METALLICLACK” -> „Palladiumsilber - metāliskā”. Ražotāja krāsas
 * nosaukums paliek oriģinālā (to neatskārš), bet vairs nekliedz lielajiem burtiem; apdares vārdi tulkoti.
 * Kodi iekavās („(LUSW)”, „(701A)”) netiek skarti.
 */
function translateColorLikeValue(raw: string, lang: ClientReportLang): string {
  const parts = raw.split(/(\([^)]*\))/g);
  return collapse(
    parts
      .map((part) => {
        if (part.startsWith("(")) return part;
        const tokened = applyColorTokens(applyTokens(part, lang), lang);
        return tokened.replace(
          /(?<!\p{L})(\p{Lu})(\p{Lu}{3,})(?!\p{L})/gu,
          (_m, first: string, rest: string) => first + rest.toLocaleLowerCase(),
        );
      })
      .join(" "),
  ).replace(/\s+\)/g, ")").replace(/\(\s+/g, "(");
}

/** Vispārīga dīlera vērtība atskaites valodā. Kodiem / VIN / datumiem nemaina. */
export function translateDealerVehicleValue(
  field: keyof OutvinVehicleInfo | string,
  raw: string,
  lang: ClientReportLang,
): string {
  const t = collapse(raw);
  if (!t) return t;
  if (field === "model" || field === "modelSeries") return t;
  if (field === "countryRegion") return normalizeCountryName(t, lang) || t;
  if (field === "power") return localizePower(t, lang);
  if (KEEP_FIELDS.has(field as keyof OutvinVehicleInfo) && looksLikeCode(t.split(/\s+/)[0] ?? t)) {
    return t;
  }
  if (field === "vinCode" || field === "engineCode" || field === "engineNumber") return t;
  if (field === "colorCode" || field === "interiorCode" || field === "modelCode") return t;
  if (field === "productionDate" || field === "firstRegistration" || field === "warrantyStartDate") return t;
  if (looksLikeCode(t) && t === t.toUpperCase() && t.length <= 12) return t;

  const exact = exactHit(t, lang);
  if (exact) return exact;
  if (field === "color" || field === "interior") return translateColorLikeValue(t, lang);

  const guardPartial = lang !== "en" && PARTIAL_TRANSLATION_GUARD_FIELDS.has(String(field));

  if (t.includes("(") && t.includes(")")) {
    const inner = t.replace(/^[^(]+\(/, "").replace(/\)\s*$/, "");
    const outer = t.slice(0, t.indexOf("(")).trim();
    const outerT = exactHit(outer, lang) ?? applyTokens(outer, lang);
    const innerT = exactHit(inner, lang) ?? applyTokens(inner, lang);
    if (outerT && innerT) {
      // B22: „LHD (left-hand drive)” -> „Kreisā stūre”, nevis „Kreisā stūre (Kreisā stūre)”.
      const dedupedInner = dedupeInnerAgainstOuter(outerT, innerT, lang);
      if (normKey(dedupedInner) === normKey(outerT)) return outerT;
      const out = `${outerT} (${dedupedInner})`;
      // Pustulkojuma vietā labāk oriģināls nekā „Continuously Variable ātrumkārba”.
      return guardPartial && isHalfTranslated(t, out) ? t : out;
    }
  }

  const tokened = applyTokens(t, lang);
  if (guardPartial && tokened && isHalfTranslated(t, tokened)) return t;
  return tokened || t;
}

export const DEALER_VEHICLE_VALUE_TRANSLATABLE_KEYS: (keyof OutvinVehicleInfo)[] = [
  "vehicleType",
  "transmission",
  "steeringSide",
  "body",
  "drive",
  "power",
  "countryRegion",
  "color",
  "interior",
  "fuel",
];

/* ---------- Business audits 23.11 (B23-B27, A9): tīrāki dīlera lauki PDF tabulā ---------- */

const TRANSMISSION_TYPE: Record<"manual" | "automatic", LangMap> = {
  manual: { lv: "Manuāla", en: "Manual", ru: "Механическая", de: "Schaltgetriebe" },
  automatic: { lv: "Automātiskā", en: "Automatic", ru: "Автоматическая", de: "Automatik" },
};
const SPEEDS: LangMap = { lv: "{n} pakāpju", en: "{n}-speed", ru: "{n}-ступенчатая", de: "{n}-Gang" };

/**
 * B23: Stellantis „ML6CV (STT TYPE 6-SPEED MANUAL GEARBOX )” -> „Manuāla, 6 pakāpju (ML6CV)”.
 * Tikai, ja formāts ir „KODS (apraksts ar SPEED + MANUAL/AUTOMATIC)”; citādi null.
 */
export function formatDealerTransmissionCode(raw: string, lang: ClientReportLang): string | null {
  const m = /^([A-Z0-9]{3,10})\s*\((.+)\)\s*$/.exec(collapse(raw));
  if (!m) return null;
  const code = m[1]!;
  const desc = m[2]!;
  const type = /\bmanual\b/i.test(desc) ? "manual" : /\bauto(?:matic)?\b/i.test(desc) ? "automatic" : null;
  const speeds = /\b(\d{1,2})[- ]?speed\b/i.exec(desc)?.[1];
  if (!type && !speeds) return null;
  const parts = [type ? TRANSMISSION_TYPE[type][lang] : "", speeds ? SPEEDS[lang].replace("{n}", speeds) : ""].filter(Boolean);
  return `${parts.join(", ")} (${code})`;
}

const FUEL_WORD: Record<string, LangMap> = {
  diesel: { lv: "dīzelis", en: "diesel", ru: "дизель", de: "Diesel" },
  essence: { lv: "benzīns", en: "petrol", ru: "бензин", de: "Benzin" },
  petrol: { lv: "benzīns", en: "petrol", ru: "бензин", de: "Benzin" },
  gasoline: { lv: "benzīns", en: "petrol", ru: "бензин", de: "Benzin" },
};

function displacementLiters(raw: string, lang: ClientReportLang): string {
  const t = collapse(raw).toLowerCase();
  let liters: number | null = null;
  const l = /^(\d+(?:[.,]\d+)?)\s*l$/.exec(t);
  if (l) liters = Number(l[1]!.replace(",", "."));
  const cc = /^(\d{3,4})\s*(?:cc|cm3|cm³|ccm)$/.exec(t);
  if (cc) liters = Math.round(Number(cc[1]) / 100) / 10;
  if (liters == null || !Number.isFinite(liters) || liters <= 0) return "";
  const s = liters.toFixed(1);
  return lang === "en" ? s : s.replace(".", ",");
}

/**
 * B24: „(10 DY3M 4074562) DIESEL DW10FE FAP 90KW” -> „2,0 dīzelis DW10FE, 90 kW”.
 * Iekavās ir dzinēja sērijas numurs - klientam to nerāda. Ja formāts neatpazīts - tikai bez sērijas numura.
 */
export function formatDealerEngineCode(raw: string, displacement: string, lang: ClientReportLang): string {
  const t = collapse(raw);
  const serial = /^\(([^)]*\d{5,}[^)]*)\)\s*(.*)$/.exec(t);
  if (!serial) return t;
  const rest = serial[2]!.trim();
  if (!rest) return "";
  const tokens = rest.split(/\s+/);
  const fuelTok = tokens.find((w) => FUEL_WORD[w.toLowerCase()]);
  const powerTok = tokens.find((w) => /^\d{2,3}kw$/i.test(w));
  const codeTok = tokens.find((w) => /^[A-Z]{1,4}\d{1,3}[A-Z0-9]{0,4}$/.test(w) && w !== powerTok);
  if (!fuelTok || !codeTok) return rest;
  const head = [displacementLiters(displacement, lang), FUEL_WORD[fuelTok.toLowerCase()]![lang], codeTok].filter(Boolean).join(" ");
  return powerTok ? `${head}, ${powerTok.replace(/kw$/i, " kW")}` : head;
}

/** B25: „Banquise white paint” - vārds „paint” krāsas laukā ir lieks. */
export function stripPaintWord(raw: string): string {
  return collapse(raw.replace(/\s+(?:paint|lack|peinture)\s*$/i, ""));
}

/** B26: „(FX)” - salons ir tikai kods bez apraksta. */
export function isBareTrimCode(raw: string): boolean {
  return /^\(?\s*[A-Z0-9]{1,6}\s*\)?$/.test(collapse(raw));
}
