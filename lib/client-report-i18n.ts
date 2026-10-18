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
  "Īpašnieku skaits": { en: "Number of owners", ru: "Количество владельцев" },
  "Reģistrācija Latvijā": { en: "Latvian registration", ru: "Регистрация в Латвии" },
  Nobraukums: { en: "Mileage", ru: "Пробег" },
  "DĪLERA DATI": { en: "DEALER RECORDS", ru: "ДАННЫЕ ДИЛЕРА" },
  "IZSOĻU PORTĀLU ARHĪVS": { en: "AUCTION PLATFORM ARCHIVE", ru: "АРХИВ АУКЦИОННЫХ ПЛОЩАДОК" },
  "Pirmā reģistrācija": { en: "First registration", ru: "Первая регистрация" },
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
  "PROVIN.LV sniedz konsultatīvu pakalpojumu: transportlīdzekļa pieejamās informācijas izvērtējumu un ieteikumus. Šis ir digitāls datu apkopojums, nevis automašīnas tehniskā diagnostika, un tas nekādā veidā nevar aizvietot pilnvērtīgu transportlīdzekļa pārbaudi un apskati klātienē. Atskaite nav valsts institūcijas izraksts, neatkarīga tehniskā ekspertīze vai juridisks spriedums. Gala lēmumu par transportlīdzekļa iegādi pieņem klients.":
    {
      en: "PROVIN.LV provides an advisory service: an assessment of the available information about the vehicle, with recommendations. This is a digital compilation of data, not a technical diagnosis of the car, and it can in no way replace a thorough in-person check and inspection of the vehicle. The report is not an official extract from a state authority, an independent technical appraisal or a legal ruling. The final decision to purchase the vehicle rests with the client.",
      ru: "PROVIN.LV оказывает консультационную услугу: оценку доступной информации о транспортном средстве и рекомендации. Это цифровая подборка данных, а не техническая диагностика автомобиля, и она ни в коем случае не заменяет полноценную проверку и осмотр автомобиля на месте. Отчёт не является выпиской из государственного реестра, независимой технической экспертизой или юридическим заключением. Окончательное решение о покупке транспортного средства принимает клиент.",
    },
  "Šī atskaite ir sagatavota ekskluzīvi tās pasūtītājam un ir izmantojama tikai personīgām vajadzībām. Atskaiti un tajā ietverto informāciju ir kategoriski aizliegts pavairot, publiski reproducēt, nodot vai jebkādā citā veidā darīt pieejamu trešajām personām (tostarp transportlīdzekļa pārdevējam) bez saskaņošanas ar PROVIN.LV.":
    {
      en: "This report has been prepared exclusively for the customer who ordered it and is for personal use only. Copying, publicly reproducing, passing on or otherwise making this report or the information in it available to third parties (including the seller of the vehicle) without the prior consent of PROVIN.LV is strictly prohibited.",
      ru: "Этот отчёт подготовлен исключительно для заказчика и предназначен только для личного использования. Копирование, публичное воспроизведение, передача отчёта и содержащейся в нём информации или предоставление к ним доступа третьим лицам любым иным способом (включая продавца транспортного средства) без согласования с PROVIN.LV строго запрещены.",
    },
};

/** Sakārtots pēc garuma (garākais pirmais), lai īsāka frāze nesabojā garāku, kas to satur. */
const SORTED_STATIC_KEYS: string[] = Object.keys(STATIC_TRANSLATIONS).sort((a, b) => b.length - a.length);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  "Īpašnieku skaits": "Anzahl der Halter",
  "Reģistrācija Latvijā": "Zulassung in Lettland",
  Nobraukums: "Kilometerstand",
  "DĪLERA DATI": "HÄNDLERDATEN",
  "IZSOĻU PORTĀLU ARHĪVS": "AUKTIONSARCHIV",
  "Pirmā reģistrācija": "Erstzulassung",
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
  "PROVIN.LV sniedz konsultatīvu pakalpojumu: transportlīdzekļa pieejamās informācijas izvērtējumu un ieteikumus. Šis ir digitāls datu apkopojums, nevis automašīnas tehniskā diagnostika, un tas nekādā veidā nevar aizvietot pilnvērtīgu transportlīdzekļa pārbaudi un apskati klātienē. Atskaite nav valsts institūcijas izraksts, neatkarīga tehniskā ekspertīze vai juridisks spriedums. Gala lēmumu par transportlīdzekļa iegādi pieņem klients.":
    "PROVIN.LV erbringt eine Beratungsleistung: eine Bewertung der verfügbaren Fahrzeuginformationen und Empfehlungen. Dies ist eine digitale Datenzusammenstellung, keine technische Diagnose des Fahrzeugs, und sie ersetzt keine vollständige Prüfung vor Ort. Der Bericht ist kein Behördenauszug, kein unabhängiges technisches Gutachten und kein Rechtsurteil. Die Kaufentscheidung trifft der Kunde.",
  "Šī atskaite ir sagatavota ekskluzīvi tās pasūtītājam un ir izmantojama tikai personīgām vajadzībām. Atskaiti un tajā ietverto informāciju ir kategoriski aizliegts pavairot, publiski reproducēt, nodot vai jebkādā citā veidā darīt pieejamu trešajām personām (tostarp transportlīdzekļa pārdevējam) bez saskaņošanas ar PROVIN.LV.":
    "Dieser Bericht wurde ausschließlich für den Auftraggeber erstellt und darf nur für private Zwecke verwendet werden. Den Bericht und die darin enthaltenen Informationen zu vervielfältigen, öffentlich wiederzugeben, weiterzugeben oder Dritten (einschließlich des Fahrzeugverkäufers) ohne Abstimmung mit PROVIN.LV zugänglich zu machen, ist untersagt.",
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
    out = out.replace(new RegExp(escapeRegExp(lv), "g"), translated);
  }
  return out;
}
