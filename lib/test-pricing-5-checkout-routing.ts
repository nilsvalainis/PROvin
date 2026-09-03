import type { TestPricingPlanId } from "@/lib/test-pricing-plans";

/** Capsule tab display labels on the home pricing hero. */
export const TP5_TAB_LABEL = {
  mini: "19,99 €",
  plus: "39,99 €",
  premium: "PROVIN AUDITS",
  dealer: "DĪLERA DATI",
  koreaUsa: "ASV UN KOREJA",
} as const;

/** Dynamic baseline CTA copy on the home pricing hero. */
export const TP5_CTA_LABEL = {
  mini: "PASŪTĪT AUDITU — 19,99 €",
  plus: "PASŪTĪT AUDITU — 39,99 €",
  premium: "PASŪTĪT PROVIN AUDITU — 99,99 €",
  dealer: "PASŪTĪT DĪLERA DATUS — 24,99 €",
  koreaUsa: "PASŪTĪT ASV UN KOREJA — 19,99 €",
} as const;

export type Tp5TierMeta = {
  title: string;
  description: string;
};

/** Dynamic tier label + explanation below the tab switcher. */
export const TP5_TIER_META: Record<TestPricingPlanId, Tp5TierMeta> = {
  mini: {
    title: "MINI AUDITS",
    description: "Pamata pārbaude, risku analīze un ieteikumi klātienes apskatei.",
  },
  plus: {
    title: "PLUS AUDITS",
    description:
      "Padziļināta tehnisko datu analīze un konsultācija Latvijā ekspluatētiem auto.",
  },
  premium: {
    title: "PROVIN AUDITS",
    description:
      "Maksimāla visu datu analīze iekļaujot maksas atskaites, oficiālo dīleru un izsoļu portālu arhīvu*.",
  },
  dealer: {
    title: "DĪLERA DATI",
    description:
      "Oficiālā dīlera servisa vēstures dati — bez PROVIN eksperta analīzes.",
  },
  koreaUsa: {
    title: "ASV UN KOREJA",
    description:
      "Pilns auto pārbaudes komplekts ASV un Korejā ekspluatētiem vai no šīm valstīm importētiem transportlīdzekļiem.",
  },
};

/** Muted footnote when PROVIN tier dealer-system row is active. */
export const TP5_DEALER_FOOTNOTE =
  "*Dati no oficiālo dīleru sistēmām un izsoļu arhīviem ir pieejami noteiktiem ražotājiem un modeļiem.";

const TP5_DEALER_FOOTNOTE_EN =
  "*Official dealer system data and auction archives are available for selected manufacturers and models.";

/** Locale-aware dealer footnote; anything other than `en` falls back to Latvian. */
export function getTp5DealerFootnote(locale?: string): string {
  return locale === "en" ? TP5_DEALER_FOOTNOTE_EN : TP5_DEALER_FOOTNOTE;
}

export const TP5_CHECKOUT_SOURCE = "test-checkout" as const;
