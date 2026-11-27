/**
 * Izsoļu portālu (IAAI, Copart, bid.cars, TheCarApi, stat.vin u.c.) standarta termini klienta PDF valodā.
 *
 * Nils 27.11: «IZSOĻU PORTĀLU ARHĪVS» tabulās palika angliski «Front end + Unknown», «… · Sold».
 * Deterministiska vārdnīca (bez AI): tulko tikai daļas, kas PILNĀ sakritībā ir vārdnīcā. Kombinācijas
 * ar «+», «,», «;», «·» tulko pa daļām. Nezināma daļa (piem. modeļa nosaukums «2013 BMW 5 Series»)
 * paliek oriģinālā - nekādu izdomājumu. Saglabātos datus nemaina, tulko tikai renderī.
 *
 * Valodas: LV/RU/DE tulko; EN paliek avota angļu teksts. Ja daļa jau ir latviski (mūsu vārdnīcas LV
 * forma), EN/RU/DE PDF to arī pārtulko, bet LV PDF atstāj kā ir.
 */
import type { ClientReportLang } from "@/lib/client-report-i18n";

type Entry = { en: string; lv: string; ru: string; de: string };

/** [angļu atslēgas (aliasi)] + tulkojumi. Atslēgas normalizē `normKey`. */
const TERMS: Array<[string[], Entry]> = [
  /* ---------- Bojājumi (primary / secondary damage) ---------- */
  [["front end", "front", "front damage"], { en: "Front end", lv: "Priekšpuse", ru: "Передняя часть", de: "Front" }],
  [["rear end", "rear", "rear damage"], { en: "Rear end", lv: "Aizmugure", ru: "Задняя часть", de: "Heck" }],
  [["side", "side damage"], { en: "Side", lv: "Sāns", ru: "Бок", de: "Seite" }],
  [["left side"], { en: "Left side", lv: "Kreisais sāns", ru: "Левый бок", de: "Linke Seite" }],
  [["right side"], { en: "Right side", lv: "Labais sāns", ru: "Правый бок", de: "Rechte Seite" }],
  [["left front"], { en: "Left front", lv: "Priekšpuse kreisajā pusē", ru: "Передняя левая часть", de: "Vorne links" }],
  [["right front"], { en: "Right front", lv: "Priekšpuse labajā pusē", ru: "Передняя правая часть", de: "Vorne rechts" }],
  [["left rear"], { en: "Left rear", lv: "Aizmugure kreisajā pusē", ru: "Задняя левая часть", de: "Hinten links" }],
  [["right rear"], { en: "Right rear", lv: "Aizmugure labajā pusē", ru: "Задняя правая часть", de: "Hinten rechts" }],
  [["all over"], { en: "All over", lv: "Visa virsbūve", ru: "Весь кузов", de: "Rundum" }],
  [["hail", "hail damage"], { en: "Hail", lv: "Krusa", ru: "Град", de: "Hagel" }],
  [
    ["water/flood", "flood", "water", "flood damage", "water damage", "fresh water", "salt water"],
    { en: "Water / flood", lv: "Applūdis", ru: "Затопление", de: "Wasserschaden / Überflutung" },
  ],
  [["mechanical", "mechanical damage"], { en: "Mechanical", lv: "Mehānisks bojājums", ru: "Механические повреждения", de: "Mechanischer Schaden" }],
  [
    ["minor dent/scratches", "minor dents/scratches", "minor dent/scratch", "minor dent scratches"],
    { en: "Minor dents / scratches", lv: "Nelieli ieliekumi / skrāpējumi", ru: "Мелкие вмятины / царапины", de: "Kleine Dellen / Kratzer" },
  ],
  [["minor dent", "minor dents"], { en: "Minor dents", lv: "Nelieli ieliekumi", ru: "Мелкие вмятины", de: "Kleine Dellen" }],
  [["scratches", "scratch"], { en: "Scratches", lv: "Skrāpējumi", ru: "Царапины", de: "Kratzer" }],
  [["undercarriage"], { en: "Undercarriage", lv: "Apakšdaļa", ru: "Днище", de: "Unterboden" }],
  [["vandalism"], { en: "Vandalism", lv: "Vandālisms", ru: "Вандализм", de: "Vandalismus" }],
  [["burn", "fire", "fire damage", "burn damage"], { en: "Fire", lv: "Ugunsbojājums", ru: "Повреждение огнём", de: "Brandschaden" }],
  [["burn engine", "fire engine"], { en: "Fire (engine)", lv: "Ugunsbojājums (dzinējs)", ru: "Повреждение огнём (двигатель)", de: "Brandschaden (Motor)" }],
  [["burn interior", "fire interior"], { en: "Fire (interior)", lv: "Ugunsbojājums (salons)", ru: "Повреждение огнём (салон)", de: "Brandschaden (Innenraum)" }],
  [["rollover"], { en: "Rollover", lv: "Apgāšanās", ru: "Опрокидывание", de: "Überschlag" }],
  [["roof", "top/roof"], { en: "Roof", lv: "Jumts", ru: "Крыша", de: "Dach" }],
  [["normal wear", "normal wear and tear", "normal wear tear"], { en: "Normal wear", lv: "Normāls nolietojums", ru: "Естественный износ", de: "Normaler Verschleiß" }],
  [["biohazard/chemical", "biohazard", "chemical"], { en: "Biohazard / chemical", lv: "Bīstamas vielas", ru: "Биологическая / химическая опасность", de: "Biogefährdung / Chemikalien" }],
  [["stripped"], { en: "Stripped", lv: "Izjaukts", ru: "Разукомплектован", de: "Ausgeschlachtet" }],
  [["theft", "stolen", "theft recovery", "recovered theft"], { en: "Theft", lv: "Zādzība", ru: "Угон", de: "Diebstahl" }],
  [["frame damage"], { en: "Frame damage", lv: "Rāmja bojājums", ru: "Повреждение рамы", de: "Rahmenschaden" }],
  [["electrical", "electrical damage"], { en: "Electrical", lv: "Elektrības bojājums", ru: "Электрика", de: "Elektrikschaden" }],
  [["engine damage", "engine"], { en: "Engine damage", lv: "Dzinēja bojājums", ru: "Повреждение двигателя", de: "Motorschaden" }],
  [["transmission damage", "transmission"], { en: "Transmission damage", lv: "Kārbas bojājums", ru: "Повреждение КПП", de: "Getriebeschaden" }],
  [["suspension", "suspension damage"], { en: "Suspension", lv: "Piekare", ru: "Подвеска", de: "Fahrwerk" }],
  [["storm damage", "storm"], { en: "Storm damage", lv: "Vētras bojājums", ru: "Повреждение бурей", de: "Sturmschaden" }],
  [["partial repair", "partially repaired"], { en: "Partial repair", lv: "Daļēji remontēts", ru: "Частичный ремонт", de: "Teilweise repariert" }],
  [["replaced vin", "vin replaced"], { en: "Replaced VIN", lv: "Nomainīts VIN", ru: "Заменён VIN", de: "VIN ersetzt" }],
  [["missing/altered vin", "missing vin", "altered vin"], { en: "Missing / altered VIN", lv: "Trūkst / mainīts VIN", ru: "VIN отсутствует / изменён", de: "VIN fehlt / verändert" }],
  [["damage history"], { en: "Damage history", lv: "Bojājumu vēsture", ru: "История повреждений", de: "Schadenshistorie" }],
  [["unknown", "unk"], { en: "Unknown", lv: "Nezināms", ru: "Неизвестно", de: "Unbekannt" }],
  [["none", "no damage"], { en: "None", lv: "Nav", ru: "Нет", de: "Keine" }],

  /* ---------- Izsoles statusi ---------- */
  [["sold"], { en: "Sold", lv: "Pārdots", ru: "Продан", de: "Verkauft" }],
  [["not sold", "unsold", "no sale"], { en: "Not sold", lv: "Nav pārdots", ru: "Не продан", de: "Nicht verkauft" }],
  [["on approval", "sold on approval"], { en: "On approval", lv: "Gaida pārdevēja apstiprinājumu", ru: "Ожидает одобрения продавца", de: "Wartet auf Verkäuferfreigabe" }],
  [["pure sale"], { en: "Pure sale", lv: "Pārdošana bez minimālās cenas", ru: "Продажа без минимальной цены", de: "Verkauf ohne Mindestpreis" }],
  [["buy now", "buy it now"], { en: "Buy now", lv: "Tūlītējs pirkums", ru: "Купить сейчас", de: "Sofortkauf" }],
  [["pending", "upcoming"], { en: "Pending", lv: "Gaida izsoli", ru: "Ожидает аукциона", de: "Auktion ausstehend" }],
  [["cancelled", "canceled"], { en: "Cancelled", lv: "Atcelts", ru: "Отменён", de: "Storniert" }],
  [["to be determined", "tbd"], { en: "To be determined", lv: "Nav noteikts", ru: "Не определено", de: "Noch offen" }],
  [["repaired"], { en: "Repaired", lv: "Remontēts", ru: "Отремонтирован", de: "Repariert" }],

  /* ---------- Stāvokļa / dokumentu zīmes ---------- */
  [["run and drive", "runs and drives", "run drive", "runs drives"], { en: "Run and drive", lv: "Iedarbojas un brauc", ru: "Заводится и едет", de: "Startet und fährt" }],
  [["starts", "engine starts", "engine start program", "starts only"], { en: "Starts", lv: "Iedarbojas", ru: "Заводится", de: "Startet" }],
  [["stationary", "does not start", "won't start", "wont start", "non runner"], { en: "Stationary", lv: "Neiedarbojas", ru: "Не заводится", de: "Nicht fahrbereit" }],
  [["salvage", "salvage title", "salvage certificate"], { en: "Salvage", lv: "Norakstīts (salvage)", ru: "Списан (salvage)", de: "Totalschaden (Salvage)" }],
  [["clean title"], { en: "Clean title", lv: "Tīrs īpašumtiesību dokuments", ru: "Чистый титул", de: "Sauberer Titel" }],
  [["rebuilt", "rebuilt title", "rebuildable"], { en: "Rebuilt", lv: "Atjaunots pēc norakstīšanas (rebuilt)", ru: "Восстановлен после списания (rebuilt)", de: "Wiederaufgebaut (Rebuilt)" }],
  [["parts only", "for parts only"], { en: "Parts only", lv: "Tikai detaļām", ru: "Только на запчасти", de: "Nur Ersatzteile" }],
  [["junk", "junk title"], { en: "Junk", lv: "Metāllūžņos (junk)", ru: "На металлолом (junk)", de: "Schrott (Junk)" }],
  [["certificate of destruction"], { en: "Certificate of destruction", lv: "Iznīcināšanas sertifikāts", ru: "Сертификат утилизации", de: "Verwertungsnachweis" }],
  [["total loss"], { en: "Total loss", lv: "Pilnīgs zaudējums (total loss)", ru: "Полная гибель (total loss)", de: "Totalschaden" }],
  [["keys available", "keys yes", "keys present", "key present", "with keys"], { en: "Keys available", lv: "Atslēgas ir", ru: "Ключи есть", de: "Schlüssel vorhanden" }],
  [["keys missing", "no keys", "keys no", "key missing", "without keys"], { en: "Keys missing", lv: "Atslēgu nav", ru: "Ключей нет", de: "Keine Schlüssel" }],
];

