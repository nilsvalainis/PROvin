/**
 * Sākumlapa v6: «Servisa vēsture, kas izlasāma kā stāsts» (dīlera dati) un
 * «No bojājuma Somijā līdz pārdošanai Latvijā» (VW gadījums). Teksti 4 valodās,
 * skaitļi un datumi kopīgi (`HOME_V6_*`), lai valodas nevar atšķirties datos.
 */

export type HomeV6Locale = "lv" | "en" | "ru" | "de";

/** 0 = normāls, 1 = sarkans (risks), 2 = galvenais sarkanais karogs, 3 = PROVIN. */
export type HomeV6EventKind = 0 | 1 | 2 | 3;

export type HomeV6EventData = {
  date: string;
  km: number | null;
  price: number | null;
  kind: HomeV6EventKind;
};

export type HomeV6EventText = { title: string; text: string; status: string };

export type HomeV6PhaseText = { title: string; subtitle: string };

export type HomeV6Copy = {
  dealer: {
    badge: string;
    kicker: string;
    title: string;
    lead: string;
    chartNote: string;
    chartAria: string;
    intervalsCaption: string;
    intervalsNorm: string;
    withinNorm: string;
    /** `{km}` -> „1 400 km”. */
    overNorm: string;
    guaranteeStrong: string;
    guaranteeText: string;
    cta: string;
  };
  caseStudy: {
    kicker: string;
    title: string;
    facts: string;
    badges: [string, string];
    lead: string;
    damageAria: string;
    phases: HomeV6PhaseText[];
    events: HomeV6EventText[][];
    panelOdometer: string;
    panelPrice: string;
    panelStatus: string;
    legend: [string, string, string];
    confirmedStrong: string;
    confirmedText: string;
  };
};

/** Nobraukuma līkne (VW Passat B8 2018). */
export const HOME_V6_MILEAGE_POINTS: readonly { date: string; km: number }[] = [
  { date: "03.2019", km: 31200 },
  { date: "04.2020", km: 45900 },
  { date: "06.2021", km: 62300 },
  { date: "09.2022", km: 89500 },
  { date: "05.2023", km: 103800 },
];

/** Eļļas maiņas norma, km. */
export const HOME_V6_OIL_NORM_KM = 15000;

/** Intervāls i = starp līknes punktiem i un i+1. */
export const HOME_V6_OIL_INTERVALS: readonly { from: string; to: string; km: number }[] = [
  { from: "03.2019", to: "04.2020", km: 14700 },
  { from: "04.2020", to: "06.2021", km: 16400 },
  { from: "06.2021", to: "09.2022", km: 27200 },
  { from: "09.2022", to: "05.2023", km: 14300 },
];

export const HOME_V6_CASE_EVENTS: readonly HomeV6EventData[][] = [
  [
    { date: "08.11.2021", km: null, price: null, kind: 0 },
    { date: "25.10.2023", km: 49469, price: null, kind: 0 },
    { date: "01.11.2024", km: null, price: null, kind: 0 },
    { date: "12.11.2024", km: 73500, price: 38500, kind: 0 },
  ],
  [
    { date: "25.11.2024", km: null, price: null, kind: 1 },
    { date: "03.12.2024", km: null, price: null, kind: 1 },
    { date: "12.12.2024", km: null, price: null, kind: 2 },
    { date: "17.01.2025", km: null, price: null, kind: 1 },
    { date: "14.08.2025", km: null, price: null, kind: 1 },
    { date: "10.11.2025", km: null, price: null, kind: 1 },
  ],
  [
    { date: "05.01.2026", km: 76255, price: 34580, kind: 1 },
    { date: "27.01.2026", km: null, price: 33980, kind: 1 },
    { date: "11.06.2026", km: null, price: 33480, kind: 1 },
    { date: "17.06.2026", km: null, price: 32980, kind: 1 },
    { date: "16.07.2026", km: null, price: 33480, kind: 1 },
    { date: "07.08.2026", km: null, price: 32980, kind: 1 },
    { date: "28.08.2026", km: null, price: 31980, kind: 1 },
    { date: "22.09.2026", km: 76237, price: 31980, kind: 1 },
  ],
  [
    { date: "26.09.2026", km: null, price: null, kind: 3 },
    { date: "27.09.2026", km: null, price: null, kind: 3 },
    { date: "28.09.2026", km: null, price: null, kind: 2 },
  ],
];

