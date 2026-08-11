import type { Tp5DesktopHeroFeatureIcon } from "@/lib/test-pricing-5-desktop-hero-features";
import {
  TP5_AUDITS_SAMPLE_REPORT_HREF,
  TP5_DEALER_SAMPLE_REPORT_HREF,
  TP5_MINI_SAMPLE_REPORT_HREF,
} from "@/lib/test-pricing-5-ui-copy";

/** Icons used on package breakdown cards (extends hero icon set). */
export type HomeFeatureBreakdownIcon =
  | Tp5DesktopHeroFeatureIcon
  | "odometer"
  | "brands"
  | "refund"
  | "auction"
  | "damage";

export type HomeFeatureBreakdownItem = {
  title: string;
  description: string;
  icon: HomeFeatureBreakdownIcon;
};

export type HomeFeatureBreakdownPackageId = "mini" | "audits" | "dealer" | "koreaUsa";

export type HomeFeatureBreakdownPackage = {
  id: HomeFeatureBreakdownPackageId;
  title: string;
  goal: string;
  items: HomeFeatureBreakdownItem[];
  /** CTA label on the catalog card. */
  buttonText: string;
  /** Optional PDF sample under the CTA. */
  sampleReportHref?: string;
  /** Optional highlight badge (e.g. „Populārākā izvēle”). */
  badge?: string;
};

const MINI_LV: HomeFeatureBreakdownPackage = {
  id: "mini",
  title: "PROVIN MINI",
  buttonText: "PASŪTĪT MINI AUDITU — 39,99 €",
  sampleReportHref: TP5_MINI_SAMPLE_REPORT_HREF,
  goal:
    "Sludinājuma un tehnisko datu analīze automašīnām, kas jau tiek ekspluatētas Latvijā. Pārbaude fokusējas uz vietējo vēsturi, pēdējo tehnisko apskašu datiem un publisko reģistru izvērtējumu, nodrošinot uzticamības prognozi un iespējamo risku kopsavilkumu.",
  items: [
    {
      title: "Sludinājuma un tehnisko risku analīze",
      description:
        "Sludinājuma un agregātu izvērtējums. Uzticamības prognoze un ekspluatācijas riski.",
      icon: "listing-analysis",
    },
    {
      title: "EU reģistru pārbaude & TA vēsture",
      description:
        "Detalizēta Latvijas un Eiropas publisko reģistru datu analīze, tostarp visu tehnisko apskašu vēsture.",
      icon: "eu-registry",
    },
    {
      title: "Ieteikumi klātienes apskatei",
      description:
        "Praktisks kontrolsaraksts un padomi, kam tieši pievērst uzmanību, dodoties skatīties konkrēto auto dzīvē.",
      icon: "inspection-tips",
    },
    {
      title: "Individuāla konsultācija",
      description:
        'Konsultācija pirms klātienes apskates, lai izrunātu visus "par" un "pret" konkrētā auto iegādei.',
      icon: "consultation",
    },
  ],
};

const AUDITS_LV: HomeFeatureBreakdownPackage = {
  id: "audits",
  title: "PROVIN AUDITS",
  badge: "Populārākā izvēle",
  buttonText: "PASŪTĪT PROVIN AUDITU — 99,99 €",
  goal:
    "Maksimāla drošība un pilnīga izpēte no ārvalstīm ievestiem auto. Apvieno PROVIN MINI un starptautisko maksas datubāzu pārskatus, oficiālo dīleru sistēmu informāciju un izsoļu foto arhīvus, sniedzot padziļinātu vēstures, nobraukuma un risku analīzi.",
  items: [
    {
      title: "Starptautiska vēstures pārbaude",
      description: "Padziļināta iepriekšējo īpašnieku, reģistrāciju un juridisko statusu analīze.",
      icon: "international",
    },
    {
      title: "carVertical integrācija",
      description:
        "Lai nodrošinātu konkrētajam reģionam atbilstošākos datus, atskaite var tikt aizstāta ar CARFAX vai citu specializētu datubāzi.",
      icon: "carvertical",
    },
    {
      title: "autoDNA integrācija",
      description:
        "Lai nodrošinātu konkrētajam reģionam atbilstošākos datus, atskaite var tikt aizstāta ar CEBIA vai citu specializētu datubāzi.",
      icon: "autodna",
    },
    {
      title: "Oficiālo dīleru un izsoļu portālu arhīvs*",
      description:
        "Dati no autorizētajiem servisiem un vēsturisko izsoļu portālu arhīviem, ieskaitot sākotnējos bojājumu attēlus pirms auto remonta.",
      icon: "dealer-data",
    },
  ],
  sampleReportHref: TP5_AUDITS_SAMPLE_REPORT_HREF,
};

