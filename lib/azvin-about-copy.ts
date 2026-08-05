import type { AzvinLocale } from "@/lib/azvin-hero-copy";

export type { AzvinLocale };

export type AzvinAboutCopy = {
  sectionId: string;
  eyebrow: string;
  title: string;
  lead: string;
  mission: string;
  directionsTitle: string;
  directions: readonly {
    id: string;
    title: string;
    body: string;
    accent?: string;
  }[];
  differentTitle: string;
  different: readonly { title: string; body: string }[];
  brandsTitle: string;
  brandsLead: string;
  reportTitle: string;
  reportLead: string;
  reportItems: readonly string[];
  trustTitle: string;
  trust: readonly string[];
  statsTitle: string;
  stats: readonly { value: string; label: string }[];
  contactTitle: string;
  contactBody: string;
  ctaLabel: string;
  punchlineLead: string;
  punchlineAccent: string;
};

const ABOUT_EN: AzvinAboutCopy = {
  sectionId: "about",
  eyebrow: "About us",
  title: "Who we are",
  lead:
    "AZ.VIN is an international vehicle history service for buyers in Azerbaijan and beyond. We focus on imported cars — consolidating Korea, USA and Europe sources into one clear report.",
  mission:
    "Our mission is simple: give buyers transparent, reliable vehicle information so they can decide with confidence and avoid costly mistakes.",
  directionsTitle: "Three directions",
  directions: [
    {
      id: "koreaUsa",
      title: "Korea & USA history",
      body:
        "Auction archives, ownership and sales trails, mileage records, insured events and legal status from major Korea and USA databases — built for Korean and American imports.",
    },
    {
      id: "dealer",
      title: "Official dealer history",
      body:
        "Direct manufacturer / authorised network service records and factory-linked specification context for supported brands. Not third-party guesses — official service trails where available.",
      accent: "Also includes brands from our secondary dealer-data source.",
    },
    {
      id: "europe",
      title: "Europe history",
      body:
        "European registry and inspection trails, insurer signals, auction-archive coverage and structured risk notes for EU-origin vehicles — the same depth buyers expect from a full European history check.",
      accent: "Rolling out next.",
    },
  ],
  differentTitle: "What makes AZ.VIN different",
  different: [
    {
      title: "Official & primary sources",
      body:
        "Dealer records from manufacturer networks, plus trusted Korea / USA / Europe databases — not scraped estimates.",
    },
    {
      title: "Fast delivery",
      body: "Typical turnaround within 24 hours. Priority cases can be faster on request.",
    },
    {
      title: "Money-back clarity",
      body: "If dealer data is not available for your VIN / year — 100% refund. No games.",
    },
    {
      title: "Privacy first",
      body: "We do not sell your data. Payments run through secure Stripe processing.",
    },
  ],
  brandsTitle: "Supported manufacturers",
  brandsLead:
    "Official dealer history is available for these brands (coverage depends on VIN and production year):",
  reportTitle: "What the report covers",
  reportLead: "Depending on the packages you select, an AZ.VIN report can include:",
  reportItems: [
    "Technical specifications & factory options",
    "Mileage and usage trail",
    "Insured events (accidents, flood, vandalism, and more)",
    "Owners and sales history",
    "Maintenance and authorised repairs",
    "Legal status signals (theft, collateral, scrap, restrictions)",
    "Auction portal archive findings",
    "European registry & inspection context",
  ],
  trustTitle: "Why trust AZ.VIN",
  trust: [
    "Accurate where sources allow — manufacturer and primary databases first.",
    "Clear AZN pricing in the order card. No hidden fees.",
    "Built for imported-car reality in Azerbaijan: Korea, USA and Europe.",
    "Secure checkout and careful handling of your VIN request.",
  ],
  statsTitle: "AZ.VIN in numbers",
  stats: [
    { value: "3", label: "Core regions" },
    { value: "17+", label: "Dealer brands" },
    { value: "24h", label: "Typical delivery" },
    { value: "100%", label: "Refund if no dealer data" },
  ],
  contactTitle: "Get in touch",
  contactBody: "Questions about AZ.VIN or a specific VIN? Start with a check — or reach us after you order.",
  ctaLabel: "Check a vehicle",
  punchlineLead: "Check VIN.",
  punchlineAccent: "Don't be fooled.",
};