/** Fāze ar cenu līkni (Latvija). */
export const HOME_V6_PRICE_PHASE = 2;

function group(n: number, sep: string): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

/** Skaitlis bez Intl (servera un klienta renderam jāsakrīt): lv/ru „31 200”, de „31.200”, en „31,200”. */
export function formatHomeV6Number(n: number, locale: string): string {
  if (locale === "en") return group(n, ",");
  if (locale === "de") return group(n, ".");
  return group(n, " ");
}

export function formatHomeV6Km(n: number, locale: string): string {
  return `${formatHomeV6Number(n, locale)} km`;
}

export function formatHomeV6Eur(n: number, locale: string): string {
  return locale === "en" ? `€${formatHomeV6Number(n, locale)}` : `${formatHomeV6Number(n, locale)} €`;
}

const LV: HomeV6Copy = {
  dealer: {
    badge: "Jaunums",
    kicker: "Oficiālā dīlera dati · 24,99\u00a0€",
    title: "Servisa vēsture, kas izlasāma kā stāsts",
    lead: "Oficiāli fiksētie nobraukuma rādījumi, apkopes un remonti pa gadiem - ar nobraukuma līkni un eļļas maiņas intervāliem.",
    chartNote: "Piemērs · Volkswagen Passat B8 · 2018",
    chartAria: "Nobraukuma līkne pēc oficiālā dīlera ierakstiem",
    intervalsCaption: "Eļļas maiņas intervāli",
    intervalsNorm: "norma 15 000 km",
    withinNorm: "normā",
    overNorm: "+{km} virs normas",
    guaranteeStrong: "Nav datu - nauda atpakaļ.",
    guaranteeText:
      "Ja oficiālā dīlera datu par auto nav, atmaksājam pilnu summu. Pasūtot pēc tam pilno auditu, 24,99\u00a0€ ieskaitām audita cenā.",
    cta: "Pasūtīt dīlera datus · 24,99\u00a0€",
  },
  caseStudy: {
    kicker: "Spilgtākais gadījums · VW",
    title: "No bojājuma Somijā līdz pārdošanai Latvijā",
    facts: "12+ avoti · 8 h izpētes · 2 dienas",
    badges: ["Atcelts līzings", "Atcelts EKII"],
    lead: "PROVIN rekonstruēja visu vēstures hronoloģiju bez standarta vēstures atskaitēm.",
    damageAria: "Bojājums",
    phases: [
      { title: "Somija", subtitle: "Normāla ekspluatācija" },
      { title: "9 dienas", subtitle: "Izsole, bojājums, apdrošinātājs" },
      { title: "Latvija", subtitle: "Pārdošanā 264 dienas" },
      { title: "PROVIN", subtitle: "Izpēte 2 dienās" },
    ],
    events: [
      [
        { title: "Pirmā reģistrācija Somijā", text: "Īpašnieks - līzinga uzņēmums.", status: "Reģistrēts" },
        {
          title: "Apkope pie oficiālā dīlera",
          text: "Odometru fiksē visi galvenie avoti. Vidēji ~1 900 km mēnesī.",
          status: "Lietošanā",
        },
        {
          title: "Līzings beidzas",
          text: "5.11.2024 reģistrā statuss - pārdošanas krājumos.",
          status: "Pārdošanas krājumos",
        },
        {
          title: "Sludinājums Somijā",
          text: "33 fotogrāfijas: auto pilnīgā kārtībā, odometrs redzams.",
          status: "Pārdošanā",
        },
      ],
      [
        { title: "Auto nonāk izsoļu platformā", text: "13 dienas pēc sludinājuma.", status: "Izsolē" },
        { title: "Lietošanas veids - privāts", text: "Auto ir pārdots un sāk braukt.", status: "Privāts" },
        {
          title: "Noņemts no uzskaites bojājumu dēļ",
          text: "Pēc 9 dienām. Braukšanas aizliegums. Apdrošinātājs noņem auto ar atpakaļejošu datumu - uz pēdējo lietošanas dienu.",
          status: "Braukšanas aizliegums",
        },
        {
          title: "Īpašnieks - apdrošināšanas sabiedrība",
          text: "Parasti tā notiek, kad remonts nav izdevīgs un īpašniekam izmaksā naudu.",
          status: "Apdrošinātāja īpašumā",
        },
        { title: "Paziņojums par īpašumtiesību nodošanu", text: "Somijas reģistrā.", status: "Nodošana" },
        { title: "Tehniskās apskates termiņš beidzas", text: "Jauna apskate netiek veikta.", status: "Bez apskates" },
      ],
      [
        {
          title: "Sludinājums Latvijā",
          text: "No 73 500 līdz ~76 000 km - tikai +2 755 km 14 mēnešos, temps krities par ~90 %.",
          status: "Pārdošanā, nereģistrēts",
        },
        { title: "Cena samazināta", text: "-600 €", status: "Pārdošanā, nereģistrēts" },
        { title: "Cena samazināta", text: "-500 €", status: "Pārdošanā, nereģistrēts" },
        { title: "Cena samazināta", text: "-500 €", status: "Pārdošanā, nereģistrēts" },
        { title: "Cena paaugstināta", text: "+500 €", status: "Pārdošanā, nereģistrēts" },
        { title: "Cena samazināta", text: "-500 €", status: "Pārdošanā, nereģistrēts" },
        { title: "Cena samazināta", text: "-1 000 €. Kopā -2 600 €.", status: "Pārdošanā, nereģistrēts" },
        {
          title: "Pirmā reģistrācija Latvijā",
          text: "8 mēnešus auto tirgoja, Latvijā vēl nereģistrētu.",
          status: "Reģistrēts Latvijā",
        },
      ],
      [
        {
          title: "Pasūtījums - oficiālā dīlera dati",
          text: "Sistēma automātiski parāda sarkano karogu. Pēc saskaņošanas ar klientu turpinām pilnā audita formātā.",
          status: "Izpēte",
        },
        {
          title: "Audits gatavs",
          text: "12+ avoti, 8 h izpētes. A atskaite: bojājumu nav. B atskaite: bojājums, apjoms nav norādīts.",
          status: "Audits",
        },
        {
          title: "Rakstisks apstiprinājums no droša avota",
          text: "Pārdots izsolē kā bojāts, nostrādājuši drošības spilveni. Rezultāts: Klients atceļ līzingu un EKII atbalstu.",
          status: "Apstiprināts",
        },
      ],
    ],
    panelOdometer: "Odometrs",
    panelPrice: "Pēdējā zināmā cena",
    panelStatus: "Statuss",
    legend: ["A atskaite: bojājumu nav", "B atskaite: bojājums, apjoms nav norādīts", "Reģistrs: noņemts no uzskaites"],
    confirmedStrong: "Rakstiski apstiprināts:",
    confirmedText:
      "pārdots izsolē kā bojāts, nostrādājuši drošības spilveni. Klients pēdējā brīdī atcēla jau noformētu līzingu un EKII atbalstu.",
  },
};

