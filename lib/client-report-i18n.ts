/**
 * PROVIN klienta atskaites (PDF) statiskais "apvalks" citās valodās.
 *
 * Modelis: latviešu virkne PATI ir vārdnīcas atslēga (nevis atsevišķs key-vārds).
 * Tas ļauj tulkojumu piemērot ar vienu "sweep" pāri pār jau uzbūvēto HTML
 * (`applyClientReportStaticTranslations`), nevis stiept `lang` parametru
 * cauri desmitiem palīgfunkciju vairākos failos.
 *
 * Trūkstošs ieraksts NEKAD nenolūzt un nerāda tukšu lauku - vienkārši paliek
 * latviski, kamēr kāds pamana un pievieno tulkojumu.
 *
 * Zīmoli (AutoDNA, CarVertical, CSDD, LTAB, Tesla, Audi u.c.) NAV šeit -
 * tie paliek nemainīgi visās valodās.
 */

export type ClientReportLang = "lv" | "en" | "ru" | "de";

export const CLIENT_REPORT_LANGS: ClientReportLang[] = ["lv", "en", "ru", "de"];

export type ClientReportTargetLang = Exclude<ClientReportLang, "lv">;

type StaticTranslationEntry = { en: string; ru: string };

/** Kārtībai nav nozīmes - garākās frāzes tiek meklētas pirmās (sk. sortētais saraksts zemāk). */
const STATIC_TRANSLATIONS: Record<string, StaticTranslationEntry> = {
  // Galvenie virsraksti
  "TRANSPORTLĪDZEKĻA AUDITS": { en: "VEHICLE HISTORY AUDIT", ru: "АУДИТ ИСТОРИИ АВТОМОБИЛЯ" },
  "Business Datu atskaite": { en: "Business data report", ru: "Отчёт по данным Business" },
  "Datu atskaite": { en: "Data report", ru: "Отчёт по данным" },
  "APPROVED BY IRISS": { en: "APPROVED BY IRISS", ru: "APPROVED BY IRISS" },

  // IRISS 1./2./3. sadaļa
  "1. Tehnisko risku analīze": { en: "1. Technical risk analysis", ru: "1. Анализ технических рисков" },
  "2. Ieteikumi klātienes apskatei": {
    en: "2. In-person inspection recommendations",
    ru: "2. Рекомендации по осмотру на месте",
  },
  "3. Kopsavilkums": { en: "3. Summary", ru: "3. Заключение" },
  "Tehnisko risku analīze": { en: "Technical risk analysis", ru: "Анализ технических рисков" },
  "Risku analīze": { en: "Risk analysis", ru: "Анализ рисков" },
  "Ieteikumi klātienes apskatei": {
    en: "In-person inspection recommendations",
    ru: "Рекомендации по осмотру на месте",
  },
  Ieteikumi: { en: "Recommendations", ru: "Рекомендации" },
  Kopsavilkums: { en: "Summary", ru: "Заключение" },

  // Nobraukuma un negadījumu bloki
  "NOBRAUKUMA VĒSTURE": { en: "ODOMETER HISTORY", ru: "ИСТОРИЯ ПРОБЕГА" },
  "NOBRAUKUMA VĒSTURES KOMENTĀRS": { en: "ODOMETER HISTORY NOTES", ru: "КОММЕНТАРИЙ К ИСТОРИИ ПРОБЕГА" },
  "NEGADĪJUMU VĒSTURES KOPSAVILKUMS": {
    en: "ACCIDENT HISTORY SUMMARY",
    ru: "СВОДКА ПО ИСТОРИИ ДТП",
  },
  Negadījums: { en: "Accident", ru: "ДТП" },
  "Bojājumu ieraksts": { en: "Damage record", ru: "Запись о повреждении" },
  "1 bojājumu ieraksts": { en: "1 damage record", ru: "1 запись о повреждении" },
  "1 negadījums": { en: "1 accident", ru: "1 ДТП" },
  Zonas: { en: "Damage areas", ru: "Зоны повреждений" },
  Detaļas: { en: "Parts", ru: "Детали" },
  Grupas: { en: "Part groups", ru: "Группы деталей" },
  "Negadījumi:": { en: "Accidents:", ru: "ДТП:" },
  "Negadījumu skaits:": { en: "Number of accidents:", ru: "Количество ДТП:" },
  "Zaudējumu dati": { en: "Insurance claims", ru: "Страховые выплаты" },

  // Sludinājuma analīze / tirgus
  "SLUDINĀJUMA ANALĪZE": { en: "LISTING ANALYSIS", ru: "АНАЛИЗ ОБЪЯВЛЕНИЯ" },
  "Sludinājuma analīze": { en: "Listing analysis", ru: "Анализ объявления" },
  "Cenas izmaiņas šajā sludinājumā": {
    en: "Price changes in this listing",
    ru: "Изменения цены в этом объявлении",
  },
  "Cenas izmaiņa:": { en: "Price change:", ru: "Изменение цены:" },
  "Ilgums tirgū:": { en: "Time on market:", ru: "Время в продаже:" },
  "Tirgus dati": { en: "Market data", ru: "Рыночные данные" },

  // Avoti / reģistri
  "OFICIĀLĀ DĪLERA DATI": { en: "OFFICIAL DEALER RECORDS", ru: "ДАННЫЕ ОФИЦИАЛЬНОГО ДИЛЕРА" },
  "DĀNIJAS REĢISTRI": { en: "DANISH REGISTERS", ru: "РЕЕСТРЫ ДАНИИ" },
  "NĪDERLANDES REĢISTRI": { en: "DUTCH REGISTERS", ru: "РЕЕСТРЫ НИДЕРЛАНДОВ" },
  "ZVIEDRIJAS REĢISTRI": { en: "SWEDISH REGISTERS", ru: "РЕЕСТРЫ ШВЕЦИИ" },
  "Igaunijas reģistrs": { en: "Estonian vehicle register", ru: "Реестр транспортных средств Эстонии" },
  "Igaunijas OCTA": { en: "Estonian MTPL insurance", ru: "ОСАГО Эстонии" },
  "CITI AVOTI": { en: "OTHER SOURCES", ru: "ДРУГИЕ ИСТОЧНИКИ" },
  "Servisa vēsture": { en: "Service history", ru: "Сервисная история" },
  "Eļļas maiņas intervāli": { en: "Oil change intervals", ru: "Интервалы замены масла" },
  "Servisa un remontu vēsture": { en: "Service and repair history", ru: "История обслуживания и ремонтов" },
  "Fotogrāfiju pielikums": { en: "Photo appendix", ru: "Приложение: фотографии" },

  " atskaites ģenerēšanā izmantotie avoti": {
    en: " report data sources",
    ru: ": источники данных для отчёта",
  },
  "Maksas vēstures atskaites": { en: "Paid vehicle history reports", ru: "Платные отчёты по истории автомобиля" },
  "Publiskas Eiropas datubāzes": { en: "Public European databases", ru: "Открытые европейские базы данных" },
  "Citi avoti": { en: "Other sources", ru: "Другие источники" },
  "Kas tika pārbaudīts": { en: "What we checked", ru: "Что мы проверили" },
  Kopā: { en: "Total", ru: "Итого" },

  // Nobraukuma tabulas galviņas
  Datums: { en: "Date", ru: "Дата" },
  "Odometrs (km)": { en: "Odometer reading (km)", ru: "Пробег (км)" },
  Avots: { en: "Source", ru: "Источник" },
  Valsts: { en: "Country", ru: "Страна" },
  // LTAB izziņas transportlīdzekļa rinda (pirms «Valsts» → «Country»).
  "Valsts numura zīme": { en: "Registration plate", ru: "Госномер" },
  "izlaiduma gads": { en: "year of manufacture", ru: "год выпуска" },
  Transportlīdzeklis: { en: "Vehicle", ru: "Транспортное средство" },
  Komentārs: { en: "Comment", ru: "Комментарий" },

  // CSDD strukturētie lauki
  "Marka, modelis:": { en: "Make and model:", ru: "Марка, модель:" },
  "Reģistrācijas numurs:": { en: "Registration number:", ru: "Госномер:" },
  "Pirmā reģistrācija:": { en: "First registration:", ru: "Первая регистрация:" },
  "Pirmā reģistrācija Latvijā:": { en: "First registration in Latvia:", ru: "Первая регистрация в Латвии:" },
  "Nākamās apskates datums:": { en: "Next inspection due:", ru: "Следующий техосмотр:" },
  "Iepriekšējās apskates datums:": { en: "Previous inspection:", ru: "Предыдущий техосмотр:" },
  "Motora tilpums (cm³):": { en: "Engine capacity (cm³):", ru: "Объём двигателя (см³):" },
  "Motora maksimālā jauda (kW):": { en: "Maximum power (kW):", ru: "Максимальная мощность (кВт):" },
  "Degvielas veids:": { en: "Fuel type:", ru: "Тип топлива:" },
  "Emisiju standarts:": { en: "Emission standard:", ru: "Экологический класс:" },
  "Pilna masa (kg):": { en: "Gross vehicle weight (kg):", ru: "Полная масса (кг):" },
  "Pašmasa (kg):": { en: "Kerb weight (kg):", ru: "Снаряжённая масса (кг):" },
  "Ekspluatācijas nodoklis (EUR):": { en: "Annual vehicle tax (EUR):", ru: "Транспортный налог (EUR):" },
  "Reģistrācijas statuss:": { en: "Registration status:", ru: "Статус регистрации:" },
  "Dūmainības koeficients (m⁻¹):": { en: "Smoke opacity (m⁻¹):", ru: "Коэффициент дымности (м⁻¹):" },
  "Atgāzu cietās daļiņas:": { en: "Exhaust particle count:", ru: "Твёрдые частицы в выхлопе:" },
  "Atgāzu cietās daļiņas (cm⁻³):": {
    en: "Exhaust particle count (cm⁻³):",
    ru: "Твёрдые частицы в выхлопе (см⁻³):",
  },
  "Iepriekšējās reģistrācijas valsts:": {
    en: "Previous country of registration:",
    ru: "Страна предыдущей регистрации:",
  },
  "Īpašnieku skaits Latvijā:": { en: "Owners in Latvia:", ru: "Владельцев в Латвии:" },
  "Tehnisko apskašu vēsture": { en: "Inspection history", ru: "История техосмотров" },
  "Iepriekšējās apskates dati": { en: "Previous inspection results", ru: "Результаты предыдущего техосмотра" },

  // Tirgus lauki
  "Auto pārdošanā (dienas):": { en: "Days on sale:", ru: "Дней в продаже:" },
  "Izveidots:": { en: "Listed on:", ru: "Опубликовано:" },
  "Cenas izmaiņas (eiro):": { en: "Price changes (EUR):", ru: "Изменения цены (EUR):" },
  "Odometrs, km:": { en: "Odometer reading, km:", ru: "Пробег, км:" },

  // Kājene / drukas rīki
  "Drukāt / PDF": { en: "Print / PDF", ru: "Печать / PDF" },
  "Drukāt (augsts kontrasts)": { en: "Print (high contrast)", ru: "Печать (высокий контраст)" },
  "Drukājamā versija - palielināts kontrasts papīram. Digitālajam PDF lietojiet „Ģenerēt PDF”.": {
    en: "Print version with higher contrast for paper. For a digital PDF, use \"Generate PDF\".",
    ru: "Версия для печати с повышенным контрастом. Для цифрового PDF используйте «Создать PDF».",
  },
  "Demonstrācijas dati": { en: "Demo data", ru: "Демонстрационные данные" },
  Ģenerēts: { en: "Generated", ru: "Сформирован" },

  // Kopsavilkuma plāksnītes, laikposms, sludinājums, kājene
  "ATSKAITES KOPSAVILKUMS": { en: "REPORT SUMMARY", ru: "КРАТКАЯ СВОДКА" },
  "Vēstures kopsavilkums": { en: "History overview", ru: "Обзор истории" },
  "NEGADĪJUMU VĒSTURE": { en: "ACCIDENT HISTORY", ru: "ИСТОРИЯ ДТП" },
  "Negadījumi un bojājumi": { en: "Accidents and damage", ru: "ДТП и повреждения" },
  "Avotos nav fiksētu negadījumu": {
    en: "No accidents recorded in the sources",
    ru: "В источниках ДТП не зафиксированы",
  },
  "Nav ierakstu": { en: "No records", ru: "Записей нет" },
  "Nav datu": { en: "No data", ru: "Нет данных" },
  "Publicēts:": { en: "Published:", ru: "Опубликовано:" },
  "Izsoļu / reģistru bojājumi bez summas": {
    en: "Auction / register damage without amount",
    ru: "Повреждения на аукционах / в реестрах без суммы",
  },
  "Bojājumi:": { en: "Damage:", ru: "Повреждения:" },
  "Īpašnieku skaits": { en: "Number of owners", ru: "Количество владельцев" },
  "Reģistrācija Latvijā": { en: "Latvian registration", ru: "Регистрация в Латвии" },
  "Reģistrācija Somijā": { en: "Registration in Finland", ru: "Регистрация в Финляндии" },
  "Reģistrācija Igaunijā": { en: "Registration in Estonia", ru: "Регистрация в Эстонии" },
  "Reģistrācija Lietuvā": { en: "Registration in Lithuania", ru: "Регистрация в Литве" },
  "Reģistrācija Dānijā": { en: "Registration in Denmark", ru: "Регистрация в Дании" },
  "Reģistrācija Zviedrijā": { en: "Registration in Sweden", ru: "Регистрация в Швеции" },
  "Reģistrācija Norvēģijā": { en: "Registration in Norway", ru: "Регистрация в Норвегии" },
  "Reģistrācija Vācijā": { en: "Registration in Germany", ru: "Регистрация в Германии" },
  "Reģistrācija Nīderlandē": { en: "Registration in the Netherlands", ru: "Регистрация в Нидерландах" },
  "Reģistrācija Beļģijā": { en: "Registration in Belgium", ru: "Регистрация в Бельгии" },
  "Reģistrācija Luksemburgā": { en: "Registration in Luxembourg", ru: "Регистрация в Люксембурге" },
  "Reģistrācija Francijā": { en: "Registration in France", ru: "Регистрация в Франции" },
  "Reģistrācija Itālijā": { en: "Registration in Italy", ru: "Регистрация в Италии" },
  "Reģistrācija Spānijā": { en: "Registration in Spain", ru: "Регистрация в Испании" },
  "Reģistrācija Austrijā": { en: "Registration in Austria", ru: "Регистрация в Австрии" },
  "Reģistrācija Šveicē": { en: "Registration in Switzerland", ru: "Регистрация в Швейцарии" },
  "Reģistrācija Polijā": { en: "Registration in Poland", ru: "Регистрация в Польше" },
  "Reģistrācija Čehijā": { en: "Registration in Czechia", ru: "Регистрация в Чехии" },
  "Reģistrācija ASV": { en: "Registration in the USA", ru: "Регистрация в США" },
  "Reģistrācija Apvienotajā Karalistē": { en: "Registration in the United Kingdom", ru: "Регистрация в Великобритании" },
  "Reģistrācija Ungārijā": { en: "Registration in Hungary", ru: "Регистрация в Венгрии" },
  Nobraukums: { en: "Mileage", ru: "Пробег" },
  "DĪLERA DATI": { en: "DEALER RECORDS", ru: "ДАННЫЕ ДИЛЕРА" },
  "IZSOĻU PORTĀLU ARHĪVS": { en: "AUCTION PLATFORM ARCHIVE", ru: "АРХИВ АУКЦИОННЫХ ПЛОЩАДОК" },
  "Pirmā reģistrācija": { en: "First registration", ru: "Первая регистрация" },
  "Ieraksts reģistrā": { en: "Register record", ru: "Запись в реестре" },
  "Tehniskā apskate": { en: "Technical inspection", ru: "Техосмотр" },
  "Īpašnieka maiņa": { en: "Change of ownership", ru: "Смена владельца" },
  "Servisa apmeklējums": { en: "Service visit", ru: "Посещение сервиса" },
  Sludinājums: { en: "Listing", ru: "Объявление" },
  "Sludinājuma cenas izmaiņa": { en: "Listing price change", ru: "Изменение цены в объявлении" },
  "Izlikts pārdošanā": { en: "Listed for sale", ru: "Выставлен на продажу" },
  "(pēc sludinājuma, nav apstiprināts)": {
    en: "(per the listing, unverified)",
    ru: "(по данным объявления, не подтверждено)",
  },
  "Sludinājuma vēsture": { en: "Listing history", ru: "История объявления" },
  "Pārdevēja portrets": { en: "Seller profile", ru: "Профиль продавца" },
  "Fotogrāfiju analīze": { en: "Photo analysis", ru: "Анализ фотографий" },
  "Pārdošanas sludinājuma konteksts": { en: "Listing context", ru: "Контекст объявления" },
  "Grafika ģenerēšanā izmantotais avotu skaits:": {
    en: "Sources used for this chart:",
    ru: "Источников, использованных для графика:",
  },
  pārbaudīts: { en: "checked", ru: "проверено" },
  Atruna: { en: "Disclaimer", ru: "Отказ от ответственности" },
  Konfidencialitāte: { en: "Confidentiality", ru: "Конфиденциальность" },
  "PROVIN.LV pakalpojums ir konsultatīvs: mēs izvērtējam pieejamo informāciju par transportlīdzekli un sniedzam ieteikumus. Atskaite ir digitāls datu apkopojums, nevis tehniskā diagnostika. Tā nekādā gadījumā neaizstāj pilnvērtīgu transportlīdzekļa pārbaudi un apskati klātienē. Atskaite nav valsts iestādes izraksts, neatkarīga tehniskā ekspertīze vai juridisks atzinums. Gala lēmumu par transportlīdzekļa iegādi pieņem klients.":
    {
      en: "The PROVIN.LV service is advisory: we assess the available information about the vehicle and provide recommendations. The report is a digital compilation of data, not a technical diagnosis. It in no way replaces a thorough in-person check and inspection of the vehicle. The report is not an official extract from a state authority, an independent technical appraisal or a legal opinion. The final decision to purchase the vehicle rests with the client.",
      ru: "Услуга PROVIN.LV носит консультационный характер: мы оцениваем доступную информацию о транспортном средстве и даём рекомендации. Отчёт является цифровой подборкой данных, а не технической диагностикой. Он ни в коем случае не заменяет полноценную проверку и осмотр автомобиля на месте. Отчёт не является выпиской государственного органа, независимой технической экспертизой или юридическим заключением. Окончательное решение о покупке транспортного средства принимает клиент.",
    },
  "PROVIN.LV Business atskaite ir digitāls pieejamās informācijas par transportlīdzekli apkopojums, nevis tehniskā diagnostika. Tā nekādā gadījumā neaizstāj pilnvērtīgu transportlīdzekļa pārbaudi un apskati klātienē. Atskaite nav valsts iestādes izraksts, neatkarīga tehniskā ekspertīze vai juridisks atzinums. Gala lēmumu par transportlīdzekļa iegādi pieņem klients.":
    {
      en: "The PROVIN.LV Business report is a digital compilation of the available information about the vehicle, not a technical diagnosis. It in no way replaces a thorough in-person check and inspection of the vehicle. The report is not an official extract from a state authority, an independent technical appraisal or a legal opinion. The final decision to purchase the vehicle rests with the client.",
      ru: "Отчёт PROVIN.LV Business является цифровой подборкой доступной информации о транспортном средстве, а не технической диагностикой. Он ни в коем случае не заменяет полноценную проверку и осмотр автомобиля на месте. Отчёт не является выпиской государственного органа, независимой технической экспертизой или юридическим заключением. Окончательное решение о покупке транспортного средства принимает клиент.",
    },
  "Šī atskaite ir sagatavota ekskluzīvi tās pasūtītājam un ir izmantojama tikai personīgām vajadzībām. Atskaiti un tajā ietverto informāciju ir kategoriski aizliegts pavairot, publiski reproducēt, nodot vai jebkādā citā veidā darīt pieejamu trešajām personām (tostarp transportlīdzekļa pārdevējam) bez saskaņošanas ar PROVIN.LV.":
    {
      en: "This report has been prepared exclusively for the customer who ordered it and is for personal use only. Copying, publicly reproducing, passing on or otherwise making this report or the information in it available to third parties (including the seller of the vehicle) without the prior consent of PROVIN.LV is strictly prohibited.",
      ru: "Этот отчёт подготовлен исключительно для заказчика и предназначен только для личного использования. Копирование, публичное воспроизведение, передача отчёта и содержащейся в нём информации или предоставление к ним доступа третьим лицам любым иным способом (включая продавца транспортного средства) без согласования с PROVIN.LV строго запрещены.",
    },

  // Dīlera / transportlīdzekļa informācija (etiķetes bez diakritikas arī, citādi residue tās izlaiž)
  "Transportlīdzekļa informācija": { en: "Vehicle information", ru: "Информация об автомобиле" },
  "Lielie darbi": { en: "Major work", ru: "Крупные работы" },
  Aprīkojums: { en: "Equipment", ru: "Комплектация" },
  Modelis: { en: "Model", ru: "Модель" },
  "Modeļa sērija": { en: "Model series", ru: "Модельный ряд" },
  "VIN kods": { en: "VIN code", ru: "VIN-код" },
  "Transportlīdzekļa tips": { en: "Vehicle type", ru: "Тип транспортного средства" },
  Ātrumkārba: { en: "Transmission", ru: "Коробка передач" },
  Stūre: { en: "Steering", ru: "Руль" },
  Dzinējs: { en: "Engine", ru: "Двигатель" },
  "Dzinēja numurs": { en: "Engine number", ru: "Номер двигателя" },
  Virsbūve: { en: "Body", ru: "Кузов" },
  Piedziņa: { en: "Drive", ru: "Привод" },
  Jauda: { en: "Power", ru: "Мощность" },
  "Integrācijas līmenis": { en: "Integration level", ru: "Уровень интеграции" },
  "Pašreizējais I-Level": { en: "Current I level", ru: "Текущий I-Level" },
  "Izstrādes kods": { en: "Development code", ru: "Код разработки" },
  "Modeļa kods": { en: "Model code", ru: "Код модели" },
  "Ražošanas datums": { en: "Production date", ru: "Дата производства" },
  "Garantijas sākums": { en: "Warranty start date", ru: "Начало гарантии" },
  "Valsts / reģions": { en: "Country / region", ru: "Страна / регион" },
  "Ražošanas valsts": { en: "Country of manufacture", ru: "Страна производства" },
  Krāsa: { en: "Colour", ru: "Цвет" },
  "Krāsas kods": { en: "Colour code", ru: "Код краски" },
  Interjers: { en: "Upholstery", ru: "Салон" },
  "Interjera kods": { en: "Upholstery code", ru: "Код салона" },
  Degviela: { en: "Fuel", ru: "Топливо" },
  Tilpums: { en: "Displacement", ru: "Объём" },
  "Dzinēja / kārbas specifikācija": { en: "Engine / gearbox specification", ru: "Спецификация двигателя / коробки" },
  "Gatavā komplektācija": { en: "Factory equipment", ru: "Заводская комплектация" },
  "Dīlera servisa žurnāls": { en: "Dealer service log", ru: "Сервисный журнал дилера" },
  "ASV vēsture un bojājumi": { en: "US history and damage", ru: "История и повреждения в США" },
  "Eiropas reģistru dati": { en: "European register data", ru: "Данные европейских реестров" },
  "Servisa veids / Piezīmes": { en: "Service type / notes", ru: "Тип ТО / примечания" },
  "Nobraukums, km": { en: "Mileage, km", ru: "Пробег, км" },
  "Importa datums": { en: "Import date", ru: "Дата импорта" },
  "Bojājumi / avārijas": { en: "Damage / accidents", ru: "Повреждения / аварии" },
  "Izsoles dati": { en: "Auction data", ru: "Данные аукциона" },
  "ASV odometrs": { en: "US odometer", ru: "Одометр США" },

  // Vizīšu birkas un kopsavilkums
  Apkope: { en: "Service", ru: "ТО" },
  Remonts: { en: "Repair", ru: "Ремонт" },
  Kampaņa: { en: "Campaign", ru: "Кампания" },
  Garantija: { en: "Warranty", ru: "Гарантия" },
  Nolasījums: { en: "Key read", ru: "Считывание" },
  Vizītes: { en: "Visits", ru: "Визиты" },
  "Pirmā vizīte": { en: "First visit", ru: "Первый визит" },
  "Pēdējā vizīte": { en: "Last visit", ru: "Последний визит" },
  "Pēdējais dīlera km": { en: "Latest dealer km", ru: "Последний пробег у дилера" },
  "Garākais periods bez ierakstiem": { en: "Longest period without records", ru: "Самый долгий период без записей" },
  "Kampaņas veiktas": { en: "Campaigns completed", ru: "Кампании выполнены" },
  "Lielie mezgli": { en: "Major assemblies", ru: "Крупные узлы" },
  "Nav fiksēts": { en: "None recorded", ru: "Не зафиксировано" },
  "Citi darbi": { en: "Other work", ru: "Прочие работы" },
  "Periods bez ierakstiem": { en: "Period without records", ru: "Период без записей" },
  "Detalizēts darbu saraksts atskaitē nav pieejams.": {
    en: "A detailed list of work is not available in this report.",
    ru: "Подробный перечень работ в отчёте недоступен.",
  },
  "Pirmais ieraksts": { en: "First record", ru: "Первая запись" },
  "Pēdējais ieraksts": { en: "Latest record", ru: "Последняя запись" },
  vizītes: { en: "visits", ru: "визитов" },
  "Sadales ķēde": { en: "Timing chain", ru: "Цепь ГРМ" },
  Zobsiksna: { en: "Timing belt", ru: "Ремень ГРМ" },
  "Kloķvārpstas blīvslēgs": { en: "Crankshaft seal", ru: "Сальник коленвала" },
  "Sadales kārba": { en: "Transfer case", ru: "Раздаточная коробка" },
  "Diferenciālis / reduktors": { en: "Differential / reduction gear", ru: "Дифференциал / редуктор" },
  "Ātrumkārbas eļļas maiņa": { en: "Transmission oil change", ru: "Замена масла в КПП" },
  "Sadales kārbas eļļas maiņa": { en: "Transfer case oil change", ru: "Замена масла в раздаточной коробке" },
  "Diferenciāļa eļļas maiņa": { en: "Differential oil change", ru: "Замена масла в дифференциале" },
  "Divmasu spararats": { en: "Dual-mass flywheel", ru: "Двухмассовый маховик" },
  Sajūgs: { en: "Clutch", ru: "Сцепление" },
  Kardāns: { en: "Propshaft", ru: "Кардан" },
  Turbokompresors: { en: "Turbocharger", ru: "Турбокомпрессор" },
  "Virsbūve / stikls": { en: "Body / glass", ru: "Кузов / стекло" },
  "Negadījuma / virsbūves remonts": { en: "Accident / body repair", ru: "Ремонт после ДТП / кузова" },
  "Bojājuma remonts": { en: "Damage repair", ru: "Ремонт повреждений" },
  // Statiskais krāsas biezuma bloks (lib/paint-gauge-static-block.ts) - agrāk palika LV vai deva "Bodys stāvoklis".
  // PASŪTĪJUMA DATI bloks (client-report-pdf-layout-draft.ts) un CSDD statuss.
  "PASŪTĪJUMA DATI": { en: "ORDER DETAILS", ru: "ДАННЫЕ ЗАКАЗА" },
  Maksājums: { en: "Payment", ru: "Оплата" },
  Pasūtījums: { en: "Order", ru: "Заказ" },
  Summa: { en: "Amount", ru: "Сумма" },
  Klients: { en: "Client", ru: "Клиент" },
  "Vārds, uzvārds": { en: "Name", ru: "Имя, фамилия" },
  "Klienta komentārs": { en: "Client comment", ru: "Комментарий клиента" },
  Reģistrēts: { en: "Registered", ru: "Зарегистрирован" },
  "Virsbūves stāvoklis un krāsas biezums": { en: "Body condition and paint thickness", ru: "Состояние кузова и толщина ЛКП" },
  "Digitālie dati var neuzrādīt krāsotus elementus, ja darbi veikti neatkarīgā servisā vai mēģinot noslēpt sīkus defektus. Virsbūve jāpārbauda klātienē ar krāsas biezuma mērītāju. Ārējiem paneļiem rūpnīcas rādījums parasti ir ap 100 līdz 150 µm. Visiem paneļiem jābūt ar līdzīgiem mērījumiem. Starpība no 50 līdz 150 µm starp blakus esošajiem elementiem var norādīt uz kosmētisku pārkrāsošanu. Iekšējās ailes un konstrukcijas elementi parasti uzrāda aptuveni uz pusi mazāku mikronu skaitu, kas ir normāli un liecina par rūpnīcas krāsojumu, nevis remonta pēdām.":
    {
      en: "Digital records may not show repainted panels if the work was done at an independent garage or to hide minor defects. The body must be checked in person with a paint thickness gauge. On exterior panels the factory reading is usually around 100 to 150 µm. All panels should show similar readings. A difference of 50 to 150 µm between adjacent panels may indicate cosmetic repainting. Inner sills and structural parts usually show roughly half the micron value, which is normal and indicates factory paint, not repair traces.",
      ru: "Цифровые данные могут не показывать перекрашенные элементы, если работы выполнялись в независимом сервисе или чтобы скрыть мелкие дефекты. Кузов нужно проверить на месте толщиномером ЛКП. На наружных панелях заводское значение обычно от 100 до 150 µm. Все панели должны показывать схожие значения. Разница от 50 до 150 µm между соседними элементами может указывать на косметическую перекраску. Внутренние пороги и силовые элементы обычно показывают примерно вдвое меньшее значение, что нормально и говорит о заводской окраске, а не о следах ремонта.",
    },
  "Sagatavots klientam:": { en: "Prepared for: ", ru: "Подготовлено для: " },
  "mēn.": { en: "mo.", ru: "мес." },

  // Eļļas intervāli / ASV / Izsoļu portālu arhīvs / tabulu galviņas, kas paliek LV bez diakritikas
  "fiksētas maiņas": { en: "recorded changes", ru: "зафиксированные замены" },
  "vidējais intervāls": { en: "average interval", ru: "средний интервал" },
  "vidējais laiks": { en: "average time", ru: "среднее время" },
  Intervāls: { en: "Interval", ru: "Интервал" },
  Periods: { en: "Period", ru: "Период" },
  "Pret ražotāja intervālu": { en: "Against manufacturer interval", ru: "К интервалу производителя" },
  "dīlera datos atbilst intervālam": {
    en: "of dealer records are within the interval",
    ru: "данных дилера в пределах интервала",
  },
  "dīlera datos virs intervāla": {
    en: "of dealer records exceed the interval",
    ru: "данных дилера сверх интервала",
  },
  "nav dīlera datu": { en: "no dealer records", ru: "нет данных дилера" },
  "nobraukuma ar dīlera datiem": { en: "of mileage with dealer records", ru: "пробега с данными дилера" },
  "Dīlera dati apliecina": { en: "Dealer records cover", ru: "Данные дилера подтверждают" },
  "Kopš pēdējā ieraksta": { en: "Since last record", ru: "С последней записи" },
  "Ieraksts bez detaļām": { en: "Record without details", ru: "Запись без деталей" },
  "Piederumi / riepas": { en: "Accessories / tyres", ru: "Аксессуары / шины" },
  "EGR dzesētājs / vārsts": { en: "EGR cooler / valve", ru: "Охладитель / клапан EGR" },
  "Kvēpu filtrs (DPF)": { en: "Particulate filter (DPF)", ru: "Сажевый фильтр (DPF)" },
  "AdBlue / SCR sistēma": { en: "AdBlue / SCR system", ru: "Система AdBlue / SCR" },
  "Ūdens sūknis": { en: "Water pump", ru: "Водяной насос" },
  "Piekares pneimobalons": { en: "Air suspension spring", ru: "Пневмобаллон подвески" },
  "Kondicioniera kompresors": { en: "A/C compressor", ru: "Компрессор кондиционера" },
  "Nobraukums mazāks nekā iepriekšējā ierakstā": { en: "Mileage lower than in the previous record", ru: "Пробег меньше, чем в предыдущей записи" },
  "Iespējama nobraukuma ievades kļūda: iepriekšējā ierakstā": { en: "Possible mileage entry error: previous record shows", ru: "Возможная ошибка ввода пробега: в предыдущей записи" },
  "Dīlera eļļas maiņu ieraksti aptver": { en: "Dealer oil change records cover", ru: "Записи дилера о замене масла охватывают" },
  "Dīlera datos eļļas maiņas ierakstu nav pēc": { en: "No oil change records in dealer data after", ru: "В данных дилера нет записей о замене масла после" },
  "Procenti rēķināti pēc laika līdz šodienai.": { en: "Percentages are calculated by time up to today.", ru: "Проценты рассчитаны по времени до сегодняшнего дня." },
  "Procenti rēķināti pēc nobraukuma līdz": { en: "Percentages are calculated by mileage up to", ru: "Проценты рассчитаны по пробегу до" },
  "Procenti attiecas tikai uz šo posmu.": { en: "Percentages refer to this section only.", ru: "Проценты относятся только к этому отрезку." },
  "laika ar dīlera datiem": { en: "of time with dealer records", ru: "времени с данными дилера" },
  "Ražotāja intervāls nav droši zināms. Ievērošanu nevērtējam. Joslas rāda tikai, cik kilometru dīlera dati apliecina.":
    {
      en: "The manufacturer interval is not known with certainty. We do not score compliance. The bars only show how many kilometres the dealer records cover.",
      ru: "Интервал производителя достоверно неизвестен. Соответствие не оцениваем. Полосы показывают только, сколько километров покрывают данные дилера.",
    },
  " Gaišā zona ir pieļaujamās robežas, melnā atzīme ir augšējā robeža.": {
    en: " The light band is the allowed range; the black mark is the upper limit.",
    ru: " Светлая зона - допустимый диапазон, чёрная отметка - верхняя граница.",
  },
  " Melnā atzīme joslā ir šis intervāls.": {
    en: " The black mark on the bar is this interval.",
    ru: " Чёрная отметка на полосе - этот интервал.",
  },
  "Svarīgi par apkopes datiem": {
    en: "Important: how to read service data",
    ru: "Важно о данных обслуживания",
  },
  "Apkopes ierakstus sniedz autorizētie dīleri un lieli servisu tīkli. Neatkarīgie servisi šos datus nesūta.": {
    en: "Service records come from authorised dealers and large service networks. Independent garages do not send this data.",
    ru: "Записи об обслуживании передают официальные дилеры и крупные сервисные сети. Независимые сервисы эти данные не передают.",
  },
  "Trūkstošs ieraksts.": { en: "Missing record.", ru: "Отсутствующая запись." },
  "Ja starp ierakstiem ir ilgāks laiks vai nobraukums, nekā paredz ražotājs, tas nepierāda, ka apkope nav veikta - tikai to, ka šajā datubāzē par to nav datu.": {
    en: "A longer time or mileage gap between records than the manufacturer specifies does not prove that a service was skipped - only that this database has no data on it.",
    ru: "Если между записями прошло больше времени или пробега, чем предусматривает производитель, это не доказывает, что ТО не проводилось, - лишь то, что в этой базе данных о нём нет.",
  },
  "Vispārīgi ieraksti.": { en: "Generic records.", ru: "Общие записи." },
  "Ierakstus „apkope” vai „serviss” bez eļļas nosaukuma neskaitām kā eļļas maiņu, ja ražotāja plāns to neietver vai nav zināms.": {
    en: "Records such as “service” or “maintenance” without an oil name are not counted as an oil change if the manufacturer plan does not include one or is unknown.",
    ru: "Записи „ТО” или „сервис” без названия масла не считаются заменой масла, если план производителя её не включает или неизвестен.",
  },
  "Plānotās apkopes, kas vienmēr ietver eļļas maiņu (piem. Mercedes-Benz „Apkope A” / „Apkope B”), skaitām.": {
    en: "Scheduled services that always include an oil change (e.g. Mercedes-Benz “Service A” / “Service B”) are counted.",
    ru: "Плановые ТО, которые всегда включают замену масла (напр. Mercedes-Benz „Service A” / „Service B”), учитываются.",
  },
  "Plānotās apkopes, kas vienmēr ietver eļļas maiņu, skaitām.": {
    en: "Scheduled services that always include an oil change are counted.",
    ru: "Плановые ТО, которые всегда включают замену масла, учитываются.",
  },
  "Ieteikums.": { en: "Recommendation.", ru: "Рекомендация." },
  "Salīdziniet ar servisa grāmatiņu un čekiem, un pirms pirkuma veiciet diagnostiku neatkarīgā servisā.": {
    en: "Compare with the service book and receipts, and have a pre-purchase inspection done at an independent garage.",
    ru: "Сверьте с сервисной книжкой и чеками, а перед покупкой пройдите диагностику в независимом сервисе.",
  },
  Veids: { en: "Type", ru: "Тип" },
  Dati: { en: "Data", ru: "Данные" },
  "ASV VĒSTURE": { en: "US HISTORY", ru: "ИСТОРИЯ США" },
  "Pārbaudītie reģistri": { en: "Registers checked", ru: "Проверенные реестры" },
  Brīdinājumi: { en: "Alerts", ru: "Предупреждения" },
  "Fiksētie bojājumi": { en: "Recorded damage", ru: "Зафиксированные повреждения" },
  "Apdrošinātāju un norakstīšanas ieraksti": {
    en: "Insurer and write-off records",
    ru: "Записи страховщиков и списаний",
  },
  "Īpašumtiesību atzīmes": { en: "Title brands", ru: "Отметки права собственности" },
  "Īpašumtiesību (title) ieraksti": { en: "Title records", ru: "Записи о праве собственности (title)" },
  "Pārdošanas un izsoļu vēsture": { en: "Sales and auction history", ru: "История продаж и аукционов" },
  "Title atzīmes": { en: "Title brands", ru: "Отметки title" },
  "Title (īpašumtiesību) ieraksti": { en: "Title (ownership) records", ru: "Записи title (право собственности)" },
  "Ķīlas, aizturēšana, eksports": { en: "Liens, holds, export", ru: "Залоги, удержания, экспорт" },
  Zādzības: { en: "Thefts", ru: "Кражи" },
  Ieraksts: { en: "Record", ru: "Запись" },
  "Avotu salīdzinājums (pārklājošie lauki)": {
    en: "Source comparison (overlapping fields)",
    ru: "Сравнение источников (пересекающиеся поля)",
  },
  Lauks: { en: "Field", ru: "Поле" },
  Spēcīgākais: { en: "Stronger source", ru: "Более сильный источник" },
  "atrasts ieraksts": { en: "record found", ru: "найдена запись" },
  "Dīlera kopsavilkums": { en: "Dealer summary", ru: "Сводка дилера" },
  "Nobraukuma līkne": { en: "Mileage curve", ru: "Кривая пробега" },
  "precīzs ieraksts": { en: "precise record", ru: "точная запись" },
  "1 precīzs ieraksts": { en: "1 precise record", ru: "1 точная запись" },
  "{n} precīzi ieraksti": { en: "{n} precise records", ru: "{n} точных записей" },
  "1 ieraksts": { en: "1 record", ru: "1 запись" },
  "1 rādījums": { en: "1 reading", ru: "1 показание" },
  "{n} rādījumi": { en: "{n} readings", ru: "{n} показаний" },
  "1 precīzs rādījums": { en: "1 precise reading", ru: "1 точное показание" },
  "{n} precīzi rādījumi": { en: "{n} precise readings", ru: "{n} точных показаний" },
  "{n} ieraksti": { en: "{n} records", ru: "{n} записей" },
  "NOBRAUKUMS PA GADIEM": { en: "MILEAGE BY YEAR", ru: "ПРОБЕГ ПО ГОДАМ" },
  "tūkst. km": { en: "thous. km", ru: "тыс. км" },
  "tūkst. km gadā": { en: "thous. km / year", ru: "тыс. км в год" },
  nepilns: { en: "partial", ru: "неполный" },
  "nepārtraukta līnija savieno precīzos ierakstus": {
    en: "unbroken line connects the precise records",
    ru: "непрерывная линия соединяет точные записи",
  },
  "precīzs gada nobraukums": { en: "precise annual mileage", ru: "точный годовой пробег" },
  "aptuveni (nav precīzu datu)": { en: "approximate (no precise data)", ru: "примерно (нет точных данных)" },
  "nepilns gads": { en: "incomplete year", ru: "неполный год" },
  "Nobraukuma vēsture un nobraukums pa kalendāra gadiem": {
    en: "Mileage history and mileage by calendar year",
    ru: "История пробега и пробег по календарным годам",
  },
  "Gadu robežās nobraukums interpolēts lineāri starp tuvākajiem precīzajiem ierakstiem. Svītrotie stabiņi: aptuvens vairāku gadu intervāla sadalījums, nevis precīzs gada nobraukums. {y0}: no {d0}; {y1}: līdz {d1} - bez pārrēķina uz pilnu gadu.":
    {
      en: "Year-end mileage is linearly interpolated between the nearest precise records. Hatched bars are an approximate split of a multi-year interval, not a precise annual mileage. {y0}: from {d0}; {y1}: until {d1} - not annualized to a full year.",
      ru: "Пробег на границах года линейно интерполирован между ближайшими точными записями. Штрихованные столбцы - приблизительное деление многолетнего интервала, а не точный годовой пробег. {y0}: с {d0}; {y1}: до {d1} - без пересчёта на полный год.",
    },
  "1 ieraksts ar mākslīgu kritumu grafikā nav rādīts - tāpat kā esošajā atskaitē.": {
    en: "1 record with an artificial drop is not shown on the chart - same as in the existing report.",
    ru: "1 запись с искусственным падением на графике не показана - как и в существующем отчёте.",
  },
  "{n} ieraksti ar mākslīgu kritumu grafikā nav rādīti - tāpat kā esošajā atskaitē.": {
    en: "{n} records with an artificial drop are not shown on the chart - same as in the existing report.",
    ru: "{n} записей с искусственным падением на графике не показаны - как и в существующем отчёте.",
  },
};

