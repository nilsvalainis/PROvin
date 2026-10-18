/**
 * OFICIĀLĀ DĪLERA DATI: „Lielie darbi” / lielie mezgli.
 *
 * Apkope pie mezgla (eļļa, filtrs, ATF, šķidrumi, sveces, pārbaude, skalošana)
 * NAV agregāta maiņa. Tikai reāla nomaiņa, kapitālais remonts, REMAN/Austausch
 * vai lielā mezgla rinda detaļu sarakstā (CAPS + part number).
 * Avoti bieži EN/DE/RU/LV, ar saplēstiem umlautiem un TJ/Symptom/Diagnose/Aktion
 * veidni (Volvo RAW). Izeja jebkurā atskaites valodā.
 */
import { foldOilWorkText, isEngineOilChangeWork } from "@/lib/oil-change-intervals";

export type DealerMajorAssemblyId =
  | "engine"
  | "timing_chain"
  | "timing_belt"
  | "crankshaft_seal"
  | "gearbox"
  | "clutch"
  | "transfer_case"
  | "differential"
  | "propshaft"
  | "dual_mass_flywheel"
  | "turbo"
  | "body_glass";

export type DealerMajorAssemblySpec = {
  id: DealerMajorAssemblyId;
  label: string;
};

/** Kārtība PDF kopsavilkumā. Etiķetes ir LV atslēgas `client-report-i18n`. */
export const MAJOR_ASSEMBLY_SPECS: readonly DealerMajorAssemblySpec[] = [
  { id: "engine", label: "Dzinējs" },
  { id: "timing_chain", label: "Sadales ķēde" },
  { id: "timing_belt", label: "Zobsiksna" },
  { id: "crankshaft_seal", label: "Kloķvārpstas blīvslēgs" },
  { id: "gearbox", label: "Ātrumkārba" },
  { id: "clutch", label: "Sajūgs" },
  { id: "transfer_case", label: "Sadales kārba" },
  { id: "differential", label: "Diferenciālis / reduktors" },
  { id: "propshaft", label: "Kardāns" },
  { id: "dual_mass_flywheel", label: "Divmasu spararats" },
  { id: "turbo", label: "Turbokompresors" },
  { id: "body_glass", label: "Virsbūve / stikls" },
];

const ASSEMBLY_RE: Record<DealerMajorAssemblyId, RegExp> = {
  engine:
    /\bengine\b|\bdzinej|двигател|motorwechsel|motorersatz|motortausch|\bmoteur\b|\bmotore\b|\bmotor\b/u,
  timing_chain:
    /timing\s+chain|steuerkette|sadales\s+ked|kedes\s+(komplekt|spriegot|main)|distributieketting|kamkedja|chaine\s+de\s+distribution|catena\s+di\s+distribuzione|cadena\s+de\s+distribucion|цеп\p{L}*\s+(?:грм|газораспред)/u,
  timing_belt:
    /zobsiksn|timing\s+belt|zahnriemen|distributieriem|kamrem|courroie\s+de\s+distribution|cinghia\s+di\s+distribuzione|correa\s+de\s+distribucion|ремень\s+грм/u,
  crankshaft_seal:
    /kurbelwell(?:en)?(?:simmerring|dicht)|crankshaft\s+seal|klokvarpstas\s+bliv|сальник\s+колен|joint\s+(?:spi|de\s+)?vilebrequin|paraolio\s+albero/u,
  gearbox:
    /atrumkar|parnesumkarb|transmisi|\bkarbas?\b|gearbox|\btransmission\b|getriebe(?!ol)|versnellingsbak|vaxellad|boite(?:\s+de)?\s+vitesses|\bcambio\b|caja(?:\s+de)?\s+cambios|коробк\p{L}*(?:\s+передач)?|акпп|мкпп|\bdsg\b|\bdct\b|\bcvt\b|tiptronic|doppelkupplung|divsajug|mechatron|gidroblok|гидроблок|valve\s+body|torque\s+converter|hidrotransform|гидротрансформатор|getriebewechsel|getriebeersatz|getriebetausch/u,
  clutch: /\bclutch(?:\s+kit)?\b|\bsajug|kupplungssatz|\bkupplung\b/u,
  transfer_case:
    /transfer(?:\s+case|\s+box)?|verteilergetriebe|razdat|раздаточн|sadales\s+karb|boite\s+de\s+transfert|caja\s+de\s+transferencia|tussenbak|fordelningslad/u,
  differential:
    /differential|differenzial|diferencial|дифференциал|achsgetriebe(?!ol)|hinterachs(?!ol)|aizmugurej\p{L}*\s+tilt|differentiel|differenziale/u,
  propshaft:
    /kardan|prop[\s-]?shaft|kardanwelle|\bcardan\b|gelenkwelle|transmisij\p{L}*\s+uz\s+(?:aizmugurej|prieksej)\p{L}*\s+asi/u,
  dual_mass_flywheel:
    /divmasu|spararat|dual[\s-]?mass|twin\s+mass|flywheel|zweimassen|schwungrad|маховик|vliegwiel|svanghjul|volant\s+bimasse|volano\s+bimassa/u,
  turbo: /\bturbo(?:charger|lader|compresseur)?\b|турбокомпрессор|turbokompresor/u,
  body_glass:
    /vejstikl|stikla\s+main|bamper|sparn|durvju|kraso|parkras|body\s+repair|windscreen|windshield|bumper|fender|lackier|karosser|scheibe|pare[- ]brise|parabrezza|parabrisas|кузов|бампер|крыл|лобов\p{L}*\s+стекл/u,
};