const EN: HomeV6Copy = {
  dealer: {
    badge: "New",
    kicker: "Official dealer data · €24.99",
    title: "A service history that reads like a story",
    lead: "Officially recorded mileage, services and repairs year by year - with a mileage curve and oil change intervals.",
    chartNote: "Example · Volkswagen Passat B8 · 2018",
    chartAria: "Mileage curve from official dealer records",
    intervalsCaption: "Oil change intervals",
    intervalsNorm: "norm 15,000 km",
    withinNorm: "within norm",
    overNorm: "+{km} over norm",
    guaranteeStrong: "No data - money back.",
    guaranteeText:
      "If there is no official dealer data for the car, we refund the full amount. If you then order the full audit, the €24.99 is credited to the audit price.",
    cta: "Order dealer data · €24.99",
  },
  caseStudy: {
    kicker: "Most striking case · VW",
    title: "From damage in Finland to a sale in Latvia",
    facts: "12+ sources · 8 h of research · 2 days",
    badges: ["Leasing cancelled", "EKII grant cancelled"],
    lead: "PROVIN rebuilt the whole history timeline without standard history reports.",
    damageAria: "Damage",
    phases: [
      { title: "Finland", subtitle: "Normal use" },
      { title: "9 days", subtitle: "Auction, damage, insurer" },
      { title: "Latvia", subtitle: "For sale 264 days" },
      { title: "PROVIN", subtitle: "Research in 2 days" },
    ],
    events: [
      [
        { title: "First registration in Finland", text: "Owner - a leasing company.", status: "Registered" },
        {
          title: "Service at an official dealer",
          text: "The odometer is recorded by all main sources. About 1,900 km a month on average.",
          status: "In use",
        },
        {
          title: "Leasing ends",
          text: "On 5.11.2024 the registry status changes to dealer stock.",
          status: "Dealer stock",
        },
        {
          title: "Listing in Finland",
          text: "33 photos: the car in perfect condition, odometer visible.",
          status: "For sale",
        },
      ],
      [
        { title: "The car goes to an auction platform", text: "13 days after the listing.", status: "At auction" },
        { title: "Use type - private", text: "The car is sold and back on the road.", status: "Private" },
        {
          title: "Deregistered due to damage",
          text: "After 9 days. Driving ban. The insurer deregisters the car backdated to the last day of use.",
          status: "Driving ban",
        },
        {
          title: "Owner - an insurance company",
          text: "This usually happens when a repair does not pay off and the owner is paid out.",
          status: "Owned by insurer",
        },
        { title: "Notice of ownership transfer", text: "In the Finnish registry.", status: "Transfer" },
        { title: "Roadworthiness test expires", text: "No new test is carried out.", status: "No valid test" },
      ],
      [
        {
          title: "Listing in Latvia",
          text: "From 73,500 to ~76,000 km - only +2,755 km in 14 months, the pace dropped by ~90 %.",
          status: "For sale, unregistered",
        },
        { title: "Price reduced", text: "-€600", status: "For sale, unregistered" },
        { title: "Price reduced", text: "-€500", status: "For sale, unregistered" },
        { title: "Price reduced", text: "-€500", status: "For sale, unregistered" },
        { title: "Price raised", text: "+€500", status: "For sale, unregistered" },
        { title: "Price reduced", text: "-€500", status: "For sale, unregistered" },
        { title: "Price reduced", text: "-€1,000. Total -€2,600.", status: "For sale, unregistered" },
        {
          title: "First registration in Latvia",
          text: "For 8 months the car was sold while still unregistered in Latvia.",
          status: "Registered in Latvia",
        },
      ],
      [
        {
          title: "Order - official dealer data",
          text: "The system automatically raises a red flag. After agreeing with the client we continue as a full audit.",
          status: "Research",
        },
        {
          title: "Audit ready",
          text: "12+ sources, 8 h of research. Report A: no damage. Report B: damage, extent not stated.",
          status: "Audit",
        },
        {
          title: "Written confirmation from a reliable source",
          text: "Sold at auction as damaged, airbags deployed. Result: the client cancels the leasing and the EKII grant.",
          status: "Confirmed",
        },
      ],
    ],
    panelOdometer: "Odometer",
    panelPrice: "Last known price",
    panelStatus: "Status",
    legend: ["Report A: no damage", "Report B: damage, extent not stated", "Registry: deregistered"],
    confirmedStrong: "Confirmed in writing:",
    confirmedText:
      "sold at auction as damaged, airbags deployed. At the last moment the client cancelled an already arranged leasing and the EKII grant.",
  },
};

