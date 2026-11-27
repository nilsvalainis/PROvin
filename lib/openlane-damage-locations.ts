/**
 * Openlane (openlane.eu, ex ADESA Europe) bojājumu vietu numuri → vieta klienta valodā.
 *
 * TheCarApi Openlane ierakstos vieta ir tikai numurs (`DamageLocation: "13"`, `areaCode: "13"`,
 * bilžu `locationId`). Nils 27.11: «Zona 13» klientam neko neizsaka.
 *
 * Avots (pārbaudīts 27.11.2026, nevis minēts):
 * 1) Openlane tīmekļa lietotnes kods `https://www.openlane.eu/v6/index-*.js` - objekts
 *    `{1: "vehicleDetails.damages.bumperFront", 2: "...grille", 3: "...hood", ... 109: "...battery"}`,
 *    ko `CarDetail-*.js` lieto kā `t(Map[picture.LocationId])` (bojājuma foto birka), un
 *    `{1: "damagekind.chip", 2: "damagekind.Scratch", 3: "damagekind.Dent", ...}` bojājuma veidam.
 * 2) Openlane oficiālie teksti `GET /en/homev6/labelsV2?language=en|ru` - `en` un `ru` zemāk ir
 *    Openlane pašu formulējumi (nedaudz saīsināti). `lv` un `de` - mūsu tulkojums no tiem.
 * Avoti nolasīti no releja Openlane profila pārlūka kešatmiņas (`/var/lib/provin-listings/profiles/openlane`).
 *
 * Nezināms numurs paliek «Zona N» (nekādu minējumu).
 */
import type { ClientReportLang } from "@/lib/client-report-i18n";

type Tr = { lv: string; en: string; ru: string; de: string };

export type OpenlaneDamageLocation = Tr & {
  /** Mūsu bojājumu tabulas zona (LV, kā `THECARAPI_ZONE_ORDER`). */
  zone: string;
  /** Detaļa zonas iekšā (LV); tukša, ja vieta = zona (piem. «Jumts»). */
  part: string;
};

const ZONE: Record<string, Tr> = {
  front: { lv: "Priekša", en: "Front", ru: "Спереди", de: "Vorne" },
  rear: { lv: "Aizmugure", en: "Rear", ru: "Сзади", de: "Hinten" },
  left: { lv: "Kreisā puse", en: "Left side", ru: "Левая сторона", de: "Linke Seite" },
  right: { lv: "Labā puse", en: "Right side", ru: "Правая сторона", de: "Rechte Seite" },
  roof: { lv: "Jumts", en: "Roof", ru: "Крыша", de: "Dach" },
  under: { lv: "Apakša", en: "Underside", ru: "Днище", de: "Unterboden" },
  accident: { lv: "Avārijas bojājumi", en: "Accident damage", ru: "Аварийные повреждения", de: "Unfallschäden" },
  technical: { lv: "Tehniskie bojājumi", en: "Technical damage", ru: "Технические повреждения", de: "Technische Schäden" },
  special: { lv: "Īpaši bojājumi", en: "Special damage", ru: "Особые повреждения", de: "Sonderschäden" },
};