const AXLE_DIFF_CONTEXT_RE =
  /diferencial|differenzial|differential|aizmugurej\p{L}*\s+(?:tilt|ass)|prieksej\p{L}*\s+(?:tilt|ass)|\btilt[au]?\b|achsgetriebe|hinterachs/u;

const REDUKTORS_RE = /reduktor|редуктор/u;

const ADBLUE_RE = /adblue|ad\s*blue|\bscr\b/u;

const DUAL_CLUTCH_RE = /dual[\s-]+clutch|doppelkupplung|divsajug/u;

const PROPSHAFT_NOT_GEARBOX_RE =
  /transmisij\p{L}*\s+uz\s+(?:aizmugurej|prieksej)\p{L}*\s+asi|kardan|prop[\s-]?shaft|kardanwelle|gelenkwelle/u;

const SHAFT_SEAL_RE = /dicht|seal|simmerring|sealing\s+ring/u;

const INTERIOR_TRIM_RE =
  /door\s+trim|trim\s+panel|interior\s+trim|durvju\s+apdar|apdares\s+panel|sitzkissen|upholstery/u;

const WASHER_FLUID_RE =
  /scheibenklar|scheibenwasch|washer\s+fluid|windscreen\s+washer|windshield\s+washer|stiklu\s+mazg/u;

const CHARGE_AIR_MINOR_RE = /charge\s+air|ladeluft|intercooler/u;

const TURBO_OIL_PRODUCT_RE =
  /twinpower|\bturbo\b(?:\s+\w+){0,4}\s+\d{1,2}w\d{2,3}|\d{1,2}w\d{2,3}(?:\s+\w+){0,4}\s+\bturbo\b|\bturbo\b(?:\s+\w+){0,6}\s+\bll[- ]?\d|\bll[- ]?\d(?:\s+\w+){0,6}\s+\bturbo\b/u;

const REMAN_EXCHANGE_RE =
  /\breman(?:ufactured)?\b|\baustauschteil\b|\brp\s+reman\b|\baustausch(?:getriebe|motor|turbo)?\b/u;

const DEALER_PART_NO_RE = /\(\s*\d{6,12}\s*\)/u;

const REPAIR_KIT_RE = /repair\s+kit/u;

