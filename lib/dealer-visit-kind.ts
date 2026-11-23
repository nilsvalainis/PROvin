/**
 * Dīlera servisa vizītes veids (čips PDF un hronoloģijā) - viena loģika visur.
 *
 * Nils 23.11.2026: veids pēc darbu satura, nevis no viena mazsvarīga darba. Katra rinda tiek
 * vērtēta atsevišķi (apkope / remonts / neitrāla), un vizīte saņem galveno veidu; ja otrs veids
 * ir būtisks, arī otru („Apkope + Remonts”). Diagnostika / pārbaude / noņemšana-uzstādīšana
 * ir neitrāla - mehāniska maiņa vienmēr sver vairāk par pārbaudi.
 */
import { isDealerCampaignText } from "@/lib/admin-ai-dealer-facts";
import {
  hasAnyMajorAssemblyRepair,
  hasNonCampaignRepairAction,
  isAccidentRepairWork,
  isCheckNoFaultWork,
  isCourtesyCarWork,
  isDealerSoftwareWork,
  isRoutineMaintenanceWork,
} from "@/lib/dealer-major-works";
import {
  isVendorServiceCategoryLine,
  looksLikeCbsKeyReadWorks,
  looksLikeIntervalMaintenanceWorks,
} from "@/lib/vendor-service-history";

/**
 * `record` = ieraksts bez darbu atšifrējuma (tukša vizīte, vietturis vai tikai kategorija),
 * `other` = darbi ir, bet tie nav ne apkope, ne remonts („Citi darbi”),
 * `accessories` = piederumi / riepas. „Remonts” tikai reālam remontam - noklusējums NAV remonts.
 */
export type DealerVisitKind =
  | "maintenance"
  | "repair"
  | "campaign"
  | "warranty"
  | "key_read"
  | "record"
  | "other"
  | "accessories";

const WARRANTY_RE = /garantij|warranty|garantie|warrenty|kulanc/i;

const PLACEHOLDER_WORKS_RE = /detaliz[ēe]ts\s+darbu\s+saraksts/i;

/** Rinda, kas tikai saka, ka detaļu nav („Servisa piezīme”, „Nav norādīts”). */
const NO_DETAILS_LINE_RE =
  /^(?:servisa\s+piez[īi]me|service\s+note|nav\s+nor[āa]d[īi]ts|nav\s+zin[āa]ms|not\s+specified|unknown|n\/a|-+)$/i;

/** Tukša vizīte: nav darbu, tikai vietturis vai tikai kategorijas vārds („Apkope”, „Service”). */
export function isDealerVisitWithoutDetails(works: string): boolean {
  const lines = (works ?? "")
    .split(/[\n;]+/)
    .map((l) => l.replace(/\s+/g, " ").trim().replace(/[.:]+$/, ""))
    .filter(Boolean);
  return lines.every(
    (l) =>
      PLACEHOLDER_WORKS_RE.test(l) ||
      isVendorServiceCategoryLine(l) ||
      /^(service|serviss|wartung|maintenance)$/i.test(l) ||
      NO_DETAILS_LINE_RE.test(l),
  );
}

/** Ražotāja plānotā apkope bez atšifrējuma („Nissan Customer Maintenance Plan”, „Inspektion nach 30.000 km”). */
const PLANNED_MAINTENANCE_RE =
  /maintenance\s+plan|customer\s+maintenance|scheduled\s+(?:maintenance|service)|service\s+plan|pl[āa]not\p{L}*\s+apkop\p{L}*|k[āa]rt[ēe]j\p{L}*\s+apkop\p{L}*|apkope\s+(?:pie|p[ēe]c)\s+\d|inspektion\s+nach|standard\s+scope|standardumfang|standarta\s+apkop\p{L}*|ecoservice|jahresinspektion|gada\s+apkop\p{L}*/iu;

