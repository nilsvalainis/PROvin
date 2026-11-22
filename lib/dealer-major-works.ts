/**
 * OFICIĀLĀ DĪLERA DATI: „Lielie darbi” / lielie mezgli.
 *
 * Apkope pie mezgla (eļļa, filtrs, ATF, šķidrumi, sveces, pārbaude, skalošana)
 * NAV agregāta maiņa. Tikai reāla nomaiņa, kapitālais remonts, REMAN/Austausch
 * vai lielā mezgla rinda detaļu sarakstā (CAPS + part number).
 * Izņēmums sarakstā (ne vizītes veidā): ātrumkārbas / sadales kārbas / diferenciāļa eļļas
 * maiņa ir atsevišķs „Lielie darbi” punkts (Nila lēmums 22.11.2026).
 * Vējstikla / loga stikla nomaiņa paliek Lielie darbi; mazgājamais, apdare,
 * čipa pārbaude/remonts un slotiņas neskaitās.
 * Avoti bieži EN/DE/RU/LV, ar saplēstiem umlautiem un TJ/Symptom/Diagnose/Aktion
 * veidni (Volvo RAW). Izeja jebkurā atskaites valodā.
 */
import { foldOilWorkText, isEngineOilChangeWork } from "@/lib/oil-change-intervals";

export type DealerMajorAssemblyId =
  | "accident_repair"
  | "engine"
  | "timing_chain"
  | "timing_belt"
  | "crankshaft_seal"
  | "gearbox"
  | "gearbox_oil"
  | "clutch"
  | "transfer_case"
  | "transfer_case_oil"
  | "differential"
  | "differential_oil"
  | "propshaft"
  | "dual_mass_flywheel"
  | "turbo"
  | "egr"
  | "dpf"
  | "adblue"
  | "water_pump"
  | "air_suspension"
  | "ac_compressor"
  | "body_glass";

/**
 * Mezgla eļļas maiņa (Nila lēmums 22.11.2026): rāda „Lielie darbi” sarakstā kā citus mezglus
 * (pēdējā reize + skaits), bet tā joprojām ir APKOPE - vizītes veids, rutīnas apkope un
 * dzinēja eļļas intervāli nemainās (`hasAnyMajorAssemblyRepair` šos neskaita).
 */
type DealerMajorServiceId = "gearbox_oil" | "transfer_case_oil" | "differential_oil";
const DEALER_MAJOR_SERVICE_IDS: ReadonlySet<string> = new Set<DealerMajorServiceId>([
  "gearbox_oil",
  "transfer_case_oil",
  "differential_oil",
]);
export function isDealerMajorServiceId(id: string): id is DealerMajorServiceId {
  return DEALER_MAJOR_SERVICE_IDS.has(id);
}
type AssemblyPatternId = Exclude<DealerMajorAssemblyId, DealerMajorServiceId>;

export type DealerMajorWorkCategory = "mechanical" | "accident";

export type DealerMajorAssemblySpec = {
  id: DealerMajorAssemblyId;
  label: string;
};

export type DealerMajorWorkHit = {
  id: string;
  label: string;
  factId: string;
  date: string;
  km: string;
  /** Cik reižu mezgls fiksēts dīlera datos (tikai, ja vairāk par vienu); datums / km ir pēdējā reize. */
  count?: number;
  /** Agrāko reižu D-ID (operatora labojumu savietojamībai). */
  earlierFactIds?: string[];
};

/** Kārtība PDF kopsavilkumā. Etiķetes ir LV atslēgas `client-report-i18n`. */
export const MAJOR_ASSEMBLY_SPECS: readonly DealerMajorAssemblySpec[] = [
  { id: "accident_repair", label: "Negadījuma / virsbūves remonts" },
  { id: "engine", label: "Dzinējs" },
  { id: "timing_chain", label: "Sadales ķēde" },
  { id: "timing_belt", label: "Zobsiksna" },
  { id: "crankshaft_seal", label: "Kloķvārpstas blīvslēgs" },
  { id: "gearbox", label: "Ātrumkārba" },
  { id: "gearbox_oil", label: "Ātrumkārbas eļļas maiņa" },
  { id: "clutch", label: "Sajūgs" },
  { id: "transfer_case", label: "Sadales kārba" },
  { id: "transfer_case_oil", label: "Sadales kārbas eļļas maiņa" },
  { id: "differential", label: "Diferenciālis / reduktors" },
  { id: "differential_oil", label: "Diferenciāļa eļļas maiņa" },
  { id: "propshaft", label: "Kardāns" },
  { id: "dual_mass_flywheel", label: "Divmasu spararats" },
  { id: "turbo", label: "Turbokompresors" },
  { id: "egr", label: "EGR dzesētājs / vārsts" },
  { id: "dpf", label: "Kvēpu filtrs (DPF)" },
  { id: "adblue", label: "AdBlue / SCR sistēma" },
  { id: "water_pump", label: "Ūdens sūknis" },
  { id: "air_suspension", label: "Piekares pneimobalons" },
  { id: "ac_compressor", label: "Kondicioniera kompresors" },
  { id: "body_glass", label: "Virsbūve / stikls" },
];

/**
 * Negadījums / apdrošināšanas gadījums: pats vārds nozīmē bojājuma novēršanu.
 * Folded NFKD (bez diakritikas, mazie burti, ß -> ss).
 */
const ACCIDENT_EVENT_RE =
  /unfall\p{L}*|accident\p{L}*|collision\p{L}*|\bcrash\p{L}*|kollision\p{L}*|(?:pec|после)\s+(?:avarij|авари)\p{L}*|avarij\p{L}*\s+(?:remont|bojajum|sek|gadijum)|negadijum\p{L}*|sadursm\p{L}*|дтп|авари(?:я|и|ю|ей)(?!\p{L})|столкновен\p{L}*|versicherungs(?:schaden|fall|reparatur)|haftpflichtschaden|kaskoschaden|insurance\s+(?:repair|claim|job|damage|case)|apdrosinasan\p{L}*\s+(?:remont|gadijum|atlidzib|lieta)|страхов\p{L}*\s+(?:случа|ремонт)|havarie|schadensfall/u;

/** Drošības sistēmas / sensori / vadības bloki ar „collision/Unfall/Karosserie” vārdu - nav bojājums. */
const ACCIDENT_SYSTEM_NOT_DAMAGE_RE =
  /(?:collision|crash|unfall|accident|kollision)\p{L}*[\s-]*(?:warn|avoid|mitigat|sensor|detect|alert|assist|preven|data|meld|schutz|camera|radar|kalibr|calibr)|pre[\s-]?(?:collision|crash)|notbrems|notruf|e[\s-]?call|karosser\p{L}*[\s-]*(?:steuer|elektr|modul|computer|control)|body\s+(?:control|module|computer|electronic)|bcm\b/u;