/** Sakārtots pēc garuma (garākais pirmais), lai īsāka frāze nesabojā garāku, kas to satur. */
const SORTED_STATIC_KEYS: string[] = Object.keys(STATIC_TRANSLATIONS).sort((a, b) => b.length - a.length);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Atslēga tikai kā vesels vārds / frāze: ne vārda daļa ("Virsbūve" iekš "Virsbūves" deva "Bodys", RU "Кузовs").
 * Ja atslēga sākas vai beidzas ar burtu/ciparu, blakus nedrīkst būt cits burts/cipars.
 */
const STATIC_KEY_PATTERNS = new Map<string, RegExp>();
function staticKeyPattern(lv: string): RegExp {
  let re = STATIC_KEY_PATTERNS.get(lv);
  if (!re) {
    const head = /^[\p{L}\p{N}]/u.test(lv) ? "(?<![\\p{L}\\p{N}])" : "";
    const tail = /[\p{L}\p{N}]$/u.test(lv) ? "(?![\\p{L}\\p{N}])" : "";
    re = new RegExp(`${head}${escapeRegExp(lv)}${tail}`, "gu");
    STATIC_KEY_PATTERNS.set(lv, re);
  }
  re.lastIndex = 0;
  return re;
}

/** Vācu statiskais apvalks. Katram STATIC_TRANSLATIONS atslēgas vārdam jābūt ierakstam. */
export const CLIENT_REPORT_DE: Record<string, string> = {
  "TRANSPORTLĪDZEKĻA AUDITS": "FAHRZEUGHISTORIE-AUDIT",
  "Business Datu atskaite": "Business Datenbericht",
  "Datu atskaite": "Datenbericht",
  "APPROVED BY IRISS": "APPROVED BY IRISS",
  "1. Tehnisko risku analīze": "1. Analyse der technischen Risiken",
  "2. Ieteikumi klātienes apskatei": "2. Empfehlungen für die Besichtigung vor Ort",
  "3. Kopsavilkums": "3. Zusammenfassung",
  "Tehnisko risku analīze": "Analyse der technischen Risiken",
  "Risku analīze": "Risikoanalyse",
  "Ieteikumi klātienes apskatei": "Empfehlungen für die Besichtigung vor Ort",
  Ieteikumi: "Empfehlungen",
  Kopsavilkums: "Zusammenfassung",
  "NOBRAUKUMA VĒSTURE": "KILOMETERSTAND-HISTORIE",
  "NOBRAUKUMA VĒSTURES KOMENTĀRS": "KOMMENTAR ZUR KILOMETERSTAND-HISTORIE",
  "NEGADĪJUMU VĒSTURES KOPSAVILKUMS": "ZUSAMMENFASSUNG DER SCHADENSHISTORIE",
  Negadījums: "Schaden",
  "Bojājumu ieraksts": "Schadeneintrag",
  "1 bojājumu ieraksts": "1 Schadeneintrag",
  "1 negadījums": "1 Schaden",
  Zonas: "Zonen",
  Detaļas: "Teile",
  Grupas: "Gruppen",
  "Negadījumi:": "Schäden:",
  "Negadījumu skaits:": "Anzahl der Schäden:",
  "Zaudējumu dati": "Schadendaten",
  "SLUDINĀJUMA ANALĪZE": "INSERATSANALYSE",
  "Sludinājuma analīze": "Inseratsanalyse",
  "Cenas izmaiņas šajā sludinājumā": "Preisänderungen in diesem Inserat",
  "Cenas izmaiņa:": "Preisänderung:",
  "Ilgums tirgū:": "Standzeit:",
  "Tirgus dati": "Marktdaten",
  "OFICIĀLĀ DĪLERA DATI": "OFFIZIELLE HÄNDLERDATEN",
  "DĀNIJAS REĢISTRI": "DÄNISCHE REGISTER",
  "NĪDERLANDES REĢISTRI": "NIEDERLÄNDISCHE REGISTER",
  "ZVIEDRIJAS REĢISTRI": "SCHWEDISCHE REGISTER",
  "Igaunijas reģistrs": "Estnisches Register",
  "Igaunijas OCTA": "Estnische OCTA",
  "CITI AVOTI": "WEITERE QUELLEN",
  "Servisa vēsture": "Servicehistorie",
  "Eļļas maiņas intervāli": "Ölwechselintervalle",
  "Servisa un remontu vēsture": "Service- und Reparaturhistorie",
  "Fotogrāfiju pielikums": "Fotoanhang",
  " atskaites ģenerēšanā izmantotie avoti": " für diesen Bericht verwendete Quellen",
  "Maksas vēstures atskaites": "Kostenpflichtige Historienberichte",
  "Publiskas Eiropas datubāzes": "Öffentliche europäische Datenbanken",
  "Citi avoti": "Weitere Quellen",
  "Kas tika pārbaudīts": "Was geprüft wurde",
  Kopā: "Gesamt",
  Datums: "Datum",
  "Odometrs (km)": "Kilometerstand (km)",
  Avots: "Quelle",
  Valsts: "Land",
  "Valsts numura zīme": "Kennzeichen",
  "izlaiduma gads": "Baujahr",
  Transportlīdzeklis: "Fahrzeug",
  Komentārs: "Kommentar",
  "Marka, modelis:": "Marke, Modell:",
  "Reģistrācijas numurs:": "Kennzeichen:",
  "Pirmā reģistrācija:": "Erstzulassung:",
  "Pirmā reģistrācija Latvijā:": "Erstzulassung in Lettland:",
  "Nākamās apskates datums:": "Nächster HU-Termin:",
  "Iepriekšējās apskates datums:": "Vorheriger Prüftermin:",
  "Motora tilpums (cm³):": "Hubraum (cm³):",
  "Motora maksimālā jauda (kW):": "Max. Motorleistung (kW):",
  "Degvielas veids:": "Kraftstoff:",
  "Emisiju standarts:": "Abgasnorm:",
  "Pilna masa (kg):": "Zulässige Gesamtmasse (kg):",
  "Pašmasa (kg):": "Leermasse (kg):",
  "Ekspluatācijas nodoklis (EUR):": "Kfz-Steuer (EUR):",
  "Reģistrācijas statuss:": "Zulassungsstatus:",
  "Dūmainības koeficients (m⁻¹):": "Trübungskoeffizient (m⁻¹):",
  "Atgāzu cietās daļiņas:": "Partikel im Abgas:",
  "Atgāzu cietās daļiņas (cm⁻³):": "Partikel im Abgas (cm⁻³):",
  "Iepriekšējās reģistrācijas valsts:": "Land der vorherigen Zulassung:",
  "Īpašnieku skaits Latvijā:": "Anzahl der Halter in Lettland:",
  "Tehnisko apskašu vēsture": "Historie der technischen Prüfungen",
  "Iepriekšējās apskates dati": "Daten der vorherigen Prüfung",
  "Auto pārdošanā (dienas):": "Inseriert (Tage):",
  "Izveidots:": "Erstellt:",
  "Cenas izmaiņas (eiro):": "Preisänderungen (EUR):",
  "Odometrs, km:": "Kilometerstand, km:",
  "Drukāt / PDF": "Drucken / PDF",
  "Drukāt (augsts kontrasts)": "Drucken (hoher Kontrast)",
  "Drukājamā versija - palielināts kontrasts papīram. Digitālajam PDF lietojiet „Ģenerēt PDF”.":
    "Druckversion mit höherem Kontrast für Papier. Für ein digitales PDF „PDF erzeugen“ verwenden.",
  "Demonstrācijas dati": "Demodaten",
  Ģenerēts: "Erstellt",
  "ATSKAITES KOPSAVILKUMS": "BERICHTSZUSAMMENFASSUNG",
  "Vēstures kopsavilkums": "Historienzusammenfassung",
  "NEGADĪJUMU VĒSTURE": "SCHADENSHISTORIE",
  "Negadījumi un bojājumi": "Schäden und Beschädigungen",
  "Avotos nav fiksētu negadījumu": "In den Quellen sind keine Unfälle erfasst",
  "Nav ierakstu": "Keine Einträge",
  "Nav datu": "Keine Daten",
  "Publicēts:": "Veröffentlicht:",
  "Izsoļu / reģistru bojājumi bez summas": "Auktions- / Registerschäden ohne Betrag",
  "Bojājumi:": "Schäden:",
  "Īpašnieku skaits": "Anzahl der Halter",
  "Reģistrācija Latvijā": "Zulassung in Lettland",
  "Reģistrācija Somijā": "Zulassung in Finnland",
  "Reģistrācija Igaunijā": "Zulassung in Estland",
  "Reģistrācija Lietuvā": "Zulassung in Litauen",
  "Reģistrācija Dānijā": "Zulassung in Dänemark",
  "Reģistrācija Zviedrijā": "Zulassung in Schweden",
  "Reģistrācija Norvēģijā": "Zulassung in Norwegen",
  "Reģistrācija Vācijā": "Zulassung in Deutschland",
  "Reģistrācija Nīderlandē": "Zulassung in den Niederlanden",
  "Reģistrācija Beļģijā": "Zulassung in Belgien",
  "Reģistrācija Luksemburgā": "Zulassung in Luxemburg",
  "Reģistrācija Francijā": "Zulassung in Frankreich",
  "Reģistrācija Itālijā": "Zulassung in Italien",
  "Reģistrācija Spānijā": "Zulassung in Spanien",
  "Reģistrācija Austrijā": "Zulassung in Österreich",
  "Reģistrācija Šveicē": "Zulassung in der Schweiz",
  "Reģistrācija Polijā": "Zulassung in Polen",
  "Reģistrācija Čehijā": "Zulassung in Tschechien",
  "Reģistrācija ASV": "Zulassung in den USA",
  "Reģistrācija Apvienotajā Karalistē": "Zulassung in dem Vereinigten Königreich",
  "Reģistrācija Ungārijā": "Zulassung in Ungarn",
  Nobraukums: "Kilometerstand",
  "DĪLERA DATI": "HÄNDLERDATEN",
  "IZSOĻU PORTĀLU ARHĪVS": "AUKTIONSARCHIV",
  "Pirmā reģistrācija": "Erstzulassung",
  "Ieraksts reģistrā": "Registereintrag",
  "Tehniskā apskate": "Technische Prüfung",
  "Īpašnieka maiņa": "Halterwechsel",
  "Servisa apmeklējums": "Werkstattbesuch",
  Sludinājums: "Inserat",
  "Sludinājuma cenas izmaiņa": "Preisänderung im Inserat",
  "Izlikts pārdošanā": "Zum Verkauf inseriert",
  "(pēc sludinājuma, nav apstiprināts)": "(laut Inserat, nicht bestätigt)",
  "Sludinājuma vēsture": "Inseratshistorie",
  "Pārdevēja portrets": "Verkäuferprofil",
  "Fotogrāfiju analīze": "Fotoanalyse",
  "Pārdošanas sludinājuma konteksts": "Kontext des Verkaufsinserats",
  "Grafika ģenerēšanā izmantotais avotu skaits:": "Anzahl der Quellen für die Grafik:",
  pārbaudīts: "geprüft",
  Atruna: "Hinweis",
  Konfidencialitāte: "Vertraulichkeit",
  "PROVIN.LV pakalpojums ir konsultatīvs: mēs izvērtējam pieejamo informāciju par transportlīdzekli un sniedzam ieteikumus. Atskaite ir digitāls datu apkopojums, nevis tehniskā diagnostika. Tā nekādā gadījumā neaizstāj pilnvērtīgu transportlīdzekļa pārbaudi un apskati klātienē. Atskaite nav valsts iestādes izraksts, neatkarīga tehniskā ekspertīze vai juridisks atzinums. Gala lēmumu par transportlīdzekļa iegādi pieņem klients.":
    "Der Dienst von PROVIN.LV ist beratend: Wir bewerten die verfügbaren Informationen zum Fahrzeug und geben Empfehlungen. Der Bericht ist eine digitale Datenzusammenstellung, keine technische Diagnose. Er ersetzt in keinem Fall eine vollständige Prüfung und Besichtigung des Fahrzeugs vor Ort. Der Bericht ist kein Auszug einer staatlichen Stelle, kein unabhängiges technisches Gutachten und kein Rechtsgutachten. Die Kaufentscheidung trifft der Kunde.",
  "PROVIN.LV Business atskaite ir digitāls pieejamās informācijas par transportlīdzekli apkopojums, nevis tehniskā diagnostika. Tā nekādā gadījumā neaizstāj pilnvērtīgu transportlīdzekļa pārbaudi un apskati klātienē. Atskaite nav valsts iestādes izraksts, neatkarīga tehniskā ekspertīze vai juridisks atzinums. Gala lēmumu par transportlīdzekļa iegādi pieņem klients.":
    "Der PROVIN.LV Business-Bericht ist eine digitale Zusammenstellung der verfügbaren Informationen zum Fahrzeug, keine technische Diagnose. Er ersetzt in keinem Fall eine vollständige Prüfung und Besichtigung des Fahrzeugs vor Ort. Der Bericht ist kein Auszug einer staatlichen Stelle, kein unabhängiges technisches Gutachten und kein Rechtsgutachten. Die Kaufentscheidung trifft der Kunde.",
  "Šī atskaite ir sagatavota ekskluzīvi tās pasūtītājam un ir izmantojama tikai personīgām vajadzībām. Atskaiti un tajā ietverto informāciju ir kategoriski aizliegts pavairot, publiski reproducēt, nodot vai jebkādā citā veidā darīt pieejamu trešajām personām (tostarp transportlīdzekļa pārdevējam) bez saskaņošanas ar PROVIN.LV.":
    "Dieser Bericht wurde ausschließlich für den Auftraggeber erstellt und darf nur für private Zwecke verwendet werden. Den Bericht und die darin enthaltenen Informationen zu vervielfältigen, öffentlich wiederzugeben, weiterzugeben oder Dritten (einschließlich des Fahrzeugverkäufers) ohne Abstimmung mit PROVIN.LV zugänglich zu machen, ist untersagt.",
  "Transportlīdzekļa informācija": "Fahrzeuginformationen",
  "Lielie darbi": "Größere Arbeiten",
  Aprīkojums: "Ausstattung",
  Modelis: "Modell",
  "Modeļa sērija": "Modellreihe",
  "VIN kods": "VIN-Code",
  "Transportlīdzekļa tips": "Fahrzeugtyp",
  Ātrumkārba: "Getriebe",
  Stūre: "Lenkung",
  Dzinējs: "Motor",
  "Dzinēja numurs": "Motornummer",
  Virsbūve: "Karosserie",
  Piedziņa: "Antrieb",
  Jauda: "Leistung",
  "Integrācijas līmenis": "Integrationsstand",
  "Pašreizējais I-Level": "Aktueller I-Level",
  "Izstrādes kods": "Entwicklungscode",
  "Modeļa kods": "Modellcode",
  "Ražošanas datums": "Produktionsdatum",
  "Garantijas sākums": "Garantiebeginn",
  "Valsts / reģions": "Land / Region",
  "Ražošanas valsts": "Herstellungsland",
  Krāsa: "Farbe",
  "Krāsas kods": "Farbcode",
  Interjers: "Interieur",
  "Interjera kods": "Interieurcode",
  Degviela: "Kraftstoff",
  Tilpums: "Hubraum",
  "Dzinēja / kārbas specifikācija": "Motor- / Getriebespezifikation",
  "Gatavā komplektācija": "Werksausstattung",
  "Dīlera servisa žurnāls": "Händler-Serviceprotokoll",
  "ASV vēsture un bojājumi": "US-Historie und Schäden",
  "Eiropas reģistru dati": "Daten europäischer Register",
  "Servisa veids / Piezīmes": "Serviceart / Hinweise",
  "Nobraukums, km": "Kilometerstand, km",
  "Importa datums": "Importdatum",
  "Bojājumi / avārijas": "Schäden / Unfälle",
  "Izsoles dati": "Auktionsdaten",
  "ASV odometrs": "US-Kilometerstand",
  Apkope: "Wartung",
  Remonts: "Reparatur",
  Kampaņa: "Aktion",
  Garantija: "Garantie",
  Nolasījums: "Schlüsselauslesung",
  Vizītes: "Besuche",
  "Pirmā vizīte": "Erster Besuch",
  "Pēdējā vizīte": "Letzter Besuch",
  "Pēdējais dīlera km": "Letzter Händler-km",
  "Garākais periods bez ierakstiem": "Längster Zeitraum ohne Einträge",
  "Kampaņas veiktas": "Aktionen durchgeführt",
  "Lielie mezgli": "Große Baugruppen",
  "Nav fiksēts": "Nicht erfasst",
  "Citi darbi": "Sonstige Arbeiten",
  "Periods bez ierakstiem": "Zeitraum ohne Einträge",
  "Detalizēts darbu saraksts atskaitē nav pieejams.":
    "Eine detaillierte Arbeitsliste liegt in diesem Bericht nicht vor.",
  "Pirmais ieraksts": "Erster Eintrag",
  "Pēdējais ieraksts": "Letzter Eintrag",
  vizītes: "Besuche",
  "Sadales ķēde": "Steuerkette",
  Zobsiksna: "Zahnriemen",
  "Kloķvārpstas blīvslēgs": "Kurbelwellendichtung",
  "Sadales kārba": "Verteilergetriebe",
  "Diferenciālis / reduktors": "Differential / Achsgetriebe",
  "Ātrumkārbas eļļas maiņa": "Getriebeölwechsel",
  "Sadales kārbas eļļas maiņa": "Verteilergetriebeölwechsel",
  "Diferenciāļa eļļas maiņa": "Differentialölwechsel",
  "Divmasu spararats": "Zweimassenschwungrad",
  Sajūgs: "Kupplung",
  Kardāns: "Gelenkwelle",
  Turbokompresors: "Turbolader",
  "Virsbūve / stikls": "Karosserie / Glas",
  "Negadījuma / virsbūves remonts": "Unfall- / Karosseriereparatur",
  "Bojājuma remonts": "Schadenreparatur",
  "PASŪTĪJUMA DATI": "BESTELLDATEN",
  Maksājums: "Zahlung",
  Pasūtījums: "Bestellung",
  Summa: "Betrag",
  Klients: "Kunde",
  "Vārds, uzvārds": "Name",
  "Klienta komentārs": "Kundenkommentar",
  Reģistrēts: "Zugelassen",
  "Virsbūves stāvoklis un krāsas biezums": "Karosseriezustand und Lackschichtdicke",
  "Digitālie dati var neuzrādīt krāsotus elementus, ja darbi veikti neatkarīgā servisā vai mēģinot noslēpt sīkus defektus. Virsbūve jāpārbauda klātienē ar krāsas biezuma mērītāju. Ārējiem paneļiem rūpnīcas rādījums parasti ir ap 100 līdz 150 µm. Visiem paneļiem jābūt ar līdzīgiem mērījumiem. Starpība no 50 līdz 150 µm starp blakus esošajiem elementiem var norādīt uz kosmētisku pārkrāsošanu. Iekšējās ailes un konstrukcijas elementi parasti uzrāda aptuveni uz pusi mazāku mikronu skaitu, kas ir normāli un liecina par rūpnīcas krāsojumu, nevis remonta pēdām.":
    "Digitale Daten zeigen lackierte Teile möglicherweise nicht, wenn die Arbeiten in einer freien Werkstatt oder zum Verbergen kleiner Mängel durchgeführt wurden. Die Karosserie muss vor Ort mit einem Lackschichtdickenmessgerät geprüft werden. An Außenteilen liegt der Werkswert meist bei etwa 100 bis 150 µm. Alle Teile sollten ähnliche Werte zeigen. Ein Unterschied von 50 bis 150 µm zwischen benachbarten Teilen kann auf eine kosmetische Nachlackierung hindeuten. Innere Schweller und Strukturteile zeigen meist etwa die Hälfte der Mikronwerte, was normal ist und auf Werkslack statt auf Reparaturspuren hinweist.",
  "Sagatavots klientam:": "Erstellt für: ",
  "mēn.": "Mon.",
  "fiksētas maiņas": "erfasste Wechsel",
  "vidējais intervāls": "durchschnittliches Intervall",
  "vidējais laiks": "durchschnittliche Zeit",
  Intervāls: "Intervall",
  Periods: "Zeitraum",
  "Pret ražotāja intervālu": "Gegen Herstellerintervall",
  "dīlera datos atbilst intervālam": "der Händlerdaten liegen im Intervall",
  "dīlera datos virs intervāla": "der Händlerdaten über dem Intervall",
  "nav dīlera datu": "keine Händlerdaten",
  "nobraukuma ar dīlera datiem": "der Laufleistung mit Händlerdaten",
  "Dīlera dati apliecina": "Händlerdaten belegen",
  "Kopš pēdējā ieraksta": "Seit letztem Eintrag",
  "Ieraksts bez detaļām": "Eintrag ohne Details",
  "Piederumi / riepas": "Zubehör / Reifen",
  "EGR dzesētājs / vārsts": "AGR-Kühler / -Ventil",
  "Kvēpu filtrs (DPF)": "Partikelfilter (DPF)",
  "AdBlue / SCR sistēma": "AdBlue- / SCR-System",
  "Ūdens sūknis": "Wasserpumpe",
  "Piekares pneimobalons": "Luftfeder",
  "Kondicioniera kompresors": "Klimakompressor",
  "Nobraukums mazāks nekā iepriekšējā ierakstā": "Kilometerstand niedriger als im vorherigen Eintrag",
  "Iespējama nobraukuma ievades kļūda: iepriekšējā ierakstā": "Möglicher Eingabefehler beim Kilometerstand: im vorherigen Eintrag",
  "Dīlera eļļas maiņu ieraksti aptver": "Ölwechsel-Einträge des Händlers decken ab:",
  "Dīlera datos eļļas maiņas ierakstu nav pēc": "Keine Ölwechsel-Einträge in den Händlerdaten nach dem",
  "Procenti rēķināti pēc laika līdz šodienai.": "Prozentwerte nach Zeit bis heute berechnet.",
  "Procenti rēķināti pēc nobraukuma līdz": "Prozentwerte nach Laufleistung berechnet bis",
  "Procenti attiecas tikai uz šo posmu.": "Prozentwerte beziehen sich nur auf diesen Abschnitt.",
  "laika ar dīlera datiem": "der Zeit mit Händlerdaten",
  "Ražotāja intervāls nav droši zināms. Ievērošanu nevērtējam. Joslas rāda tikai, cik kilometru dīlera dati apliecina.":
    "Das Herstellerintervall ist nicht sicher bekannt. Die Einhaltung bewerten wir nicht. Die Balken zeigen nur, wie viele Kilometer die Händlerdaten belegen.",
  " Gaišā zona ir pieļaujamās robežas, melnā atzīme ir augšējā robeža.":
    " Die helle Zone ist der zulässige Bereich, die schwarze Markierung die Obergrenze.",
  " Melnā atzīme joslā ir šis intervāls.": " Die schwarze Markierung auf dem Balken ist dieses Intervall.",
  "Svarīgi par apkopes datiem": "Wichtig: so lesen Sie die Servicedaten",
  "Apkopes ierakstus sniedz autorizētie dīleri un lieli servisu tīkli. Neatkarīgie servisi šos datus nesūta.":
    "Serviceeinträge stammen von Vertragshändlern und großen Werkstattnetzen. Freie Werkstätten übermitteln diese Daten nicht.",
  "Trūkstošs ieraksts.": "Fehlender Eintrag.",
  "Ja starp ierakstiem ir ilgāks laiks vai nobraukums, nekā paredz ražotājs, tas nepierāda, ka apkope nav veikta - tikai to, ka šajā datubāzē par to nav datu.":
    "Ein längerer Zeit- oder Kilometerabstand zwischen Einträgen als vom Hersteller vorgesehen beweist nicht, dass eine Wartung ausgelassen wurde - nur, dass diese Datenbank dazu keine Daten hat.",
  "Vispārīgi ieraksti.": "Allgemeine Einträge.",
  "Ierakstus „apkope” vai „serviss” bez eļļas nosaukuma neskaitām kā eļļas maiņu, ja ražotāja plāns to neietver vai nav zināms.":
    "Einträge wie „Wartung” oder „Service” ohne Ölangabe zählen wir nicht als Ölwechsel, wenn der Herstellerplan keinen vorsieht oder unbekannt ist.",
  "Plānotās apkopes, kas vienmēr ietver eļļas maiņu (piem. Mercedes-Benz „Apkope A” / „Apkope B”), skaitām.":
    "Planmäßige Wartungen, die immer einen Ölwechsel enthalten (z. B. Mercedes-Benz „Wartung A” / „Wartung B”), zählen wir.",
  "Plānotās apkopes, kas vienmēr ietver eļļas maiņu, skaitām.":
    "Planmäßige Wartungen, die immer einen Ölwechsel enthalten, zählen wir.",
  "Ieteikums.": "Empfehlung.",
  "Salīdziniet ar servisa grāmatiņu un čekiem, un pirms pirkuma veiciet diagnostiku neatkarīgā servisā.":
    "Vergleichen Sie mit dem Serviceheft und den Belegen und lassen Sie vor dem Kauf eine Diagnose in einer freien Werkstatt durchführen.",
  Veids: "Art",
  Dati: "Daten",
  "ASV VĒSTURE": "US-HISTORIE",
  "Pārbaudītie reģistri": "Geprüfte Register",
  Brīdinājumi: "Hinweise",
  "Fiksētie bojājumi": "Erfasste Schäden",
  "Apdrošinātāju un norakstīšanas ieraksti": "Versicherer- und Abschreibungseinträge",
  "Īpašumtiesību atzīmes": "Eigentumskennzeichnungen",
  "Īpašumtiesību (title) ieraksti": "Title-Einträge",
  "Pārdošanas un izsoļu vēsture": "Verkaufs- und Auktionshistorie",
  "Title atzīmes": "Title-Kennzeichnungen",
  "Title (īpašumtiesību) ieraksti": "Title-Einträge (Eigentum)",
  "Ķīlas, aizturēšana, eksports": "Pfandrechte, Sperren, Export",
  Zādzības: "Diebstähle",
  Ieraksts: "Eintrag",
  "Avotu salīdzinājums (pārklājošie lauki)": "Quellenvergleich (überlappende Felder)",
  Lauks: "Feld",
  Spēcīgākais: "Stärkere Quelle",
  "atrasts ieraksts": "Eintrag gefunden",
  "Dīlera kopsavilkums": "Händlerübersicht",
  "Nobraukuma līkne": "Kilometerstandkurve",
  "precīzs ieraksts": "präziser Eintrag",
  "1 precīzs ieraksts": "1 präziser Eintrag",
  "{n} precīzi ieraksti": "{n} präzise Einträge",
  "1 ieraksts": "1 Eintrag",
  "1 rādījums": "1 Ablesung",
  "{n} rādījumi": "{n} Ablesungen",
  "1 precīzs rādījums": "1 präzise Ablesung",
  "{n} precīzi rādījumi": "{n} präzise Ablesungen",
  "{n} ieraksti": "{n} Einträge",
  "NOBRAUKUMS PA GADIEM": "LAUFLEISTUNG NACH JAHR",
  "tūkst. km": "Tsd. km",
  "tūkst. km gadā": "Tsd. km / Jahr",
  nepilns: "unvollständig",
  "nepārtraukta līnija savieno precīzos ierakstus":
    "ununterbrochene Linie verbindet die präzisen Einträge",
  "precīzs gada nobraukums": "präzise Jahreslaufleistung",
  "aptuveni (nav precīzu datu)": "ungefähr (keine präzisen Daten)",
  "nepilns gads": "unvollständiges Jahr",
  "Nobraukuma vēsture un nobraukums pa kalendāra gadiem":
    "Laufleistungshistorie und Laufleistung nach Kalenderjahr",
  "Gadu robežās nobraukums interpolēts lineāri starp tuvākajiem precīzajiem ierakstiem. Svītrotie stabiņi: aptuvens vairāku gadu intervāla sadalījums, nevis precīzs gada nobraukums. {y0}: no {d0}; {y1}: līdz {d1} - bez pārrēķina uz pilnu gadu.":
    "Der Jahresgrenzen-km wird linear zwischen den nächsten präzisen Einträgen interpoliert. Schraffierte Balken sind eine ungefähre Aufteilung eines mehrjährigen Intervalls, keine präzise Jahreslaufleistung. {y0}: ab {d0}; {y1}: bis {d1} - ohne Hochrechnung auf ein volles Jahr.",
  "1 ieraksts ar mākslīgu kritumu grafikā nav rādīts - tāpat kā esošajā atskaitē.":
    "1 Eintrag mit künstlichem Rückgang wird im Diagramm nicht gezeigt - wie im bestehenden Bericht.",
  "{n} ieraksti ar mākslīgu kritumu grafikā nav rādīti - tāpat kā esošajā atskaitē.":
    "{n} Einträge mit künstlichem Rückgang werden im Diagramm nicht gezeigt - wie im bestehenden Bericht.",
};

