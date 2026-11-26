/**
 * Klienta PDF (EN/RU/DE) - galīgais gājiens pāri teksta mezgliem pēc statiskās vārdnīcas un
 * `client-report-dynamic-i18n` frāzēm. Tulko latviešu terminus, ko ģenerē mūsu pašu kods no
 * strukturētiem datiem: 6a / kopsavilkuma kartīšu vērtības («3 ieraksti», «Nav ierakstu»), CSDD
 * lauki un vērtības, TA vērtējumi, CARFAX bloka etiķetes, bojājumu zonas, LTAB izziņa, eļļas intervāli.
 *
 * Teksta mezgls tiek sadalīts pa atdalītājiem (« · », «; », «, », «: ») un tulkots tikai tas
 * gabals, kas PILNĪBĀ sakrīt ar zināmu terminu vai šablonu - nezināms teksts (avotu oriģināli,
 * nosaukumi) paliek kā ir. CSDD TA defektu kataloga teikumi - `csdd-ta-defects-i18n`; nezināmi
 * defektu teksti paliek AI atlieku gājienam (`translateClientReportHtmlResidue`). 25.11.2026: EN/RU/DE PDF palika «3 ieraksti», «Nav ierakstu».
 */
import type { ClientReportLang } from "@/lib/client-report-i18n";
import { ISO2_TO_LV_NAME } from "@/lib/country-names-lv";
import { translateCsddTaDefectText } from "@/lib/csdd-ta-defects-i18n";

type Target = Exclude<ClientReportLang, "lv">;
type Tr = Record<Target, string>;

const t = (en: string, ru: string, de: string): Tr => ({ en, ru, de });