/** Mūsu koda / vecāku importu LV formas (parse-bidcars, damage-labels-lv), ko EN/RU/DE PDF arī tulko. */
const LV_ALIASES: Array<[string, string]> = [
  ["priekšpuse", "front end"],
  ["aizmugure", "rear end"],
  ["sāns", "side"],
  ["applūdis", "water/flood"],
  ["degšana", "fire"],
  ["vandalisms", "vandalism"],
  ["nelieli ieliekumi / skrāpējumi", "minor dent/scratches"],
  ["elektrība", "electrical"],
  ["nezināms", "unknown"],
  ["nav pārdots", "not sold"],
  ["pārdots", "sold"],
];

function normKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/:/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+-\s+|-/g, " ")
    .replace(/[:.]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const EN_INDEX = new Map<string, Entry>();
const LV_INDEX = new Map<string, Entry>();
for (const [keys, entry] of TERMS) {
  for (const k of keys) EN_INDEX.set(normKey(k), entry);
  EN_INDEX.set(normKey(entry.en), entry);
  LV_INDEX.set(normKey(entry.lv), entry);
}
for (const [lv, en] of LV_ALIASES) {
  const entry = EN_INDEX.get(normKey(en));
  if (entry) LV_INDEX.set(normKey(lv), entry);
}

const UNTRANSLATED_SUFFIX = /\s*\(oriģināls\)\s*$/i;

/** Viena termina tulkojums vai `null`, ja termins nav vārdnīcā. */
function translatePart(part: string, lang: ClientReportLang): string | null {
  const bare = part.replace(UNTRANSLATED_SUFFIX, "").trim();
  if (!bare) return null;
  const key = normKey(bare);
  const en = EN_INDEX.get(key);
  if (en) return lang === "en" ? bare : en[lang];
  const lv = LV_INDEX.get(key);
  if (lv) return lang === "lv" ? bare : lv[lang];
  // «Front End/Side» - abas daļas zināmas → «Priekšpuse / sāns».
  if (bare.includes("/")) {
    const sub = bare.split("/").map((s) => translatePart(s, lang));
    if (sub.every((s): s is string => s != null)) return sub.join(" / ");
  }
  return null;
}

function lowerFirst(s: string): string {
  // Saīsinājumus («VIN …», «PROVIN») neaiztiek.
  if (s.length > 1 && s.charAt(1) === s.charAt(1).toUpperCase() && s.charAt(1) !== s.charAt(1).toLowerCase()) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/**
 * «Front end + Unknown» → LV «Priekšpuse + nezināms», RU «Передняя часть + неизвестно», DE «Front + Unbekannt».
 * «2013 BMW 5 Series, 535I Xdrive · Sold» → LV «2013 BMW 5 Series, 535I Xdrive · Pārdots».
 * EN: avota teksts paliek. Nezināmas daļas paliek oriģinālā.
 */
export function translateAuctionTerms(text: string, lang: ClientReportLang | undefined = "lv"): string {
  const raw = text ?? "";
  if (!raw.trim()) return raw;
  const target: ClientReportLang = lang ?? "lv";
  // Atdalītāji paliek savās vietās (ar atstarpēm), tulko tikai daļas starp tiem.
  const tokens = raw.split(/(\s*(?:\+|,|;|·)\s*)/);
  let firstText = true;
  return tokens
    .map((tok, i) => {
      if (i % 2 === 1) return tok;
      if (!tok.trim()) return tok;
      const isFirst = firstText;
      firstText = false;
      const hit = translatePart(tok, target);
      if (hit == null) return tok;
      const lead = /^\s*/.exec(tok)![0];
      const trail = /\s*$/.exec(tok)![0];
      // LV/RU: daļas aiz atdalītāja ar mazo burtu (kā Nila piemērā «Priekšpuse + nezināms»); DE lietvārdi ar lielo.
      const prevSep = i > 0 ? tokens[i - 1]!.trim() : "";
      const cased = !isFirst && prevSep !== "·" && (target === "lv" || target === "ru") ? lowerFirst(hit) : hit;
      return `${lead}${cased}${trail}`;
    })
    .join("");
}