export function clientReportStaticKeys(): string[] {
  return Object.keys(STATIC_TRANSLATIONS);
}

/** Viena virkne. Trūkstošs tulkojums paliek latviski. */
export function translateClientReportStatic(lv: string, lang: ClientReportLang): string {
  if (lang === "lv") return lv;
  if (lang === "de") return CLIENT_REPORT_DE[lv] ?? lv;
  return STATIC_TRANSLATIONS[lv]?.[lang] ?? lv;
}

/** Datumu / naudas Intl locale atskaites valodai. */
export function clientReportDateLocale(lang: ClientReportLang): string {
  switch (lang) {
    case "en":
      return "en-GB";
    case "ru":
      return "ru-RU";
    case "de":
      return "de-DE";
    default:
      return "lv-LV";
  }
}

/**
 * Jā / Nē tikai renderēšanas laikā. Nav STATIC_TRANSLATIONS atslēga, lai sweep
 * neaizvietotu šos vārdus AI komentāros.
 */
export function translateClientReportYesNo(value: boolean, lang: ClientReportLang): string {
  if (value) {
    switch (lang) {
      case "en":
        return "Yes";
      case "ru":
        return "Да";
      case "de":
        return "Ja";
      default:
        return "Jā";
    }
  }
  switch (lang) {
    case "en":
      return "No";
    case "ru":
      return "Нет";
    case "de":
      return "Nein";
    default:
      return "Nē";
  }
}