const ABOUT_AZ: AzvinAboutCopy = {
  sectionId: "about",
  eyebrow: "Haqqımızda",
  title: "Biz kimik",
  lead:
    "AZ.VIN — Azərbaycan və ondan kənar alıcılar üçün beynəlxalq avtomobil tarixi xidmətidir. İdxal avtomobillərinə fokuslanırıq: Koreya, ABŞ və Avropa mənbələrini bir hesabatda birləşdiririk.",
  mission:
    "Missiyamız sadədir: alıcılara şəffaf və etibarlı məlumat vermək ki, inamla qərar versinlər və bahalı səhvlərdən yayınsınlar.",
  directionsTitle: "Üç istiqamət",
  directions: [
    {
      id: "koreaUsa",
      title: "Koreya və ABŞ tarixi",
      body:
        "Hərrac arxivləri, sahiblik və satış izi, yürüş qeydləri, sığorta hadisələri və hüquqi status — Koreya və ABŞ idxalı üçün əsas bazalardan.",
    },
    {
      id: "dealer",
      title: "Rəsmi diler tarixi",
      body:
        "İstehsalçı / rəsmi şəbəkə servis qeydləri və zavod spesifikasiyası konteksti. Üçüncü tərəf təxminləri deyil — mövcud olduqda rəsmi servis izi.",
      accent: "İkinci diler-məlumat mənbəyindən markalar da daxildir.",
    },
    {
      id: "europe",
      title: "Avropa tarixi",
      body:
        "Avropa reyestrləri və texniki baxış izi, sığortaçı siqnalları, hərrac arxivləri və risk qeydləri — tam Avropa tarixi yoxlamasının gözlənilən dərinliyi.",
      accent: "Növbəti mərhələdə.",
    },
  ],
  differentTitle: "AZ.VIN-i fərqləndirən",
  different: [
    {
      title: "Rəsmi və əsas mənbələr",
      body: "İstehsalçı şəbəkəsinin diler qeydləri və etibarlı Koreya / ABŞ / Avropa bazaları.",
    },
    {
      title: "Sürətli çatdırılma",
      body: "Tipik müddət 24 saat. Prioritet hallar sorğu ilə daha tez ola bilər.",
    },
    {
      title: "Pulun qaytarılması",
      body: "VIN / il üçün diler məlumatı yoxdursa — 100% geri ödəniş.",
    },
    {
      title: "Məxfilik",
      body: "Məlumatlarınızı satmırıq. Ödənişlər Stripe vasitəsilə təhlükəsizdir.",
    },
  ],
  brandsTitle: "Dəstəklənən istehsalçılar",
  brandsLead:
    "Rəsmi diler tarixi bu markalar üçün mövcuddur (əhatə VIN və istehsal ilindən asılıdır):",
  reportTitle: "Hesabat nə əhatə edir",
  reportLead: "Seçdiyiniz paketlərə görə AZ.VIN hesabatına daxil ola bilər:",
  reportItems: [
    "Texniki spesifikasiya və zavod seçimləri",
    "Yürüş və istismar izi",
    "Sığorta hadisələri (qəza, su basması, vandalizm və s.)",
    "Sahiblər və satış tarixi",
    "Texniki xidmət və rəsmi təmirlər",
    "Hüquqi status (oğurluq, girov, utilizasiya, məhdudiyyətlər)",
    "Hərrac portalı arxiv tapıntıları",
    "Avropa reyestr və texniki baxış konteksti",
  ],
  trustTitle: "Niyə AZ.VIN",
  trust: [
    "Mənbə icazə verdikdə dəqiq — əvvəlcə istehsalçı və əsas bazalar.",
    "Sifariş kartında aydın AZN qiymətlər. Gizli rüsum yoxdur.",
    "Azərbaycanda idxal reallığı üçün: Koreya, ABŞ və Avropa.",
    "Təhlükəsiz ödəniş və VIN sorğusunun diqqətli emalı.",
  ],
  statsTitle: "AZ.VIN rəqəmlərlə",
  stats: [
    { value: "3", label: "Əsas region" },
    { value: "17+", label: "Diler markası" },
    { value: "24s", label: "Tipik çatdırılma" },
    { value: "100%", label: "Diler datası yoxdursa geri ödəniş" },
  ],
  contactTitle: "Əlaqə",
  contactBody: "AZ.VIN və ya konkret VIN barədə sualınız var? Yoxlama ilə başlayın.",
  ctaLabel: "Avtomobili yoxla",
  punchlineLead: "VIN yoxla.",
  punchlineAccent: "Aldanma.",
};

