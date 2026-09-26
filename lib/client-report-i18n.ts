/**
 * PROVIN klienta atskaites (PDF) statiskais "apvalks" citās valodās.
 *
 * Modelis: latviešu virkne PATI ir vārdnīcas atslēga (nevis atsevišķs key-vārds).
 * Tas ļauj tulkojumu piemērot ar vienu "sweep" pāri pār jau uzbūvēto HTML
 * (`applyClientReportStaticTranslations`), nevis stiept `lang` parametru
 * cauri desmitiem palīgfunkciju vairākos failos.
 *
 * Trūkstošs ieraksts NEKAD nenolūzt un nerāda tukšu lauku — vienkārši paliek
 * latviski, kamēr kāds pamana un pievieno tulkojumu.
 *
 * Zīmoli (AutoDNA, CarVertical, CSDD, LTAB, Tesla, Audi u.c.) NAV šeit —
 * tie paliek nemainīgi visās valodās.
 */

export type ClientReportLang = "lv" | "en" | "ru" | "de";

export const CLIENT_REPORT_LANGS: ClientReportLang[] = ["lv", "en", "ru", "de"];

export type ClientReportTargetLang = Exclude<ClientReportLang, "lv">;

type StaticTranslationEntry = { en: string; ru: string };

/** Kārtībai nav nozīmes — garākās frāzes tiek meklētas pirmās (sk. sortētais saraksts zemāk). */
const STATIC_TRANSLATIONS: Record<string, StaticTranslationEntry> = {
  // Galvenie virsraksti
  "TRANSPORTLĪDZEKĻA AUDITS": { en: "VEHICLE HISTORY AUDIT", ru: "АУДИТ ИСТОРИИ АВТОМОБИЛЯ" },
  "PROVIN BUSINESS VĒSTURES AUDITS": {
    en: "PROVIN BUSINESS HISTORY AUDIT",
    ru: "PROVIN BUSINESS АУДИТ ИСТОРИИ",
  },
  "APPROVED BY IRISS": { en: "APPROVED BY IRISS", ru: "APPROVED BY IRISS" },

  // IRISS 1./2./3. sadaļa
  "1. Tehnisko risku analīze": { en: "1. Technical Risk Analysis", ru: "1. Анализ технических рисков" },
  "2. Ieteikumi klātienes apskatei": {
    en: "2. Recommendations for In-Person Inspection",
    ru: "2. Рекомендации по личному осмотру",
  },
  "3. Kopsavilkums": { en: "3. Summary", ru: "3. Итоги" },
  "Tehnisko risku analīze": { en: "Technical Risk Analysis", ru: "Анализ технических рисков" },

  // Nobraukuma un negadījumu bloki
  "NOBRAUKUMA VĒSTURE": { en: "MILEAGE HISTORY", ru: "ИСТОРИЯ ПРОБЕГА" },
  "NOBRAUKUMA VĒSTURES KOMENTĀRS": { en: "MILEAGE HISTORY COMMENT", ru: "КОММЕНТАРИЙ К ИСТОРИИ ПРОБЕГА" },
  "NEGADĪJUMU VĒSTURES KOPSAVILKUMS": {
    en: "INCIDENT HISTORY SUMMARY",
    ru: "СВОДКА ПО ИСТОРИИ ПРОИСШЕСТВИЙ",
  },
  Negadījums: { en: "Incident", ru: "Происшествие" },
  "Negadījumi:": { en: "Incidents:", ru: "Происшествия:" },
  "Negadījumu skaits:": { en: "Number of incidents:", ru: "Количество происшествий:" },
  "Zaudējumu dati": { en: "Loss data", ru: "Данные об ущербе" },

  // Sludinājuma analīze / tirgus
  "SLUDINĀJUMA ANALĪZE": { en: "LISTING ANALYSIS", ru: "АНАЛИЗ ОБЪЯВЛЕНИЯ" },
  "Sludinājuma analīze": { en: "Listing analysis", ru: "Анализ объявления" },
  "Cenas izmaiņas šajā sludinājumā": {
    en: "Price changes in this listing",
    ru: "Изменения цены в этом объявлении",
  },
  "Cenas izmaiņa:": { en: "Price change:", ru: "Изменение цены:" },
  "Ilgums tirgū:": { en: "Time on market:", ru: "Время на рынке:" },
  "Tirgus dati": { en: "Market data", ru: "Рыночные данные" },

  // Avoti / reģistri
  "OFICIĀLĀ DĪLERA DATI": { en: "OFFICIAL DEALER DATA", ru: "ОФИЦИАЛЬНЫЕ ДАННЫЕ ДИЛЕРА" },
  "DĀNIJAS REĢISTRI": { en: "DANISH REGISTRIES", ru: "ДАТСКИЕ РЕЕСТРЫ" },
  "NĪDERLANDES REĢISTRI": { en: "DUTCH REGISTRIES", ru: "НИДЕРЛАНДСКИЕ РЕЕСТРЫ" },
  "ZVIEDRIJAS REĢISTRI": { en: "SWEDISH REGISTRIES", ru: "ШВЕДСКИЕ РЕЕСТРЫ" },
  "Igaunijas reģistrs": { en: "Estonian registry", ru: "Эстонский реестр" },
  "Igaunijas OCTA": { en: "Estonian OCTA", ru: "Эстонская OCTA" },
  "CITI AVOTI": { en: "OTHER SOURCES", ru: "ДРУГИЕ ИСТОЧНИКИ" },
  "Servisa vēsture": { en: "Service history", ru: "История обслуживания" },
  "Eļļas maiņas intervāli": { en: "Oil change intervals", ru: "Интервалы замены масла" },
  "Servisa un remontu vēsture": { en: "Service and repair history", ru: "История обслуживания и ремонта" },
  "Fotogrāfiju pielikums": { en: "Photo appendix", ru: "Приложение с фотографиями" },

  " atskaites ģenerēšanā izmantotie avoti": {
    en: " sources used to generate this report",
    ru: " источники, использованные при формировании отчёта",
  },
  "Maksas vēstures atskaites": { en: "Paid history reports", ru: "Платные отчёты об истории" },
  "Publiskas Eiropas datubāzes": { en: "Public European databases", ru: "Публичные европейские базы данных" },
  "Kas tika pārbaudīts": { en: "What was checked", ru: "Что было проверено" },
  Kopā: { en: "Total", ru: "Всего" },

  // Nobraukuma tabulas galviņas
  Datums: { en: "Date", ru: "Дата" },
  "Odometrs (km)": { en: "Odometer (km)", ru: "Одометр (км)" },
  Avots: { en: "Source", ru: "Источник" },
  Valsts: { en: "Country", ru: "Страна" },
  Komentārs: { en: "Comment", ru: "Комментарий" },

  // CSDD strukturētie lauki
  "Marka, modelis:": { en: "Make, model:", ru: "Марка, модель:" },
  "Reģistrācijas numurs:": { en: "Registration number:", ru: "Регистрационный номер:" },
  "Pirmā reģistrācija:": { en: "First registration:", ru: "Первая регистрация:" },
  "Nākamās apskates datums:": { en: "Next inspection date:", ru: "Дата следующего осмотра:" },
  "Iepriekšējās apskates datums:": { en: "Previous inspection date:", ru: "Дата предыдущего осмотра:" },
  "Motora tilpums (cm³):": { en: "Engine displacement (cm³):", ru: "Объём двигателя (см³):" },
  "Motora maksimālā jauda (kW):": { en: "Max engine power (kW):", ru: "Макс. мощность двигателя (кВт):" },
  "Degvielas veids:": { en: "Fuel type:", ru: "Тип топлива:" },
  "Emisiju standarts:": { en: "Emission standard:", ru: "Экологический стандарт:" },
  "Pilna masa (kg):": { en: "Gross mass (kg):", ru: "Полная масса (кг):" },
  "Pašmasa (kg):": { en: "Curb mass (kg):", ru: "Снаряжённая масса (кг):" },
  "Ekspluatācijas nodoklis (EUR):": { en: "Road tax (EUR):", ru: "Дорожный налог (EUR):" },
  "Reģistrācijas statuss:": { en: "Registration status:", ru: "Статус регистрации:" },
  "Dūmainības koeficients (m⁻¹):": { en: "Opacity coefficient (m⁻¹):", ru: "Коэффициент дымности (м⁻¹):" },
  "Atgāzu cietās daļiņas:": { en: "Exhaust particulate matter:", ru: "Твёрдые частицы выхлопа:" },
  "Iepriekšējās reģistrācijas valsts:": {
    en: "Previous registration country:",
    ru: "Страна предыдущей регистрации:",
  },
  "Īpašnieku skaits Latvijā:": { en: "Number of owners in Latvia:", ru: "Количество владельцев в Латвии:" },
  "Tehnisko apskašu vēsture": { en: "Technical inspection history", ru: "История технических осмотров" },
  "Iepriekšējās apskates dati": { en: "Previous inspection data", ru: "Данные предыдущего осмотра" },

  // Tirgus lauki
  "Auto pārdošanā (dienas):": { en: "Listed for sale (days):", ru: "В продаже (дней):" },
  "Izveidots:": { en: "Created:", ru: "Создано:" },
  "Cenas izmaiņas (eiro):": { en: "Price changes (EUR):", ru: "Изменения цены (EUR):" },
  "Odometrs, km:": { en: "Odometer, km:", ru: "Одометр, км:" },

  // Kājene / drukas rīki
  "Drukāt / PDF": { en: "Print / PDF", ru: "Печать / PDF" },
  "Drukāt (augsts kontrasts)": { en: "Print (high contrast)", ru: "Печать (высокий контраст)" },
  "Drukājamā versija - palielināts kontrasts papīram. Digitālajam PDF lietojiet „Ģenerēt PDF”.": {
    en: "Print version - increased contrast for paper. For a digital PDF use \"Generate PDF\".",
    ru: "Версия для печати - повышенный контраст для бумаги. Для цифрового PDF используйте «Сгенерировать PDF».",
  },
  "Demonstrācijas dati": { en: "Demo data", ru: "Демонстрационные данные" },
  Ģenerēts: { en: "Generated", ru: "Сформировано" },

  // Kopsavilkuma plāksnītes, laikposms, sludinājums, kājene
  "ATSKAITES KOPSAVILKUMS": { en: "REPORT SUMMARY", ru: "СВОДКА ОТЧЁТА" },
  "Vēstures kopsavilkums": { en: "History summary", ru: "Сводка истории" },
  "NEGADĪJUMU VĒSTURE": { en: "INCIDENT HISTORY", ru: "ИСТОРИЯ ПРОИСШЕСТВИЙ" },
  "Negadījumi un bojājumi": { en: "Incidents and damage", ru: "Происшествия и повреждения" },
  "Avotos nav fiksētu negadījumu": {
    en: "No accidents recorded in the sources",
    ru: "В источниках нет зафиксированных происшествий",
  },
  "Nav ierakstu": { en: "No records", ru: "Нет записей" },
  "Īpašnieku skaits": { en: "Number of owners", ru: "Количество владельцев" },
  "Reģistrācija Latvijā": { en: "Registration in Latvia", ru: "Регистрация в Латвии" },
  Nobraukums: { en: "Mileage", ru: "Пробег" },
  "DĪLERA DATI": { en: "DEALER DATA", ru: "ДАННЫЕ ДИЛЕРА" },
  "IZSOĻU PORTĀLU ARHĪVS": { en: "AUCTION ARCHIVE", ru: "АРХИВ АУКЦИОНОВ" },
  "Pirmā reģistrācija": { en: "First registration", ru: "Первая регистрация" },
  "Tehniskā apskate": { en: "Technical inspection", ru: "Техосмотр" },
  "Īpašnieka maiņa": { en: "Change of owner", ru: "Смена владельца" },
  "Servisa apmeklējums": { en: "Service visit", ru: "Визит на сервис" },
  Sludinājums: { en: "Listing", ru: "Объявление" },
  "Sludinājuma cenas izmaiņa": { en: "Listing price change", ru: "Изменение цены в объявлении" },
  "Izlikts pārdošanā": { en: "Listed for sale", ru: "Выставлено на продажу" },
  "(pēc sludinājuma, nav apstiprināts)": {
    en: "(from the listing, not confirmed)",
    ru: "(по объявлению, не подтверждено)",
  },
  "Sludinājuma vēsture": { en: "Listing history", ru: "История объявления" },
  "Pārdevēja portrets": { en: "Seller profile", ru: "Портрет продавца" },
  "Fotogrāfiju analīze": { en: "Photo analysis", ru: "Анализ фотографий" },
  "Pārdošanas sludinājuma konteksts": { en: "Sales listing context", ru: "Контекст объявления о продаже" },
  "Grafika ģenerēšanā izmantotais avotu skaits:": {
    en: "Number of sources used to build the chart:",
    ru: "Число источников, использованных для графика:",
  },
  pārbaudīts: { en: "checked", ru: "проверено" },
  Atruna: { en: "Disclaimer", ru: "Оговорка" },
  Konfidencialitāte: { en: "Confidentiality", ru: "Конфиденциальность" },
  "PROVIN.LV sniedz konsultatīvu pakalpojumu: transportlīdzekļa pieejamās informācijas izvērtējumu un ieteikumus. Šis ir digitāls datu apkopojums, nevis automašīnas tehniskā diagnostika, un tas nekādā veidā nevar aizvietot pilnvērtīgu transportlīdzekļa pārbaudi un apskati klātienē. Atskaite nav valsts institūcijas izraksts, neatkarīga tehniskā ekspertīze vai juridisks spriedums. Gala lēmumu par transportlīdzekļa iegādi pieņem klients.":
    {
      en: "PROVIN.LV provides a consulting service: an assessment of the available information about a vehicle and recommendations. This is a digital compilation of data, not a technical diagnosis of the car, and it cannot replace a full in-person inspection of the vehicle. The report is not an extract issued by a state authority, an independent technical examination, or a legal judgment. The client makes the final decision on whether to buy the vehicle.",
      ru: "PROVIN.LV оказывает консультационную услугу: оценку доступной информации о транспортном средстве и рекомендации. Это цифровая сводка данных, а не техническая диагностика автомобиля, и она не заменяет полноценный личный осмотр транспортного средства. Отчёт не является выпиской государственного учреждения, независимой технической экспертизой или юридическим решением. Окончательное решение о покупке принимает клиент.",
    },
  "Šī atskaite ir sagatavota ekskluzīvi tās pasūtītājam un ir izmantojama tikai personīgām vajadzībām. Atskaiti un tajā ietverto informāciju ir kategoriski aizliegts pavairot, publiski reproducēt, nodot vai jebkādā citā veidā darīt pieejamu trešajām personām (tostarp transportlīdzekļa pārdevējam) bez saskaņošanas ar PROVIN.LV.":
    {
      en: "This report was prepared exclusively for the customer who ordered it and may be used only for personal purposes. Copying the report or the information in it, reproducing it publicly, transferring it, or otherwise making it available to third parties (including the seller of the vehicle) without agreement from PROVIN.LV is strictly forbidden.",
      ru: "Этот отчёт подготовлен исключительно для заказчика и предназначен только для личных целей. Копировать отчёт и содержащуюся в нём информацию, публично воспроизводить, передавать или иным образом делать доступной третьим лицам (включая продавца транспортного средства) без согласования с PROVIN.LV категорически запрещено.",
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
  "PROVIN BUSINESS VĒSTURES AUDITS": "PROVIN BUSINESS HISTORIENAUDIT",
  "APPROVED BY IRISS": "APPROVED BY IRISS",
  "1. Tehnisko risku analīze": "1. Analyse der technischen Risiken",
  "2. Ieteikumi klātienes apskatei": "2. Empfehlungen für die Besichtigung vor Ort",
  "3. Kopsavilkums": "3. Zusammenfassung",
  "Tehnisko risku analīze": "Analyse der technischen Risiken",
  "NOBRAUKUMA VĒSTURE": "KILOMETERSTAND-HISTORIE",
  "NOBRAUKUMA VĒSTURES KOMENTĀRS": "KOMMENTAR ZUR KILOMETERSTAND-HISTORIE",
  "NEGADĪJUMU VĒSTURES KOPSAVILKUMS": "ZUSAMMENFASSUNG DER SCHADENSHISTORIE",
  Negadījums: "Schaden",
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
 * "Sweep" pāri jau uzbūvētam PDF HTML — aizvieto zināmās latviešu frāzes ar
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
