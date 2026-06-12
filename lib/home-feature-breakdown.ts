import type { Tp5DesktopHeroFeatureIcon } from "@/lib/test-pricing-5-desktop-hero-features";

export type HomeFeatureBreakdownItem = {
  title: string;
  description: string;
  icon: Tp5DesktopHeroFeatureIcon;
};

export type HomeFeatureBreakdownPackage = {
  id: "mini" | "audits";
  title: string;
  goal: string;
  items: HomeFeatureBreakdownItem[];
};

export const HOME_FEATURE_BREAKDOWN_PACKAGES: HomeFeatureBreakdownPackage[] = [
  {
    id: "mini",
    title: "PROVIN MINI",
    goal:
      "Sludinājuma, tehnisko datu un risku analīze automašīnām, kuras jau ilgāku laiku atrodas un tiek ekspluatētas Latvijā. Pārbaude ir fokusēta uz vietējās ekspluatācijas, pēdējo tehnisko apskašu vēstures un publisko reģistru datu padziļinātu izvērtējumu. Pakalpojums nodrošina pilnu agregātu analīzi, uzticamības prognozi un iespējamo ekspluatācijas risku kopsavilkumu.",
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
  },
  {
    id: "audits",
    title: "PROVIN AUDITS",
    goal:
      "Maksimāla drošība vai tikko no ārvalstīm ievestu automašīnu pilnīga izpēte. Detalizēta auto vēstures un risku analīze, apvienojot lielākos maksas datubāzu pārskatus un oficiālo dīleru datus. Audits ir izveidots kā pilna servisa risinājums, kas automātiski sevī ietver arī PROVIN MINI pārbaudi un paplašina to ar starptautisko maksas datubāzu un oficiālo dīleru sistēmu informāciju.",
    items: [
      {
        title: "Starptautiska vēstures pārbaude",
        description: "Padziļināta iepriekšējo īpašnieku, reģistrāciju un juridisko statusu analīze.",
        icon: "international",
      },
      {
        title: "carVertical integrācija",
        description: "Nobraukuma manipulāciju, bojājumu un arhīva fotogrāfiju pārbaude.",
        icon: "carvertical",
      },
      {
        title: "autoDNA integrācija",
        description: "Nobraukuma manipulāciju, bojājumu un arhīva fotogrāfiju pārbaude.",
        icon: "autodna",
      },
      {
        title: "Oficiālo dīleru dati*",
        description: "Informācija no autorizētajiem servisiem par fiksētajiem nobraukuma datiem.",
        icon: "dealer-data",
      },
    ],
  },
];

const HOME_FEATURE_BREAKDOWN_PACKAGES_EN: HomeFeatureBreakdownPackage[] = [
  {
    id: "mini",
    title: "PROVIN MINI",
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
  },
  {
    id: "audits",
    title: "PROVIN AUDIT",
    goal:
      "Maximum confidence — or a complete investigation of cars recently imported from abroad. An in-depth vehicle history and risk analysis that combines the leading paid database reports with official dealer data. The audit is built as a full-service solution: it automatically includes the PROVIN MINI check and extends it with information from international paid databases and official dealer systems.",
    items: [
      {
        title: "International history check",
        description: "In-depth analysis of previous owners, registrations and legal status.",
        icon: "international",
      },
      {
        title: "carVertical integration",
        description: "Checks for mileage manipulation, damage records and archive photos.",
        icon: "carvertical",
      },
      {
        title: "autoDNA integration",
        description: "Checks for mileage manipulation, damage records and archive photos.",
        icon: "autodna",
      },
      {
        title: "Official dealer data*",
        description: "Information from authorised service centres on recorded mileage readings.",
        icon: "dealer-data",
      },
    ],
  },
];

/** Locale-aware package cards; anything other than `en` falls back to Latvian. */
export function getHomeFeatureBreakdownPackages(locale?: string): HomeFeatureBreakdownPackage[] {
  return locale === "en" ? HOME_FEATURE_BREAKDOWN_PACKAGES_EN : HOME_FEATURE_BREAKDOWN_PACKAGES;
}
