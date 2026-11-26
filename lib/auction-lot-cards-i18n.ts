/**
 * Izsoļu kartīšu (klienta PDF «IZSOĻU PORTĀLU ARHĪVS», `auction-lot-cards-html.ts`) teksti EN/RU/DE.
 * 26.11 regresija: EN/RU/DE PDF palika «Izsoles Nr.», «1. izsole», «BCA izsole», «Izsoles laiks», «ZS».
 *
 * Tulko tikai mūsu koda etiķetes un fiksētās vērtības (pilnā sakritībā) un šablonus ar skaitļiem.
 * Avota brīvais teksts (pārdevējs, vieta, bojājumu apraksti) paliek kā ir - to tulko AI atlieku gājiens.
 * Tīrs modulis (bez client-report-html importiem).
 */
import type { ClientReportLang } from "@/lib/client-report-i18n";
import type { ArchiveFinding, ArchiveKv } from "@/lib/auction-archive-facts";

type Target = Exclude<ClientReportLang, "lv">;
type Tr = Record<Target, string>;
const t = (en: string, ru: string, de: string): Tr => ({ en, ru, de });

/** Kartīšu virsraksti un šūnu etiķetes (atslēga - LV teksts kodā). */
const CARD_TEXT: Record<string, Tr> = {
  "Izsoļu hronoloģija": t("Auction timeline", "Хронология аукционов", "Auktionschronologie"),
  "Galvenie fakti": t("Key facts", "Основные факты", "Wichtigste Fakten"),
  "Transportlīdzekļa dati": t("Vehicle data", "Данные автомобиля", "Fahrzeugdaten"),
  Aprīkojums: t("Equipment", "Комплектация", "Ausstattung"),
  "pēc izsoļu datiem": t("per auction data", "по данным аукционов", "laut Auktionsdaten"),
  Nobraukums: t("Mileage", "Пробег", "Laufleistung"),
  Bildes: t("Photos", "Фото", "Fotos"),
  nav: t("none", "нет", "keine"),
  Cena: t("Price", "Цена", "Preis"),
  "Izsoles Nr.": t("Lot no.", "№ лота", "Los-Nr."),
  "Datums nav zināms": t("Date unknown", "Дата неизвестна", "Datum unbekannt"),
  "Izsoles dati": t("Auction details", "Данные аукциона", "Auktionsdaten"),
  "Cenas (avota dati)": t("Prices (source data)", "Цены (данные источника)", "Preise (Quelldaten)"),
  "Stāvoklis un dokumenti": t("Condition and documents", "Состояние и документы", "Zustand und Dokumente"),
  "Bojājumi un defekti": t("Damage and defects", "Повреждения и дефекты", "Schäden und Mängel"),
  "Krāsas biezuma mērījumi": t("Paint thickness readings", "Замеры толщины ЛКП", "Lackschichtdicke-Messungen"),
  "Riepas un diski": t("Tyres and wheels", "Шины и диски", "Reifen und Felgen"),
  Bremzes: t("Brakes", "Тормоза", "Bremsen"),
  "Izsoles apraksts": t("Auction description", "Описание аукциона", "Auktionsbeschreibung"),
  "citi izsoļu avoti": t("other auction sources", "другие источники аукционов", "weitere Auktionsquellen"),
  "Redzams bildē": t("Visible in photo", "Видно на фото", "Auf Foto sichtbar"),
  "Redzams bildē (PROVIN atzīme)": t("Visible in photo (PROVIN mark)", "Видно на фото (отметка PROVIN)", "Auf Foto sichtbar (PROVIN-Markierung)"),
  Virsbūve: t("Body", "Кузов", "Karosserie"),
  Izsole: t("Auction", "Аукцион", "Auktion"),
  "(oriģināls)": t("(original)", "(оригинал)", "(Original)"),
  /* Atsevišķais «Izsoļu arhīva» PDF (`auction-archive-pdf-html.ts`). */
  "IZSOĻU ARHĪVS": t("AUCTION ARCHIVE", "АРХИВ АУКЦИОНОВ", "AUKTIONSARCHIV"),
  "Eiropas izsoļu arhīvs": t("European auction archive", "Европейский архив аукционов", "Europäisches Auktionsarchiv"),
  Izsoles: t("Auctions", "Аукционы", "Auktionen"),
  "Pēdējā izsole": t("Last auction", "Последний аукцион", "Letzte Auktion"),
  "Citi avoti": t("Other sources", "Другие источники", "Weitere Quellen"),
  "Ģenerēts": t("Generated", "Сформировано", "Erstellt"),
};