/**
 * Dīlera servisa vizītes galvenes precizācija („priekšā labajā pusē”, „nomainīta”).
 * Nav STATIC_TRANSLATIONS atslēgas, lai sweep neaizvietotu šos vispārīgos vārdus citos tekstos.
 */
const DEALER_HIGHLIGHT_DETAIL: Record<string, { en: string; ru: string; de: string }> = {
  nomainīts: { en: "replaced", ru: "замена", de: "ersetzt" },
  nomainīta: { en: "replaced", ru: "замена", de: "ersetzt" },
  priekšā: { en: "front", ru: "спереди", de: "vorne" },
  aizmugurē: { en: "rear", ru: "сзади", de: "hinten" },
  "kreisajā pusē": { en: "left side", ru: "слева", de: "links" },
  "labajā pusē": { en: "right side", ru: "справа", de: "rechts" },
  "priekšā kreisajā pusē": { en: "front left", ru: "спереди слева", de: "vorne links" },
  "priekšā labajā pusē": { en: "front right", ru: "спереди справа", de: "vorne rechts" },
  "aizmugurē kreisajā pusē": { en: "rear left", ru: "сзади слева", de: "hinten links" },
  "aizmugurē labajā pusē": { en: "rear right", ru: "сзади справа", de: "hinten rechts" },
};