/** Virsbūves remonts / krāsošana pēc bojājuma (bez negadījuma vārda). */
const BODY_DAMAGE_REPAIR_RE =
  /karosser\p{L}*|carrosserie\p{L}*|body\s*(?:shop|work|repair)|bodywork|panel\s+beat\p{L}*|virsbuv\p{L}*\s+remont|remont\p{L}*\s+virsbuv|kuzov\p{L}*\s+remont|remont\p{L}*\s+kuzov|кузовн\p{L}*\s+ремонт|ремонт\p{L}*\s+кузов|кузовн\p{L}*\s+работ|(?:paint|respray)\p{L}*.{0,40}(?:after|due\s+to|following)\s+(?:damage|impact)|damage\s+repair|repair\s+of\s+(?:the\s+)?damage|(?:par)?kraso\p{L}*.{0,40}pec\s+bojajum|bojajum\p{L}*\s+(?:novers|remont)|lackschaden|lackierung\s+nach\s+schaden|schadensbehebung|schaden\s+(?:behoben|instandgesetzt|repariert)|покраск\p{L}*.{0,40}после\s+(?:повреждени|удар)|устранени\p{L}*\s+повреждени/u;

/** „Bez negadījumiem” / „unfallfrei” - nav remonts. */
const ACCIDENT_NEGATION_RE =
  /unfallfrei|kein\p{L}*\s+unfall|ohne\s+unfall|accident[\s-]?free|no\s+(?:accident|collision|damage)|not\s+involved\s+in|bez\s+(?:avarij|negadijum|bojajum)|nav\s+(?:bijis\s+)?(?:avarij|negadijum)|без\s+(?:дтп|авари|повреждени)|не\s+(?:было|участвовал)/u;

/** Tikai pārbaude / nolasījums (piem. BMW „Accident check”). */
const BODY_CHECK_RE =
  /\bcheck\p{L}*|prufung|gepruft|kontrolle|durchsicht|inspection|inspektion|parbaud\p{L}*|проверк\p{L}*|осмотр|diagnos\p{L}*|диагност\p{L}*|vermessung|gutachten|appraisal|estimate|kostenvoranschlag|tames\p{L}*|смет/u;

/** Mazgāšana / pulēšana / rūsas garantijas pārbaude - nav bojājuma remonts. */
const BODY_ROUTINE_RE =
  /garantie\p{L}*|warranty|garantij\p{L}*|wasch\p{L}*|wash\p{L}*|mazgas\p{L}*|мойк\p{L}*|polier\p{L}*|polish\p{L}*|pulej\p{L}*|aufbereit\p{L}*|detailing|valet|konservier\p{L}*|hohlraum|rust|rost\p{L}*|corros\p{L}*|korozij\p{L}*|коррози\p{L}*/u;

const BODY_REPAIR_ACTION_RE =
  /instandsetz\p{L}*|instandgesetz\p{L}*|reparatur|repar\p{L}*|repair\p{L}*|lackier\p{L}*|lackiert|kraso\p{L}*|parkras\p{L}*|krasoj\p{L}*|покраск\p{L}*|ремонт\p{L}*|remont\p{L}*|respray|paint\p{L}*|richt\p{L}*|ausbeul\p{L}*|beseitig\p{L}*|behob\p{L}*|novers\p{L}*|устранени\p{L}*/u;

const ASSEMBLY_RE: Record<AssemblyPatternId, RegExp> = {
  accident_repair: ACCIDENT_EVENT_RE,
  engine:
    /\bengine\b|\bdzinej|двигател|motorwechsel|motorersatz|motortausch|\bmoteur\b|\bmotore\b|\bmotor\b/u,
  timing_chain:
    /timing\s+chain|steuerkette|sadales\s+ked|kedes\s+(komplekt|spriegot|main)|distributieketting|kamkedja|kamk(?:ae|æ)de|tandk(?:ae|æ)de|chaine\s+de\s+distribution|catena\s+di\s+distribuzione|cadena\s+de\s+distribucion|цеп\p{L}*\s+(?:грм|газораспред)/u,
  timing_belt:
    /zobsiksn|sadales\s+siksn|timing\s+belt|zahnriemen|distributieriem|kamrem|tandrem|courroie\s+de\s+distribution|cinghia\s+di\s+distribuzione|correa\s+de\s+distribucion|ремень\s+грм/u,
  crankshaft_seal:
    /kurbelwell(?:en)?(?:simmerring|dicht)|crankshaft\s+seal|klokvarpstas\s+bliv|сальник\s+колен|joint\s+(?:spi|de\s+)?vilebrequin|paraolio\s+albero/u,
  gearbox:
    /atrumkar|parnesumkarb|transmisi|\bkarbas?\b|gearbox|\btransmission\b|getriebe(?!ol)|versnellingsbak|vaxellad|boite(?:\s+de)?\s+vitesses|\bcambio\b|caja(?:\s+de)?\s+cambios|коробк\p{L}*(?:\s+передач)?|акпп|мкпп|\bdsg\b|\bdct\b|\bcvt\b|tiptronic|doppelkupplung|divsajug|mechatron|gidroblok|гидроблок|valve\s+body|torque\s+converter|hidrotransform|гидротрансформатор|getriebewechsel|getriebeersatz|getriebetausch/u,
  clutch: /\bclutch(?:\s+kit)?\b|\bsajug|kupplungssatz|\bkupplung\b|\bkobling\b|\bkoppeling\b/u,
  transfer_case:
    /transfer(?:\s+case|\s+box)?|verteilergetriebe|razdat|раздаточн|sadales\s+karb|boite\s+de\s+transfert|caja\s+de\s+transferencia|tussenbak|fordelningslad/u,
  // Tilta vārds vien („Hinterachsbuchse”, „aizmugurējā tilta bukse”) NAV diferenciālis.
  differential:
    /differential|differenzial|diferencial|дифференциал|achsgetriebe(?!ol)|differentiel|differenziale|differentieel/u,
  propshaft:
    /kardan|prop[\s-]?shaft|kardanwelle|\bcardan\b|gelenkwelle|transmisij\p{L}*\s+uz\s+(?:aizmugurej|prieksej)\p{L}*\s+asi/u,
  dual_mass_flywheel:
    /divmasu|spararat|dual[\s-]?mass|twin\s+mass|flywheel|zweimassen|schwungrad|маховик|vliegwiel|svanghjul|svinghjul|volant\s+bimasse|volano\s+bimassa/u,
  turbo: /\bturbo(?:charger|lader|compresseur)?\b|турбокомпрессор|turbokompresor/u,
  egr: /\begr\b|\begr[-\s]?(?:ventil|klep|kuhler|koeler|koler)|\bagr\b|\bagr[-\s]?(?:ventil|kuhler|modul|rohr)|abgasruckfuhr\p{L}*|abgaskuhler|exhaust[-\s]?gas\s+recirc\p{L}*|exhaust[-\s]?gas\s+(?:radiator|cooler)|\bexhaust\s+cooler\b|izpludes\s+gazu\s+(?:recirk\p{L}*|dzesetaj\p{L}*)|uitlaatgasrecirculatie|udstodnings?gas\s*recirk\p{L}*/u,
  dpf: /\bdpf\b|\bfap\b|(?:russ)?partikelfilter|russfilter|particulate\s+filter|diesel\s+particulate|sodreju\s+filtr\p{L}*|kvepu\s+filtr\p{L}*|(?:cieto\s+)?dalinu\s+filtr\p{L}*|roetfilter|partikkelfilter/u,
  adblue:
    /nox[-\s]?(?:sensor|sonde|devej\p{L}*)|(?:adblue|ad\s*blue|\bscr\b|harnstoff\p{L}*|\burea\b|reduktionsmittel\p{L}*)/u,
  water_pump:
    /wasserpumpe|kuhlmittelpumpe|water\s*pump|coolant\s+pump|udens\s*sukn\p{L}*|dzesesanas\s+(?:skidruma\s+)?sukn\p{L}*|waterpomp|koelvloeistofpomp|vandpumpe|k(?:o|ø)lev(?:ae|æ)skepumpe|vattenpump/u,
  air_suspension:
    /pneumatic\s+spring|air\s+spring|air\s+suspension\s+(?:strut|spring|bellows?|bag)|luftfeder\p{L}*|luftbalg|luchtveer|luchtbalg|luftfjed\p{L}*|luftb(?:ae|æ|a)lg|pneimobalon\p{L}*|pneimatisk\p{L}*\s+(?:atsper\p{L}*|balon\p{L}*|amortizator\p{L}*|spilven\p{L}*)|gaisa\s+(?:balon|spilven)\p{L}*/u,
  ac_compressor:
    /klima\p{L}*kompressor|kompressor\s+klima\p{L}*|klimaverdichter|kaltemittelverdichter|\bac[-\s]?compressor|air[-\s]?con(?:ditioning|ditioner)?\s+compressor|refrigera\p{L}*\s+compressor|kondicionier\p{L}*\s+kompresor\p{L}*|kompresor\p{L}*\s+kondicionier\p{L}*|aircocompressor|airco[-\s]compressor|aircondition\p{L}*[-\s]?kompressor|\bac[-\s]?kompressor/u,
  body_glass:
    /vejstikl|stikla\s+main|loga\s+stikl|bamper|sparn|durvju|kraso|parkras|body\s+repair|windscreen|windshield|window\s+glass|side\s+window|door\s+(?:window|glass)|bumper|fender|lackier|karosser|(?:windschutz|seiten|heck|front)?scheibe(?!n(?:klar|wasch|wisch))|pare[- ]brise|parabrezza|parabrisas|кузов|бампер|крыл|(?:лобов|боков)\p{L}*\s+стекл|\bhood\b|\bbonnet\b|motorhaube|\bkapote\b|(?:dzineja|motora)\s+parsegs|\bcapot(?:\s+moteur)?\b|\bcofano\b|капот|engine\s+hood/u,
};

