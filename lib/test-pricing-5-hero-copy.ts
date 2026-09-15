/** Isolated hero copy for the home pricing hero — not shared with production Hero i18n. */

import type { Tp5MobileServiceId } from "@/lib/test-pricing-5-mobile";

export const TP5_HERO_TITLE_PREFIX = "Auto vēstures un sludinājuma ";
export const TP5_HERO_TITLE_ACCENT = "audits";

/** Desktop lg+ hero H1 — two explicit lines. */
export const TP5_HERO_TITLE_DESKTOP_LINE1 = "Auto vēstures";
export const TP5_HERO_TITLE_DESKTOP_LINE2_PREFIX = "un sludinājuma ";

export const TP5_HERO_DEALER_TITLE_PREFIX = "Oficiālā dīlera datu ";
export const TP5_HERO_DEALER_TITLE_ACCENT = "atskaite";

export const TP5_HERO_SUBHEAD_LEAD = "Uzzini visu par savu nākamo auto.";
export const TP5_HERO_SUBHEAD_ACCENT =
  "Apvienojam auto vēstures datus un sludinājuma analīzi vienā pārskatāmā auditā.";

export type Tp5HeroCopy = {
  titlePrefix: string;
  titleAccent: string;
  subheadLead: string;
  subheadAccent: string;
};

const TP5_HERO_COPY_LV: Tp5HeroCopy = {
  titlePrefix: TP5_HERO_TITLE_PREFIX,
  titleAccent: TP5_HERO_TITLE_ACCENT,
  subheadLead: TP5_HERO_SUBHEAD_LEAD,
  subheadAccent: TP5_HERO_SUBHEAD_ACCENT,
};

const TP5_HERO_COPY_EN: Tp5HeroCopy = {
  titlePrefix: "Vehicle history and listing ",
  titleAccent: "audit",
  subheadLead: "Know everything about your next car.",
  subheadAccent:
    "We combine vehicle history data and listing analysis into a single, easy-to-read audit.",
};

const TP5_HERO_DEALER_COPY_LV: Tp5HeroCopy = {
  ...TP5_HERO_COPY_LV,
  titlePrefix: TP5_HERO_DEALER_TITLE_PREFIX,
  titleAccent: TP5_HERO_DEALER_TITLE_ACCENT,
};

const TP5_HERO_DEALER_COPY_EN: Tp5HeroCopy = {
  ...TP5_HERO_COPY_EN,
  titlePrefix: "Official dealer data ",
  titleAccent: "report",
};

/** Locale-aware hero copy; anything other than `en` falls back to Latvian. */
export function getTp5HeroCopy(
  locale: string,
  serviceId: Tp5MobileServiceId = "audits",
): Tp5HeroCopy {
  const dealer = serviceId === "dealer";
  if (locale === "en") return dealer ? TP5_HERO_DEALER_COPY_EN : TP5_HERO_COPY_EN;
  return dealer ? TP5_HERO_DEALER_COPY_LV : TP5_HERO_COPY_LV;
}