/** Precīzi termini (gabals pēc sadalīšanas). Atslēga - kā to raksta kods; reģistrs tiek pieskaņots. */
const TERMS: Record<string, Tr> = {
  // Kopsavilkuma / 6a kartītes
  "Nav ierakstu": t("No records", "Нет записей", "Keine Einträge"),
  "Nav datu": t("No data", "Нет данных", "Keine Daten"),
  Nav: t("None", "Нет", "Keine"),
  "Apkopju ieraksti nav atrasti": t("No maintenance records found", "Записи о ТО не найдены", "Keine Wartungseinträge gefunden"),
  "Odometra ieraksti nav atrasti": t("No odometer records found", "Записи одометра не найдены", "Keine Kilometerstand-Einträge gefunden"),
  "Ražotāja, dīlera un citu avotu apkopes": t(
    "Maintenance from manufacturer, dealer and other sources",
    "ТО по данным производителя, дилера и других источников",
    "Wartungen laut Hersteller, Händler und anderen Quellen",
  ),
  "Bez neatbilstībām": t("No discrepancies", "Без расхождений", "Ohne Abweichungen"),
  "Pilnīgs zaudējums": t("Total loss", "Полная гибель", "Totalschaden"),
  "Avotos fiksēts pilnīgs zaudējums": t("Total loss recorded in sources", "В источниках зафиксирована полная гибель", "Totalschaden in Quellen erfasst"),
  "Avotos nav fiksētu negadījumu": t("No incidents recorded in sources", "В источниках нет зафиксированных ДТП", "Keine Unfälle in Quellen erfasst"),
  "Izsoļu / reģistru bojājumi bez summas": t(
    "Auction / registry damage without amount",
    "Повреждения из аукционов / реестров без суммы",
    "Auktions- / Registerschäden ohne Betrag",
  ),
  "LTAB: negadījumi nav reģistrēti": t("LTAB: no incidents registered", "LTAB: ДТП не зарегистрированы", "LTAB: keine Unfälle registriert"),
  "LTAB: OCTA negadījumu nav": t("LTAB: no MTPL claims", "LTAB: страховых случаев ОСАГО нет", "LTAB: keine Haftpflichtschäden"),
  "Skaits nav fiksēts": t("Count not recorded", "Количество не зафиксировано", "Anzahl nicht erfasst"),
  "CSDD ir reģistrācijas ieraksti, bet īpašnieku skaits nav norādīts": t(
    "CSDD has registration records, but the number of owners is not stated",
    "В CSDD есть записи о регистрации, но число владельцев не указано",
    "CSDD enthält Zulassungseinträge, die Halteranzahl ist jedoch nicht angegeben",
  ),
  "Nav LV reģistra": t("Not in LV register", "Нет в реестре LV", "Nicht im LV-Register"),
  "Auto nav reģistrēts Latvijā; ārvalstu īpašnieku skaits avotos nav norādīts": t(
    "The car is not registered in Latvia; the number of foreign owners is not stated in sources",
    "Авто не зарегистрировано в Латвии; число зарубежных владельцев в источниках не указано",
    "Das Fahrzeug ist nicht in Lettland zugelassen; die Anzahl ausländischer Halter ist in den Quellen nicht angegeben",
  ),
  "Avotos nav fiksēta īpašnieku skaita": t("No owner count recorded in sources", "В источниках число владельцев не зафиксировано", "Keine Halteranzahl in Quellen erfasst"),
  "Nav atrastas": t("None found", "Не найдены", "Keine gefunden"),

  // Laikjosla / nobraukums
  "Odometra ieraksts": t("Odometer record", "Запись одометра", "Kilometerstand-Eintrag"),
  "Iespējama odometra pretruna": t("Possible odometer discrepancy", "Возможное расхождение одометра", "Mögliche Kilometerstand-Abweichung"),
  "Sludinājumā norādīts mazāks nobraukums": t(
    "Listing states lower mileage",
    "В объявлении указан меньший пробег",
    "Inserat nennt geringere Laufleistung",
  ),
  "Odometra anomālija": t("Odometer anomaly", "Аномалия одометра", "Kilometerstand-Anomalie"),
  Pārdots: t("Sold", "Продано", "Verkauft"),
  "Nav pārdots": t("Not sold", "Не продано", "Nicht verkauft"),
  "Izsole noslēgusies": t("Auction closed", "Аукцион завершён", "Auktion beendet"),

  // CSDD lauki (vērtības)
  "Transportlīdzekļa veids": t("Vehicle type", "Тип транспортного средства", "Fahrzeugart"),
  "Izlaiduma gads": t("Year of manufacture", "Год выпуска", "Baujahr"),
  "OCTA polise derīga līdz": t("MTPL policy valid until", "Полис ОСАГО действует до", "Haftpflichtpolice gültig bis"),
  "Sēdvietu skaits": t("Number of seats", "Количество мест", "Sitzplätze"),
  "Reģistrācijas numurs": t("Registration number", "Регистрационный номер", "Kennzeichen"),
  "Pirmā reģistrācija": t("First registration", "Первая регистрация", "Erstzulassung"),
  "Pirmā reģistrācija Latvijā": t("First registration in Latvia", "Первая регистрация в Латвии", "Erstzulassung in Lettland"),
  "Nākamās apskates datums": t("Next inspection date", "Дата следующего техосмотра", "Nächster HU-Termin"),
  "Iepriekšējās apskates datums": t("Previous inspection date", "Дата предыдущего техосмотра", "Vorheriger HU-Termin"),
  "Kategorija (COC)": t("Category (COC)", "Категория (COC)", "Klasse (COC)"),
  "Tips (COC)": t("Type (COC)", "Тип (COC)", "Typ (COC)"),
  "Tipa apstiprinājuma numurs": t("Type approval number", "Номер одобрения типа", "Typgenehmigungsnummer"),
  "Variants (COC)": t("Variant (COC)", "Вариант (COC)", "Variante (COC)"),
  "Versija (COC)": t("Version (COC)", "Версия (COC)", "Version (COC)"),
  "Emisiju standarts": t("Emission standard", "Экологический стандарт", "Abgasnorm"),
  "Pilna masa (kg)": t("Gross weight (kg)", "Полная масса (кг)", "Zulässiges Gesamtgewicht (kg)"),
  "Pašmasa (kg)": t("Curb weight (kg)", "Снаряжённая масса (кг)", "Leergewicht (kg)"),
  "Ekspluatācijas nodoklis (EUR)": t("Vehicle operation tax (EUR)", "Налог на эксплуатацию (EUR)", "Kfz-Betriebssteuer (EUR)"),
  "Atgāzu cietās daļiņas": t("Exhaust particulate matter", "Твёрдые частицы в выхлопе", "Partikel im Abgas"),
  "Iepriekšējās reģistrācijas valsts": t("Country of previous registration", "Страна предыдущей регистрации", "Land der vorherigen Zulassung"),
  "Īpašnieku skaits Latvijā": t("Number of owners in Latvia", "Число владельцев в Латвии", "Halteranzahl in Lettland"),
  "Motora maksimālā jauda (kW)": t("Max engine power (kW)", "Макс. мощность двигателя (кВт)", "Max. Motorleistung (kW)"),
  "Elektromotora jauda (kW)": t("Electric motor power (kW)", "Мощность электромотора (кВт)", "Elektromotorleistung (kW)"),
  "Otrā elektromotora jauda (kW)": t("Second electric motor power (kW)", "Мощность второго электромотора (кВт)", "Leistung des zweiten Elektromotors (kW)"),
  "Vieglais pasažieru": t("Passenger car", "Легковой пассажирский", "Pkw"),
  "Vieglais plašlietojuma": t("Light multi-purpose vehicle", "Легковой универсального назначения", "Mehrzweck-Pkw"),
  "Kravas": t("Goods vehicle", "Грузовой", "Lkw"),
  Uzskaitē: t("Registered", "На учёте", "Zugelassen"),
  Reģistrēts: t("Registered", "Зарегистрирован", "Zugelassen"),
  "Noņemts no uzskaites": t("Deregistered", "Снят с учёта", "Abgemeldet"),
  "Īslaicīgi noņemts no uzskaites": t("Temporarily deregistered", "Временно снят с учёта", "Vorübergehend abgemeldet"),
  Dīzeļdegviela: t("Diesel", "Дизельное топливо", "Diesel"),
  Dīzelis: t("Diesel", "Дизель", "Diesel"),
  Benzīns: t("Petrol", "Бензин", "Benzin"),
  Elektroenerģija: t("Electricity", "Электроэнергия", "Elektrizität"),
  "Benzīns/gāze": t("Petrol/gas", "Бензин/газ", "Benzin/Gas"),

  // Dzīves laikjosla / izsoļu statuss (26.11: EN/RU/DE PDF palika «Izsole · Autobid»)
  Izsole: t("Auction", "Аукцион", "Auktion"),
  "Pārdošanas ieraksts": t("Sale record", "Запись о продаже", "Verkaufseintrag"),

  // CSDD tehniskā apskate
  pamatpārbaude: t("periodic inspection", "основной осмотр", "Hauptuntersuchung"),
  "atkārtota pārbaude": t("re-inspection", "повторный осмотр", "Nachprüfung"),
  atkārtota: t("re-inspection", "повторный", "Nachprüfung"),
  Novērtējums: t("Rating", "Оценка", "Bewertung"),
  "Trūkumi vai bojājumi": t("Defects or damage", "Недостатки или повреждения", "Mängel oder Schäden"),
  "Nav reģistrētu trūkumu vai bojājumu": t("No defects or damage recorded", "Недостатки или повреждения не зарегистрированы", "Keine Mängel oder Schäden erfasst"),
  "0 - Teicamā tehniskā stāvoklī": t("0 - Excellent technical condition", "0 - Отличное техническое состояние", "0 - Ausgezeichneter technischer Zustand"),
  "1 - Ar pieļaujamiem defektiem": t("1 - With acceptable defects", "1 - С допустимыми дефектами", "1 - Mit zulässigen Mängeln"),
  "2 - Ar mēneša laikā labojamiem defektiem": t(
    "2 - With defects to be fixed within a month",
    "2 - С дефектами, устраняемыми в течение месяца",
    "2 - Mit innerhalb eines Monats zu behebenden Mängeln",
  ),
  "3 - Braukšanai nederīgā stāvoklī": t("3 - Unroadworthy condition", "3 - Непригоден для движения", "3 - Nicht verkehrssicherer Zustand"),

  // AutoDNA «Iepriekšējie meklējumi»
  "Iepriekšējie meklējumi": t("Previous searches", "Предыдущие запросы", "Frühere Abfragen"),
  "Pakalpojuma veids": t("Service type", "Тип услуги", "Dienstart"),
  "Atrašanās vieta": t("Location", "Местоположение", "Standort"),
  "Datums un laiks": t("Date and time", "Дата и время", "Datum und Uhrzeit"),

  // CARFAX bloks
  "Ātrā pārbaude": t("Quick check", "Быстрая проверка", "Schnellprüfung"),
  Bojājumi: t("Damage", "Повреждения", "Schäden"),
  Vēsture: t("History", "История", "Historie"),
  "Īpašnieki un piezīmes": t("Owners and notes", "Владельцы и примечания", "Halter und Hinweise"),
  "CARFAX bojājumus nav saņēmis": t("CARFAX has not received any damage reports", "CARFAX не получал данных о повреждениях", "CARFAX liegen keine Schadensmeldungen vor"),
  Nobraukums: t("Mileage", "Пробег", "Laufleistung"),
  Zādzība: t("Theft", "Угон", "Diebstahl"),
  Norakstīšana: t("Scrapping", "Списание", "Verschrottung"),
  Imports: t("Import", "Импорт", "Import"),
  Taksometrs: t("Taxi", "Такси", "Taxi"),
  Atsaukumi: t("Recalls", "Отзывные кампании", "Rückrufe"),
  "Apgrūtinājumi (ACI)": t("Encumbrances (ACI)", "Обременения (ACI)", "Belastungen (ACI)"),
  "Ķīla (ACI)": t("Lien (ACI)", "Залог (ACI)", "Pfandrecht (ACI)"),
  Komerclietošana: t("Commercial use", "Коммерческое использование", "Gewerbliche Nutzung"),
  Noma: t("Rental", "Аренда", "Vermietung"),
  Policija: t("Police", "Полиция", "Polizei"),
  Eksports: t("Export", "Экспорт", "Export"),
  "Odometra rādījumi pieaug loģiski": t("Odometer readings increase logically", "Показания одометра растут логично", "Kilometerstände steigen plausibel"),
  "Nav odometra manipulāciju pazīmju": t("No signs of odometer manipulation", "Нет признаков манипуляций с одометром", "Keine Anzeichen von Tachomanipulation"),
  "Nav ziņots par zādzību": t("Not reported stolen", "Об угоне не сообщалось", "Nicht als gestohlen gemeldet"),
  "Ziņots par zādzību": t("Reported stolen", "Сообщено об угоне", "Als gestohlen gemeldet"),
  "Nav ziņots par norakstīšanu": t("Not reported scrapped", "О списании не сообщалось", "Nicht als verschrottet gemeldet"),
  "Ziņots par norakstīšanu": t("Reported scrapped", "Сообщено о списании", "Als verschrottet gemeldet"),
  "Nav privāts imports": t("Not a private import", "Не частный импорт", "Kein Privatimport"),
  "Privāts imports": t("Private import", "Частный импорт", "Privatimport"),
  "Nav lietots kā taksometrs": t("Not used as taxi", "Не использовался как такси", "Nicht als Taxi genutzt"),
  "Lietots kā taksometrs": t("Used as taxi", "Использовался как такси", "Als Taxi genutzt"),
  "Atsaukumu nav": t("No recalls", "Отзывных кампаний нет", "Keine Rückrufe"),
  "Bojājumi nav ziņoti": t("No damage reported", "О повреждениях не сообщалось", "Keine Schäden gemeldet"),
  "Ziņots par pilnīgu bojāeju (total loss)": t("Total loss reported", "Сообщено о полной гибели (total loss)", "Totalschaden gemeldet"),
  "Ziņots par bojājumu": t("Damage reported", "Сообщено о повреждении", "Schaden gemeldet"),
  "ACI datus nesniedz": t("ACI does not provide data", "ACI данные не предоставляет", "ACI liefert keine Daten"),
  "Problēmas nav ziņotas": t("No issues reported", "Проблем не сообщалось", "Keine Probleme gemeldet"),
  Izgatavots: t("Manufactured", "Изготовлен", "Hergestellt"),
  "Pirmo reizi satiksmē": t("First time in traffic", "Впервые в движении", "Erstmals im Verkehr"),
  "Ziņots jaunais īpašnieks": t("New owner reported", "Сообщено о новом владельце", "Neuer Halter gemeldet"),
  "Tehniskā apskate": t("Technical inspection", "Техосмотр", "Hauptuntersuchung"),
  "Ziņots par līzingu": t("Leasing reported", "Сообщено о лизинге", "Leasing gemeldet"),
  Apdrošināts: t("Insured", "Застрахован", "Versichert"),
  "Apdrošināšanas atlīdzības pieteikums": t("Insurance claim reported", "Заявление о страховом возмещении", "Versicherungsschaden gemeldet"),
  "Izsniegts salvage title (bojāta auto statuss)": t(
    "Salvage title issued",
    "Выдан salvage title (статус повреждённого авто)",
    "Salvage Title ausgestellt (Status Unfallfahrzeug)",
  ),
  "Nostrādājuši drošības spilveni": t("Airbag deployed", "Сработали подушки безопасности", "Airbag ausgelöst"),
  "Drošības spilveni nostrādājuši": t("Airbags deployed", "Подушки безопасности сработали", "Airbags ausgelöst"),
  "Odometra rādījums": t("Odometer reading", "Показание одометра", "Kilometerstand"),
  "Piedāvāts pārdošanai": t("Offered for sale", "Выставлен на продажу", "Zum Verkauf angeboten"),
  Eksportēts: t("Exported", "Экспортирован", "Exportiert"),
  Norakstīts: t("Scrapped", "Списан", "Verschrottet"),
  Līzings: t("Leasing", "Лизинг", "Leasing"),
  "Nobraukuma pārbaude": t("Mileage check", "Проверка пробега", "Laufleistungsprüfung"),
  "Īpašnieku skaits": t("Number of owners", "Число владельцев", "Halteranzahl"),
  "Mazāk par mēnesi": t("Less than a month", "Меньше месяца", "Weniger als ein Monat"),
  Privātpersona: t("Private individual", "Частное лицо", "Privatperson"),
  Uzņēmums: t("Company", "Компания", "Unternehmen"),
  Dīleris: t("Dealer", "Дилер", "Händler"),
  "Līzinga kompānija": t("Leasing company", "Лизинговая компания", "Leasinggesellschaft"),
  "Nomas kompānija": t("Rental company", "Прокатная компания", "Vermietungsfirma"),
  "Valsts iestāde": t("Government agency", "Государственное учреждение", "Behörde"),
  Smagums: t("Severity", "Тяжесть", "Schweregrad"),
  Neliels: t("Minor", "Незначительная", "Gering"),
  Vidējs: t("Moderate", "Средняя", "Mittel"),
  "Vidējs līdz smags": t("Moderate to severe", "От средней до тяжёлой", "Mittel bis schwer"),
  Smags: t("Severe", "Тяжёлая", "Schwer"),
  "Neliels līdz vidējs": t("Minor to moderate", "От незначительной до средней", "Gering bis mittel"),
  Sadursme: t("Collision", "Столкновение", "Kollision"),
  "Pilnīga bojāeja (Total loss)": t("Total loss", "Полная гибель (total loss)", "Totalschaden"),
  Krusa: t("Hail", "Град", "Hagel"),
  Plūdi: t("Flood", "Наводнение", "Überschwemmung"),
  Ugunsgrēks: t("Fire", "Пожар", "Brand"),
  Vandālisms: t("Vandalism", "Вандализм", "Vandalismus"),
  Melna: t("Black", "Чёрный", "Schwarz"),
  Balta: t("White", "Белый", "Weiß"),
  "Pelēka / sudraba": t("Grey / silver", "Серый / серебристый", "Grau / Silber"),
  Pelēka: t("Grey", "Серый", "Grau"),
  Sudraba: t("Silver", "Серебристый", "Silber"),
  Zila: t("Blue", "Синий", "Blau"),
  Sarkana: t("Red", "Красный", "Rot"),
  Zaļa: t("Green", "Зелёный", "Grün"),
  Brūna: t("Brown", "Коричневый", "Braun"),
  Bēša: t("Beige", "Бежевый", "Beige"),
  Dzeltena: t("Yellow", "Жёлтый", "Gelb"),
  Oranža: t("Orange", "Оранжевый", "Orange"),
  Universālis: t("Estate", "Универсал", "Kombi"),
  Sedans: t("Sedan", "Седан", "Limousine"),
  Hečbeks: t("Hatchback", "Хэтчбек", "Schrägheck"),
  Pikaps: t("Pickup", "Пикап", "Pick-up"),
  Apvidus: t("SUV", "Внедорожник", "SUV"),
  Kupeja: t("Coupe", "Купе", "Coupé"),
  Kabriolets: t("Convertible", "Кабриолет", "Cabriolet"),
  Furgons: t("Van", "Фургон", "Transporter"),
  Automātiskā: t("Automatic", "Автоматическая", "Automatik"),
  Manuālā: t("Manual", "Механическая", "Schaltgetriebe"),
  "Iekšdedzes motora jauda": t("Combustion engine power", "Мощность ДВС", "Leistung Verbrennungsmotor"),
  "Elektromotora jauda": t("Electric motor power", "Мощность электромотора", "Elektromotorleistung"),
  "Kopējā jauda": t("Total system power", "Суммарная мощность", "Systemleistung"),
  "Motora tilpums": t("Engine size", "Объём двигателя", "Hubraum"),
  Ātrumkārba: t("Gearbox", "Коробка передач", "Getriebe"),
  Piedziņa: t("Drive", "Привод", "Antrieb"),
  "Durvju skaits": t("Number of doors", "Количество дверей", "Anzahl Türen"),
  Hibrīds: t("Hybrid", "Гибрид", "Hybrid"),
  "Modeļa gads": t("Model year", "Модельный год", "Modelljahr"),
  "CO2 izmeši (jauktais cikls)": t("CO2 emissions (combined)", "Выбросы CO2 (смешанный цикл)", "CO2-Emissionen (kombiniert)"),
  "Degvielas patēriņš (jauktais cikls)": t("Fuel consumption (combined)", "Расход топлива (смешанный цикл)", "Kraftstoffverbrauch (kombiniert)"),
  "Euro klase": t("Euro class", "Класс Euro", "Euro-Klasse"),
  Kravnesība: t("Max payload", "Грузоподъёмность", "Zuladung"),
  "Pilnā masa": t("Gross vehicle weight", "Полная масса", "Zulässiges Gesamtgewicht"),
  Pašmasa: t("Curb weight", "Снаряжённая масса", "Leergewicht"),
  Garums: t("Length", "Длина", "Länge"),
  Platums: t("Width", "Ширина", "Breite"),
  Augstums: t("Height", "Высота", "Höhe"),
  Garenbāze: t("Wheelbase", "Колёсная база", "Radstand"),
  "EK kategorija": t("EU vehicle category", "Категория ЕС", "EU-Fahrzeugklasse"),
  "EK tipa apstiprinājums": t("EU type approval", "Одобрение типа ЕС", "EU-Typgenehmigung"),

  // Bojājumu zonas un detaļu grupas (AutoDNA / CarVertical / CARFAX)
  Priekšpuse: t("Front", "Передняя часть", "Front"),
  "Kreisā sāna priekšpuse": t("Left front side", "Левая передняя сторона", "Linke Seite vorne"),
  "Labā sāna priekšpuse": t("Right front side", "Правая передняя сторона", "Rechte Seite vorne"),
  "Kreisais sāns": t("Left side", "Левая сторона", "Linke Seite"),
  "Labais sāns": t("Right side", "Правая сторона", "Rechte Seite"),
  Aizmugure: t("Rear", "Задняя часть", "Heck"),
  "Kreisā sāna aizmugure": t("Left rear side", "Левая задняя сторона", "Linke Seite hinten"),
  "Labā sāna aizmugure": t("Right rear side", "Правая задняя сторона", "Rechte Seite hinten"),
  Jumts: t("Roof", "Крыша", "Dach"),
  Apakša: t("Underbody", "Днище", "Unterboden"),
  Salons: t("Interior", "Салон", "Innenraum"),
  "Ārējais apgaismojums": t("Exterior lighting", "Внешнее освещение", "Außenbeleuchtung"),
  // Izsoles kartītes «Izsoles apraksts»: bojājuma dziļums no AUTO1 i18n atslēgām (`thecarapiFreeText`).
  "Dziļš, līdz gruntij": t("Deep, down to primer", "Глубокое, до грунта", "Tief, bis zur Grundierung"),
  "Līdz gruntij": t("Down to primer", "До грунта", "Bis zur Grundierung"),
  "Dziļš, līdz metālam": t("Deep, down to bare metal", "Глубокое, до металла", "Tief, bis aufs Blech"),
  "Līdz metālam": t("Down to bare metal", "До металла", "Bis aufs Blech"),
  "Dziļš": t("Deep", "Глубокое", "Tief"),
  "Virspusējs": t("Superficial", "Поверхностное", "Oberflächlich"),
  "Viegls": t("Light", "Лёгкое", "Leicht"),
  "Tikai lakas slānī": t("Clear coat only", "Только в слое лака", "Nur im Klarlack"),
  "Līdz krāsas slānim": t("Down to the paint layer", "До слоя краски", "Bis zur Farbschicht"),
  "Cauri krāsas slānim": t("Through the paint layer", "Сквозь слой краски", "Durch die Farbschicht"),
  "Ar lakas bojājumu": t("With paint damage", "С повреждением лака", "Mit Lackschaden"),
  "Bez lakas bojājuma": t("Without paint damage", "Без повреждения лака", "Ohne Lackschaden"),
  "Virsbūves ārējās daļas": t("Exterior body parts", "Наружные детали кузова", "Karosserieaußenteile"),
  "Virsbūves konstrukcija": t("Body structure", "Конструкция кузова", "Karosseriestruktur"),
  Stikli: t("Glass", "Стёкла", "Verglasung"),
  "Riteņi un riepas": t("Wheels and tyres", "Колёса и шины", "Räder und Reifen"),
  Balstiekārta: t("Suspension", "Подвеска", "Fahrwerk"),
  "Drošības spilveni": t("Airbags", "Подушки безопасности", "Airbags"),
  "Drošības sistēmas": t("Safety systems", "Системы безопасности", "Sicherheitssysteme"),
  Dzinējs: t("Engine", "Двигатель", "Motor"),
  "Spēka agregāts": t("Powertrain", "Силовой агрегат", "Antriebsstrang"),
  "Dzesēšanas sistēma": t("Cooling system", "Система охлаждения", "Kühlsystem"),
  Elektrosistēma: t("Electrical system", "Электросистема", "Elektrik"),
  "Mehāniskās daļas": t("Mechanical parts", "Механические части", "Mechanische Teile"),

  // Eļļas maiņas intervāli
  "Ražotāja intervāls": t("Manufacturer interval", "Интервал производителя", "Herstellerintervall"),
  Sākums: t("Start", "Начало", "Beginn"),
  "Datu iztrūkums": t("Data gap", "Пробел в данных", "Datenlücke"),

  // LTAB izziņa
  "LTAB datubāzē negadījumi nav reģistrēti": t(
    "No incidents registered in the LTAB database",
    "В базе LTAB ДТП не зарегистрированы",
    "In der LTAB-Datenbank sind keine Unfälle registriert",
  ),
  "Izziņa ir sagatavota automātiski no OCTA informācijas sistēmas.": t(
    "The certificate was generated automatically from the MTPL information system.",
    "Справка сформирована автоматически из информационной системы ОСАГО.",
    "Die Bescheinigung wurde automatisch aus dem Kfz-Haftpflicht-Informationssystem erstellt.",
  ),
  "Zaudējumu dati": t("Loss data", "Данные об убытках", "Schadensdaten"),

  // kfzgutachten.at §57a rezultāts
  "atbilst, bez trūkumiem": t("passed, no defects", "соответствует, без недостатков", "entspricht, mängelfrei"),
  "atbilst, ar nelieliem trūkumiem": t("passed, minor defects", "соответствует, с незначительными недостатками", "entspricht, leichte Mängel"),
  "neatbilst - būtiski trūkumi": t("failed - major defects", "не соответствует - существенные недостатки", "entspricht nicht - schwere Mängel"),
  "neatbilst - bīstami trūkumi": t("failed - dangerous defects", "не соответствует - опасные недостатки", "entspricht nicht - Gefahr im Verzug"),
};