/** Ātrumkārbas eļļa (ATF, Getriebeöl, DSG/S tronic/ZF). Diferenciāļa / sadales kārbas eļļu pirms tam izņem. */
const GEARBOX_OIL_RE =
  /getriebeol\p{L}*|\batf\b|(?:automati\p{L}*\s+)?(?:getriebe|karbas?|atrumkarb\p{L}*|parnesumkarb\p{L}*|transmisij\p{L}*|transmission|gearbox|versnellingsbak|gearkasse|коробк\p{L}*(?:\s+передач)?|акпп|\bdsg|\bdct|\bcvt|s[\s-]?tronic)\p{L}*[\s:.-]*(?:\p{L}+\s+){0,2}(?:ol\b|oil|ell\p{L}*|olie|olja|масл\p{L}*|fluid|skidrum\p{L}*)|(?:ol|oil|ell\p{L}*|olie|масл\p{L}*)[\s-]*(?:wechsel|change|main\p{L}*|замена)\s+(?:\p{L}+\s+){0,2}(?:getriebe|transmission|gearbox|karb\p{L}*|atrumkarb\p{L}*|коробк\p{L}*)/u;

const OIL_WORD = String.raw`(?:ol\p{L}*|oil|ell\p{L}*|olie|olja|масл\p{L}*|fluid|skidrum\p{L}*)`;

/** Diferenciāļa / tilta reduktora eļļa (Achsgetriebeöl, Hinterachsöl, rear axle oil, diferenciāļa eļļa). */
const DIFF_OIL_RE = new RegExp(
  String.raw`(?<!\p{L})(?:hypoid\p{L}*|hipoid\p{L}*|(?:hinter|vorder)?achs(?:getriebe)?|hinterachs\p{L}*|vorderachs\p{L}*|differential\p{L}*|differenzial\p{L}*|diferencia\p{L}*|diferenci\p{L}*|дифференциал\p{L}*|(?:rear|front)\s+axle|axle|(?:aizmugurej|prieksej)\p{L}*\s+tilt\p{L}*|tilt\p{L}*\s+reduktor\p{L}*|reduktor\p{L}*|редуктор\p{L}*|мост\p{L}*)[\s:.-]*(?:\p{L}+\s+){0,2}${OIL_WORD}` +
    String.raw`|(?<!\p{L})(?:ol|oil|ell\p{L}*|масл\p{L}*)[\s-]*(?:wechsel|change|main\p{L}*|замена)?\s+(?:\p{L}+\s+){0,2}(?:differential|differenzial|diferenci|дифференциал|редуктор|reduktor|(?:hinter|vorder)?achsgetriebe|hinterachs|rear\s+axle)\p{L}*`,
  "u",
);

/** Sadales kārbas eļļa (Verteilergetriebeöl, transfer case oil, раздаточная коробка). */
const TRANSFER_OIL_RE = new RegExp(
  String.raw`(?<!\p{L})(?:verteilergetriebe|transfer(?:\s+case|\s+box)?|razdat\p{L}*|раздаточн\p{L}*(?:\s+коробк\p{L}*)?|sadales\s+karb\p{L}*|tussenbak|fordelningslad\p{L}*)[\s:.-]*(?:\p{L}+\s+){0,2}${OIL_WORD}` +
    String.raw`|(?<!\p{L})(?:ol|oil|ell\p{L}*|масл\p{L}*)[\s-]*(?:wechsel|change|main\p{L}*|замена)?\s+(?:\p{L}+\s+){0,2}(?:verteilergetriebe|transfer\s+(?:case|box)|раздаточн|sadales\s+karb)\p{L}*`,
  "u",
);