/** Faktu un transportlīdzekļa rindu etiķetes (`auction-archive-facts.ts`). */
const KV_LABEL: Record<string, Tr> = {
  "Izsoles laiks": t("Auction time", "Время аукциона", "Auktionszeit"),
  "Izsoles beigas": t("Auction end", "Окончание аукциона", "Auktionsende"),
  "Izsoles Nr.": CARD_TEXT["Izsoles Nr."]!,
  "Auto atrašanās vieta": t("Vehicle location", "Местонахождение авто", "Fahrzeugstandort"),
  Pārdevējs: t("Seller", "Продавец", "Verkäufer"),
  "Auto izcelsme": t("Vehicle origin", "Происхождение авто", "Fahrzeugherkunft"),
  "Pārdevēja atrašanās vieta": t("Seller location", "Местонахождение продавца", "Verkäuferstandort"),
  "Pārdevēja vērtējums": t("Seller rating", "Рейтинг продавца", "Verkäuferbewertung"),
  "Auto atbilst aprakstam (pircēju vērtējums)": t(
    "Vehicle as described (buyer rating)",
    "Авто соответствует описанию (оценка покупателей)",
    "Fahrzeug wie beschrieben (Käuferbewertung)",
  ),
  "Piegādes laiks pēc izsoles": t("Delivery time after auction", "Срок доставки после аукциона", "Lieferzeit nach Auktion"),
  "Pirmoreiz fiksēts arhīvā": t("First recorded in archive", "Впервые зафиксировано в архиве", "Erstmals im Archiv erfasst"),
  "Pēdējoreiz redzēts portālā": t("Last seen on portal", "Последний раз на портале", "Zuletzt im Portal gesehen"),
  "Skatījumi izsolē": t("Auction views", "Просмотры на аукционе", "Aufrufe in der Auktion"),
  Atslēgas: t("Keys", "Ключи", "Schlüssel"),
  "Auto brauc": t("Vehicle drives", "Авто на ходу", "Fahrzeug fährt"),
  "Virsbūves stāvoklis (izsoles vērtējums)": t("Body condition (auction rating)", "Состояние кузова (оценка аукциона)", "Karosseriezustand (Auktionsbewertung)"),
  "Bojājumi izsoles datos": t("Damage in auction data", "Повреждения в данных аукциона", "Schäden in Auktionsdaten"),
  "Galvenais bojājums": t("Primary damage", "Основное повреждение", "Hauptschaden"),
  "Papildu bojājums": t("Secondary damage", "Дополнительное повреждение", "Zusätzlicher Schaden"),
  "Iedarbojas un brauc": t("Starts and drives", "Заводится и едет", "Startet und fährt"),
  "Dokumentu statuss (izsoles dati)": t("Title status (auction data)", "Статус документов (данные аукциона)", "Dokumentenstatus (Auktionsdaten)"),
  "Tehniskas problēmas": t("Technical issues", "Технические проблемы", "Technische Probleme"),
  "Stāvokļa vērtējums (izsoles skala)": t("Condition grade (auction scale)", "Оценка состояния (шкала аукциона)", "Zustandsnote (Auktionsskala)"),
  "Negadījumi (pārdevēja dati)": t("Accidents (seller data)", "ДТП (данные продавца)", "Unfälle (Verkäuferangaben)"),
  "Nesmēķētāja auto": t("Non-smoker vehicle", "Авто некурящего", "Nichtraucherfahrzeug"),
  "Otrs riepu komplekts": t("Second set of tyres", "Второй комплект шин", "Zweiter Reifensatz"),
  "Servisa vēsture izsolē": t("Service history at auction", "История обслуживания на аукционе", "Servicehistorie in der Auktion"),
  "Pēdējais serviss": t("Last service", "Последнее ТО", "Letzter Service"),
  "Tehniskās apskates termiņš": t("Inspection due", "Срок техосмотра", "HU fällig"),
  "Nobraukuma garantija": t("Mileage guarantee", "Гарантия пробега", "Kilometerstand-Garantie"),
  "Tehniski bojājumi": t("Technical damage", "Технические повреждения", "Technische Schäden"),
  "Nav braucams": t("Not driveable", "Не на ходу", "Nicht fahrbereit"),
  "Ievests no citas valsts": t("Imported from another country", "Ввезено из другой страны", "Aus einem anderen Land eingeführt"),
  "Reģistrācijas dokumenti": t("Registration documents", "Регистрационные документы", "Zulassungsdokumente"),
  "COC atbilstības sertifikāts": t("COC certificate of conformity", "Сертификат соответствия COC", "COC-Konformitätsbescheinigung"),
  "Dokumenti tiek nodoti kopā ar auto": t("Documents handed over with the car", "Документы передаются вместе с авто", "Dokumente werden mit dem Fahrzeug übergeben"),
  "Pārbaudes atskaites": t("Inspection reports", "Отчёты о проверке", "Prüfberichte"),
  Cena: CARD_TEXT.Cena!,
  "Sākuma cena": t("Starting price", "Стартовая цена", "Startpreis"),
  "Minimālā (rezerves) cena": t("Reserve price", "Резервная цена", "Mindestpreis"),
  "Pēdējais solījums": t("Last bid", "Последняя ставка", "Letztes Gebot"),
  "Noslēguma cena": t("Final price", "Итоговая цена", "Endpreis"),
  "Portāla publiskā cena": t("Portal public price", "Публичная цена портала", "Öffentlicher Portalpreis"),
  "Portāla aplēstā vērtība (nav pirkšanas cena)": t(
    "Portal estimated value (not a purchase price)",
    "Оценочная стоимость портала (не цена покупки)",
    "Geschätzter Portalwert (kein Kaufpreis)",
  ),
  "Pircēja komisija": t("Buyer fee", "Комиссия покупателя", "Käufergebühr"),
  "Eksporta maksa": t("Export fee", "Экспортный сбор", "Exportgebühr"),
  PVN: t("VAT", "НДС", "MwSt."),
  "Pirmā reģistrācija": t("First registration", "Первая регистрация", "Erstzulassung"),
  Ražots: t("Manufactured", "Произведено", "Hergestellt"),
  Virsbūve: CARD_TEXT.Virsbūve!,
  Durvis: t("Doors", "Двери", "Türen"),
  Sēdvietas: t("Seats", "Места", "Sitzplätze"),
  Dzinējs: t("Engine", "Двигатель", "Motor"),
  Jauda: t("Power", "Мощность", "Leistung"),
  Ātrumkārba: t("Gearbox", "Коробка передач", "Getriebe"),
  Piedziņa: t("Drive", "Привод", "Antrieb"),
  Krāsa: t("Colour", "Цвет", "Farbe"),
  "CO₂ izmeši": t("CO₂ emissions", "Выбросы CO₂", "CO₂-Emissionen"),
  "Emisiju standarts": t("Emission standard", "Экологический стандарт", "Abgasnorm"),
  Stūre: t("Steering", "Руль", "Lenkung"),
  "Reģistrācijas valsts": t("Country of registration", "Страна регистрации", "Zulassungsland"),
};

