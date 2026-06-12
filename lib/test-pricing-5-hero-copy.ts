/** Isolated hero copy for `/test-pricing-5` — not shared with production Hero i18n. */

export const TP5_HERO_TITLE_PREFIX = "Auto vēstures un sludinājuma ";
export const TP5_HERO_TITLE_ACCENT = "audits";

/** Desktop lg+ hero H1 — two explicit lines. */
export const TP5_HERO_TITLE_DESKTOP_LINE1 = "Auto vēstures";
export const TP5_HERO_TITLE_DESKTOP_LINE2_PREFIX = "un sludinājuma ";

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

/** Locale-aware hero copy; anything other than `en` falls back to Latvian. */
export function getTp5HeroCopy(locale: string): Tp5HeroCopy {
  return locale === "en" ? TP5_HERO_COPY_EN : TP5_HERO_COPY_LV;
}