const AXLE_DIFF_CONTEXT_RE =
  /diferencial|differenzial|differential|aizmugurej\p{L}*\s+(?:tilt|ass)|prieksej\p{L}*\s+(?:tilt|ass)|\btilt[au]?\b|achsgetriebe|hinterachs/u;

const REDUKTORS_RE = /reduktor|редуктор/u;

const ADBLUE_RE = /adblue|ad\s*blue|\bscr\b/u;

const DUAL_CLUTCH_RE = /dual[\s-]+clutch|doppelkupplung|divsajug/u;

const PROPSHAFT_NOT_GEARBOX_RE =
  /transmisij\p{L}*\s+uz\s+(?:aizmugurej|prieksej)\p{L}*\s+asi|kardan|prop[\s-]?shaft|kardanwelle|gelenkwelle/u;

const SHAFT_SEAL_RE = /dicht|seal|simmerring|sealing\s+ring/u;

const INTERIOR_TRIM_RE =
  /door\s+trim|trim\s+panel|interior\s+trim|durvju\s+apdar|apdares\s+panel|sitzkissen|upholstery|roktur\p{L}*|\bhandle\b|turgriff\p{L}*|innengriff\p{L}*|turoffner\p{L}*/u;

const WASHER_FLUID_RE =
  /scheibenklar|scheibenwasch|washer\s+fluid|windscreen\s+washer|windshield\s+washer|stiklu\s+mazg/u;

/** Akmens skaida / čipa pārbaude vai remonts nav stikla nomaiņa. */
const GLASS_CHIP_CHECK_RE =
  /steinschlag|stone\s+chip|chip\s+(?:repair|check|inspect)|glass\s+chip|stikla\s+(?:skabarg|skaid)|akmens\s+triecien|скол/u;

const WIPER_NOT_GLASS_RE =
  /scheibenwisch|wiper\s+blade|windscreen\s+wiper|windshield\s+wiper|logu\s+tiritaj|unterlegscheibe/u;

const GLASS_UNIT_REPLACE_RE =
  /(?:windscreen|windshield|vejstikl|windschutzscheibe|seitenscheibe|heckscheibe|frontscheibe|window\s+glass|side\s+window|door\s+(?:window|glass)|loga\s+stikl|(?:лобов|боков)\p{L}*\s+стекл|stikla)\p{L}*.{0,24}(?:replac|erneuer|ersetzt|getauscht|nomain|maina|wechsel|remplac|sostituit|sustitu|reemplaz|замена)|(?:replac|erneuer|замена|nomain|remplac|sostituit|sustitu|reemplaz)\p{L}*.{0,24}(?:windscreen|windshield|vejstikl|windschutzscheibe|seitenscheibe|window\s+glass|side\s+window|loga\s+stikl|стекл)/u;

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
  /replac\p{L}*|\brep\.|exchang\p{L}*|swapp\p{L}*|getauscht|erneuert|ausgetauscht|austausch|ersetzen|nomain|wechsel|zamena|замена|заменен\p{L}*|\bchange\b|maina|\bremont|ремонт|repaired|reparatur|repariert|erneuerung|tausch(?:en|te)?|ersetzt|vervangen|bytt|udskift\p{L}*|parkras|lackier|remplac\p{L}*|sostituit\p{L}*|sostituz\p{L}*|reemplaz\p{L}*|sustitu\p{L}*|cambiato/u;

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
  /motorleistung|motorol|olleckage|\bmotoren\b|schlauch|hose|dicht|seal|simmerring|kurbelwell|crankshaft|zahnriemen|timing\s+belt|cooling|kuhlsystem|ladeluft|charge\s+air|fuel\s+line|connector|sun\s*roof|dachkaset|schiebedach|upholstery|sitz|software|upgrade|downloading|ersatzwagen|courtesy|\bhood\b|\bbonnet\b|motorhaube|\bkapote\b|(?:dzineja|motora)\s+parsegs|engine\s+mounts?|motorlager|motortrager|(?:dzineja|motora)\s+spilven|valve\s+cover|ventildeckel|engine\s+cover/u;

/** Kapote / dzinēja pārsegs / Motorhaube - virsbūves panelis, ne dzinēja agregāts. Folded NFKD. */
const HOOD_PANEL_RE =
  /\bhood\b|\bbonnet\b|motorhaube|\bkapote\b|(?:dzineja|motora)\s+parsegs|\bcapot(?:\s+moteur)?\b|\bcofano\b|капот|engine\s+hood/u;

const HOOD_GAS_SPRING_RE =
  /gas\s+(?:pressure\s+)?springs?|gazes\s+atsper|gasfeder|motorhauben[- ]?gas/u;

const ENGINE_MOUNT_RE =
  /engine\s+mounts?|motorlager|motortrager|motoraufhang|engine\s+support|(?:dzineja|motora)\s+spilven|engine\s+bracket|подушк\p{L}*.{0,16}двигател|двигател\p{L}*.{0,16}подушк/u;

const ENGINE_COVER_NOT_UNIT_RE =
  /valve\s+cover|ventildeckel|varstu\s+parsegs|engine\s+cover|motorabdeckung|dekorativ\p{L}*\s+parsegs/u;

const ENGINE_UNIT_REPLACE_RE =
  /(?:\bengine\b|dzinej\p{L}*|двигател\p{L}*|\bmoteur\b|\bmotore\b|\bmotor\b)(?:\s+and\s+turbo(?:charger|lader)?|\s+und\s+turbolader)?\s+(?:replac|erneuer|getauscht|ersetzt|nomain|maina|wechsel|remplac|sostituit|sustitu|reemplaz)|(?:replac\p{L}*|erneuer\p{L}*|замена|nomain|remplac\p{L}*|sostituit\p{L}*|sustitu\p{L}*|reemplaz\p{L}*)\s+(?:the\s+|du\s+|de\s+(?:l[ae]\s+)?|del\s+|della\s+|el\s+)?(?:engine|dzinej|двигател|moteur|motore|\bmotor\b)|motorwechsel|motorersatz|motortausch|(?:^|[^\p{L}])motor\s+(?:erneuert|getauscht|ersetzt|ausgewechselt)|замена\s+двигател|капитальн\p{L}*\s+ремонт\s+двигател/u;

const CHECK_NO_FAULT_RE = /ohne\s+befund|no\s+fault|bez\s+defekta|nav\s+konstatet/u;

/** Sajūga cilindrs / pedālis / šķidrums nav sajūga (komplekta) maiņa. */
const CLUTCH_ANCILLARY_RE =
  /geberzylinder|nehmerzylinder|kupplungs(?:geber|nehmer|pedal|schalter|leitung|flussigkeit)|clutch\s+(?:master\s+|slave\s+)?cylinder|clutch\s+(?:fluid|pedal|switch|line|hose)|sajuga\s+(?:galven\p{L}*\s+|darba\s+)?cilindr\p{L}*|sajuga\s+(?:pedal\p{L}*|skidrum\p{L}*|sledz\p{L}*|devej\p{L}*|trose\p{L}*)/u;

