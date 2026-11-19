/**
 * CSDD marka/modelis (19.11): brīvs teksts («Volvo XC90 2.4 D5 Edition», «3ER 325D») neatbilst CSDD modeļu sarakstam
 * (`#kmod_id_mod` - piem. «XC90», «GOLF», «E350»), tāpēc worker darbu nodod Aivaram.
 * Šeit tikai IETEIKUMS formai («CSDD modelis: XC90»). Nosūtītais teksts mainās TIKAI, ja lietotājs piespiež ieteikumu.
 * Konservatīvi: noņem dzinēja/komplektācijas vārdus, neizdomā modeli; ja nav droša pamata - tukšs saraksts.
 */

export type CsddModelCandidate = {
  /** CSDD saraksta formā (lielie burti, bez dzinēja/komplektācijas). */
  model: string;
  /** 0..1, saraksts sakārtots dilstoši. */
  confidence: number;
};

const compact = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Marku aizstājvārdi kā adapterī (MB, VW) + biežākie divu vārdu nosaukumi. */
const MAKE_ALIASES: Record<string, string> = {
  MB: "MERCEDES-BENZ",
  MERCEDES: "MERCEDES-BENZ",
  "MERCEDES BENZ": "MERCEDES-BENZ",
  VW: "VOLKSWAGEN",
};
const TWO_WORD_MAKES = new Set(["LAND ROVER", "ALFA ROMEO", "MERCEDES BENZ", "ASTON MARTIN"]);

/** Komplektācijas, piedziņas un pārnesumkārbas vārdi - modeļa nosaukumā CSDD tos neraksta. */
const TRIM_WORDS = new Set(
  [
    "EDITION", "SPORT", "SPORTLINE", "LINE", "RLINE", "MSPORT", "SLINE", "AMG", "AMGLINE", "4MATIC", "XDRIVE", "SDRIVE",
    "QUATTRO", "4MOTION", "AWD", "4WD", "4X4", "FWD", "RWD", "AUTOMATIC", "AUTOMATIK", "AUTO", "AUT", "AT", "MT", "DSG",
    "STEPTRONIC", "TIPTRONIC", "STRONIC", "GEARTRONIC", "MOMENTUM", "INSCRIPTION", "SUMMUM", "KINETIC", "RDESIGN",
    "COMFORTLINE", "HIGHLINE", "TRENDLINE", "ELEGANCE", "AVANTGARDE", "LUXURY", "BUSINESS", "PREMIUM", "EXCLUSIVE",
    "TDI", "TSI", "TFSI", "FSI", "CDI", "CRDI", "HDI", "DCI", "TDCI", "JTD", "BLUETEC", "BLUEMOTION", "BLUEHDI",
    "HYBRID", "PHEV", "PLUGIN", "ETRON", "DIESEL", "BENZIN", "PETROL", "GTD", "TURBO", "BITURBO", "FACELIFT", "LCI",
    "FULL", "FULLOPTION", "PANORAMA", "NAVI", "LED", "PLUS", "PRO", "STYLE", "DESIGN", "LIFE", "ACTIVE", "BASE",
  ].map(compact),
);

/** Virsbūves vārdi: modeļa daļa tikai kā otrais (mazāk drošais) variants («216D GRAN TOURER»). */
const BODY_PHRASES = [
  "GRAN TOURER", "ACTIVE TOURER", "GRAN COUPE", "GRAN TURISMO", "TOURING", "AVANT", "VARIANT", "ALLTRACK", "SPORTBACK",
  "KOMBI", "ESTATE", "WAGON", "CABRIO", "CABRIOLET", "COUPE", "LIMOUSINE", "SEDAN", "HATCHBACK", "COMPACT", "SPORTSVAN",
];

/** Mercedes klases burti («E 350 CDI» -> «E350»). */
const MB_CLASS_RE = /^(A|B|C|E|S|G|V|X|CL|CLA|CLK|CLS|GL|GLA|GLB|GLC|GLE|GLK|GLS|ML|SL|SLC|SLK|R)$/;

function isNoise(token: string, make: string): boolean {
  const t = compact(token);
  if (!t) return true;
  if (TRIM_WORDS.has(t)) return true;
  // Dzinēja tilpums 2.4 / 1,6 / 2.0L, gads, jauda (150KW, 190PS, 190ZS, 190HP).
  if (/^\d[.,]\d+L?$/i.test(token)) return true;
  if (/^(19|20)\d{2}$/.test(t)) return true;
  if (/^\d{2,4}(KW|PS|ZS|HP|BHP|CV)$/.test(t)) return true;
  // Volvo dzinēju kodi D2..D5, T3..T8, B4/B5 (mild hybrid).
  if (make === "VOLVO" && /^[DTB]\d$/.test(t)) return true;
  // BMW sērija «3ER», «3-SERIES», «SERIES»; modeļa kods paliek («325D»).
  if (make === "BMW" && (/^\d(ER|SERIES|SERIE|SERIJA)$/.test(t) || t === "SERIES" || t === "SERIE")) return true;
  return false;
}

