/** Desktop tp5 hero — 8 interactive feature icon labels (lg+ only). */

export type Tp5DesktopHeroFeatureIcon =
  | "consultation"
  | "listing-analysis"
  | "eu-registry"
  | "inspection-tips"
  | "carvertical"
  | "autodna"
  | "dealer-data"
  | "international";

export type Tp5DesktopHeroFeature = {
  label: string;
  icon: Tp5DesktopHeroFeatureIcon;
};

export const TP5_DESKTOP_HERO_FEATURES: Tp5DesktopHeroFeature[] = [
  { label: "Individuāla konsultācija", icon: "consultation" },
  { label: "Sludinājuma un tehnisko risku analīze", icon: "listing-analysis" },
  { label: "EU reģistru pārbaude & TA vēsture", icon: "eu-registry" },
  { label: "Ieteikumi klātienes apskatei", icon: "inspection-tips" },
  { label: "carVertical integrācija", icon: "carvertical" },
  { label: "autoDNA integrācija", icon: "autodna" },
  { label: "Oficiālo dīleru un izsoļu portālu arhīvs*", icon: "dealer-data" },
  { label: "Starptautiska vēstures pārbaude", icon: "international" },
];

const TP5_DESKTOP_HERO_FEATURES_EN: Tp5DesktopHeroFeature[] = [
  { label: "Personal consultation", icon: "consultation" },
  { label: "Listing and technical risk analysis", icon: "listing-analysis" },
  { label: "EU registry check & inspection history", icon: "eu-registry" },
  { label: "In-person inspection guidance", icon: "inspection-tips" },
  { label: "carVertical integration", icon: "carvertical" },
  { label: "autoDNA integration", icon: "autodna" },
  { label: "Official dealer & auction portal archive*", icon: "dealer-data" },
  { label: "International history check", icon: "international" },
];

/** Locale-aware icon-row labels; anything other than `en` falls back to Latvian. */
export function getTp5DesktopHeroFeatures(locale?: string): Tp5DesktopHeroFeature[] {
  return locale === "en" ? TP5_DESKTOP_HERO_FEATURES_EN : TP5_DESKTOP_HERO_FEATURES;
}