/** Riepas / riteņi / sezonas uzglabāšana un piederumi (atslēgu piekariņš, emblēma, paklājiņi). */
const TYRES_ACCESSORIES_RE =
  /riep\p{L}*|rite[ņn]\p{L}*|disk\p{L}*\s+komplekt|balans[ēe]\p{L}*|\btyres?\b|\btires?\b|\bwheels?\b|reifen\p{L}*|r(?:ä|ae|a)der\p{L}*|radwechsel|\bwkr\b|\bskr\b|einlagerung|uzglab[āa]\p{L}*|piekari[ņn]\p{L}*|key\s*(?:ring|fob)|schl(?:ü|ue|u)sselanh(?:ä|ae|a)nger|embl[ēe]m\p{L}*|\bemblem\p{L}*|\bplaque\b|\bbadge\b|pakl[āa]ji[ņn]\p{L}*|floor\s+mats?|fu(?:ß|ss)matten|lietussarg\p{L}*|umbrella|regenschirm|piederum\p{L}*|accessor\p{L}*|zubeh(?:ö|oe|o)r|merchandise|lifestyle/iu;

/** Riepu / piederumu vizītē nedrīkst būt cita mehāniska darba (bremzes, piekare u.c.). */
const MECHANICAL_PART_RE =
  /brem[zž]\p{L}*|brake\p{L}*|brems\p{L}*|amortiz\p{L}*|shock\s+absorb|sto(?:ß|ss)d(?:ä|ae|a)mpfer|pneimo\p{L}*|pneimatisk\p{L}*|pneumatic|luftfeder|atsper\p{L}*|\bspring\b|\bfeder\b|spol\p{L}*|\bcoil\b|z(?:ü|ue|u)ndspule|s[ūu]k[nņ]\p{L}*|\bpump\p{L}*|pumpe|radiator\p{L}*|k(?:ü|ue|u)hler|dzes[ēe]t[āa]j\p{L}*|\begr\b|\bagr\b|turbo\p{L}*|saj[ūu]g\p{L}*|clutch|kupplung|spararat\p{L}*|flywheel|schwungrad|siksn\p{L}*|\bbelt\b|riemen|[ķk][ēe]d\p{L}*|\bchain\b|kette|gult[nņ]\p{L}*|bearing|\blager\b|svir\p{L}*|control\s+arm|querlenker|[šs]arn[īi]r\p{L}*|ball\s+joint|kugelgelenk|buks\p{L}*|bushing|buchse|bl[īi]v\p{L}*|gasket|dichtung|sprausl\p{L}*|iesmidzin\p{L}*|injector|injektor|kompresor\p{L}*|compressor|kompressor|[ģg]enerator\p{L}*|alternator|lichtmaschine|starter\p{L}*|anlasser|akumulator\p{L}*|battery|batterie|sensor\p{L}*|dev[ēe]j\p{L}*|izpl[ūu]d\p{L}*|exhaust|auspuff|katalizator\p{L}*|kv[ēe]pu|sodr[ēe]ju|particulate|partikelfilter|st[ūu]res|steering|lenk\p{L}*|pusass|drive\s*shaft|antriebswelle|termostat\p{L}*|thermostat|sv[ēe]tspuldz\p{L}*|lukt\p{L}*|headlight|scheinwerfer/iu;

/** Rinda ar apkopes atzīmi („… (apkope)”, „… WARTUNG”, „Sistemātiskie apkopes darbi”). */
const MAINTENANCE_LINE_MARK_RE =
  /\(apkope\)|(?:liel|maz|visp[āa]r[ēe]j|regul[āa]r|pl[āa]not)\p{L}*\s+(?:\p{L}+\s+)?apkop\p{L}*|\bapkope\s+[ab]\b|\bwartung\p{L}*|\bmaintenance\b|\binspektion\b|apkop\p{L}*\s+darb|k[āa]rt[ēe]j\p{L}*\s+apkop|systematisch\p{L}*\s+wartung/iu;

/** Klimata sistēmas apkope (aukstumaģenta uzpilde „bez remonta”) nav remonts. */
const AC_SERVICE_LINE_RE =
  /aukstuma[ģg]ent\p{L}*|k[äa]ltemittel|refrigerant|klimaservice|kondicionier\p{L}*\s+apkop/iu;

