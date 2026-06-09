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
      "Sludinājuma, tehnisko datu un risku analīze automašīnām, kuras jau ilgāku laiku atrodas un tiek ekspluatētas Latvijā.",
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
      "Maksimāla drošība vai tikko no ārvalstīm ievestu automašīnu pilnīga izpēte. Detalizēta auto vēstures un risku analīze, apvienojot lielākos maksas datubāzu pārskatus un oficiālo dīleru datus.",
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