const RU: HomeV6Copy = {
  dealer: {
    badge: "Новинка",
    kicker: "Данные официального дилера · 24,99\u00a0€",
    title: "Сервисная история, которая читается как рассказ",
    lead: "Официально зафиксированные показания пробега, ТО и ремонты по годам - с кривой пробега и интервалами замены масла.",
    chartNote: "Пример · Volkswagen Passat B8 · 2018",
    chartAria: "Кривая пробега по записям официального дилера",
    intervalsCaption: "Интервалы замены масла",
    intervalsNorm: "норма 15 000 км",
    withinNorm: "в норме",
    overNorm: "+{km} сверх нормы",
    guaranteeStrong: "Нет данных - вернём деньги.",
    guaranteeText:
      "Если данных официального дилера по авто нет, вернём полную сумму. Если затем закажете полный аудит, 24,99\u00a0€ засчитаем в его цену.",
    cta: "Заказать данные дилера · 24,99\u00a0€",
  },
  caseStudy: {
    kicker: "Самый яркий случай · VW",
    title: "От повреждения в Финляндии до продажи в Латвии",
    facts: "12+ источников · 8 ч проверки · 2 дня",
    badges: ["Лизинг отменён", "Поддержка EKII отменена"],
    lead: "PROVIN восстановил всю хронологию истории без стандартных отчётов.",
    damageAria: "Повреждение",
    phases: [
      { title: "Финляндия", subtitle: "Обычная эксплуатация" },
      { title: "9 дней", subtitle: "Аукцион, повреждение, страховщик" },
      { title: "Латвия", subtitle: "В продаже 264 дня" },
      { title: "PROVIN", subtitle: "Проверка за 2 дня" },
    ],
    events: [
      [
        { title: "Первая регистрация в Финляндии", text: "Владелец - лизинговая компания.", status: "Зарегистрирован" },
        {
          title: "ТО у официального дилера",
          text: "Одометр фиксируют все основные источники. В среднем ~1 900 км в месяц.",
          status: "В эксплуатации",
        },
        {
          title: "Лизинг заканчивается",
          text: "5.11.2024 в регистре статус - складской запас продавца.",
          status: "Склад продавца",
        },
        {
          title: "Объявление в Финляндии",
          text: "33 фотографии: авто в полном порядке, одометр виден.",
          status: "В продаже",
        },
      ],
      [
        { title: "Авто попадает на аукционную площадку", text: "Через 13 дней после объявления.", status: "На аукционе" },
        { title: "Тип использования - частный", text: "Авто продано и снова ездит.", status: "Частный" },
        {
          title: "Снят с учёта из-за повреждений",
          text: "Через 9 дней. Запрет на эксплуатацию. Страховщик снимает авто с учёта задним числом - на последний день использования.",
          status: "Запрет эксплуатации",
        },
        {
          title: "Владелец - страховая компания",
          text: "Обычно так бывает, когда ремонт невыгоден и владельцу выплачивают деньги.",
          status: "У страховщика",
        },
        { title: "Уведомление о передаче права собственности", text: "В регистре Финляндии.", status: "Передача" },
        { title: "Срок техосмотра истекает", text: "Новый техосмотр не проводится.", status: "Без техосмотра" },
      ],
      [
        {
          title: "Объявление в Латвии",
          text: "С 73 500 до ~76 000 км - всего +2 755 км за 14 месяцев, темп упал на ~90 %.",
          status: "В продаже, не зарегистрирован",
        },
        { title: "Цена снижена", text: "-600 €", status: "В продаже, не зарегистрирован" },
        { title: "Цена снижена", text: "-500 €", status: "В продаже, не зарегистрирован" },
        { title: "Цена снижена", text: "-500 €", status: "В продаже, не зарегистрирован" },
        { title: "Цена повышена", text: "+500 €", status: "В продаже, не зарегистрирован" },
        { title: "Цена снижена", text: "-500 €", status: "В продаже, не зарегистрирован" },
        { title: "Цена снижена", text: "-1 000 €. Всего -2 600 €.", status: "В продаже, не зарегистрирован" },
        {
          title: "Первая регистрация в Латвии",
          text: "8 месяцев авто продавали, ещё не зарегистрированным в Латвии.",
          status: "Зарегистрирован в Латвии",
        },
      ],
      [
        {
          title: "Заказ - данные официального дилера",
          text: "Система автоматически показывает красный флаг. По согласованию с клиентом продолжаем в формате полного аудита.",
          status: "Проверка",
        },
        {
          title: "Аудит готов",
          text: "12+ источников, 8 ч проверки. Отчёт A: повреждений нет. Отчёт B: повреждение, объём не указан.",
          status: "Аудит",
        },
        {
          title: "Письменное подтверждение из надёжного источника",
          text: "Продан на аукционе как повреждённый, сработали подушки безопасности. Итог: клиент отменяет лизинг и поддержку EKII.",
          status: "Подтверждено",
        },
      ],
    ],
    panelOdometer: "Одометр",
    panelPrice: "Последняя известная цена",
    panelStatus: "Статус",
    legend: ["Отчёт A: повреждений нет", "Отчёт B: повреждение, объём не указан", "Регистр: снят с учёта"],
    confirmedStrong: "Подтверждено письменно:",
    confirmedText:
      "продан на аукционе как повреждённый, сработали подушки безопасности. В последний момент клиент отменил уже оформленный лизинг и поддержку EKII.",
  },
};