/** Krāsošanas / gruntēšanas pozīcijas: virsbūves darbs arī bez darbības vārda (grunts pildviela, gruntēts panelis). */
const PAINT_WORK_RE =
  /lackier\p{L}*|lackiert|grundier\p{L}*|\bprimer\b|\bprimed\b|\bprimend\b|\bpaint(?:ed|ing|work)?\b|\brespray\p{L}*|grunt(?:s|ets|eta|eti|esan\p{L}*|et)\b|grunts[-\s]?pildviel\p{L}*|krasosan\p{L}*|parkraso\p{L}*|kraso(?:ts|ta|ti|t)\b|spuitwerk|gespoten|lakering|lakeret/u;

/** Krāsas kopšana, aizsardzība, korekcijas zīmulis, krāsas kods - nav krāsošana. */
const PAINT_NOT_WORK_RE =
  /lackpflege|lackschutz|lackversiegel\p{L}*|lackstift|paint\s+(?:protection|sealant|care|inspection|check|code|stick|pen)|touch[-\s]?up|krasas\s+(?:kod\p{L}*|biezum\p{L}*|aizsardzib\p{L}*|zimul\p{L}*)|paintwork\s+(?:check|inspection)/u;

/** AdBlue / SCR sistēmas detaļa (šķidruma uzpilde vien nav remonts). */
const ADBLUE_COMPONENT_RE =
  /tank|behalter|tvertn\p{L}*|pumpe?\b|pump\b|sukn\p{L}*|modul\p{L}*|dosier\p{L}*|dosing|doser|metering|injector|injektor|einspritz\p{L}*|sprausl\p{L}*|iesmidzin\p{L}*|sensor\p{L}*|sonde|devej\p{L}*|leitung|\bline\b|heater|heiz\p{L}*|sildit\p{L}*|katalysator|catalyst|catalytic|katalizator\p{L}*|steuergerat|control\s+unit|vadibas\s+blok\p{L}*|system\p{L}*|sistem\p{L}*/u;

const ADBLUE_REFILL_RE = /nachfull\p{L}*|auffull\p{L}*|befull\p{L}*|top[-\s]?up|refill\p{L}*|uzpild\p{L}*|papildin\p{L}*|bijvullen|p(?:a|å)fyld\p{L}*/u;

/** Kondicioniera kompresora šļūtene / siksna / sajūgs / smērviela nav kompresora maiņa. */
const AC_COMPRESSOR_ANCILLARY_RE =
  /schlauch|\bhose\b|leitung|\bline\b|riemen|\bbelt\b|siksn\p{L}*|caurul\p{L}*|slauten\p{L}*|magnetkupplung|\bclutch\b|lubricant|smerviel\p{L}*|kompressorol|compressor\s+oil/u;

const DPF_CLEAN_RE = /reinig\p{L}*|gereinigt|clean\p{L}*|tiris\p{L}*|iztir\p{L}*|skalos\p{L}*/u;

/** Kārbas eļļas līmeņa pārbaude / noplūde nav maiņa. */
const GEARBOX_OIL_NOT_CHANGE_RE =
  /nachfull\p{L}*|nachgefullt|verlust\p{L}*|diagnos\p{L}*|top[-\s]?up|papildin\p{L}*|долив\p{L}*|olstand|\bstand\b|\blevel\b|limen\p{L}*|pruf\p{L}*|\bcheck\p{L}*|parbaud\p{L}*|leck\p{L}*|\bleak\p{L}*|undicht\p{L}*|noplud\p{L}*|suc\p{L}*|kuhler|cooler|dzesetaj\p{L}*|wanne|\bpan\b|vacel\p{L}*|leitung|\bline\b|schlauch|\bhose\b|dicht\p{L}*|\bseal\p{L}*|bliv\p{L}*/u;

