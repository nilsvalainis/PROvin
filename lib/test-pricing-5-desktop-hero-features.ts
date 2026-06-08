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
  { label: "Oficiālo dīleru dati*", icon: "dealer-data" },
  { label: "Starptautiska vēstures pārbaude", icon: "international" },
];