/** Fiksētās vērtības (pilnā sakritībā). */
const KV_VALUE: Record<string, Tr> = {
  Jā: t("Yes", "Да", "Ja"),
  Nē: t("No", "Нет", "Nein"),
  Ir: t("Yes", "Есть", "Vorhanden"),
  Nav: t("No", "Нет", "Nicht vorhanden"),
  Bija: t("Yes", "Были", "Ja"),
  Norādīti: t("Stated", "Указаны", "Angegeben"),
  "Nav norādīti": t("Not stated", "Не указаны", "Nicht angegeben"),
  Norādītas: t("Stated", "Указаны", "Angegeben"),
  "Nav norādītas": t("Not stated", "Не указаны", "Nicht angegeben"),
  "Nav datu": t("No data", "Нет данных", "Keine Daten"),
  "Kreisajā pusē": t("Left-hand", "Слева", "Links"),
  "Labajā pusē": t("Right-hand", "Справа", "Rechts"),
  Pilnpiedziņa: t("All-wheel drive", "Полный привод", "Allradantrieb"),
  "Viena ass (nav pilnpiedziņas)": t("Single axle (not all-wheel drive)", "Одна ось (не полный привод)", "Eine Achse (kein Allrad)"),
  Normāls: t("Normal", "Нормальное", "Normal"),
  Labs: t("Good", "Хорошее", "Gut"),
  Bojāts: t("Damaged", "Повреждён", "Beschädigt"),
  "Smagi bojāts": t("Heavily damaged", "Сильно повреждён", "Schwer beschädigt"),
  "Jā (pārdevējs apliecina)": t("Yes (confirmed by seller)", "Да (подтверждает продавец)", "Ja (vom Verkäufer bestätigt)"),
  "Ir (pēc izsoles datiem)": t("Yes (per auction data)", "Есть (по данным аукциона)", "Ja (laut Auktionsdaten)"),
  "Jā (pēc izsoles datiem)": t("Yes (per auction data)", "Да (по данным аукциона)", "Ja (laut Auktionsdaten)"),
  "Peļņas daļas režīms (nav atskaitāms)": t("Margin scheme (not deductible)", "Режим маржи (не вычитается)", "Differenzbesteuerung (nicht abziehbar)"),
  "Nav norādīta": t("Not stated", "Не указана", "Nicht angegeben"),
  "Ir, servisa grāmata ir": t("Yes, service book present", "Есть, есть сервисная книжка", "Vorhanden, Serviceheft vorhanden"),
};