/** [zona, lv, en (Openlane), ru (Openlane), de]. */
const RAW: Record<number, [keyof typeof ZONE, string, string, string, string]> = {
  1: ["front", "Priekšējais buferis", "Front bumper", "Передний бампер", "Frontstoßstange"],
  2: ["front", "Radiatora reste", "Grille", "Радиаторная решетка", "Kühlergrill"],
  3: ["front", "Motora pārsegs", "Hood / bonnet", "Капот", "Motorhaube"],
  4: ["front", "Vējstikls", "Windshield / windscreen", "Лобовое стекло", "Windschutzscheibe"],
  5: ["front", "Kreisais priekšējais lukturis", "Left headlight", "Левая фара", "Scheinwerfer links"],
  6: ["left", "Kreisais priekšējais spārns", "Front left fender / wing", "Переднее левое крыло", "Kotflügel vorne links"],
  7: ["left", "Kreisais A statnis", "Left A pillar", "Левая передняя стойка", "A-Säule links"],
  8: ["left", "Kreisās priekšējās durvis", "Front left door", "Передняя левая дверь", "Tür vorne links"],
  9: ["left", "Kreisais slieksnis", "Left skirt / sill", "Левый порог", "Schweller links"],
  10: ["left", "Kreisās aizmugurējās durvis", "Rear left door", "Задняя левая дверь", "Tür hinten links"],
  11: ["left", "Kreisais aizmugurējais spārns", "Left quarter panel", "Заднее левое крыло (панель четверти)", "Seitenwand hinten links"],
  12: ["rear", "Kreisais aizmugurējais lukturis", "Left tail light", "Задний левый фонарь", "Rückleuchte links"],
  13: ["rear", "Aizmugurējais buferis", "Rear bumper", "Задний бампер", "Heckstoßstange"],
  14: ["rear", "Bagāžnieka vāks", "Tailgate", "Крышка багажника", "Heckklappe"],
  15: ["rear", "Aizmugurējais stikls", "Rear window", "Заднее стекло", "Heckscheibe"],
  16: ["roof", "", "Roof", "Крыша", "Dach"],
  17: ["rear", "Labais aizmugurējais lukturis", "Right tail light", "Задний правый фонарь", "Rückleuchte rechts"],
  18: ["right", "Labais aizmugurējais spārns", "Right quarter panel", "Заднее правое крыло (панель четверти)", "Seitenwand hinten rechts"],
  19: ["right", "Labās aizmugurējās durvis", "Rear right door", "Задняя правая дверь", "Tür hinten rechts"],
  20: ["right", "Labais slieksnis", "Right skirt / sill", "Правый порог", "Schweller rechts"],
  21: ["right", "Labās priekšējās durvis", "Front right door", "Передняя правая дверь", "Tür vorne rechts"],
  22: ["right", "Labais A statnis", "Right A pillar", "Правая передняя стойка", "A-Säule rechts"],
  23: ["right", "Labais priekšējais spārns", "Front right fender / wing", "Переднее правое крыло", "Kotflügel vorne rechts"],
  24: ["front", "Labais priekšējais lukturis", "Right headlight", "Правая фара", "Scheinwerfer rechts"],
  36: ["accident", "Piekare priekšā kreisajā pusē", "Suspension front left", "Подвеска спереди слева", "Fahrwerk vorne links"],
  37: ["accident", "Piekare priekšā labajā pusē", "Suspension front right", "Подвеска спереди справа", "Fahrwerk vorne rechts"],
  38: ["accident", "Piekare aizmugurē kreisajā pusē", "Suspension rear left", "Подвеска сзади слева", "Fahrwerk hinten links"],
  39: ["accident", "Piekare aizmugurē labajā pusē", "Suspension rear right", "Подвеска сзади справа", "Fahrwerk hinten rechts"],
  40: ["accident", "Priekšpuse", "Front", "Спереди", "Front"],
  41: ["accident", "Radiatori", "Radiators", "Радиаторы", "Kühler"],
  42: ["accident", "Stūres stiepnis", "Traverse bar", "Привод механизма поворота", "Spurstange"],
  43: ["accident", "Šasija kreisajā pusē", "Chassis left", "Шасси слева", "Rahmen links"],
  44: ["accident", "Šasija labajā pusē", "Chassis right", "Шасси справа", "Rahmen rechts"],
  45: ["accident", "Jumts", "Roof", "Крыша", "Dach"],
  46: ["accident", "Motora balsts", "Engine support", "Опора двигателя", "Motorträger"],
  47: ["accident", "Atvērušies drošības spilveni", "Open airbags", "Открыты подушки безопасности", "Ausgelöste Airbags"],
  51: ["technical", "Kondicionieris", "Air conditioning", "Кондиционер", "Klimaanlage"],
  52: ["technical", "Sajūgs un spararats", "Clutch + flywheel", "Сцепление + маховик", "Kupplung + Schwungrad"],
  53: ["technical", "Turbokompresors", "Turbo", "Турбонаддув", "Turbolader"],
  54: ["technical", "Dzinējs", "Engine", "Двигатель", "Motor"],
  55: ["technical", "Ātrumkārba", "Gearbox", "Коробка передач", "Getriebe"],
  56: ["technical", "Ģenerators", "Alternator", "Генератор", "Lichtmaschine"],
  57: ["technical", "Bremzes", "Brake", "Тормоз", "Bremse"],
  58: ["technical", "Cilindru galvas blīve", "Cylinder head gasket", "Прокладка головки цилиндров", "Zylinderkopfdichtung"],
  62: ["technical", "Cits", "Other", "Другое", "Sonstiges"],
  59: ["special", "Krusas bojājums", "Hail damage", "Повреждение градом", "Hagelschaden"],
  60: ["special", "Ugunsbojājums", "Fire damage", "Повреждение огнем", "Brandschaden"],
  61: ["special", "Ūdens bojājums", "Water damage", "Повреждение водой", "Wasserschaden"],
  63: ["left", "Priekšējais kreisais disks", "Front left wheel", "Передний левый колесный диск", "Felge vorne links"],
  64: ["right", "Priekšējais labais disks", "Front right wheel", "Передний правый колесный диск", "Felge vorne rechts"],
  65: ["left", "Aizmugurējais kreisais disks", "Rear left wheel", "Задний левый колесный диск", "Felge hinten links"],
  66: ["right", "Aizmugurējais labais disks", "Rear right wheel", "Задний правый колесный диск", "Felge hinten rechts"],
  67: ["rear", "", "Rear", "Задняя часть", "Heck"],
  68: ["under", "", "Underside", "Днище кузова", "Unterboden"],
  71: ["roof", "Jumta kreisā mala", "Left roof arcade", "Левая арка крыши", "Dachrahmen links"],
  72: ["roof", "Jumta labā mala", "Right roof arcade", "Правая арка крыши", "Dachrahmen rechts"],
  73: ["left", "Kreisais spogulis", "Left mirror", "Левое зеркало", "Außenspiegel links"],
  74: ["right", "Labais spogulis", "Right mirror", "Правое зеркало", "Außenspiegel rechts"],
  107: ["technical", "Elektriskā / hibrīda sistēma", "EV / hybrid", "Электро / гибрид", "Elektro / Hybrid"],
  108: ["technical", "Transmisija", "Transmission", "Трансмиссия", "Antriebsstrang"],
  109: ["technical", "Akumulators", "Battery", "Аккумулятор", "Batterie"],
};