/** Atdala marku no brīvā teksta. «3ER 325D» bez markas -> BMW (sērijas apzīmējums ir tikai BMW). */
export function splitCsddMake(brandModel: string): { make: string; makeAsTyped: string; rest: string } {
  const tokens = String(brandModel || "").trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { make: "", makeAsTyped: "", rest: "" };
  const two = tokens.slice(0, 2).join(" ").toUpperCase();
  if (tokens.length > 2 && TWO_WORD_MAKES.has(two)) {
    return { make: MAKE_ALIASES[two] || two, makeAsTyped: tokens.slice(0, 2).join(" "), rest: tokens.slice(2).join(" ") };
  }
  if (/^\d(ER|-?SERIES)$/i.test(tokens[0])) return { make: "BMW", makeAsTyped: "", rest: tokens.join(" ") };
  const first = tokens[0].toUpperCase();
  return { make: MAKE_ALIASES[first] || first, makeAsTyped: tokens[0], rest: tokens.slice(1).join(" ") };
}

/**
 * CSDD modeļa kandidāti no brīvā teksta. make - marka (jebkādā formā), freeText - modeļa daļa (drīkst ar marku sākumā).
 * knownModels (CSDD saraksts, ja zināms) - atgriež TIKAI tos kandidātus, kas sarakstā ir; nekas neatbilst -> [].
 */
export function normalizeCsddModel(make: string, freeText: string, knownModels?: readonly string[]): CsddModelCandidate[] {
  const mk = MAKE_ALIASES[String(make || "").trim().toUpperCase()] || String(make || "").trim().toUpperCase();
  let tokens = String(freeText || "").trim().split(/\s+/).filter(Boolean);
  // Marka atkārtota modeļa tekstā («Volvo» + «Volvo XC90»).
  const makeWords = mk.split(/[\s-]+/).map(compact);
  while (tokens.length && (makeWords.includes(compact(tokens[0])) || compact(MAKE_ALIASES[tokens[0].toUpperCase()] || "") === compact(mk))) {
    tokens = tokens.slice(1);
  }
  const upper = tokens.map((t) => t.toUpperCase());

  // Mercedes: «E 350» -> «E350» (klase + skaitlis vienā vārdā).
  const merged: string[] = [];
  for (let i = 0; i < upper.length; i++) {
    if (mk === "MERCEDES-BENZ" && MB_CLASS_RE.test(upper[i]) && /^\d{2,3}[A-Z]?$/.test(upper[i + 1] ?? "")) {
      merged.push(`${upper[i]}${upper[i + 1]}`);
      i++;
    } else merged.push(upper[i]);
  }

  const core = merged.filter((t) => !isNoise(t, mk));
  if (!core.length) return [];
  let primary = core[0].replace(/[^A-Z0-9-]/g, "");
  // BMW: ja ir modeļa kods (325D, 216D, 520I, X5), tas ir modelis.
  if (mk === "BMW") {
    const code = core.find((t) => /^(\d{3}[A-Z]{0,2}|[XZMI]\d{1,2}[A-Z]?)$/.test(t));
    if (code) primary = code;
  }
  if (!/[A-Z]/.test(primary) && !/^\d{3,4}$/.test(primary)) return []; // tikai cipari/zīmes - neminam

  const out: CsddModelCandidate[] = [{ model: primary, confidence: 0.8 }];
  // Virsbūve - no oriģinālajiem vārdiem (ACTIVE ir arī komplektācija, bet «ACTIVE TOURER» - virsbūve).
  const restText = merged.slice(merged.indexOf(primary) + 1).join(" ");
  const body = BODY_PHRASES.find((p) => restText === p || restText.startsWith(`${p} `));
  if (body) out.push({ model: `${primary} ${body}`, confidence: 0.5 });

  if (!knownModels) return out;
  const known = new Map(knownModels.map((m) => [compact(m), m]));
  const matched = out
    .map((c) => (known.has(compact(c.model)) ? { model: known.get(compact(c.model))!, confidence: Math.min(1, c.confidence + 0.15) } : null))
    .filter((c): c is CsddModelCandidate => c !== null);
  return matched.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Formas ieteikums: «CSDD modelis: XC90» un ko ielikt laukā, ja lietotājs piespiež («Volvo XC90»).
 * null - teksts jau atbilst (piem. «VW Golf») vai nav droša ieteikuma.
 */
export function csddModelHint(brandModel: string): { model: string; apply: string } | null {
  const { make, makeAsTyped, rest } = splitCsddMake(brandModel);
  if (!make || !rest) return null;
  const [best] = normalizeCsddModel(make, rest);
  if (!best) return null;
  if (compact(best.model) === compact(rest)) return null;
  const makeText = makeAsTyped || (make === "BMW" ? "BMW" : make);
  return { model: best.model, apply: `${makeText} ${best.model}` };
}