export function translateDealerHighlightDetail(lv: string, lang: ClientReportLang): string {
  if (lang === "lv") return lv;
  return DEALER_HIGHLIGHT_DETAIL[lv]?.[lang] ?? lv;
}

/** Kartītes „Vēl” poga. Nav STATIC_TRANSLATIONS atslēga, lai sweep neaizvietotu citus „Vēl”. */
export function translateClientReportLifeMore(lang: ClientReportLang): string {
  switch (lang) {
    case "en":
      return "More";
    case "ru":
      return "Ещё";
    case "de":
      return "Mehr";
    default:
      return "Vēl";
  }
}

/** Tukša vērtība kopsavilkumā. Nav globālā sweep atslēga „Nav”. */
export function translateClientReportNone(lang: ClientReportLang): string {
  switch (lang) {
    case "en":
      return "None";
    case "ru":
      return "Нет данных";
    case "de":
      return "Keine";
    default:
      return "Nav";
  }
}

/**
 * "Sweep" pāri jau uzbūvētam PDF HTML - aizvieto zināmās latviešu frāzes ar
 * to EN/RU ekvivalentiem. Drošs, jo darbojas tikai ar iepriekš pārbaudītu,
 * daudzvārdu / unikālu frāžu sarakstu (nevis vispārīgiem vārdiem), tāpēc
 * praktiski neaizskar dinamisko (AI ģenerēto) tekstu, kas šajā brīdī jau ir
 * iztulkots atsevišķi.
 */
