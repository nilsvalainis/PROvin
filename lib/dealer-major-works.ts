/**
 * OFICIĀLĀ DĪLERA DATI: „Lielie darbi” / lielie mezgli.
 *
 * Apkope pie mezgla (eļļa, filtrs, ATF, šķidrumi, sveces, pārbaude, skalošana)
 * NAV agregāta maiņa. Tikai reāla nomaiņa, kapitālais remonts vai agregāta remonts.
 * Avoti bieži EN/DE/RU/LV; izeja jebkurā atskaites valodā.
 */
import { foldOilWorkText } from "@/lib/oil-change-intervals";

export type DealerMajorAssemblyId =
  | "engine"
  | "timing_chain"
  | "gearbox"
  | "transfer_case"
  | "differential"
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
  { id: "gearbox", label: "Ātrumkārba" },
  { id: "transfer_case", label: "Sadales kārba" },
  { id: "differential", label: "Diferenciālis / reduktors" },
  { id: "dual_mass_flywheel", label: "Divmasu spararats" },
  { id: "turbo", label: "Turbokompresors" },
  { id: "body_glass", label: "Virsbūve / stikls" },
];

const ASSEMBLY_RE: Record<DealerMajorAssemblyId, RegExp> = {
  engine:
    /\bengine\b|\bdzinej|двигател|мотор(?:а|е|ом|у|ы)?|\bmotor(?:en)?\b|motorwechsel|motorersatz|motortausch|motorinstandsetz/u,
  timing_chain:
    /timing\s+chain|steuerkette|sadales\s+ked|kedes\s+(komplekt|spriegot|main)|distributieketting|kamkedja|цеп\p{L}*\s+(?:грм|газораспред)/u,
  gearbox:
    /atrumkar|parnesumkarb|\bkarbas?\b|gearbox|\btransmission\b|getriebe(?!ol)|versnellingsbak|vaxellad|коробк\p{L}*(?:\s+передач)?|акпп|мкпп|\bdsg\b|\bdct\b|\bcvt\b|tiptronic|doppelkupplung|divsajug|mechatron|gidroblok|гидроблок|valve\s+body|torque\s+converter|hidrotransform|гидротрансформатор|getriebewechsel|getriebeersatz|getriebetausch/u,
  transfer_case:
    /transfer(?:\s+case)?|verteilergetriebe|razdat|раздаточн|sadales\s+karb/u,
  differential:
    /differential|differenzial|diferencial|дифференциал|reduktor|редуктор|achsgetriebe(?!ol)|hinterachs(?!ol)|aizmugurej\p{L}*\s+tilt/u,
  dual_mass_flywheel:
    /divmasu|spararat|dual[\s-]?mass|flywheel|zweimassen|schwungrad|маховик|vliegwiel|svanghjul/u,
  turbo: /\bturbo(?:charger|lader)?\b|турбокомпрессор|turbokompresor/u,
  body_glass:
    /vejstikl|stikla\s+main|bamper|sparn|durvju|pankr|kraso|parkras|body\s+repair|windscreen|windshield|bumper|fender|lackier|karosser|scheibe|кузов|бампер|крыл|лобов\p{L}*\s+стекл/u,
};