const HP_UNIT: Tr = t("HP", "л.с.", "PS");
const VAT: Tr = t("VAT", "НДС", "MwSt.");

function isTarget(lang: ClientReportLang | undefined): lang is Target {
  return lang === "en" || lang === "ru" || lang === "de";
}

/** Kartītes literālis; nezināms - LV. */
export function auctionCardText(lv: string, lang: ClientReportLang | undefined): string {
  if (!isTarget(lang)) return lv;
  return CARD_TEXT[lv]?.[lang] ?? lv;
}

/** «2. izsole» / «Auction 2» / «Аукцион 2» / «2. Auktion». */
export function auctionCardOrdinal(n: number, lang: ClientReportLang | undefined): string {
  if (lang === "en") return `Auction ${n}`;
  if (lang === "ru") return `Аукцион ${n}`;
  if (lang === "de") return `${n}. Auktion`;
  return `${n}. izsole`;
}

/** «BCA izsole» / «BCA auction» / «Аукцион BCA» / «BCA-Auktion». */
export function auctionCardPlatformTitle(platform: string, lang: ClientReportLang | undefined): string {
  if (lang === "en") return `${platform} auction`;
  if (lang === "ru") return `Аукцион ${platform}`;
  if (lang === "de") return `${platform}-Auktion`;
  return `${platform} izsole`;
}

type CountWord = "bilde" | "bojājums" | "mērījums" | "bojāj." | "izsole";

function ruPlural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

/** Skaits ar vārdu atskaites valodā (LV - kā `lvCount`). */
export function auctionCardCount(n: number, word: CountWord, lang: ClientReportLang | undefined): string {
  const lvOne = n % 10 === 1 && n % 100 !== 11;
  switch (word) {
    case "bilde":
      if (lang === "en") return `${n} ${n === 1 ? "photo" : "photos"}`;
      if (lang === "ru") return `${n} ${ruPlural(n, "фото", "фото", "фото")}`;
      if (lang === "de") return `${n} ${n === 1 ? "Foto" : "Fotos"}`;
      return `${n} ${lvOne ? "bilde" : "bildes"}`;
    case "bojājums":
      if (lang === "en") return `${n} ${n === 1 ? "damage" : "damages"}`;
      if (lang === "ru") return `${n} ${ruPlural(n, "повреждение", "повреждения", "повреждений")}`;
      if (lang === "de") return `${n} ${n === 1 ? "Schaden" : "Schäden"}`;
      return `${n} ${lvOne ? "bojājums" : "bojājumi"}`;
    case "mērījums":
      if (lang === "en") return `${n} ${n === 1 ? "reading" : "readings"}`;
      if (lang === "ru") return `${n} ${ruPlural(n, "замер", "замера", "замеров")}`;
      if (lang === "de") return `${n} ${n === 1 ? "Messung" : "Messungen"}`;
      return `${n} ${lvOne ? "mērījums" : "mērījumi"}`;
    case "izsole":
      if (lang === "en") return `${n} ${n === 1 ? "auction" : "auctions"}`;
      if (lang === "ru") return `${n} ${ruPlural(n, "аукцион", "аукциона", "аукционов")}`;
      if (lang === "de") return `${n} ${n === 1 ? "Auktion" : "Auktionen"}`;
      return `${n} ${lvOne ? "izsole" : "izsoles"}`;
    case "bojāj.":
      if (lang === "en") return `${n} dmg.`;
      if (lang === "ru") return `${n} повр.`;
      if (lang === "de") return `${n} Sch.`;
      return `${n} bojāj.`;
  }
}