/** Eļļa / filtrs / šķidrums / sveces / pārbaude / skalošana / papildināšana. */
const CONSUMABLE_RE =
  /(?:motor|engine|getriebe|transmission|gearbox|karbas?|atrumkarb|parnesum|transfer(?:\s+case)?|differential|achs|razdat|раздаточн|reduktor|редуктор|boite|cambio)?(?:\s|-)?(?:oil|ol\b|\bellas?\b|huile|olio|aceite|\bolja\b|olie\b|масло|масла|маслу)|oil(?:\s+and\s+filter)?(?:\s+(?:change|service|replacement|filter))?|\bfilter\b|filtr\p{L}*|olwechsel|oilwechsel|filterwechsel|\bvidange\b|atf\b|dexron|mercon|fluid|skidrum|жидкост|coolant|kuhlmittel|antifreeze|dzesesan|антифриз|охлажд|brake\s+fluid|bremsfluss|bremzu\s+skidrum|тормозн\p{L}*\s+жидкост|spark\s*plugs?|zundkerz|aizdedzes\s+svec|свеч|inspection|inspektion|apskate|осмотр|fahrzeugcheck|wartung|\bcheck\b|prufung|parbaud|проверк|top[- ]?up|nachfull|papildin|долив|flush|spulung|skalos|промыв|диагност|diagnos|lube(?:\s+service)?|long[\s-]?life|pollen|cabin\s+filter|luftfilter|innenraumfilter|microfilter|gaisa\s+filtr|degvielas\s+filtr|fuel\s+filter|salona\s+gaisa/u;

const CONSUMABLE_COMPOUND_RE =
  /getriebeol\p{L}*|motorol\p{L}*|achs(?:getriebe)?ol\p{L}*|haldexol\p{L}*|hinterachs\p{L}*\s+ol\p{L}*|ol[- ]und[- ]filter|масла?\s+и\s+фильтра?/u;

const OVERHAUL_RE =
  /overhaul|rebuild|rebuilt|instandgesetz|instandsetz|uberholt|generaluberhol|kapitalais\s+remont|капитальн\p{L}*\s+ремонт|переборк|recondition/u;

const UNIT_REPAIR_VERB_RE =
  /replac\p{L}*|\brep\.|exchang\p{L}*|swapp\p{L}*|getauscht|erneuert|ausgetauscht|austausch|nomain|wechsel|zamena|замена|\bchange\b|maina|\bremont|ремонт|repaired|reparatur|repariert|erneuerung|tausch(?:en|te)?|ersetzt|vervangen|bytt|parkras|lackier|remplac\p{L}*|sostituit\p{L}*|sostituz\p{L}*|reemplaz\p{L}*|sustitu\p{L}*|cambiato/u;

const CAMPAIGN_CLAUSE_RE =
  /\bqb\b|acc(?:ording)?\.?\s*to:?\s*qb|nach\s+qb|technische\s+aktion|safety\s+recall|\brecalls?\b|ruckruf|service\s+action|field\s+fix|\btsb\b|\bsib\b/u;

const SOFTWARE_RE =
  /software\s+control\s+module|control\s+module\s+download|software\s+update|total\s+upgrade|vcm\s*\/?\s*cmq\s+upgrade|steuergerat|programmierung|codierung|downloading/u;

const COURTESY_CAR_RE = /ersatzwagen|courtesy\s+car|replacement\s+vehicle|mainas\s+auto/u;

const COMFORT_INTERIOR_RE =
  /sun\s*roof|schiebedach|panoramadach|dachkaset|wind\s+deflector|upholstery|sitzkissen|sitzbezug|sitzkissenbezug|interior\s+trim/u;

const MINOR_PART_RE =
  /schlauch|hose|bleed|dicht(?:ung|ring)?|sealing\s+ring|simmerring|kurbelwell|crankshaft|drive\s+shaft|antriebswelle|fuel\s+line|kraftstoffleitung|connector|cooling\s+system|kuhlsystem|ladeluft|charge\s+air|zahnriemen|timing\s+belt|drain\s+hose|klima|climate\s+unit|ohne\s+befund|park\s+acc|oil\s+line|olleitung/u;

const ENGINE_NOT_THE_UNIT_RE =
  /motorleistung|motorol|olleckage|\bmotoren\b|schlauch|hose|dicht|seal|simmerring|kurbelwell|crankshaft|zahnriemen|timing\s+belt|cooling|kuhlsystem|ladeluft|charge\s+air|fuel\s+line|connector|sun\s*roof|dachkaset|schiebedach|upholstery|sitz|software|upgrade|downloading|ersatzwagen|courtesy/u;

