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
  Komentārs: { en: "Comment", ru: "Комментарий" },

  // CSDD strukturētie lauki
  "Marka, modelis:": { en: "Make and model:", ru: "Марка, модель:" },
  "Reģistrācijas numurs:": { en: "Registration number:", ru: "Госномер:" },
  "Pirmā reģistrācija:": { en: "First registration:", ru: "Первая регистрация:" },
  "Pirmā reģistrācija (pasaulē):": { en: "First registration (worldwide):", ru: "Первая регистрация (в мире):" },
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
  "Izsoļu / reģistru bojājumi bez summas": {
    en: "Auction / register damage without amount",
    ru: "Повреждения на аукционах / в реестрах без суммы",
  },
  "Bojājumi:": { en: "Damage:", ru: "Повреждения:" },
  "Īpašnieku skaits": { en: "Number of owners", ru: "Количество владельцев" },
  "Reģistrācija Latvijā": { en: "Latvian registration", ru: "Регистрация в Латвии" },
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
  "Garākais robs": { en: "Longest gap", ru: "Самый длинный пробел" },
  "Kampaņas veiktas": { en: "Campaigns completed", ru: "Кампании выполнены" },
  "Lielie mezgli": { en: "Major assemblies", ru: "Крупные узлы" },
  "Nav fiksēts": { en: "None recorded", ru: "Не зафиксировано" },
  "Robs datos": { en: "Gap in records", ru: "Пробел в данных" },
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
  "Divmasu spararats": { en: "Dual-mass flywheel", ru: "Двухмассовый маховик" },
  Sajūgs: { en: "Clutch", ru: "Сцепление" },
  Kardāns: { en: "Propshaft", ru: "Кардан" },
  Turbokompresors: { en: "Turbocharger", ru: "Турбокомпрессор" },
  "Virsbūve / stikls": { en: "Body / glass", ru: "Кузов / стекло" },
  // Statiskais krāsas biezuma bloks (lib/paint-gauge-static-block.ts) - agrāk palika LV vai deva "Bodys stāvoklis".
  // PASŪTĪJUMA DATI bloks (client-report-pdf-layout-draft.ts) un CSDD statuss.
  "PASŪTĪJUMA DATI": { en: "ORDER DETAILS", ru: "ДАННЫЕ ЗАКАЗА" },
  Maksājums: { en: "Payment", ru: "Оплата" },
  Pasūtījums: { en: "Order", ru: "Заказ" },
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
  "Svarīga piezīme par apkopes datu interpretāciju": {
    en: "Important note on how service data is interpreted",
    ru: "Важное замечание по интерпретации данных обслуживания",
  },
  "Lūdzam ņemt vērā:": { en: "Please note:", ru: "Просим учесть:" },
  "Ierakstu robežas.": { en: "Limits of the records.", ru: "Границы записей." },
  "Neiztrūkstošas apkopes.": { en: "Missing services.", ru: "Пропущенные ТО." },
  "Vispārīgi apmeklējumi.": { en: "Generic visits.", ru: "Общие визиты." },
  "Secinājums.": { en: "Conclusion.", ru: "Вывод." },
  "Rekomendācija pilnīgai pārbaudei.": {
    en: "Recommendation for a complete check.",
    ru: "Рекомендация для полной проверки.",
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
  Komentārs: "Kommentar",
  "Marka, modelis:": "Marke, Modell:",
  "Reģistrācijas numurs:": "Kennzeichen:",
  "Pirmā reģistrācija:": "Erstzulassung:",
  "Pirmā reģistrācija (pasaulē):": "Erstzulassung (weltweit):",
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
  "Izsoļu / reģistru bojājumi bez summas": "Auktions- / Registerschäden ohne Betrag",
  "Bojājumi:": "Schäden:",
  "Īpašnieku skaits": "Anzahl der Halter",
  "Reģistrācija Latvijā": "Zulassung in Lettland",
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
  "Garākais robs": "Längste Lücke",
  "Kampaņas veiktas": "Aktionen durchgeführt",
  "Lielie mezgli": "Große Baugruppen",
  "Nav fiksēts": "Nicht erfasst",
  "Robs datos": "Lücke in den Daten",
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
  "Divmasu spararats": "Zweimassenschwungrad",
  Sajūgs: "Kupplung",
  Kardāns: "Gelenkwelle",
  Turbokompresors: "Turbolader",
  "Virsbūve / stikls": "Karosserie / Glas",
  "PASŪTĪJUMA DATI": "BESTELLDATEN",
  Maksājums: "Zahlung",
  Pasūtījums: "Bestellung",
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
  "Ražotāja intervāls nav droši zināms. Ievērošanu nevērtējam. Joslas rāda tikai, cik kilometru dīlera dati apliecina.":
    "Das Herstellerintervall ist nicht sicher bekannt. Die Einhaltung bewerten wir nicht. Die Balken zeigen nur, wie viele Kilometer die Händlerdaten belegen.",
  " Gaišā zona ir pieļaujamās robežas, melnā atzīme ir augšējā robeža.":
    " Die helle Zone ist der zulässige Bereich, die schwarze Markierung die Obergrenze.",
  " Melnā atzīme joslā ir šis intervāls.": " Die schwarze Markierung auf dem Balken ist dieses Intervall.",
  "Svarīga piezīme par apkopes datu interpretāciju": "Wichtiger Hinweis zur Auslegung der Servicedaten",
  "Lūdzam ņemt vērā:": "Bitte beachten:",
  "Ierakstu robežas.": "Grenzen der Einträge.",
  "Neiztrūkstošas apkopes.": "Fehlende Wartungen.",
  "Vispārīgi apmeklējumi.": "Allgemeine Besuche.",
  "Secinājums.": "Schlussfolgerung.",
  "Rekomendācija pilnīgai pārbaudei.": "Empfehlung für eine vollständige Prüfung.",
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