export function applyClientReportStaticTranslations(html: string, lang: ClientReportLang): string {
  if (lang === "lv") return html;
  let out = html.replace(/<html lang="lv"/, `<html lang="${lang}"`);
  for (const lv of SORTED_STATIC_KEYS) {
    const translated = translateClientReportStatic(lv, lang);
    if (!translated || translated === lv) continue;
    out = out.replace(staticKeyPattern(lv), translated);
  }
  const more = translateClientReportLifeMore(lang);
  if (more !== "Vēl") {
    out = out.replace(/(<button\b[^>]*\bdata-life-more\b[^>]*>)Vēl(<\/button>)/g, `$1${more}$2`);
  }
  return out;
}

/**
 * Bloks «Īpašnieki un nobraukums» (CSDD sadaļa, PDF + admin). Teksti uzreiz atskaites valodā
 * (nav sweep atslēgas). Ilgumi saīsināti vienā rindā («5 g. 10 mēn.», «13 d.»).
 */
export type OwnerMileageTextKey =
  | "title"
  | "abroad"
  | "latvia"
  | "imported"
  | "firstRegLv"
  | "since"
  | "today"
  | "mileage"
  | "footApprox"
  | "footBar";

const OWNER_MILEAGE_TEXT: Record<OwnerMileageTextKey, Record<ClientReportLang, string>> = {
  title: { lv: "Īpašnieki un nobraukums", en: "Owners and mileage", ru: "Владельцы и пробег", de: "Halter und Laufleistung" },
  abroad: { lv: "Ārvalstīs", en: "Abroad", ru: "За рубежом", de: "Im Ausland" },
  latvia: { lv: "Latvijā", en: "In Latvia", ru: "В Латвии", de: "In Lettland" },
  imported: { lv: "Ievests Latvijā", en: "Imported to Latvia", ru: "Ввезён в Латвию", de: "Nach Lettland eingeführt" },
  firstRegLv: {
    lv: "Pirmā reģistrācija Latvijā",
    en: "First registration in Latvia",
    ru: "Первая регистрация в Латвии",
    de: "Erstzulassung in Lettland",
  },
  since: { lv: "kopš", en: "since", ru: "с", de: "seit" },
  today: { lv: "šodien", en: "today", ru: "сегодня", de: "heute" },
  mileage: { lv: "Nobraukums", en: "Mileage", ru: "Пробег", de: "Laufleistung" },
  footApprox: {
    lv: "Zīme «~» nozīmē, ka nobraukums ir aptuvens: tas aprēķināts pēc tuvākajiem odometra rādījumiem.",
    en: "The sign «~» means the mileage is approximate: it is calculated from the nearest odometer readings.",
    ru: "Знак «~» означает, что пробег приблизительный: он рассчитан по ближайшим показаниям одометра.",
    de: "Das Zeichen «~» bedeutet, dass die Laufleistung ungefähr ist: Sie wurde aus den nächstgelegenen Kilometerständen berechnet.",
  },
  footBar: {
    lv: "Josla katrā kolonnā ir viss auto mūžs; iekrāsotā daļa - šī īpašnieka laiks.",
    en: "The bar in each column is the car's whole life; the coloured part is this owner's time.",
    ru: "Полоса в каждой колонке - вся жизнь автомобиля; закрашенная часть - время этого владельца.",
    de: "Der Balken in jeder Spalte zeigt das gesamte Fahrzeugleben; der farbige Teil ist die Zeit dieses Halters.",
  },
};