/** Diagnostika / pārbaude / noņemšana-uzstādīšana bez apkopes atzīmes - neitrāla rinda (ne apkope, ne remonts). */
const NEUTRAL_LINE_RE =
  /diagnos\p{L}*|k[ļl][ūu]mju\s+mekl\p{L}*|fehlersuche|p[āa]rbaud\p{L}*|\bcheck\p{L}*|gepr(?:ü|ue|u)ft|pr(?:ü|ue|u)fung|no[ņn]em\p{L}*\s+un\s+uzst[āa]d\p{L}*|aus-?\s*u(?:nd)?\.?\s*eingebaut|programm[ēe]\p{L}*|programmier\p{L}*|nostiprin\p{L}*/iu;

/** Apkopes saturs rindā (filtri, šķidrumi, eļļa, sveces, apskate) - tad pārbaude rindā nepadara to neitrālu. */
const MAINTENANCE_SUBSTANCE_RE =
  /filtr\p{L}*|filter|фильтр|e[ļl][ļl]\p{L}*|(?:ö|oe)l|\bol\b|oil|масл\p{L}*|жидкост\p{L}*|антифриз|huile|olio|aceite|olie|[šs][ķk]idrum\p{L}*|fl(?:ü|ue|u)ssig\p{L}*|fluid|svec\p{L}*|spark|z(?:ü|ue|u)ndkerz\p{L}*|apskat\p{L}*|serviss|\bservice\b|apkop\p{L}*/iu;

/** Klientam nesaistīts „bez remonta” (aukstumaģenta uzpilde bez remonta) nav remonta pazīme. */
const NO_REPAIR_NOTE_RE = /\(?\s*bez\s+remonta\s*\)?|ohne\s+reparatur|without\s+repair|no\s+repair/giu;