const MINOR_SKIP_EXCEPT: ReadonlySet<DealerMajorAssemblyId> = new Set([
  "timing_chain",
  "timing_belt",
  "crankshaft_seal",
  "egr",
  "dpf",
  "adblue",
  "water_pump",
  "air_suspension",
  "ac_compressor",
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

function isWiperNotGlass(folded: string): boolean {
  WIPER_NOT_GLASS_RE.lastIndex = 0;
  return WIPER_NOT_GLASS_RE.test(folded);
}

/** Čipa/skaidas pārbaude vai remonts, ja nav pašas stikla vienības nomaiņas. */
function isGlassChipCheckNotReplacement(folded: string): boolean {
  GLASS_CHIP_CHECK_RE.lastIndex = 0;
  if (!GLASS_CHIP_CHECK_RE.test(folded)) return false;
  GLASS_UNIT_REPLACE_RE.lastIndex = 0;
  return !GLASS_UNIT_REPLACE_RE.test(folded);
}

function isChargeAirMinor(folded: string): boolean {
  CHARGE_AIR_MINOR_RE.lastIndex = 0;
  return CHARGE_AIR_MINOR_RE.test(folded);
}

function isHoodPanelWork(folded: string): boolean {
  HOOD_PANEL_RE.lastIndex = 0;
  return HOOD_PANEL_RE.test(folded);
}

function isHoodGasSpringWork(folded: string): boolean {
  if (!isHoodPanelWork(folded)) return false;
  HOOD_GAS_SPRING_RE.lastIndex = 0;
  return HOOD_GAS_SPRING_RE.test(folded);
}

/** Eļļa, spilveni, kapote, vārstu pārsegs - nav dzinēja / bloka nomaiņa. */
function isEngineAncillaryNotUnit(folded: string): boolean {
  ENGINE_MOUNT_RE.lastIndex = 0;
  if (ENGINE_MOUNT_RE.test(folded)) return true;
  ENGINE_COVER_NOT_UNIT_RE.lastIndex = 0;
  if (ENGINE_COVER_NOT_UNIT_RE.test(folded)) return true;
  return isHoodPanelWork(folded);
}

/**
 * Negadījuma / virsbūves bojājuma remonts vienā klauzulā.
 * Garantijas atsaukumi, pārbaudes, mazgāšana un „bez negadījumiem” neskaitās.
 */
function isAccidentRepairClause(folded: string): boolean {
  if (isCampaignClause(folded) || isSoftwareClause(folded) || isCourtesyCarClause(folded)) return false;
  ACCIDENT_NEGATION_RE.lastIndex = 0;
  if (ACCIDENT_NEGATION_RE.test(folded)) return false;
  ACCIDENT_SYSTEM_NOT_DAMAGE_RE.lastIndex = 0;
  if (ACCIDENT_SYSTEM_NOT_DAMAGE_RE.test(folded)) return false;
  ACCIDENT_EVENT_RE.lastIndex = 0;
  const event = ACCIDENT_EVENT_RE.test(folded);
  BODY_DAMAGE_REPAIR_RE.lastIndex = 0;
  const bodyRepair = BODY_DAMAGE_REPAIR_RE.test(folded);
  if (!event && !bodyRepair) return false;
  BODY_REPAIR_ACTION_RE.lastIndex = 0;
  const hasAction = BODY_REPAIR_ACTION_RE.test(folded) || hasUnitRepairVerb(folded);
  BODY_CHECK_RE.lastIndex = 0;
  if (BODY_CHECK_RE.test(folded) && !hasAction) return false;
  if (!event) {
    BODY_ROUTINE_RE.lastIndex = 0;
    if (BODY_ROUTINE_RE.test(folded)) return false;
  }
  return true;
}

export function isAccidentRepairWork(works: string): boolean {
  const folded = foldDealerWorkText(works);
  if (!folded) return false;
  return splitClauses(folded).some(isAccidentRepairClause);
}

export function dealerMajorWorkCategory(id: string): DealerMajorWorkCategory {
  return id === "accident_repair" ? "accident" : "mechanical";
}

function mentionsAssembly(folded: string, assembly: DealerMajorAssemblyId): boolean {
  if (isDealerMajorServiceId(assembly)) return false;
  if (assembly === "accident_repair") return isAccidentRepairClause(folded);
  if (assembly === "turbo" && isTurboOilProduct(folded)) return false;
  if (assembly === "body_glass" && isAccidentRepairClause(folded)) {
    // Negadījuma remonts ir sava kategorija; Virsbūve / stikls paliek tikai stikla vienības nomaiņai.
    GLASS_UNIT_REPLACE_RE.lastIndex = 0;
    if (!GLASS_UNIT_REPLACE_RE.test(folded)) return false;
  }
  if (
    assembly === "body_glass" &&
    (isWasherFluid(folded) ||
      isInteriorTrim(folded) ||
      isWiperNotGlass(folded) ||
      isGlassChipCheckNotReplacement(folded) ||
      isHoodGasSpringWork(folded))
  ) {
    return false;
  }
  if (assembly === "engine" && isEngineAncillaryNotUnit(folded)) {
    ENGINE_UNIT_REPLACE_RE.lastIndex = 0;
    if (!ENGINE_UNIT_REPLACE_RE.test(folded)) return false;
  }
  if (assembly === "gearbox" && PROPSHAFT_NOT_GEARBOX_RE.test(folded)) return false;
  if (assembly === "clutch") {
    if (CLUTCH_ANCILLARY_RE.test(folded)) return false;
    if (AC_COMPRESSOR_ANCILLARY_RE.test(folded) && ASSEMBLY_RE.ac_compressor.test(folded)) return false;
    const withoutDual = folded.replace(DUAL_CLUTCH_RE, " ");
    ASSEMBLY_RE.clutch.lastIndex = 0;
    return ASSEMBLY_RE.clutch.test(withoutDual);
  }
  if (assembly === "adblue") {
    if (!ASSEMBLY_RE.adblue.test(folded)) return false;
    if (/nox[-\s]?(?:sensor|sonde|devej)/u.test(folded)) return true;
    return ADBLUE_COMPONENT_RE.test(folded) && !ADBLUE_REFILL_RE.test(folded);
  }
  if (assembly === "ac_compressor") {
    return ASSEMBLY_RE.ac_compressor.test(folded) && !AC_COMPRESSOR_ANCILLARY_RE.test(folded);
  }
  if (assembly === "body_glass" && isPaintWork(folded)) return true;
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

function isPaintWork(folded: string): boolean {
  return PAINT_WORK_RE.test(folded) && !PAINT_NOT_WORK_RE.test(folded);
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
  if (isEngineAncillaryNotUnit(folded)) return false;
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

/** Mezgla nomaiņa / remonts (bez eļļas maiņām, kas ir apkope - sk. `DEALER_MAJOR_SERVICE_IDS`). */
export function hasAnyMajorAssemblyRepair(works: string): boolean {
  return MAJOR_ASSEMBLY_SPECS.some(
    (spec) => !isDealerMajorServiceId(spec.id) && isMajorAssemblyRepairWork(works, spec.id),
  );
}

const DIFF_OIL_STRIP_RE = new RegExp(DIFF_OIL_RE.source, "gu");
const TRANSFER_OIL_STRIP_RE = new RegExp(TRANSFER_OIL_RE.source, "gu");

/** Vispārīgs „transmisija / transmission” (bez „automatic”) var nozīmēt arī tilta eļļu (LV tulkojums „Hypoid axle oil”). */
const GENERIC_TRANSMISSION_RE = /(?<!automat\p{L}*\s+)(?:transmisij\p{L}*|transmission)/gu;

/** Diferenciāļa / sadales kārbas eļļai vajag maiņas vārdu (detaļu rinda „Hypoid axle oil G2 (…)” vien nav maiņa). */
const OIL_CHANGE_SIGNAL_RE =
  /wechsel|gewechselt|erneuer\p{L}*|ersetz\p{L}*|change\p{L}*|replac\p{L}*|renew\p{L}*|flush\p{L}*|spulung|\bservice\b|main\p{L}*|nomain\p{L}*|замен\p{L}*|vervang\p{L}*|verversen|udskift\p{L}*|\bbyte\b|\bbytt\p{L}*|vidange/u;

type OilSentenceHits = {
  transfer: boolean;
  diff: boolean;
  gearboxSpecific: boolean;
  gearboxGeneric: boolean;
  /** Pieminēts tilts / sadales kārba (arī bez maiņas vārda) - vispārīgais „transmisija” attiecas uz to. */
  axleMention: boolean;
};

/**
 * Teikumi bez dalīšanas pie kola: „Automatic transmission: oil and filter change.” ir viens darbs
 * (`splitClauses` to sadalītu „automatic transmission” + „oil and filter change”).
 */
function splitOilSentences(folded: string): string[] {
  return uniqueNonEmpty(folded.replace(/\bacc\./g, "acc").split(/[\n;/|]+|(?<=[\p{L}\d])\.\s+/u));
}

function oilSentenceHits(sentence: string): OilSentenceHits | null {
  if (GEARBOX_OIL_NOT_CHANGE_RE.test(sentence)) return null;
  const change = OIL_CHANGE_SIGNAL_RE.test(sentence);
  const transferMention = TRANSFER_OIL_RE.test(sentence);
  const diffMention = DIFF_OIL_RE.test(sentence);
  const rest = sentence.replace(TRANSFER_OIL_STRIP_RE, " ").replace(DIFF_OIL_STRIP_RE, " ");
  const gearboxAny = GEARBOX_OIL_RE.test(rest);
  const gearboxSpecific = gearboxAny && GEARBOX_OIL_RE.test(rest.replace(GENERIC_TRANSMISSION_RE, " "));
  return {
    transfer: transferMention && change,
    diff: diffMention && change,
    gearboxSpecific,
    gearboxGeneric: gearboxAny && !gearboxSpecific,
    axleMention: transferMention || diffMention,
  };
}

/** Diferenciāļa / sadales kārbas eļļa NAV ātrumkārbas eļļa. Teksts var saturēt RAW + LV tulkojumu. */
function hasOilServiceOf(works: string, id: DealerMajorServiceId): boolean {
  let transfer = false;
  let diff = false;
  let gearboxSpecific = false;
  let gearboxGeneric = false;
  let axleMention = false;
  for (const line of (works ?? "").split(/\r?\n+/)) {
    const folded = foldDealerWorkText(line);
    if (!folded) continue;
    for (const sentence of splitOilSentences(folded)) {
      const h = oilSentenceHits(sentence);
      if (!h) continue;
      transfer ||= h.transfer;
      diff ||= h.diff;
      gearboxSpecific ||= h.gearboxSpecific;
      gearboxGeneric ||= h.gearboxGeneric;
      axleMention ||= h.axleMention;
    }
  }
  if (id === "transfer_case_oil") return transfer;
  if (id === "differential_oil") return diff;
  return gearboxSpecific || (gearboxGeneric && !axleMention);
}

const OIL_SERVICE_UNIT: Record<DealerMajorServiceId, AssemblyPatternId> = {
  gearbox_oil: "gearbox",
  transfer_case_oil: "transfer_case",
  differential_oil: "differential",
};

/**
 * Automātiskās / manuālās ātrumkārbas eļļas maiņa (DE/EN/DA/NL/LV/RU). Diferenciāļa / sadales kārbas
 * eļļa, līmeņa pārbaude, noplūde, dzesētājs u.tml. neskaitās.
 */
export function isGearboxOilChangeWork(works: string): boolean {
  return hasOilServiceOf(works, "gearbox_oil");
}

const PHRASE_BOUNDARY = "|";

function isConsumableToken(token: string): boolean {
  return token !== PHRASE_BOUNDARY && hasConsumableSignal(token);
}

const EXTRA_VERB_TOKEN_RE = /^(?:замен\p{L}*|заменен\p{L}*|nomain\p{L}*)$/u;

function isRepairVerbToken(token: string): boolean {
  if (token === PHRASE_BOUNDARY) return false;
  UNIT_REPAIR_VERB_RE.lastIndex = 0;
  return UNIT_REPAIR_VERB_RE.test(token) || EXTRA_VERB_TOKEN_RE.test(token) || isOverhaul(token);
}

/** Pēcpozīcijas divdabis („getauscht”, „replaced”, „заменена”) - attiecas uz iepriekšējo mezglu. */
const PARTICIPLE_TOKEN_RE = /(?:ed|(?<!men)t|ен[аоы]?|ён)$/u;

function phraseTokens(folded: string): string[] {
  return folded
    .replace(/[,;:()]+/gu, ` ${PHRASE_BOUNDARY} `)
    .split(/\s+/u)
    .filter(Boolean);
}

/**
 * Saplūdušā tekstā (piem. „Getriebe getauscht Getriebeöl erneuert”) eļļas vārds nedrīkst
 * bloķēt skaidru mezgla nomaiņas frāzi. Frāze = mezgls + ≤2 vārdi + darbības vārds (vai otrādi),
 * starpā nav eļļas/filtra/šķidruma vārda vai pieturzīmes; darbības vārds-lietvārds
 * („замена”, „replacement”), kam seko eļļa, attiecas uz eļļu, ne mezglu.
 */
function hasExplicitUnitReplacePhrase(
  folded: string,
  assembly: DealerMajorAssemblyId,
  isVerb: (token: string) => boolean = isRepairVerbToken,
): boolean {
  const tokens = phraseTokens(folded);
  const at = (k: number) => (k >= 0 && k < tokens.length ? tokens[k]! : PHRASE_BOUNDARY);
  for (let i = 0; i < tokens.length; i++) {
    for (let len = 1; len <= 2 && i + len <= tokens.length; len++) {
      const parts = tokens.slice(i, i + len);
      if (parts.includes(PHRASE_BOUNDARY)) continue;
      const window = parts.join(" ");
      if (isConsumableToken(window) || !mentionsAssembly(window, assembly)) continue;
      // Uz priekšu: „Getriebe getauscht”, „коробка передач заменена”.
      for (let j = i + len; j < Math.min(tokens.length, i + len + 3); j++) {
        const t = at(j);
        if (t === PHRASE_BOUNDARY || isConsumableToken(t)) break;
        if (isVerb(t)) {
          if (isConsumableToken(at(j + 1)) && !PARTICIPLE_TOKEN_RE.test(t)) break;
          return true;
        }
      }
      // Atpakaļ: „Замена коробки”, „replacement of gearbox”; mezglam nedrīkst sekot eļļas vārds.
      if (isConsumableToken(at(i + len))) continue;
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        const t = at(j);
        if (t === PHRASE_BOUNDARY || isConsumableToken(t)) break;
        if (isVerb(t)) {
          if (isConsumableToken(at(j - 1))) break;
          return true;
        }
      }
    }
  }
  return false;
}

function clauseIsUnitRepairOf(foldedClause: string, assembly: DealerMajorAssemblyId): boolean {
  if (isCampaignClause(foldedClause)) return false;
  if (isSoftwareClause(foldedClause)) return false;
  if (isCourtesyCarClause(foldedClause)) return false;
  if (isComfortInteriorClause(foldedClause)) return false;
  if (assembly === "accident_repair") return isAccidentRepairClause(foldedClause);
  if (assembly === "turbo" && isChargeAirMinor(foldedClause)) return false;
  if (assembly === "engine") return isEngineUnitReplacement(foldedClause);
  // Krāsošanas / gruntēšanas materiāls vai gruntēts panelis: virsbūves darbs arī bez darbības vārda.
  if (assembly === "body_glass" && isPaintWork(foldedClause) && !isInteriorTrim(foldedClause)) {
    return !isAccidentRepairClause(foldedClause);
  }
  // Filtra / dzesēšanas vārds šiem mezgliem ir paša mezgla nosaukumā, tāpēc „palīgmateriāla” filtrs neder.
  if (assembly === "dpf" || assembly === "water_pump") {
    if (!mentionsAssembly(foldedClause, assembly)) return false;
    if (isOverhaul(foldedClause) || isRemanOrExchange(foldedClause) || hasDealerPartNumber(foldedClause)) {
      return true;
    }
    if (assembly === "dpf" && DPF_CLEAN_RE.test(foldedClause)) return true;
    return hasUnitRepairVerb(foldedClause);
  }
  if (isMinorPartClause(foldedClause) && !MINOR_SKIP_EXCEPT.has(assembly)) {
    if (!isRemanOrExchange(foldedClause) && !isMajorPartListLine(foldedClause, assembly)) {
      return false;
    }
  }
  if (!mentionsAssembly(foldedClause, assembly)) return false;
  if (isUnitReplacementSignal(foldedClause, assembly)) return true;
  if (!hasUnitRepairVerb(foldedClause)) return false;
  if (hasConsumableSignal(foldedClause)) return hasExplicitUnitReplacePhrase(foldedClause, assembly);
  return true;
}

/** Vai teksts fiksē šī mezgla nomaiņu / kapitālo remontu, ne eļļas-filtra apkopi. */
export function isMajorAssemblyRepairWork(works: string, assembly: DealerMajorAssemblyId): boolean {
  if (isDealerMajorServiceId(assembly)) {
    // Eļļas uzpilde pēc paša mezgla nomaiņas ir daļa no nomaiņas, ne atsevišķs darbs.
    return hasOilServiceOf(works, assembly) && !isMajorAssemblyRepairWork(works, OIL_SERVICE_UNIT[assembly]);
  }
  // Katra rinda atsevišķi: `foldDealerWorkText` saplūdina rindas, un citas rindas eļļa / šķidrums
  // (piem. „Anti-freeze” blakus „EGR dzesētājs (11717822350)”) nedrīkst paslēpt mezgla pozīciju.
  for (const line of (works ?? "").split(/\r?\n+/)) {
    const folded = foldDealerWorkText(line);
    if (!folded) continue;
    for (const clause of splitClauses(folded)) {
      if (clauseIsUnitRepairOf(clause, assembly)) return true;
    }
  }
  return false;
}

/** Mezglu nomaiņas / remonti ierakstā (eļļas maiņas - apkope - šeit neietilpst). */
export function dealerMajorAssembliesInWork(works: string): DealerMajorAssemblyId[] {
  return MAJOR_ASSEMBLY_SPECS.filter(
    (spec) => !isDealerMajorServiceId(spec.id) && isMajorAssemblyRepairWork(works, spec.id),
  ).map(
    (spec) => spec.id,
  );
}

export function majorAssemblyLabel(id: DealerMajorAssemblyId): string {
  return MAJOR_ASSEMBLY_SPECS.find((s) => s.id === id)?.label ?? id;
}

/* ---------- Servisa vizītes galvenes precizācija (PDF) ---------- */

/** Tikai nomaiņa (ne remonts / kapitālais remonts). Teksts jau salocīts (bez diakritikas, mazie burti). */
const REPLACE_VERB_TOKEN_RE =
  /^(?:getauscht|ausgetauscht|austausch\p{L}*|tausch|ersetzt|ersetzen|erneuert|erneuern|gewechselt|replace|replaced|replacement|renewed|exchanged|nomain\p{L}*|aizvietot\p{L}*|замен\p{L}*)$/u;

function isReplaceVerbToken(token: string): boolean {
  return token !== PHRASE_BOUNDARY && REPLACE_VERB_TOKEN_RE.test(token);
}

/** Mezgla nomaiņas precizācija LV (dzimte pēc etiķetes). „Virsbūve / stikls” - bez precizācijas. */
const REPLACED_DETAIL_LV: Partial<Record<DealerMajorAssemblyId, string>> = {
  engine: "nomainīts",
  timing_chain: "nomainīta",
  timing_belt: "nomainīta",
  crankshaft_seal: "nomainīts",
  gearbox: "nomainīta",
  clutch: "nomainīts",
  transfer_case: "nomainīta",
  differential: "nomainīts",
  propshaft: "nomainīts",
  dual_mass_flywheel: "nomainīts",
  turbo: "nomainīts",
  egr: "nomainīts",
  water_pump: "nomainīts",
  air_suspension: "nomainīts",
  ac_compressor: "nomainīts",
};

/**
 * „nomainīts/-a”, ja ierakstā ir skaidra šī mezgla nomaiņa (frāze mezgls + nomaiņas darbības vārds
 * vai REMAN/Austausch vienība). Remonts, kapitālais remonts vai neskaidrs teksts - "".
 */
export function dealerAssemblyReplacedDetail(works: string, assembly: string): string {
  const detail = REPLACED_DETAIL_LV[assembly as DealerMajorAssemblyId];
  if (!detail) return "";
  const id = assembly as DealerMajorAssemblyId;
  const folded = foldDealerWorkText(works);
  if (!folded) return "";
  for (const clause of splitClauses(folded)) {
    if (!clauseIsUnitRepairOf(clause, id)) continue;
    if (isOverhaul(clause)) continue;
    if (hasExplicitUnitReplacePhrase(clause, id, isReplaceVerbToken)) return detail;
    if (isRemanOrExchange(clause) && mentionsAssembly(clause, id)) return detail;
  }
  return "";
}

/** Teksts salocīts: bez diakritikas (LV „priekšā” -> „prieksa”, RU „й” -> „и”), mazie burti. */
const FRONT_F =
  /(?<!\p{L})(?:vorne?|vorder\p{L}*|front|frontschaden|frontpartie|prieksa|priekse\p{L}*|priekspus\p{L}*|передн\p{L}*|спереди)(?!\p{L})/u;
const REAR_F =
  /(?<!\p{L})(?:hinten|hinter(?:e|en|er|es)?|heck\p{L}*|rear|aizmugur\p{L}*|задн\p{L}*|сзади)(?!\p{L})/u;
const LEFT_F =
  /(?<!\p{L})(?:links|linke[nrs]?|left|lh|kreis\p{L}*|лев(?:ы\p{L}?|ая|ое|ои|ую|ого|ому|ом)|слева)(?!\p{L})/u;
const RIGHT_F =
  /(?<!\p{L})(?:rechts|rechte[nrs]?|right|rh|lab(?:a|ais|aja|ajai|ajam|as|ie|ajos|ajas)|прав(?:ы\p{L}?|ая|ое|ои|ую|ого|ому|ом)|справа)(?!\p{L})/u;

/**
 * Bojājuma zona LV no negadījuma klauzulām („priekšā labajā pusē”, „aizmugurē”).
 * Ja zona nav minēta vai ir pretrunīga (priekšā un aizmugurē, kreisajā un labajā) - "".
 */
export function dealerAccidentZoneDetail(works: string): string {
  const folded = foldDealerWorkText(works);
  if (!folded) return "";
  let front = false;
  let rear = false;
  let left = false;
  let right = false;
  for (const clause of splitClauses(folded)) {
    if (!isAccidentRepairClause(clause)) continue;
    front ||= FRONT_F.test(clause);
    rear ||= REAR_F.test(clause);
    left ||= LEFT_F.test(clause);
    right ||= RIGHT_F.test(clause);
  }
  if ((front && rear) || (left && right)) return "";
  const fb = front ? "priekšā" : rear ? "aizmugurē" : "";
  const side = left ? "kreisajā pusē" : right ? "labajā pusē" : "";
  return [fb, side].filter(Boolean).join(" ");
}