/** Eļļa / filtrs / šķidrums / sveces / pārbaude / skalošana / papildināšana. */
const CONSUMABLE_RE =
  /(?:motor|engine|getriebe|transmission|gearbox|karbas?|atrumkarb|parnesum|transfer(?:\s+case)?|differential|achs|razdat|раздаточн|reduktor|редуктор)?(?:\s|-)?(?:oil|ol\b|ellas?|масло|масла|маслу)|oil(?:\s+and\s+filter)?(?:\s+(?:change|service|replacement|filter))?|\bfilter\b|filtr\p{L}*|olwechsel|oilwechsel|filterwechsel|atf\b|dexron|mercon|fluid|skidrum|жидкост|coolant|kuhlmittel|antifreeze|dzesesan|антифриз|охлажд|brake\s+fluid|bremsfluss|bremzu\s+skidrum|тормозн\p{L}*\s+жидкост|spark\s*plugs?|zundkerz|aizdedzes\s+svec|свеч|inspection|inspektion|apskate|осмотр|fahrzeugcheck|wartung|\bcheck\b|prufung|parbaud|проверк|top[- ]?up|nachfull|papildin|долив|flush|spulung|skalos|промыв|диагност|diagnos|lube(?:\s+service)?|long[\s-]?life|pollen|cabin\s+filter|luftfilter|innenraumfilter|microfilter|gaisa\s+filtr|degvielas\s+filtr|fuel\s+filter|salona\s+gaisa/u;

const CONSUMABLE_COMPOUND_RE =
  /getriebeol\p{L}*|motorol\p{L}*|achs(?:getriebe)?ol\p{L}*|haldexol\p{L}*|hinterachs\p{L}*\s+ol\p{L}*|ol[- ]und[- ]filter|масла?\s+и\s+фильтра?/u;

const OVERHAUL_RE =
  /overhaul|rebuild|rebuilt|instandgesetz|instandsetz|uberholt|generaluberhol|kapitalais\s+remont|капитальн\p{L}*\s+ремонт|переборк|recondition/u;

const UNIT_REPAIR_VERB_RE =
  /replac\p{L}*|exchang\p{L}*|swapp\p{L}*|getauscht|erneuert|ausgetauscht|austausch|nomain|wechsel|zamena|замена|\bchange\b|maina|ремонт|repair(?:ed|s)?|reparatur|repariert|erneuerung|tausch(?:en|te)?|ersetzt|vervangen|bytt/u;

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

function splitClauses(folded: string): string[] {
  return uniqueNonEmpty(folded.split(/[\n;/|]+|(?<=\w)[:.]\s+/));
}

function mentionsAssembly(folded: string, assembly: DealerMajorAssemblyId): boolean {
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
  UNIT_REPAIR_VERB_RE.lastIndex = 0;
  return UNIT_REPAIR_VERB_RE.test(folded);
}

/**
 * Intervāla / ekspluatācijas materiālu apkope (ne agregāta maiņa).
 * Tukšs „Apkope” / „Service” bez eļļas, filtra vai šķidruma te NAV.
 */
export function isRoutineMaintenanceWork(works: string): boolean {
  const folded = foldOilWorkText(works);
  if (!folded) return false;
  if (hasAnyMajorAssemblyRepair(works)) return false;
  return hasConsumableSignal(folded);
}

export function hasAnyMajorAssemblyRepair(works: string): boolean {
  return MAJOR_ASSEMBLY_SPECS.some((spec) => isMajorAssemblyRepairWork(works, spec.id));
}

function clauseIsUnitRepairOf(foldedClause: string, assembly: DealerMajorAssemblyId): boolean {
  if (!mentionsAssembly(foldedClause, assembly)) return false;
  if (isOverhaul(foldedClause)) return true;
  if (!hasUnitRepairVerb(foldedClause)) return false;
  if (hasConsumableSignal(foldedClause)) return false;
  return true;
}

/** Vai teksts fiksē šī mezgla nomaiņu / kapitālo remontu, ne eļļas-filtra apkopi. */
export function isMajorAssemblyRepairWork(works: string, assembly: DealerMajorAssemblyId): boolean {
  const folded = foldOilWorkText(works);
  if (!folded) return false;
  for (const clause of [folded, ...splitClauses(folded)]) {
    if (clauseIsUnitRepairOf(clause, assembly)) return true;
  }
  return false;
}

export function dealerMajorAssembliesInWork(works: string): DealerMajorAssemblyId[] {
  return MAJOR_ASSEMBLY_SPECS.filter((spec) => isMajorAssemblyRepairWork(works, spec.id)).map(
    (spec) => spec.id,
  );
}