type Rule = { re: RegExp; to: (m: RegExpMatchArray, lang: Target) => string };

function records(n: string, lang: Target): string {
  if (lang === "en") return `${n} ${n === "1" ? "record" : "records"}`;
  if (lang === "de") return `${n} ${n === "1" ? "Eintrag" : "Einträge"}`;
  return `${n} зап.`;
}

/** Šabloni ar skaitļiem / datumiem (visam gabalam). */
const RULES: Rule[] = [
  { re: /^(\d+) (?:ieraksts|ieraksti|ierakstu)$/, to: (m, l) => records(m[1]!, l) },
  {
    re: /^(\d+) bojājumu (?:ieraksts|ieraksti)$/,
    to: (m, l) =>
      l === "en"
        ? `${m[1]} damage ${m[1] === "1" ? "record" : "records"}`
        : l === "de"
          ? `${m[1]} ${m[1] === "1" ? "Schadenseintrag" : "Schadenseinträge"}`
          : `${m[1]} зап. о повреждениях`,
  },
  {
    re: /^(\d+) (?:negadījums|negadījumi)$/,
    to: (m, l) =>
      l === "en" ? `${m[1]} ${m[1] === "1" ? "accident" : "accidents"}` : l === "de" ? `${m[1]} ${m[1] === "1" ? "Unfall" : "Unfälle"}` : `ДТП: ${m[1]}`,
  },
  {
    re: /^(\d+) ar bojājumu zonām$/,
    to: (m, l) => (l === "en" ? `${m[1]} with damage zones` : l === "de" ? `${m[1]} mit Schadenszonen` : `${m[1]} с зонами повреждений`),
  },
  {
    re: /^(\d+) (?:rādījums|rādījumi)(?: (bez pretrunām))?$/,
    to: (m, l) => {
      const base = l === "en" ? `${m[1]} ${m[1] === "1" ? "reading" : "readings"}` : l === "de" ? `${m[1]} ${m[1] === "1" ? "Messwert" : "Messwerte"}` : `${m[1]} показ.`;
      if (!m[2]) return base;
      return l === "en" ? `${base}, consistent` : l === "de" ? `${base} ohne Widersprüche` : `${base} без противоречий`;
    },
  },
  {
    re: /^(\d+) (?:nobraukuma kritums|nobraukuma kritumi)$/,
    to: (m, l) => (l === "en" ? `${m[1]} mileage drop${m[1] === "1" ? "" : "s"}` : l === "de" ? `${m[1]} Laufleistungsrückgang` : `Падение пробега: ${m[1]}`),
  },
  {
    re: /^(\d+) (?:diena|dienas|dienu)$/,
    to: (m, l) => (l === "en" ? `${m[1]} ${m[1] === "1" ? "day" : "days"}` : l === "de" ? `${m[1]} ${m[1] === "1" ? "Tag" : "Tage"}` : `${m[1]} дн.`),
  },
  {
    re: /^(\d+) (?:mēn\.?|mēneši|mēnesis|mēnešu)$/,
    to: (m, l) => (l === "en" ? `${m[1]} mo.` : l === "de" ? `${m[1]} Mon.` : `${m[1]} мес.`),
  },
  {
    re: /^(\d+) g\.(?: (\d+) mēn\.?)?$/,
    to: (m, l) => {
      const y = l === "en" ? `${m[1]} ${m[1] === "1" ? "yr" : "yrs"}` : l === "de" ? `${m[1]} J.` : `${m[1]} г.`;
      if (!m[2]) return y;
      return `${y} ${l === "en" ? `${m[2]} mos` : l === "de" ? `${m[2]} Mon.` : `${m[2]} мес.`}`;
    },
  },
  { re: /^Pēdējais:? (\d{2}\.(?:\d{2}\.)?\d{4})$/, to: (m, l) => `${l === "en" ? "Latest" : l === "de" ? "Letzter" : "Последний"} ${m[1]}` },
  { re: /^Kopš (\d{2}\.\d{2}\.\d{4})$/, to: (m, l) => `${l === "en" ? "Since" : l === "de" ? "Seit" : "С"} ${m[1]}` },
  { re: /^[Nn]o (\d{4})$/, to: (m, l) => `${l === "en" ? "From" : l === "de" ? "Ab" : "С"} ${m[1]}` },
  { re: /^līdz (.+)$/, to: (m, l) => `${l === "en" ? "up to" : l === "de" ? "bis" : "до"} ${m[1]}` },
  {
    re: /^Pēdējais rādījums (\d[\d\s\u00a0]*km)(?: \(([^()·]+)\))?$/u,
    to: (m, l) => {
      const src = m[2] ? ` (${m[2]})` : "";
      return `${l === "en" ? "Latest reading" : l === "de" ? "Letzter Messwert" : "Последний показатель"} ${m[1]}${src}`;
    },
  },
  {
    re: /^iepriekš (\d[\d\s\u00a0]*km)(?: \(([^()·]+)\))?$/u,
    to: (m, l) => {
      const src = m[2] ? ` (${m[2]})` : "";
      return `${l === "en" ? "earlier" : l === "de" ? "zuvor" : "ранее"} ${m[1]}${src}`;
    },
  },
  {
    re: /^kritums (\d[\d\s\u00a0]*km)$/u,
    to: (m, l) => `${l === "en" ? "decrease" : l === "de" ? "Rückgang" : "снижение"} ${m[1]}`,
  },
  {
    re: /^sludinājumā (\d.*?[\s\u00a0]km)$/u,
    to: (m, l) => (l === "en" ? `listing ${m[1]}` : l === "de" ? `Inserat ${m[1]}` : `в объявлении ${m[1]}`),
  },
  { re: /^Bojājums (\d{2}\.\d{4}|\d{2}\.\d{2}\.\d{4})$/, to: (m, l) => `${l === "en" ? "Damage" : l === "de" ? "Schaden" : "Повреждение"} ${m[1]}` },
  {
    re: /^(\d+)\. īpašnieka periods$/,
    to: (m, l) => (l === "en" ? `Owner period no. ${m[1]}` : l === "de" ? `${m[1]}. Halterzeitraum` : `Период владельца № ${m[1]}`),
  },
  {
    re: /^Novērtējums (.+)$/,
    to: (m, l) => `${TERMS.Novērtējums![l]} ${translatePiece(m[1]!, l)}`,
  },
  {
    re: /^Transportlīdzekļa zaudējumu dati uz (.+)$/,
    to: (m, l) => (l === "en" ? `Vehicle loss data as of ${m[1]}` : l === "de" ? `Schadensdaten des Fahrzeugs zum ${m[1]}` : `Данные об убытках ТС на ${m[1]}`),
  },
  {
    re: /^Laikā no (\S+) līdz (\S+) apdrošināts (\d+) dienas\.$/,
    to: (m, l) =>
      l === "en"
        ? `Insured from ${m[1]} to ${m[2]}: ${m[3]} days.`
        : l === "de"
          ? `Versichert vom ${m[1]} bis ${m[2]}: ${m[3]} Tage.`
          : `Застраховано с ${m[1]} по ${m[2]}: ${m[3]} дн.`,
  },
];