/** Openlane `DamageKindId` → veids (Openlane EN/RU no `labelsV2`; LV kā `thecarapi-i18n-lv` DAMAGE_TYPES). */
const KIND: Record<number, Tr> = {
  1: { lv: "Akmens šķemba", en: "Chip", ru: "Скол (следы от камней)", de: "Steinschlag" },
  2: { lv: "Skrāpējums", en: "Scratch", ru: "Царапина", de: "Kratzer" },
  3: { lv: "Iespiedums", en: "Dent", ru: "Вмятина", de: "Delle" },
  4: { lv: "Salūzis", en: "Broken", ru: "Разбито", de: "Gebrochen" },
  5: { lv: "Cita", en: "Other", ru: "Другое", de: "Sonstiges" },
  9: { lv: "Korozija", en: "Corrosion", ru: "Коррозия", de: "Korrosion" },
  6: { lv: "Neliels bojājums", en: "Small damage", ru: "Незначительное повреждение", de: "Kleiner Schaden" },
  7: { lv: "Vidējs bojājums", en: "Medium damage", ru: "Среднее повреждение", de: "Mittlerer Schaden" },
  8: { lv: "Liels bojājums", en: "Large damage", ru: "Серьёзное повреждение", de: "Großer Schaden" },
};

export const OPENLANE_DAMAGE_LOCATIONS: Readonly<Record<number, OpenlaneDamageLocation>> = Object.freeze(
  Object.fromEntries(
    Object.entries(RAW).map(([id, [zone, lv, en, ru, de]]) => {
      const z = ZONE[zone]!;
      const name: Tr = lv ? { lv, en, ru, de } : { lv: z.lv, en, ru, de };
      return [Number(id), { ...name, zone: z.lv, part: lv }];
    }),
  ),
);

/** «13» / 13 → vieta vai `null` (nezināms numurs, ne skaitlis). */
export function openlaneDamageLocation(raw: unknown): OpenlaneDamageLocation | null {
  const s = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (!/^\d{1,3}$/.test(s)) return null;
  return OPENLANE_DAMAGE_LOCATIONS[Number(s)] ?? null;
}

export function openlaneDamageKind(raw: unknown): Tr | null {
  const s = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (!/^\d{1,2}$/.test(s)) return null;
  return KIND[Number(s)] ?? null;
}

/** LV teksts (zona, detaļa, veids) → tulkojums. Zināmās Openlane formas + Openlane `Chip`/`Dent` EN nosaukumi. */
const LV_INDEX = new Map<string, Tr>();
for (const z of Object.values(ZONE)) LV_INDEX.set(z.lv.toLowerCase(), z);
for (const l of Object.values(OPENLANE_DAMAGE_LOCATIONS)) if (l.part) LV_INDEX.set(l.part.toLowerCase(), l);
for (const k of Object.values(KIND)) LV_INDEX.set(k.lv.toLowerCase(), k);

/**
 * Bojājumu saraksta zona/detaļa/veids klienta valodā. Tikai pilna sakritība ar šīs vārdnīcas LV formu;
 * citādi `null` (izsaucējs lieto savu tulkojumu).
 */
export function translateOpenlaneDamageText(lvText: string, lang: ClientReportLang | undefined): string | null {
  const hit = LV_INDEX.get(lvText.trim().toLowerCase());
  if (!hit) return null;
  if (lang === "en" || lang === "ru" || lang === "de") return hit[lang];
  return hit.lv;
}