export function ownerMileageT(key: OwnerMileageTextKey, lang: ClientReportLang): string {
  return OWNER_MILEAGE_TEXT[key][lang] ?? OWNER_MILEAGE_TEXT[key].lv;
}

/** «N īpašnieki» ar pareizu skaitli katrā valodā. */
export function ownerMileageOwnersCount(n: number, lang: ClientReportLang): string {
  if (lang === "en") return `${n} ${n === 1 ? "owner" : "owners"}`;
  if (lang === "de") return `${n} Halter`;
  if (lang === "ru") {
    const m10 = n % 10;
    const m100 = n % 100;
    const w = m10 === 1 && m100 !== 11 ? "владелец" : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? "владельца" : "владельцев";
    return `${n} ${w}`;
  }
  const one = n % 10 === 1 && n % 100 !== 11;
  return `${n} ${one ? "īpašnieks" : "īpašnieki"}`;
}

/** Kolonnas virsraksts: «3. īpašnieks». */
export function ownerMileageOwnerLabel(n: number, lang: ClientReportLang): string {
  if (lang === "en") return `Owner ${n}`;
  if (lang === "ru") return `Владелец ${n}`;
  if (lang === "de") return `${n}. Halter`;
  return `${n}. īpašnieks`;
}

/** Saīsināts ilgums vienā rindā: «5 g. 10 mēn.», «13 d.». */
export function ownerMileageDuration(
  parts: { years: number; months: number; days?: number },
  lang: ClientReportLang,
): string {
  const U: Record<ClientReportLang, { y: string; m: string; d: string }> = {
    lv: { y: "g.", m: "mēn.", d: "d." },
    en: { y: "yr", m: "mo", d: "d" },
    ru: { y: "г.", m: "мес.", d: "дн." },
    de: { y: "J.", m: "Mon.", d: "T." },
  };
  const u = U[lang] ?? U.lv;
  if (parts.days != null) return `${parts.days} ${u.d}`;
  const bits = [parts.years ? `${parts.years} ${u.y}` : "", parts.months ? `${parts.months} ${u.m}` : ""].filter(Boolean);
  return bits.join(" ") || `0 ${u.m}`;
}