const DE: HomeV6Copy = {
  dealer: {
    badge: "Neu",
    kicker: "Offizielle Händlerdaten · 24,99\u00a0€",
    title: "Eine Servicehistorie, die sich wie eine Geschichte liest",
    lead: "Offiziell erfasste Kilometerstände, Wartungen und Reparaturen nach Jahren - mit Kilometerkurve und Ölwechselintervallen.",
    chartNote: "Beispiel · Volkswagen Passat B8 · 2018",
    chartAria: "Kilometerkurve aus offiziellen Händlereinträgen",
    intervalsCaption: "Ölwechselintervalle",
    intervalsNorm: "Norm 15.000 km",
    withinNorm: "in der Norm",
    overNorm: "+{km} über der Norm",
    guaranteeStrong: "Keine Daten - Geld zurück.",
    guaranteeText:
      "Gibt es keine offiziellen Händlerdaten zum Fahrzeug, erstatten wir den vollen Betrag. Bestellen Sie danach das volle Audit, rechnen wir die 24,99\u00a0€ auf den Auditpreis an.",
    cta: "Händlerdaten bestellen · 24,99\u00a0€",
  },
  caseStudy: {
    kicker: "Der krasseste Fall · VW",
    title: "Vom Schaden in Finnland bis zum Verkauf in Lettland",
    facts: "12+ Quellen · 8 h Recherche · 2 Tage",
    badges: ["Leasing storniert", "EKII-Förderung storniert"],
    lead: "PROVIN hat die gesamte Chronologie ohne Standard-Historienberichte rekonstruiert.",
    damageAria: "Schaden",
    phases: [
      { title: "Finnland", subtitle: "Normale Nutzung" },
      { title: "9 Tage", subtitle: "Auktion, Schaden, Versicherer" },
      { title: "Lettland", subtitle: "264 Tage im Verkauf" },
      { title: "PROVIN", subtitle: "Recherche in 2 Tagen" },
    ],
    events: [
      [
        { title: "Erstzulassung in Finnland", text: "Halter - eine Leasinggesellschaft.", status: "Zugelassen" },
        {
          title: "Wartung beim Vertragshändler",
          text: "Alle wichtigen Quellen erfassen den Kilometerstand. Im Schnitt ~1.900 km pro Monat.",
          status: "In Nutzung",
        },
        {
          title: "Leasing endet",
          text: "Am 5.11.2024 wechselt der Registerstatus auf Händlerbestand.",
          status: "Händlerbestand",
        },
        {
          title: "Inserat in Finnland",
          text: "33 Fotos: Fahrzeug in einwandfreiem Zustand, Tacho sichtbar.",
          status: "Im Verkauf",
        },
      ],
      [
        { title: "Fahrzeug landet auf einer Auktionsplattform", text: "13 Tage nach dem Inserat.", status: "In der Auktion" },
        { title: "Nutzungsart - privat", text: "Das Auto ist verkauft und wird wieder gefahren.", status: "Privat" },
        {
          title: "Wegen Schäden abgemeldet",
          text: "Nach 9 Tagen. Fahrverbot. Der Versicherer meldet das Auto rückwirkend zum letzten Nutzungstag ab.",
          status: "Fahrverbot",
        },
        {
          title: "Halter - eine Versicherung",
          text: "Das passiert meist, wenn sich eine Reparatur nicht lohnt und der Halter ausgezahlt wird.",
          status: "Im Besitz des Versicherers",
        },
        { title: "Mitteilung über Eigentumsübertragung", text: "Im finnischen Register.", status: "Übertragung" },
        { title: "Hauptuntersuchung läuft ab", text: "Eine neue Prüfung findet nicht statt.", status: "Ohne HU" },
      ],
      [
        {
          title: "Inserat in Lettland",
          text: "Von 73.500 auf ~76.000 km - nur +2.755 km in 14 Monaten, das Tempo sank um ~90 %.",
          status: "Im Verkauf, nicht zugelassen",
        },
        { title: "Preis gesenkt", text: "-600 €", status: "Im Verkauf, nicht zugelassen" },
        { title: "Preis gesenkt", text: "-500 €", status: "Im Verkauf, nicht zugelassen" },
        { title: "Preis gesenkt", text: "-500 €", status: "Im Verkauf, nicht zugelassen" },
        { title: "Preis erhöht", text: "+500 €", status: "Im Verkauf, nicht zugelassen" },
        { title: "Preis gesenkt", text: "-500 €", status: "Im Verkauf, nicht zugelassen" },
        { title: "Preis gesenkt", text: "-1.000 €. Insgesamt -2.600 €.", status: "Im Verkauf, nicht zugelassen" },
        {
          title: "Erstzulassung in Lettland",
          text: "8 Monate wurde das Auto verkauft, ohne in Lettland zugelassen zu sein.",
          status: "In Lettland zugelassen",
        },
      ],
      [
        {
          title: "Bestellung - offizielle Händlerdaten",
          text: "Das System zeigt automatisch eine rote Flagge. Nach Absprache mit dem Kunden machen wir als volles Audit weiter.",
          status: "Recherche",
        },
        {
          title: "Audit fertig",
          text: "12+ Quellen, 8 h Recherche. Bericht A: kein Schaden. Bericht B: Schaden, Umfang nicht angegeben.",
          status: "Audit",
        },
        {
          title: "Schriftliche Bestätigung aus sicherer Quelle",
          text: "Als Unfallwagen versteigert, Airbags ausgelöst. Ergebnis: Der Kunde storniert das Leasing und die EKII-Förderung.",
          status: "Bestätigt",
        },
      ],
    ],
    panelOdometer: "Kilometerstand",
    panelPrice: "Letzter bekannter Preis",
    panelStatus: "Status",
    legend: ["Bericht A: kein Schaden", "Bericht B: Schaden, Umfang nicht angegeben", "Register: abgemeldet"],
    confirmedStrong: "Schriftlich bestätigt:",
    confirmedText:
      "als Unfallwagen versteigert, Airbags ausgelöst. Im letzten Moment stornierte der Kunde ein bereits abgeschlossenes Leasing und die EKII-Förderung.",
  },
};

const COPY: Record<HomeV6Locale, HomeV6Copy> = { lv: LV, en: EN, ru: RU, de: DE };

/** Locale-aware v6 teksti. Nezināma valoda paliek latviski. */
export function getHomeV6Copy(locale?: string): HomeV6Copy {
  return COPY[(locale ?? "lv") as HomeV6Locale] ?? LV;
}

export const HOME_V6_LOCALES: readonly HomeV6Locale[] = ["lv", "en", "ru", "de"];