function visitWorkLines(works: string): string[] {
  return (works ?? "")
    .split(/\r?\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(
      (l) =>
        l &&
        !PLACEHOLDER_WORKS_RE.test(l) &&
        !NO_DETAILS_LINE_RE.test(l.replace(/[.:]+$/, "")) &&
        !isVendorServiceCategoryLine(l.replace(/[.:]+$/, "")),
    );
}

type LineKind = "maintenance" | "repair" | "neutral";

/** Vienas darbu rindas veids. */
export function classifyDealerWorkLine(rawLine: string): LineKind {
  const line = rawLine.replace(NO_REPAIR_NOTE_RE, " ").replace(/\s+/g, " ").trim();
  if (!line) return "neutral";
  if (MAINTENANCE_LINE_MARK_RE.test(line)) return "maintenance";
  if (AC_SERVICE_LINE_RE.test(line) && !hasAnyMajorAssemblyRepair(line)) return "maintenance";
  const kind = classifyDealerVisitKindWhole(line);
  if (kind === "campaign" || kind === "warranty" || kind === "key_read" || kind === "accessories") {
    return "neutral";
  }
  const replaces = hasNonCampaignRepairAction(line);
  const substance = MAINTENANCE_SUBSTANCE_RE.test(line);
  // Pārbaude / diagnostika / noņemšana-uzstādīšana bez maiņas un bez apkopes satura.
  if (NEUTRAL_LINE_RE.test(line) && !replaces && !substance) return "neutral";
  if (kind === "maintenance") {
    // Detaļas maiņa (akumulators, bremžu diski, starteris) ir remonts; filtri / šķidrumi / sveces - apkope.
    return replaces && !substance ? "repair" : "maintenance";
  }
  if (kind === "repair") return "repair";
  return "neutral";
}

export type DealerVisitKinds = {
  /** Galvenais veids (čips, sliedes krāsa). */
  primary: DealerVisitKind;
  /** Otrs būtisks veids („Apkope + Remonts”), citādi null. */
  secondary: DealerVisitKind | null;
};

/**
 * Vizītes veids(-i). Apkope un remonts pēc rindu skaita (vienādā skaitā - apkope); otrais čips
 * tikai, ja tā rindu ir vismaz trešdaļa no galvenā (viena mazsvarīga rinda kategoriju nemaina).
 */
export function classifyDealerVisitKinds(works: string): DealerVisitKinds {
  const whole = classifyDealerVisitKindWhole(works);
  if (whole === "key_read" || whole === "warranty" || whole === "campaign") {
    return { primary: whole, secondary: null };
  }
  if (isDealerVisitWithoutDetails(works)) return { primary: "record", secondary: null };
  const lines = visitWorkLines(works);
  let maintenance = 0;
  let repair = 0;
  for (const line of lines) {
    const k = classifyDealerWorkLine(line);
    if (k === "maintenance") maintenance++;
    else if (k === "repair") repair++;
  }
  if (isAccidentRepairWork(works)) {
    return { primary: "repair", secondary: maintenance > 0 && maintenance * 3 >= Math.max(1, repair) ? "maintenance" : null };
  }
  if (maintenance === 0 && repair === 0) {
    if (whole === "accessories") return { primary: "accessories", secondary: null };
    if (whole === "maintenance" || whole === "repair") return { primary: whole, secondary: null };
    return { primary: lines.length > 0 ? "other" : "record", secondary: null };
  }
  const primary: DealerVisitKind = maintenance >= repair ? "maintenance" : "repair";
  const major = Math.max(maintenance, repair);
  const minor = Math.min(maintenance, repair);
  const secondary: DealerVisitKind | null =
    minor > 0 && minor * 3 >= major ? (primary === "maintenance" ? "repair" : "maintenance") : null;
  return { primary, secondary };
}

/** Galvenais vizītes veids (saderībai ar esošajiem izsaucējiem). */
export function classifyDealerVisitKind(works: string): DealerVisitKind {
  return classifyDealerVisitKinds(works).primary;
}

function classifyDealerVisitKindWhole(works: string): DealerVisitKind {
  const text = works ?? "";
  if (looksLikeCbsKeyReadWorks(text)) return "key_read";
  if (isDealerVisitWithoutDetails(text)) return "record";
  if (WARRANTY_RE.test(text)) return "warranty";
  if (hasAnyMajorAssemblyRepair(text)) return "repair";
  const independentRepair = hasNonCampaignRepairAction(text);
  if (isDealerCampaignText(text) && !independentRepair) return "campaign";
  if (isDealerSoftwareWork(text) && !independentRepair) return "campaign";
  if (looksLikeIntervalMaintenanceWorks(text) || isRoutineMaintenanceWork(text)) return "maintenance";
  if (PLANNED_MAINTENANCE_RE.test(text)) return "maintenance";
  if (isCheckNoFaultWork(text) && !independentRepair) return "maintenance";
  if (isCourtesyCarWork(text) && !independentRepair) return "warranty";
  const mechanical = MECHANICAL_PART_RE.test(text);
  if (TYRES_ACCESSORIES_RE.test(text) && !mechanical) return "accessories";
  if (independentRepair || mechanical) return "repair";
  if (isDealerCampaignText(text)) return "campaign";
  // Pozīcija bez darbības vai neatpazīts teksts: fakts ir tikai „ieraksts”, ne remonts.
  return "record";
}

export function dealerVisitKindLabel(kind: DealerVisitKind): string {
  switch (kind) {
    case "maintenance":
      return "Apkope";
    case "repair":
      return "Remonts";
    case "campaign":
      return "Kampaņa";
    case "warranty":
      return "Garantija";
    case "key_read":
      return "Nolasījums";
    case "record":
      return "Ieraksts bez detaļām";
    case "other":
      return "Citi darbi";
    case "accessories":
      return "Piederumi / riepas";
  }
}

/** Hronoloģijas kartītes virsraksts dīlera vizītei - tas pats veids kā dīlera sadaļas čipā. */
export function dealerVisitTimelineTitle(works: string): string {
  const { primary, secondary } = classifyDealerVisitKinds(works);
  if (primary === "key_read") return "Dīlera nolasījums";
  if (primary === "record") return "Servisa apmeklējums";
  const main = dealerVisitKindLabel(primary);
  return secondary ? `${main} + ${dealerVisitKindLabel(secondary).toLocaleLowerCase("lv")}` : main;
}
