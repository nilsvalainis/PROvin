import type { AzvinLocale } from "@/lib/azvin-hero-copy";
import { TP5_DEALER_SAMPLE_REPORT_HREF } from "@/lib/test-pricing-5-ui-copy";

export type AzvinUiCopy = {
  packageTabsAria: string;
  packageAriaSuffix: string;
  vinPlaceholder: string;
  vinAria: string;
  listingPlaceholder: string;
  listingAria: string;
  featureIconRowAria: string;
  sampleReportLink: string;
  dealerRefundBanner: string;
  dealerBrandsAria: string;
  metaDealerTitle: string;
};

export { TP5_DEALER_SAMPLE_REPORT_HREF as AZVIN_DEALER_SAMPLE_REPORT_HREF };

const UI_AZ: AzvinUiCopy = {
  packageTabsAria: "Paket seçin",
  packageAriaSuffix: " paketi",
  vinPlaceholder: "VIN kodunu daxil edin",
  vinAria: "VIN kodunu daxil edin",
  listingPlaceholder: "Elan linkini yapışdırın",
  listingAria: "Elan linkini yapışdırın",
  featureIconRowAria: "AZ.VIN xidmətlərinin üstünlükləri",
  sampleReportLink: "Hesabat nümunəsinə bax (PDF)",
  dealerRefundBanner:
    "100% pulun qaytarılması zəmanəti: Diler bazalarında məlumat yoxdursa, tam geri ödəniş edəcəyik.",
  dealerBrandsAria: "Dəstəklənən istehsalçılar",
  metaDealerTitle: "Rəsmi diler məlumatları",
};

const UI_EN: AzvinUiCopy = {
  packageTabsAria: "Choose a package",
  packageAriaSuffix: " package",
  vinPlaceholder: "Enter VIN code",
  vinAria: "Enter VIN code",
  listingPlaceholder: "Paste the listing link",
  listingAria: "Paste the listing link",
  featureIconRowAria: "AZ.VIN service benefits",
  sampleReportLink: "View sample report (PDF)",
  dealerRefundBanner:
    "100% refund guarantee: If no data is available in dealer databases, we will issue a full refund.",
  dealerBrandsAria: "Supported manufacturers",
  metaDealerTitle: "Authorized dealer data",
};

const UI_RU: AzvinUiCopy = {
  packageTabsAria: "Выберите пакет",
  packageAriaSuffix: " пакет",
  vinPlaceholder: "Введите VIN-код",
  vinAria: "Введите VIN-код",
  listingPlaceholder: "Вставьте ссылку на объявление",
  listingAria: "Вставьте ссылку на объявление",
  featureIconRowAria: "Преимущества услуг AZ.VIN",
  sampleReportLink: "Смотреть пример отчёта (PDF)",
  dealerRefundBanner:
    "100% гарантия возврата: если данных нет в дилерских базах, сделаем полный возврат.",
  dealerBrandsAria: "Поддерживаемые производители",
  metaDealerTitle: "Данные авторизованного дилера",
};

const UI_LV: AzvinUiCopy = {
  packageTabsAria: "Izvēlies paketi",
  packageAriaSuffix: " pakete",
  vinPlaceholder: "Ievadi VIN kodu",
  vinAria: "Ievadi VIN kodu",
  listingPlaceholder: "Iekopē sludinājuma linku",
  listingAria: "Iekopē sludinājuma linku",
  featureIconRowAria: "AZ.VIN pakalpojumu priekšrocības",
  sampleReportLink: "Skatīt atskaites piemēru (PDF)",
  dealerRefundBanner:
    "100% Naudas atmaksas garantija: Ja dīleru datubāzēs dati nav pieejami, veiksim pilnu atmaksu.",
  dealerBrandsAria: "Atbalstītie ražotāji",
  metaDealerTitle: "Autorizētā dīlera dati",
};

const UI_BY_LOCALE: Record<AzvinLocale, AzvinUiCopy> = {
  az: UI_AZ,
  en: UI_EN,
  ru: UI_RU,
  lv: UI_LV,
};

export function getAzvinUiCopy(locale: AzvinLocale): AzvinUiCopy {
  return UI_BY_LOCALE[locale] ?? UI_AZ;
}