const ENGINE_UNIT_REPLACE_RE =
  /(?:\bengine\b|dzinej\p{L}*|двигател\p{L}*|\bmoteur\b|\bmotore\b|\bmotor\b)(?:\s+and\s+turbo(?:charger|lader)?|\s+und\s+turbolader)?\s+(?:replac|erneuer|getauscht|ersetzt|nomain|maina|wechsel|remplac|sostituit|sustitu|reemplaz)|(?:replac\p{L}*|erneuer\p{L}*|замена|nomain|remplac\p{L}*|sostituit\p{L}*|sustitu\p{L}*|reemplaz\p{L}*)\s+(?:the\s+|du\s+|de\s+(?:l[ae]\s+)?|del\s+|della\s+|el\s+)?(?:engine|dzinej|двигател|moteur|motore|\bmotor\b)|motorwechsel|motorersatz|motortausch|(?:^|[^\p{L}])motor\s+(?:erneuert|getauscht|ersetzt|ausgewechselt)|замена\s+двигател|капитальн\p{L}*\s+ремонт\s+двигател/u;

const CHECK_NO_FAULT_RE = /ohne\s+befund|no\s+fault|bez\s+defekta|nav\s+konstatet/u;

const MINOR_SKIP_EXCEPT: ReadonlySet<DealerMajorAssemblyId> = new Set([
  "timing_chain",
  "timing_belt",
  "crankshaft_seal",
]);