const DELIMS = [" · ", "; ", ", ", ": "] as const;

let LOWER: Map<string, Tr> | null = null;
function lowerTerms(): Map<string, Tr> {
  if (!LOWER) LOWER = new Map(Object.entries(TERMS).map(([k, v]) => [k.toLocaleLowerCase("lv"), v]));
  return LOWER;
}

const isUpper = (c: string) => c !== c.toLocaleLowerCase("lv");

function matchCase(src: string, out: string, lang: Target): string {
  if (!out) return out;
  const letters = src.replace(/[^\p{L}]/gu, "");
  if (letters.length > 3 && letters === letters.toLocaleUpperCase("lv")) return out.toLocaleUpperCase(lang);
  const first = src.match(/\p{L}/u)?.[0] ?? "";
  if (first && isUpper(first)) return out.charAt(0).toLocaleUpperCase(lang) + out.slice(1);
  if (first && lang !== "de") return out.charAt(0).toLocaleLowerCase(lang) + out.slice(1);
  return out;
}

let LV_COUNTRY: Map<string, string> | null = null;
function lvCountryIso(piece: string): string | null {
  if (!LV_COUNTRY) LV_COUNTRY = new Map(Object.entries(ISO2_TO_LV_NAME).map(([iso, lv]) => [lv.toLocaleLowerCase("lv"), iso]));
  return LV_COUNTRY.get(piece.toLocaleLowerCase("lv")) ?? null;
}