const DEALER_LV: HomeFeatureBreakdownPackage = {
  id: "dealer",
  title: "DĪLERA DATI",
  buttonText: "PASŪTĪT DĪLERA DATUS — 24,99 €",
  goal:
    "Oficiālās dīleru servisa vēstures un ražotāju datubāzu analīze automašīnām. Pārbaude fokusējas uz autorizēto servisu ierakstiem, hronoloģisko nobraukumu, veiktajām apkopēm un rūpnīcas atsaukumiem, nodrošinot maksimālu pārredzamību par auto reālo ekspluatāciju.",
  items: [
    {
      title: "Oficiālā servisa vēsture",
      description:
        "Padziļināta autorizēto servisu apmeklējumu, veikto remontu un apkopes darbu ierakstu analīze.",
      icon: "international",
    },
    {
      title: "Odometra & kampaņu pārbaude",
      description:
        "Nobraukuma hronoloģiskā izsekošana ražotāja sistēmā, kā arī aktīvo garantijas atsaukumu pārbaude.",
      icon: "odometer",
    },
    {
      title: "Atbalstīto ražotāju sistēmas",
      description:
        "Piekļuve Vācijas premium zīmoliem (BMW, Audi, MB), VAG grupas, VOLVO un citu ražotāju oficiālajiem datiem.",
      icon: "brands",
    },
    {
      title: "100% Naudas atmaksas garantija",
      description:
        "Ja konkrētajam VIN kodam ražotāja oficiālajā datubāzē nav ierakstu, veiksim pilnu pirkuma atmaksu.",
      icon: "refund",
    },
  ],
  sampleReportHref: TP5_DEALER_SAMPLE_REPORT_HREF,
};

const KOREA_USA_LV: HomeFeatureBreakdownPackage = {
  id: "koreaUsa",
  title: "ASV UN KOREJA",
  buttonText: "PASŪTĪT ASV UN KOREJA — 19,99 €",
  goal:
    "Pilns auto pārbaudes komplekts ASV un Korejā ekspluatētiem vai no šīm valstīm importētiem transportlīdzekļiem. Pārbaude fokusējas uz oficiālo reģistru ierakstiem, izsoļu vēsturi un vizuālajiem bojājumiem, nodrošinot pilnīgu skaidrību par auto reālo stāvokli pirms tā iegādes vai reģistrācijas.",
  items: [
    {
      title: "Oficiālo reģistru vēsture",
      description:
        "Pieeja apvienotajām ASV un Korejas transportlīdzekļu datubāzēm, kā arī oficiālajiem reģistrācijas (Title) statusiem.",
      icon: "international",
    },
    {
      title: "Izsoļu arhīvs un foto",
      description:
        "ASV (Copart, IAAI) un Korejas izsoļu vēsture ar pievienotiem attēliem pirms auto remonta.",
      icon: "auction",
    },
    {
      title: "Bojājumu un nobraukuma analīze",
      description:
        "Apdrošināšanas gadījumu (salvage / junk ieraksti), avāriju, nobraukuma hronoloģijas un zādzību pārbaude.",
      icon: "damage",
    },
    {
      title: "100% Naudas atmaksas garantija",
      description:
        "Ja ASV un Korejas datubāzēs par konkrēto VIN kodu dati nav pieejami, veiksim pilnu pirkuma atmaksu.",
      icon: "refund",
    },
  ],
};

const MINI_EN: HomeFeatureBreakdownPackage = {
  id: "mini",
  title: "PROVIN MINI",
  buttonText: "ORDER MINI AUDIT — €39.99",
  sampleReportHref: TP5_MINI_SAMPLE_REPORT_HREF,
  goal:
    "Listing, technical data and risk analysis for cars that have already spent a longer time on Latvian roads. The check focuses on an in-depth review of local usage, recent roadworthiness inspection history and public registry data. The service delivers a full assessment of the major components, a reliability outlook and a summary of potential running risks.",
  items: [
    {
      title: "Listing and technical risk analysis",
      description:
        "Assessment of the listing and major components. Reliability outlook and running risks.",
      icon: "listing-analysis",
    },
    {
      title: "EU registry check & inspection history",
      description:
        "Detailed analysis of Latvian and European public registry data, including the full roadworthiness inspection history.",
      icon: "eu-registry",
    },
    {
      title: "In-person inspection guidance",
      description:
        "A practical checklist and tips on exactly what to look out for when going to see the car in person.",
      icon: "inspection-tips",
    },
    {
      title: "Personal consultation",
      description:
        "A consultation before the in-person viewing to talk through all the pros and cons of buying the specific car.",
      icon: "consultation",
    },
  ],
};

