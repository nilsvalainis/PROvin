import type { Tp5DesktopHeroFeatureIcon } from "@/lib/test-pricing-5-desktop-hero-features";

export type HomeFeatureBreakdownItem = {
  title: string;
  description: string;
  icon: Tp5DesktopHeroFeatureIcon;
};

export type HomeFeatureBreakdownPackage = {
  id: "local" | "premium";
  title: string;
  goal: string;
  summary: string;
  items: HomeFeatureBreakdownItem[];
};

export const HOME_FEATURE_BREAKDOWN_PACKAGES: HomeFeatureBreakdownPackage[] = [
  {
    id: "local",
    title: 'Bāzes pakete: "Vietējā pārbaude"',
    goal:
      "Ātra un efektīva analīze automašīnām, kuras jau ilgāku laiku atrodas un tiek ekspluatētas Latvijā.",
    summary:
      "Sludinājuma, tehnisko datu un risku analīze. Rekomendējam veikt auto, kas Latvijā reģistrēti jau kādu laiku, lai pārliecinātos par to tehnisko stāvokli un 'zemūdens akmeņiem'.",
    items: [
      {
        title: "Sludinājuma un tehnisko risku analīze",
        description:
          "Profesionāls sludinājuma vizuālais un tekstuālais novērtējums (slēptu defektu vai neatbilstību identificēšana).",
        icon: "listing-analysis",
      },
      {
        title: "EU reģistru pārbaude & TA vēsture",
        description:
          "Detalizēta Latvijas un Eiropas publisko reģistru datu analīze, tostarp pēdējo tehnisko apskašu vēsture, fiksētie nobraukumi un aizrādījumi.",
        icon: "eu-registry",
      },
      {
        title: "Ieteikumi klātienes apskatei",
        description:
          "Praktisks kontrolsaraksts un padomi, kam tieši pievērst uzmanību, dodoties skatīties konkrēto auto dzīvē.",
        icon: "inspection-tips",
      },
    ],
  },
  {
    id: "premium",
    title: '🔥 Premium pakete: "Pilna vēstures analīze"',
    goal:
      "Maksimāla drošība pirms dārga pirkuma vai tikko no ārzemēm ievestu automašīnu pilnīga izpēte.",
    summary:
      "Detalizēta auto vēstures un risku analīze, apvienojot lielākos maksas datubāzu pārskatus un oficiālo dīleru informāciju pilnīgam sirdsmieram.",
    items: [
      {
        title: "Starptautiska vēstures pārbaude",
        description: "Padziļināta iepriekšējo īpašnieku, reģistrāciju un juridisko statusu analīze.",
        icon: "international",
      },
      {
        title: "carVertical integrācija",
        description:
          "Nobraukuma manipulāciju, slēptu bojājumu un zagto auto datubāzu pārbaude.",
        icon: "carvertical",
      },
      {
        title: "autoDNA integrācija",
        description:
          "Papildu datu dublēšana, aprīkojuma rūpnīcas specifikācijas un arhīva fotogrāfiju pārbaude (ja pieejamas).",
        icon: "autodna",
      },
      {
        title: "Oficiālo dīleru dati*",
        description:
          "Informācija no ražotāja autorizētajiem servisiem par veiktajām apkopēm, remontdarbiem un atsaukuma kampaņām.",
        icon: "dealer-data",
      },
      {
        title: "Individuāla konsultācija",
        description:
          'Eksperta slēdziens un telefona vai online saruna, lai izrunātu visus "par" un "pret" konkrētā auto iegādei.',
        icon: "consultation",
      },
    ],
  },
];