function lookup(piece: string, lang: Target): string | null {
  const exact = TERMS[piece];
  if (exact) return exact[lang];
  const ci = lowerTerms().get(piece.toLocaleLowerCase("lv"));
  if (ci) return matchCase(piece, ci[lang], lang);
  // LV valsts nosaukums jebkurā reģistrā (CSDD «NĪDERLANDE»).
  const iso = lvCountryIso(piece);
  if (iso) return new Intl.DisplayNames([lang], { type: "region" }).of(iso) ?? null;
  return null;
}

/** Viens gabals: precīzs termins (arī ar «:» / «.» galā) vai šablons; citādi `null`. */
function translateExact(piece: string, lang: Target): string | null {
  const direct = lookup(piece, lang);
  if (direct != null) return direct;
  const tail = piece.match(/^([\s\S]+?)([:.])$/);
  if (tail) {
    const hit = lookup(tail[1]!, lang);
    if (hit != null) return hit + tail[2];
  }
  for (const r of RULES) {
    const m = piece.match(r.re);
    if (m) return r.to(m, lang);
  }
  if (tail) {
    for (const r of RULES) {
      const m = tail[1]!.match(r.re);
      if (m) return r.to(m, lang) + tail[2];
    }
  }
  return null;
}

function translatePiece(piece: string, lang: Target, depth = 0): string {
  const lead = piece.match(/^\s*/)![0];
  const trail = piece.match(/\s*$/)![0];
  const core = piece.trim();
  if (!core || !/\p{L}/u.test(core)) return piece;
  const whole = translateExact(core, lang);
  if (whole != null) return lead + whole + trail;
  // CSDD TA defektu / piezīmju standarta teikumi (veselā gabalā, pirms dalīšanas pa komatiem).
  const defect = translateCsddTaDefectText(core, lang);
  if (defect != null) return lead + defect + trail;
  for (let i = depth; i < DELIMS.length; i++) {
    const d = DELIMS[i]!;
    if (!core.includes(d)) continue;
    return lead + core.split(d).map((p) => translatePiece(p, lang, i)).join(d) + trail;
  }
  return piece;
}

/** Teksta mezglam (starp `>` un `<`). LV - bez izmaiņām. */
export function translateClientReportLvTerms(text: string, lang: ClientReportLang): string {
  if (lang === "lv" || !/[^\s]/.test(text)) return text;
  return translatePiece(text, lang);
}