const AUDITS_EN: HomeFeatureBreakdownPackage = {
  id: "audits",
  title: "PROVIN AUDIT",
  badge: "Most popular choice",
  buttonText: "ORDER PROVIN AUDIT — €99.99",
  goal:
    "Maximum confidence and a complete investigation of cars imported from abroad. Combines PROVIN MINI with international paid database reports, official dealer system data and auction photo archives, delivering in-depth history, mileage and risk analysis.",
  items: [
    {
      title: "International history check",
      description: "In-depth analysis of previous owners, registrations and legal status.",
      icon: "international",
    },
    {
      title: "carVertical integration",
      description:
        "To ensure the most relevant data for the specific region, the report may be substituted with CARFAX or another specialised database.",
      icon: "carvertical",
    },
    {
      title: "autoDNA integration",
      description:
        "To ensure the most relevant data for the specific region, the report may be substituted with CEBIA or another specialised database.",
      icon: "autodna",
    },
    {
      title: "Official dealer & auction portal archive*",
      description:
        "Data from authorised service centres and historical auction portal archives, including original damage photos before repairs.",
      icon: "dealer-data",
    },
  ],
  sampleReportHref: TP5_AUDITS_SAMPLE_REPORT_HREF,
};

const DEALER_EN: HomeFeatureBreakdownPackage = {
  id: "dealer",
  title: "DEALER DATA",
  buttonText: "ORDER DEALER DATA — €24.99",
  goal:
    "Official dealer service history and manufacturer database analysis for vehicles. The check focuses on authorised service records, chronological mileage, completed maintenance and factory recalls, providing maximum transparency into the car’s real operating history.",
  items: [
    {
      title: "Official service history",
      description:
        "In-depth analysis of authorised service visits, repairs carried out and maintenance records.",
      icon: "international",
    },
    {
      title: "Odometer & campaign check",
      description:
        "Chronological mileage tracking in the manufacturer system, plus checks for active warranty recalls.",
      icon: "odometer",
    },
    {
      title: "Supported manufacturer systems",
      description:
        "Access to German premium brands (BMW, Audi, MB), the VAG group, VOLVO and other manufacturers’ official data.",
      icon: "brands",
    },
    {
      title: "100% money-back guarantee",
      description:
        "If the manufacturer’s official database has no records for the specific VIN, we will issue a full purchase refund.",
      icon: "refund",
    },
  ],
  sampleReportHref: TP5_DEALER_SAMPLE_REPORT_HREF,
};

const KOREA_USA_EN: HomeFeatureBreakdownPackage = {
  id: "koreaUsa",
  title: "USA & KOREA",
  buttonText: "ORDER USA & KOREA — €19.99",
  goal:
    "A full vehicle check package for cars used in the USA and Korea or imported from these countries. The check focuses on official registry records, auction history and visual damage, giving complete clarity on the car’s real condition before purchase or registration.",
  items: [
    {
      title: "Official registry history",
      description:
        "Access to combined US and Korea vehicle databases, plus official registration (Title) statuses.",
      icon: "international",
    },
    {
      title: "Auction archive and photos",
      description:
        "US (Copart, IAAI) and Korea auction history with attached images from before repairs.",
      icon: "auction",
    },
    {
      title: "Damage and mileage analysis",
      description:
        "Insurance events (salvage / junk records), accidents, mileage chronology and theft checks.",
      icon: "damage",
    },
    {
      title: "100% money-back guarantee",
      description:
        "If no data is available for the specific VIN in US and Korea databases, we will issue a full purchase refund.",
      icon: "refund",
    },
  ],
};

/** Full catalog for `/pakalpojumi` (extensible to 4–6 services). */
export const HOME_FEATURE_BREAKDOWN_PACKAGES: HomeFeatureBreakdownPackage[] = [
  AUDITS_LV,
  MINI_LV,
  DEALER_LV,
  KOREA_USA_LV,
];

const HOME_FEATURE_BREAKDOWN_PACKAGES_EN: HomeFeatureBreakdownPackage[] = [
  AUDITS_EN,
  MINI_EN,
  DEALER_EN,
  KOREA_USA_EN,
];

export function catalogPackageAnchorId(id: HomeFeatureBreakdownPackageId): string {
  return `pakalpojums-${id}`;
}

/** Locale-aware catalog packages; anything other than `en` falls back to Latvian. */
export function getHomeFeatureBreakdownPackages(locale?: string): HomeFeatureBreakdownPackage[] {
  return locale === "en" ? HOME_FEATURE_BREAKDOWN_PACKAGES_EN : HOME_FEATURE_BREAKDOWN_PACKAGES;
}

/** Alias for catalog page clarity. */
export function getCatalogFeatureBreakdownPackages(
  locale?: string,
): HomeFeatureBreakdownPackage[] {
  return getHomeFeatureBreakdownPackages(locale);
}
