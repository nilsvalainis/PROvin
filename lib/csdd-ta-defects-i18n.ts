/**
 * CSDD tehniskās apskates defektu un piezīmju standarta teikumi EN / RU / DE (Nils 25.11: EN/RU/DE PDF
 * palika ~18 latviešu atlieku - visas no CSDD TA defektu saraksta un «Piezīmes»).
 *
 * CSDD defektus raksta no fiksēta kataloga (kods + standarta teikums), tāpēc tos var tulkot
 * deterministiski - neatkarīgi no AI atlieku gājiena. Tulko tikai, ja VISI teikumi gabalā ir zināmi;
 * nezināms teikums -> viss gabals paliek kā ir (AI gājienam).
 */
import type { ClientReportLang } from "@/lib/client-report-i18n";

type Target = Exclude<ClientReportLang, "lv">;
type Tr = Record<Target, string>;

const t = (en: string, ru: string, de: string): Tr => ({ en, ru, de });

type Side = { lv: string; lvGen: string; en: string; ruF: string; ruM: string; ruGen: string; de: string; deN: string };
const SIDES: Side[] = [
  { lv: "Labais", lvGen: "Labā", en: "right", ruF: "Правая", ruM: "Правый", ruGen: "правого", de: "Rechter", deN: "rechten" },
  { lv: "Kreisais", lvGen: "Kreisā", en: "left", ruF: "Левая", ruM: "Левый", ruGen: "левого", de: "Linker", deN: "linken" },
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function sideSentences(): Record<string, Tr> {
  const out: Record<string, Tr> = {};
  for (const s of SIDES) {
    const lvSideGenLower = s.lvGen.toLocaleLowerCase("lv");
    out[`${s.lv} augšējais šarnīrs.`] = t(`${cap(s.en)} upper joint.`, `${s.ruM} верхний шарнир.`, `${s.de.replace(/r$/, "s")} oberes Gelenk.`);
    out[`${s.lv} apakšējais šarnīrs.`] = t(`${cap(s.en)} lower joint.`, `${s.ruM} нижний шарнир.`, `${s.de.replace(/r$/, "s")} unteres Gelenk.`);
    out[`Palielināta brīvkustība ${lvSideGenLower} riteņa gultnī.`] = t(
      `Excessive play in the ${s.en} wheel bearing.`,
      `Повышенный люфт подшипника ${s.ruGen} колеса.`,
      `Übermäßiges Spiel im ${s.deN} Radlager.`,
    );
    out[`Plaisas, lūzumi, ievērojama korozija ${s.lvGen.toLocaleLowerCase("lv").replace(/ā$/, "ās")} puses atsperojumā.`] = t(
      `Cracks, fractures, significant corrosion of the ${s.en}-hand suspension spring.`,
      `Трещины, изломы, значительная коррозия ${s.ruGen === "правого" ? "правой" : "левой"} пружины подвески.`,
      `Risse, Brüche, erhebliche Korrosion an der ${s.deN} Federung.`,
    );
    out[`${s.lvGen} tuvās gaismas luktura gaismas kūļa noliekums attiecībā pret horizontālu ceļa virsmu par augstu.`] = t(
      `${cap(s.en)} dipped-beam headlamp aim too high relative to the horizontal road surface.`,
      `Наклон светового пучка ${s.ruGen} фары ближнего света относительно горизонтальной поверхности дороги слишком высокий.`,
      `Neigung des Lichtbündels des ${s.deN} Abblendscheinwerfers zur horizontalen Fahrbahn zu hoch.`,
    );
    out[`${s.lvGen} tuvās gaismas luktura gaismas kūļa noliekums attiecībā pret horizontālu ceļa virsmu par zemu.`] = t(
      `${cap(s.en)} dipped-beam headlamp aim too low relative to the horizontal road surface.`,
      `Наклон светового пучка ${s.ruGen} фары ближнего света относительно горизонтальной поверхности дороги слишком низкий.`,
      `Neigung des Lichtbündels des ${s.deN} Abblendscheinwerfers zur horizontalen Fahrbahn zu niedrig.`,
    );
    // 26.11: no repo e-CSDD fiktūrām (`lib/__fixtures__/ecsdd-paid/*`, testi) - abas puses kā CSDD katalogā.
    const lvLoc = s.lv === "Labais" ? "labajā" : "kreisajā";
    out[`Neliela ${lvSideGenLower} ārējā stūres šarnīra brīvkustība.`] = t(
      `Slight play in the ${s.en} outer steering joint.`,
      `Небольшой люфт ${s.ruGen} наружного рулевого шарнира.`,
      `Geringes Spiel im ${s.deN} äußeren Lenkgelenk.`,
    );
    out[`Palielināta ${lvSideGenLower} ārējā stūres šarnīra brīvkustība.`] = t(
      `Excessive play in the ${s.en} outer steering joint.`,
      `Повышенный люфт ${s.ruGen} наружного рулевого шарнира.`,
      `Übermäßiges Spiel im ${s.deN} äußeren Lenkgelenk.`,
    );
    out[`Nedeg ${s.lv.toLocaleLowerCase("lv")} priekšējais gabarītlukturis.`] = t(
      `${cap(s.en)} front position lamp not working.`,
      `Не горит ${s.ruM.toLocaleLowerCase("ru")} передний габаритный фонарь.`,
      `${s.de.replace(/r$/, "s")} vorderes Begrenzungslicht leuchtet nicht.`,
    );
    out[`Nedeg ${s.lv.toLocaleLowerCase("lv")} pakaļējais miglas lukturis.`] = t(
      `${cap(s.en)} rear fog lamp not working.`,
      `Не горит ${s.ruM.toLocaleLowerCase("ru")} задний противотуманный фонарь.`,
      `${s.de.replace(/r$/, "")} Nebelschlussleuchte leuchtet nicht.`,
    );
    out[`Nelieli bojājumi ${lvLoc} priekšējā miglas lukturī.`] = t(
      `Minor damage to the ${s.en} front fog lamp.`,
      `Незначительные повреждения ${s.ruGen === "правого" ? "правой" : "левой"} передней противотуманной фары.`,
      `Geringe Schäden am ${s.deN} vorderen Nebelscheinwerfer.`,
    );
    out[`${s.lv} galvenais lukturis viegli aizsvīdis.`] = t(
      `${cap(s.en)} headlamp slightly fogged.`,
      `${s.ruF} основная фара слегка запотела.`,
      `${s.de} Hauptscheinwerfer leicht beschlagen.`,
    );
    out[`${s.lv} priekšējais miglas lukturis iestatīts par augstu.`] = t(
      `${cap(s.en)} front fog lamp aimed too high.`,
      `${s.ruF} передняя противотуманная фара установлена слишком высоко.`,
      `${s.de} vorderer Nebelscheinwerfer zu hoch eingestellt.`,
    );
  }
  return out;
}

/** Teikums (ar punktu galā) -> tulkojums. Atslēgas kā CSDD izziņā; salīdzina bez reģistra un atstarpju atšķirībām. */
const SENTENCES: Record<string, Tr> = {
  "Priekšējais tilts.": t("Front axle.", "Передний мост.", "Vorderachse."),
  "Aizmugurējais tilts.": t("Rear axle.", "Задний мост.", "Hinterachse."),
  "Palielināta brīvkustība balstiekārtas šarnīrā.": t(
    "Excessive play in a suspension joint.",
    "Повышенный люфт в шарнире подвески.",
    "Übermäßiges Spiel im Achsgelenk.",
  ),
  "Stāvbremze nedarbojas vienā pusē.": t(
    "Parking brake inoperative on one side.",
    "Стояночный тормоз не действует с одной стороны.",
    "Feststellbremse auf einer Seite unwirksam.",
  ),
  "Nav sasniegta noteiktā stāvbremzes bremzēšanas efektivitātes minimālā vērtība.": t(
    "The required minimum parking brake efficiency is not reached.",
    "Не достигнуто установленное минимальное значение эффективности стояночного тормоза.",
    "Der vorgeschriebene Mindestwert der Feststellbremswirkung wird nicht erreicht.",
  ),
  "Neveidojot piles, sūcas eļļa no motora (transmisijas).": t(
    "Oil seeping from the engine (transmission) without forming drops.",
    "Подтекание масла из двигателя (трансмиссии) без образования капель.",
    "Ölaustritt am Motor (Getriebe) ohne Tropfenbildung.",
  ),
  "Apgrūtināta bagāžnieka pārsega atvēršana vai aizvēršana.": t(
    "Boot lid difficult to open or close.",
    "Крышка багажника открывается или закрывается с трудом.",
    "Kofferraumdeckel schwer zu öffnen oder zu schließen.",
  ),
  "Bagāžnieka pārsegs nav atverams.": t("Boot lid cannot be opened.", "Крышка багажника не открывается.", "Kofferraumdeckel lässt sich nicht öffnen."),
  "Stāvbremzes bremzēšanas efektivitāte pietiekoša - riteņi tiek nobloķēti bremžu stendā.": t(
    "Parking brake efficiency sufficient - the wheels lock on the brake tester.",
    "Эффективность стояночного тормоза достаточная - колёса блокируются на тормозном стенде.",
    "Feststellbremswirkung ausreichend - die Räder blockieren auf dem Bremsenprüfstand.",
  ),
  "Stāvbremzes efektivitāte pietiekoša.": t(
    "Parking brake efficiency sufficient.",
    "Эффективность стояночного тормоза достаточная.",
    "Feststellbremswirkung ausreichend.",
  ),
  "Pilnpiedziņa.": t("All-wheel drive.", "Полный привод.", "Allradantrieb."),
  "Nevar pieslēgties OBD, jo nesavienojas ar sistēmu.": t(
    "Unable to connect to OBD - no connection with the system.",
    "Не удаётся подключиться к OBD - нет связи с системой.",
    "OBD-Verbindung nicht möglich - keine Verbindung zum System.",
  ),
  "Izplūdes sistēma nehermētiska.": t("Exhaust system leaking.", "Выпускная система негерметична.", "Abgasanlage undicht."),
  // 26.11: biežākie CSDD TA standarta teikumi no repo e-CSDD fiktūrām un testiem (nav izdomāti).
  "Nenozīmīga eļļas noplūde no motora (transmisijas).": t(
    "Minor oil leak from the engine (transmission).",
    "Незначительная утечка масла из двигателя (трансмиссии).",
    "Geringfügiger Ölverlust am Motor (Getriebe).",
  ),
  "Neveidojot piles, sūcas eļļa.": t("Oil seeping without forming drops.", "Подтекание масла без образования капель.", "Ölaustritt ohne Tropfenbildung."),
  "Sūcas eļļa no motora.": t("Oil seeping from the engine.", "Подтекание масла из двигателя.", "Ölaustritt am Motor."),
  "Virspusēja rāmja vai nesošā elementa korozija.": t(
    "Surface corrosion of the frame or a load-bearing element.",
    "Поверхностная коррозия рамы или несущего элемента.",
    "Oberflächliche Korrosion des Rahmens oder eines tragenden Teils.",
  ),
  "Nesošās konstrukcijas stiprību ietekmējošs korozijas bojājums.": t(
    "Corrosion damage affecting the strength of the load-bearing structure.",
    "Коррозионное повреждение, влияющее на прочность несущей конструкции.",
    "Korrosionsschaden mit Einfluss auf die Festigkeit der tragenden Struktur.",
  ),
  "Funkcionalitāti neietekmējošas balstrāmja deformācijas vai virspusēja korozija.": t(
    "Subframe deformation not affecting function, or surface corrosion.",
    "Деформации подрамника, не влияющие на работу, или поверхностная коррозия.",
    "Funktionsneutrale Verformungen des Hilfsrahmens oder oberflächliche Korrosion.",
  ),
  "Funkcionalitāti neietekmējošas balstiekārtas sviru deformācijas vai virspusēja korozija.": t(
    "Suspension arm deformation not affecting function, or surface corrosion.",
    "Деформации рычагов подвески, не влияющие на работу, или поверхностная коррозия.",
    "Funktionsneutrale Verformungen der Fahrwerkslenker oder oberflächliche Korrosion.",
  ),
  "Bremžu pārvada cauruļvadu korozija sākuma stadijā.": t(
    "Early-stage corrosion of the brake lines.",
    "Коррозия тормозных трубопроводов в начальной стадии.",
    "Korrosion der Bremsleitungen im Anfangsstadium.",
  ),
  "Bremzēšanas īpašības neietekmējoši bremžu disku korozijas bojājumi.": t(
    "Brake disc corrosion not affecting braking performance.",
    "Коррозия тормозных дисков, не влияющая на тормозные свойства.",
    "Korrosion der Bremsscheiben ohne Einfluss auf die Bremswirkung.",
  ),
  "Priekšējie miglas lukturi nav atbilstoši noregulēti.": t(
    "Front fog lamps not correctly adjusted.",
    "Передние противотуманные фары отрегулированы неправильно.",
    "Vordere Nebelscheinwerfer nicht richtig eingestellt.",
  ),
  "Nedeg līdz vienai trešdaļai kvēlspuldžu vai diožu S3 kategorijas (papildus) bremžu lukturī.": t(
    "Up to one third of the bulbs or LEDs in the S3 category (additional) brake lamp not working.",
    "Не горит до одной трети ламп или диодов в стоп-сигнале категории S3 (дополнительном).",
    "Bis zu einem Drittel der Glühlampen oder LEDs in der Bremsleuchte der Kategorie S3 (zusätzlich) leuchten nicht.",
  ),
  "Nedeg S3 kategorijas (papildus) bremžu lukturis.": t(
    "S3 category (additional) brake lamp not working.",
    "Не горит стоп-сигнал категории S3 (дополнительный).",
    "Bremsleuchte der Kategorie S3 (zusätzlich) leuchtet nicht.",
  ),
  "Drošības sistēmas (SRS) kļūmes (bojājuma) indikators norāda uz kļūmi (bojājumu) tās darbībā.": t(
    "The safety system (SRS) malfunction indicator shows a fault in its operation.",
    "Индикатор неисправности системы безопасности (SRS) указывает на неисправность в её работе.",
    "Die Störungsanzeige des Sicherheitssystems (SRS) zeigt eine Störung in seiner Funktion an.",
  ),
  "Redzamību vai izturību būtiski neietekmējoši stiklojuma bojājumi.": t(
    "Glazing damage not significantly affecting visibility or strength.",
    "Повреждения остекления, существенно не влияющие на обзор или прочность.",
    "Verglasungsschäden ohne wesentlichen Einfluss auf Sicht oder Festigkeit.",
  ),
  "Nepietiekams riepu protektora dziļums.": t("Insufficient tyre tread depth.", "Недостаточная глубина протектора шин.", "Unzureichende Reifenprofiltiefe."),
  "Nelieli vietēji vai virspusēji riepas bojājumi.": t(
    "Minor local or surface tyre damage.",
    "Незначительные местные или поверхностные повреждения шины.",
    "Geringe örtliche oder oberflächliche Reifenschäden.",
  ),
  "Nelieli riepas (riepu) bojājumi.": t("Minor tyre damage.", "Незначительные повреждения шины (шин).", "Geringe Reifenschäden."),
  "Nelieli numura zīmes bojājumi.": t("Minor number plate damage.", "Незначительные повреждения номерного знака.", "Geringe Schäden am Kennzeichen."),
  "Stūres mehānisms.": t("Steering gear.", "Рулевой механизм.", "Lenkgetriebe."),
  "Palielināta brīvkustība.": t("Excessive play.", "Повышенный люфт.", "Übermäßiges Spiel."),
  "Augšā pakaļējais šarnīrs.": t("Upper rear joint.", "Верхний задний шарнир.", "Oberes hinteres Gelenk."),
  ...sideSentences(),
};

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLocaleLowerCase("lv");

let INDEX: Map<string, Tr> | null = null;
function index(): Map<string, Tr> {
  if (!INDEX) INDEX = new Map(Object.entries(SENTENCES).map(([k, v]) => [norm(k), v]));
  return INDEX;
}

/** Sadala teikumos pēc «. » (punkts + atstarpe + lielais burts). */
function splitSentences(text: string): string[] {
  return text.split(/(?<=\.)\s+(?=\p{Lu})/u).filter(Boolean);
}

/**
 * Viss gabals (var būt «- …» vai «…» ietvarā) -> tulkojums, ja katrs teikums zināms; citādi `null`.
 */
export function translateCsddTaDefectText(text: string, lang: ClientReportLang): string | null {
  if (lang === "lv") return null;
  const m = text.match(/^(\s*(?:-\s+|«)?)([\s\S]*?)(»?\s*)$/);
  if (!m) return null;
  const [, lead, core, trail] = m;
  if (!core || !/\p{L}/u.test(core)) return null;
  const parts = splitSentences(core.trim());
  const out: string[] = [];
  for (const p of parts) {
    const hit = index().get(norm(p));
    if (!hit) return null;
    out.push(hit[lang]);
  }
  return `${lead}${out.join(" ")}${trail}`;
}

/** Testiem: visi zināmie LV teikumi. */
export function csddTaDefectSentencesLv(): string[] {
  return Object.keys(SENTENCES);
}