/** Atsevišķā arhīva PDF beigu piezīme (avoti, cenas, PROVIN atzīmes) atskaites valodā. */
export function auctionArchivePdfNote(opts: { showPrices: boolean; marks: boolean }, lang: ClientReportLang | undefined): string {
  if (lang === "en") {
    return `Data from the European auction portal archive on the auction day. Photos, ${opts.showPrices ? "prices, " : ""}mileage and descriptions are source data; translation and summary - PROVIN.${
      opts.marks ? " «Visible in photo» - PROVIN mark based on the photo." : ""
    }`;
  }
  if (lang === "ru") {
    return `Данные из архива европейских аукционных порталов на день аукциона. Фото, ${opts.showPrices ? "цены, " : ""}пробег и описания - данные источника; перевод и сводка - PROVIN.${
      opts.marks ? " «Видно на фото» - отметка PROVIN по фото." : ""
    }`;
  }
  if (lang === "de") {
    return `Daten aus dem Archiv europäischer Auktionsportale am Auktionstag. Fotos, ${opts.showPrices ? "Preise, " : ""}Laufleistung und Beschreibungen sind Quelldaten; Übersetzung und Zusammenfassung - PROVIN.${
      opts.marks ? " «Auf Foto sichtbar» - PROVIN-Markierung nach Foto." : ""
    }`;
  }
  return `Dati no Eiropas izsoļu portālu arhīva izsoles dienā. Bildes, ${opts.showPrices ? "cenas, " : ""}nobraukums un apraksti ir avota dati; tulkojums un apkopojums - PROVIN.${
    opts.marks ? " «Redzams bildē» - PROVIN atzīme pēc bildes." : ""
  }`;
}

/** «2 gab.» → «2 pcs» / «2 шт.» / «2 Stk.». */
export function auctionCardPieces(n: string, lang: ClientReportLang | undefined): string {
  if (lang === "en") return `${n} pcs`;
  if (lang === "ru") return `${n} шт.`;
  if (lang === "de") return `${n} Stk.`;
  return `${n} gab.`;
}

/** Vērtība: fiksēta frāze vai šablons ar skaitļiem; citādi - nemainīta (AI gājienam). */
export function translateAuctionKvValue(v: string, lang: ClientReportLang | undefined): string {
  if (!isTarget(lang)) return v;
  const exact = KV_VALUE[v.trim()];
  if (exact) return exact[lang];
  let out = v;
  // Jauda: «110 kW (150 ZS)», «150 ZS».
  out = out.replace(/(\d[\d\s ]*) ZS(?![\p{L}])/gu, (_, n: string) => `${n} ${HP_UNIT[lang]}`);
  // «4,5 no 5».
  out = out.replace(/^(\d+(?:[.,]\d+)?) no (\d+)$/, (_, a: string, b: string) =>
    lang === "en" ? `${a} of ${b}` : lang === "ru" ? `${a} из ${b}` : `${a} von ${b}`,
  );
  // «3-5 dienas».
  out = out.replace(/^(\d+(?:-\d+)?) dienas$/, (_, d: string) => (lang === "en" ? `${d} days` : lang === "ru" ? `${d} дн.` : `${d} Tage`));
  // «350 € + PVN».
  out = out.replace(/ \+ PVN$/, ` + ${VAT[lang]}`);
  // «Atskaitāms (19 %)».
  out = out.replace(/^Atskaitāms(.*)$/, (_, rest: string) =>
    (lang === "en" ? "Deductible" : lang === "ru" ? "Вычитается" : "Abziehbar") + rest,
  );
  return out;
}

export function translateAuctionKvLabel(k: string, lang: ClientReportLang | undefined): string {
  if (!isTarget(lang)) return k;
  return KV_LABEL[k]?.[lang] ?? k;
}

/** Faktu / transportlīdzekļa rindas atskaites valodā. LV - tās pašas rindas. */
export function translateAuctionKvRows(rows: readonly ArchiveKv[], lang: ClientReportLang | undefined): ArchiveKv[] {
  if (!isTarget(lang)) return [...rows];
  return rows.map((r) => ({ ...r, k: translateAuctionKvLabel(r.k, lang), v: translateAuctionKvValue(r.v, lang) }));
}

type FindingRule = { re: RegExp; to: (m: RegExpExecArray, lang: Target) => string };