const ABOUT_RU: AzvinAboutCopy = {
  sectionId: "about",
  eyebrow: "О нас",
  title: "Кто мы",
  lead:
    "AZ.VIN — международный сервис истории авто для покупателей в Азербайджане и за его пределами. Фокус на импорте: источники Кореи, США и Европы — в одном понятном отчёте.",
  mission:
    "Миссия проста: дать прозрачные и надёжные данные, чтобы решение о покупке было осознанным, а скрытые риски — видимыми.",
  directionsTitle: "Три направления",
  directions: [
    {
      id: "koreaUsa",
      title: "История Корея и США",
      body:
        "Аукционные архивы, история владельцев и продаж, пробег, страховые случаи и правовой статус — из ключевых баз Кореи и США.",
    },
    {
      id: "dealer",
      title: "История официального дилера",
      body:
        "Сервисные записи производителя / официальной сети и заводской спецификации. Не оценки третьих сторон — официальный сервисный след, где он доступен.",
      accent: "Также бренды из нашего дополнительного источника дилерских данных.",
    },
    {
      id: "europe",
      title: "История Европы",
      body:
        "Европейские реестры и техосмотры, сигналы страховщиков, аукционные архивы и структурированные риски — глубина полной европейской проверки.",
      accent: "Запуск — следующим этапом.",
    },
  ],
  differentTitle: "Чем AZ.VIN отличается",
  different: [
    {
      title: "Официальные и первичные источники",
      body: "Дилерские записи сетей производителей и проверенные базы Кореи / США / Европы.",
    },
    {
      title: "Быстрая выдача",
      body: "Обычно в течение 24 часов. Срочные случаи — по запросу быстрее.",
    },
    {
      title: "Возврат средств",
      body: "Нет дилерских данных по VIN / году — 100% возврат.",
    },
    {
      title: "Конфиденциальность",
      body: "Мы не продаём ваши данные. Оплата через защищённый Stripe.",
    },
  ],
  brandsTitle: "Поддерживаемые производители",
  brandsLead:
    "Официальная дилерская история доступна для этих марок (покрытие зависит от VIN и года):",
  reportTitle: "Что входит в отчёт",
  reportLead: "В зависимости от выбранных пакетов отчёт AZ.VIN может включать:",
  reportItems: [
    "Технические характеристики и заводские опции",
    "Пробег и история эксплуатации",
    "Страховые случаи (ДТП, затопление, вандализм и др.)",
    "Владельцы и история продаж",
    "Обслуживание и официальные ремонты",
    "Правовой статус (угон, залог, утиль, ограничения)",
    "Находки аукционных архивов",
    "Контекст европейских реестров и техосмотров",
  ],
  trustTitle: "Почему AZ.VIN",
  trust: [
    "Точность там, где позволяют источники — сначала производитель и первичные базы.",
    "Прозрачные цены в AZN в карточке заказа. Без скрытых сборов.",
    "Под реалии импорта в Азербайджане: Корея, США и Европа.",
    "Безопасная оплата и аккуратная обработка VIN-запроса.",
  ],
  statsTitle: "AZ.VIN в цифрах",
  stats: [
    { value: "3", label: "Ключевых региона" },
    { value: "17+", label: "Дилерских брендов" },
    { value: "24ч", label: "Типичный срок" },
    { value: "100%", label: "Возврат без дилерских данных" },
  ],
  contactTitle: "Связаться",
  contactBody: "Вопросы по AZ.VIN или конкретному VIN? Начните с проверки.",
  ctaLabel: "Проверить авто",
  punchlineLead: "Проверь VIN.",
  punchlineAccent: "Не обманывайся.",
};