function uniqueNonEmpty(parts: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const t = part.replace(/\s+/g, " ").trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** PDF/RAW bieži ieliek `?` vietā `ö/ü/ä`. `?l` = öl. */
export function normalizeBrokenDealerUmlauts(raw: string): string {
  return (raw ?? "").replace(/\?l/gi, "ol").replace(/(\p{L})\?(\p{L})/gu, "$1o$2");
}

function stripDealerTemplateNoise(text: string): string {
  return text
    .replace(/\btj\s*:/gi, " ")
    .replace(/\bsymptom\s*:/gi, " ")
    .replace(/\bdiagnose\s*:/gi, " ")
    .replace(/\baktion\s*:/gi, " ");
}

export function foldDealerWorkText(raw: string): string {
  return foldOilWorkText(stripDealerTemplateNoise(normalizeBrokenDealerUmlauts(raw)));
}

function splitClauses(folded: string): string[] {
  const protectedAbbrev = folded.replace(/\bacc\./g, "acc");
  return uniqueNonEmpty(protectedAbbrev.split(/[\n;/|]+|(?<=\w)[:.]\s+/));
}

function isRemanOrExchange(folded: string): boolean {
  REMAN_EXCHANGE_RE.lastIndex = 0;
  return REMAN_EXCHANGE_RE.test(folded);
}

function hasDealerPartNumber(folded: string): boolean {
  DEALER_PART_NO_RE.lastIndex = 0;
  return DEALER_PART_NO_RE.test(folded);
}

function isTurboOilProduct(folded: string): boolean {
  TURBO_OIL_PRODUCT_RE.lastIndex = 0;
  if (TURBO_OIL_PRODUCT_RE.test(folded)) return true;
  if (!/\bturbo\b/u.test(folded)) return false;
  if (isEngineOilChangeWork(folded)) return true;
  CONSUMABLE_RE.lastIndex = 0;
  return CONSUMABLE_RE.test(folded) && !/turbo(?:charger|lader|kompresor)/u.test(folded);
}

function isAdBlueReducer(folded: string): boolean {
  ADBLUE_RE.lastIndex = 0;
  REDUKTORS_RE.lastIndex = 0;
  return ADBLUE_RE.test(folded) && REDUKTORS_RE.test(folded);
}

function isInteriorTrim(folded: string): boolean {
  INTERIOR_TRIM_RE.lastIndex = 0;
  return INTERIOR_TRIM_RE.test(folded);
}

function isWasherFluid(folded: string): boolean {
  WASHER_FLUID_RE.lastIndex = 0;
  return WASHER_FLUID_RE.test(folded);
}

function isChargeAirMinor(folded: string): boolean {
  CHARGE_AIR_MINOR_RE.lastIndex = 0;
  return CHARGE_AIR_MINOR_RE.test(folded);
}

function mentionsAssembly(folded: string, assembly: DealerMajorAssemblyId): boolean {
  if (assembly === "turbo" && isTurboOilProduct(folded)) return false;
  if (assembly === "body_glass" && (isWasherFluid(folded) || isInteriorTrim(folded))) return false;
  if (assembly === "gearbox" && PROPSHAFT_NOT_GEARBOX_RE.test(folded)) return false;
  if (assembly === "clutch") {
    const withoutDual = folded.replace(DUAL_CLUTCH_RE, " ");
    ASSEMBLY_RE.clutch.lastIndex = 0;
    return ASSEMBLY_RE.clutch.test(withoutDual);
  }
  if (assembly === "differential") {
    if (isAdBlueReducer(folded)) return false;
    ASSEMBLY_RE.differential.lastIndex = 0;
    if (ASSEMBLY_RE.differential.test(folded)) return true;
    REDUKTORS_RE.lastIndex = 0;
    AXLE_DIFF_CONTEXT_RE.lastIndex = 0;
    return REDUKTORS_RE.test(folded) && AXLE_DIFF_CONTEXT_RE.test(folded);
  }
  if (assembly === "propshaft") {
    ASSEMBLY_RE.propshaft.lastIndex = 0;
    if (!ASSEMBLY_RE.propshaft.test(folded)) return false;
    SHAFT_SEAL_RE.lastIndex = 0;
    return !SHAFT_SEAL_RE.test(folded);
  }
  ASSEMBLY_RE[assembly].lastIndex = 0;
  return ASSEMBLY_RE[assembly].test(folded);
}

function hasConsumableSignal(folded: string): boolean {
  CONSUMABLE_RE.lastIndex = 0;
  CONSUMABLE_COMPOUND_RE.lastIndex = 0;
  return CONSUMABLE_RE.test(folded) || CONSUMABLE_COMPOUND_RE.test(folded);
}

function isOverhaul(folded: string): boolean {
  OVERHAUL_RE.lastIndex = 0;
  return OVERHAUL_RE.test(folded);
}

function hasUnitRepairVerb(folded: string): boolean {
  const withoutKits = folded.replace(REPAIR_KIT_RE, " ");
  UNIT_REPAIR_VERB_RE.lastIndex = 0;
  return UNIT_REPAIR_VERB_RE.test(withoutKits);
}

function isCampaignClause(folded: string): boolean {
  CAMPAIGN_CLAUSE_RE.lastIndex = 0;
  return CAMPAIGN_CLAUSE_RE.test(folded);
}

function isSoftwareClause(folded: string): boolean {
  SOFTWARE_RE.lastIndex = 0;
  return SOFTWARE_RE.test(folded);
}

function isCourtesyCarClause(folded: string): boolean {
  COURTESY_CAR_RE.lastIndex = 0;
  return COURTESY_CAR_RE.test(folded);
}

function isComfortInteriorClause(folded: string): boolean {
  COMFORT_INTERIOR_RE.lastIndex = 0;
  return COMFORT_INTERIOR_RE.test(folded);
}

function isMinorPartClause(folded: string): boolean {
  MINOR_PART_RE.lastIndex = 0;
  return MINOR_PART_RE.test(folded);
}

function isMajorPartListLine(folded: string, assembly: DealerMajorAssemblyId): boolean {
  if (!hasDealerPartNumber(folded)) return false;
  if (assembly === "turbo" && (isTurboOilProduct(folded) || isChargeAirMinor(folded))) return false;
  if (hasConsumableSignal(folded) && !isRemanOrExchange(folded)) return false;
  return mentionsAssembly(folded, assembly);
}

function isUnitReplacementSignal(folded: string, assembly: DealerMajorAssemblyId): boolean {
  if (isOverhaul(folded)) return true;
  if (isRemanOrExchange(folded)) return true;
  if (isMajorPartListLine(folded, assembly)) return true;
  return false;
}

function isEngineUnitReplacement(folded: string): boolean {
  if (isTurboOilProduct(folded) && !ENGINE_UNIT_REPLACE_RE.test(folded)) return false;
  ENGINE_UNIT_REPLACE_RE.lastIndex = 0;
  if (ENGINE_UNIT_REPLACE_RE.test(folded)) return true;
  if (!mentionsAssembly(folded, "engine")) return false;
  if (isRemanOrExchange(folded) || isMajorPartListLine(folded, "engine")) {
    ENGINE_NOT_THE_UNIT_RE.lastIndex = 0;
    return !ENGINE_NOT_THE_UNIT_RE.test(folded);
  }
  if (!isOverhaul(folded)) return false;
  ENGINE_NOT_THE_UNIT_RE.lastIndex = 0;
  return !ENGINE_NOT_THE_UNIT_RE.test(folded);
}

/**
 * Intervāla / ekspluatācijas materiālu apkope (ne agregāta maiņa).
 * Tukšs „Apkope” / „Service” bez eļļas, filtra vai šķidruma te NAV.
 */
export function isRoutineMaintenanceWork(works: string): boolean {
  const folded = foldDealerWorkText(works);
  if (!folded) return false;
  if (hasAnyMajorAssemblyRepair(works)) return false;
  return hasConsumableSignal(folded) || isEngineOilChangeWork(works);
}

export function isDealerSoftwareWork(works: string): boolean {
  return isSoftwareClause(foldDealerWorkText(works));
}

export function isCourtesyCarWork(works: string): boolean {
  return isCourtesyCarClause(foldDealerWorkText(works));
}

export function isCheckNoFaultWork(works: string): boolean {
  CHECK_NO_FAULT_RE.lastIndex = 0;
  return CHECK_NO_FAULT_RE.test(foldDealerWorkText(works));
}

export function hasNonCampaignRepairAction(works: string): boolean {
  const folded = foldDealerWorkText(works);
  const withoutCampaignJobs = folded.replace(
    /[^.?\n;]*\b(?:qb|acc(?:ording)?\.?\s*to:?\s*qb|nach\s+qb)[^.?\n;]*/gu,
    " ",
  );
  for (const clause of splitClauses(withoutCampaignJobs)) {
    if (isCampaignClause(clause) || isSoftwareClause(clause) || isCourtesyCarClause(clause)) continue;
    if (hasUnitRepairVerb(clause) || isOverhaul(clause) || isRemanOrExchange(clause)) return true;
    if (hasDealerPartNumber(clause) && hasAnyMajorAssemblyRepair(clause)) return true;
  }
  return false;
}

export function hasAnyMajorAssemblyRepair(works: string): boolean {
  return MAJOR_ASSEMBLY_SPECS.some((spec) => isMajorAssemblyRepairWork(works, spec.id));
}

function clauseIsUnitRepairOf(foldedClause: string, assembly: DealerMajorAssemblyId): boolean {
  if (isCampaignClause(foldedClause)) return false;
  if (isSoftwareClause(foldedClause)) return false;
  if (isCourtesyCarClause(foldedClause)) return false;
  if (isComfortInteriorClause(foldedClause)) return false;
  if (assembly === "turbo" && isChargeAirMinor(foldedClause)) return false;
  if (assembly === "engine") return isEngineUnitReplacement(foldedClause);
  if (isMinorPartClause(foldedClause) && !MINOR_SKIP_EXCEPT.has(assembly)) {
    if (!isRemanOrExchange(foldedClause) && !isMajorPartListLine(foldedClause, assembly)) {
      return false;
    }
  }
  if (!mentionsAssembly(foldedClause, assembly)) return false;
  if (isUnitReplacementSignal(foldedClause, assembly)) return true;
  if (!hasUnitRepairVerb(foldedClause)) return false;
  if (hasConsumableSignal(foldedClause)) return false;
  return true;
}

/** Vai teksts fiksē šī mezgla nomaiņu / kapitālo remontu, ne eļļas-filtra apkopi. */
export function isMajorAssemblyRepairWork(works: string, assembly: DealerMajorAssemblyId): boolean {
  const folded = foldDealerWorkText(works);
  if (!folded) return false;
  for (const clause of splitClauses(folded)) {
    if (clauseIsUnitRepairOf(clause, assembly)) return true;
  }
  return false;
}

export function dealerMajorAssembliesInWork(works: string): DealerMajorAssemblyId[] {
  return MAJOR_ASSEMBLY_SPECS.filter((spec) => isMajorAssemblyRepairWork(works, spec.id)).map(
    (spec) => spec.id,
  );
}

export function majorAssemblyLabel(id: DealerMajorAssemblyId): string {
  return MAJOR_ASSEMBLY_SPECS.find((s) => s.id === id)?.label ?? id;
}