const FINDING_RULES: FindingRule[] = [
  {
    re: /^Nobraukums visās izsolēs vienāds - (.+) km\.$/,
    to: (m, l) =>
      l === "en" ? `Mileage identical in all auctions - ${m[1]} km.` : l === "ru" ? `Пробег во всех аукционах одинаковый - ${m[1]} км.` : `Laufleistung in allen Auktionen gleich - ${m[1]} km.`,
  },
  {
    re: /^Nobraukums vēlākā izsolē ir MAZĀKS nekā agrākā \((.+)\)\.$/,
    to: (m, l) =>
      l === "en"
        ? `Mileage at a later auction is LOWER than at an earlier one (${m[1]}).`
        : l === "ru"
          ? `Пробег на более позднем аукционе МЕНЬШЕ, чем на более раннем (${m[1].replace(/ km/g, " км")}).`
          : `Laufleistung in einer späteren Auktion ist NIEDRIGER als in einer früheren (${m[1]}).`,
  },
  {
    re: /^Nobraukums pieaug hronoloģiski: (.+)\.$/,
    to: (m, l) =>
      l === "en"
        ? `Mileage increases chronologically: ${m[1]}.`
        : l === "ru"
          ? `Пробег растёт хронологически: ${m[1].replace(/ km/g, " км")}.`
          : `Laufleistung steigt chronologisch: ${m[1]}.`,
  },
  {
    re: /^Nobraukums izsolē \((.+), (\d{2}\.\d{2}\.\d{4})\): (.+) km\.$/,
    to: (m, l) =>
      l === "en"
        ? `Mileage at auction (${m[1]}, ${m[2]}): ${m[3]} km.`
        : l === "ru"
          ? `Пробег на аукционе (${m[1]}, ${m[2]}): ${m[3]} км.`
          : `Laufleistung in der Auktion (${m[1]}, ${m[2]}): ${m[3]} km.`,
  },
  {
    re: /^(\S+) auto vienlaikus piedāvāts (\d+) izsoļu portālos \((.+)\)\.$/,
    to: (m, l) =>
      l === "en"
        ? `${m[1]} the car was offered on ${m[2]} auction portals at the same time (${m[3]}).`
        : l === "ru"
          ? `${m[1]} авто одновременно предлагалось на ${m[2]} аукционных порталах (${m[3]}).`
          : `${m[1]} wurde das Fahrzeug gleichzeitig auf ${m[2]} Auktionsportalen angeboten (${m[3]}).`,
  },
  {
    re: /^Atslēgu skaits izsolēs atšķiras: (.+)\.$/,
    to: (m, l) =>
      l === "en" ? `Number of keys differs between auctions: ${m[1]}.` : l === "ru" ? `Количество ключей на аукционах различается: ${m[1]}.` : `Schlüsselanzahl unterscheidet sich zwischen Auktionen: ${m[1]}.`,
  },
  {
    re: /^Izsolēs norādīts 1 bojājums\.$/,
    to: (_m, l) => (l === "en" ? "Auctions list 1 damage." : l === "ru" ? "На аукционах указано 1 повреждение." : "In den Auktionen ist 1 Schaden angegeben."),
  },
  {
    re: /^Izsolēs norādīti (\d+) bojājumi\.$/,
    to: (m, l) =>
      l === "en"
        ? `Auctions list ${m[1]} damages.`
        : l === "ru"
          ? `На аукционах указано ${auctionCardCount(Number(m[1]), "bojājums", "ru")}.`
          : `In den Auktionen sind ${m[1]} Schäden angegeben.`,
  },
  {
    re: /^Izsolēs bojājumi nav norādīti\.$/,
    to: (_m, l) => (l === "en" ? "No damage listed in the auctions." : l === "ru" ? "На аукционах повреждения не указаны." : "In den Auktionen sind keine Schäden angegeben."),
  },
  {
    re: /^Pēdējais serviss \((.+) dati\) (.+) km pirms izsoles\.$/,
    to: (m, l) =>
      l === "en"
        ? `Last service (${m[1]} data) ${m[2]} km before the auction.`
        : l === "ru"
          ? `Последнее ТО (данные ${m[1]}) за ${m[2]} км до аукциона.`
          : `Letzter Service (${m[1]}-Daten) ${m[2]} km vor der Auktion.`,
  },
];

/** Galveno faktu teikumi (mūsu šabloni) atskaites valodā; nezināms teikums paliek LV (AI gājienam). */
export function translateAuctionFindings(list: readonly ArchiveFinding[], lang: ClientReportLang | undefined): ArchiveFinding[] {
  if (!isTarget(lang)) return [...list];
  return list.map((f) => {
    for (const r of FINDING_RULES) {
      const m = r.re.exec(f.text);
      if (m) return { ...f, text: r.to(m, lang) };
    }
    return f;
  });
}
