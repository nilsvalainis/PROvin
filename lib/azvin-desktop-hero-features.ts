import type { AzvinLocale } from "@/lib/azvin-hero-copy";
import type { AzvinServiceId } from "@/lib/azvin-mobile-services";

export type AzvinDesktopHeroFeatureIcon =
  | "consultation"
  | "auction"
  | "mileage"
  | "salvage"
  | "title"
  | "carvertical"
  | "autodna"
  | "eu-registry"
  | "dealer-data"
  | "international";

export type AzvinDesktopHeroFeature = {
  label: string;
  icon: AzvinDesktopHeroFeatureIcon;
};

const FEATURES_AZ: Record<AzvinDesktopHeroFeatureIcon, string> = {
  consultation: "Konsultasiya",
  auction: "Hərrac arxivi",
  mileage: "Yürüş qeydləri",
  salvage: "Zədələnmə və salvage",
  title: "Title və hüquqi status",
  carvertical: "carVertical inteqrasiyası",
  autodna: "autoDNA inteqrasiyası",
  "eu-registry": "Avropa reyestr yoxlaması",
  "dealer-data": "Rəsmi diler məlumatları",
  international: "Beynəlxalq tarix yoxlaması",
};

const FEATURES_EN: Record<AzvinDesktopHeroFeatureIcon, string> = {
  consultation: "Consultation",
  auction: "Auction archive",
  mileage: "Mileage records",
  salvage: "Damage and salvage",
  title: "Title and legal status",
  carvertical: "carVertical integration",
  autodna: "autoDNA integration",
  "eu-registry": "European registry check",
  "dealer-data": "Official dealer data",
  international: "International history check",
};

const FEATURES_RU: Record<AzvinDesktopHeroFeatureIcon, string> = {
  consultation: "Консультация",
  auction: "Архив аукционов",
  mileage: "Записи пробега",
  salvage: "Повреждения и salvage",
  title: "Title и правовой статус",
  carvertical: "Интеграция carVertical",
  autodna: "Интеграция autoDNA",
  "eu-registry": "Проверка реестров Европы",
  "dealer-data": "Официальные данные дилера",
  international: "Международная проверка истории",
};

const FEATURES_LV: Record<AzvinDesktopHeroFeatureIcon, string> = {
  consultation: "Konsultācija",
  auction: "Izsoļu arhīvs",
  mileage: "Nobraukuma ieraksti",
  salvage: "Bojājumi un salvage",
  title: "Title un juridiskais statuss",
  carvertical: "carVertical integrācija",
  autodna: "autoDNA integrācija",
  "eu-registry": "Eiropas reģistru pārbaude",
  "dealer-data": "Oficiālie dīlera dati",
  international: "Starptautiska vēstures pārbaude",
};

const ICONS_BY_TAB: Record<AzvinServiceId, readonly AzvinDesktopHeroFeatureIcon[]> = {
  korea: ["auction", "mileage", "salvage", "title", "consultation"],
  europe: ["carvertical", "autodna", "eu-registry", "auction", "dealer-data", "consultation"],
  usa: ["auction", "mileage", "salvage", "title", "consultation"],
  dealer: [],
};

const LABELS: Record<AzvinLocale, Record<AzvinDesktopHeroFeatureIcon, string>> = {
  az: FEATURES_AZ,
  en: FEATURES_EN,
  ru: FEATURES_RU,
  lv: FEATURES_LV,
};

export function getAzvinDesktopHeroFeatures(
  locale: AzvinLocale,
  serviceId: AzvinServiceId,
): AzvinDesktopHeroFeature[] {
  const labels = LABELS[locale] ?? FEATURES_AZ;
  return ICONS_BY_TAB[serviceId].map((icon) => ({ icon, label: labels[icon] }));
}