const ABOUT_LV: AzvinAboutCopy = {
  sectionId: "about",
  eyebrow: "Par mums",
  title: "Kas mēs esam",
  lead:
    "AZ.VIN ir starptautisks auto vēstures serviss pircējiem Azerbaidžānā un ārpus tās. Fokusā — importētie auto: Korejas, ASV un Eiropas avoti vienā skaidrā atskaitē.",
  mission:
    "Misija ir vienkārša: sniegt caurspīdīgu un uzticamu informāciju, lai lēmums par pirkumu būtu pamatots un dārgi riski — redzami.",
  directionsTitle: "Trīs virzieni",
  directions: [
    {
      id: "koreaUsa",
      title: "Korejas un ASV vēsture",
      body:
        "Izsoļu arhīvi, īpašnieku un pārdošanas vēsture, nobraukums, apdrošināšanas gadījumi un juridiskais statuss — no galvenajām Korejas un ASV datubāzēm.",
    },
    {
      id: "dealer",
      title: "Oficiālā dīlera vēsture",
      body:
        "Ražotāja / oficiālā tīkla servisa ieraksti un rūpnīcas specifikācijas konteksts. Ne trešo pušu novērtējumi — oficiālā servisa pēda, kad tā pieejama.",
      accent: "Ietver arī zīmolus no mūsu papildu dīleru datu avota.",
    },
    {
      id: "europe",
      title: "Eiropas vēsture",
      body:
        "Eiropas reģistri un tehniskās apskates, apdrošinātāju signāli, izsoļu arhīvi un strukturēti risku komentāri — pilnas Eiropas vēstures pārbaudes dziļums.",
      accent: "Nākamajā posmā.",
    },
  ],
  differentTitle: "Kas atšķir AZ.VIN",
  different: [
    {
      title: "Oficiāli un primāri avoti",
      body: "Dīleru ieraksti no ražotāju tīkliem un uzticamas Korejas / ASV / Eiropas datubāzes.",
    },
    {
      title: "Ātra izpilde",
      body: "Tipiski 24 stundu laikā. Prioritāte pēc pieprasījuma — ātrāk.",
    },
    {
      title: "Naudas atmaksa",
      body: "Ja dīlera datu nav šim VIN / gadam — 100% atmaksa.",
    },
    {
      title: "Privātums",
      body: "Mēs nepārdodam tavus datus. Maksājumi caur drošu Stripe.",
    },
  ],
  brandsTitle: "Atbalstītie ražotāji",
  brandsLead:
    "Oficiālā dīlera vēsture pieejama šiem zīmoliem (aptvere atkarīga no VIN un ražošanas gada):",
  reportTitle: "Kas iekļauts atskaitē",
  reportLead: "Atkarībā no izvēlētajām paketēm AZ.VIN atskaite var ietvert:",
  reportItems: [
    "Tehniskā specifikācija un rūpnīcas opcijas",
    "Nobraukums un ekspluatācijas vēsture",
    "Apdrošināšanas gadījumi (avārija, applūšana, vandālisms u.c.)",
    "Īpašnieki un pārdošanas vēsture",
    "Apkope un oficiālie remoni",
    "Juridiskais statuss (zādzība, ķīla, utilizācija, ierobežojumi)",
    "Izsoļu portālu arhīva atrades",
    "Eiropas reģistru un TA konteksts",
  ],
  trustTitle: "Kāpēc AZ.VIN",
  trust: [
    "Precizitāte tur, kur avoti atļauj — vispirms ražotājs un primārās datubāzes.",
    "Skaidras AZN cenas pasūtījuma kartītē. Bez slēptām maksām.",
    "Pielāgots importa realitātei Azerbaidžānā: Koreja, ASV un Eiropa.",
    "Droša apmaksa un rūpīga VIN pieprasījuma apstrāde.",
  ],
  statsTitle: "AZ.VIN skaitļos",
  stats: [
    { value: "3", label: "Galvenie reģioni" },
    { value: "17+", label: "Dīleru zīmoli" },
    { value: "24h", label: "Tipisks izpildes laiks" },
    { value: "100%", label: "Atmaksa bez dīlera datiem" },
  ],
  contactTitle: "Sazinies",
  contactBody: "Jautājumi par AZ.VIN vai konkrētu VIN? Sāc ar pārbaudi.",
  ctaLabel: "Pārbaudīt auto",
  punchlineLead: "Pārbaudi VIN.",
  punchlineAccent: "Neļaujies apmānīt.",
};

const ABOUT_BY_LOCALE: Record<AzvinLocale, AzvinAboutCopy> = {
  az: ABOUT_AZ,
  en: ABOUT_EN,
  ru: ABOUT_RU,
  lv: ABOUT_LV,
};

export function getAzvinAboutCopy(locale: AzvinLocale): AzvinAboutCopy {
  return ABOUT_BY_LOCALE[locale] ?? ABOUT_AZ;
}
