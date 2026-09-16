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
  dealerRefundInfoBody: string;
  dealerRefundInfoAria: string;
  dealerBrandsAria: string;
  dealerBrandsClose: string;
  featureInfoAria: string;
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
  dealerRefundBanner: "100% pulun qaytarılması zəmanəti.",
  dealerRefundInfoBody:
    "Diler bazalarında heç bir qeyd yoxdursa, tam geri ödəniş edəcəyik. Xidmət yerinə yetirilmiş sayılır, əgər ən azı bir odometr qeydi tapılır.",
  dealerRefundInfoAria: "Pulun qaytarılması şərtləri",
  dealerBrandsAria: "Dəstəklənən istehsalçılar",
  dealerBrandsClose: "Bağla",
  featureInfoAria: "Əlavə məlumat",
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
  dealerRefundBanner: "100% money-back guarantee.",
  dealerRefundInfoBody:
    "Full refund if no records exist in the dealer database. The service is considered fulfilled if at least one odometer reading is found.",
  dealerRefundInfoAria: "Refund conditions",
  dealerBrandsAria: "Supported manufacturers",
  dealerBrandsClose: "Close",
  featureInfoAria: "More information",
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
  dealerRefundBanner: "100% гарантия возврата.",
  dealerRefundInfoBody:
    "Полный возврат, если в дилерской базе нет ни одной записи. Услуга считается выполненной, если найдена хотя бы одна отметка одометра.",
  dealerRefundInfoAria: "Условия возврата",
  dealerBrandsAria: "Поддерживаемые производители",
  dealerBrandsClose: "Закрыть",
  featureInfoAria: "Дополнительная информация",
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
  dealerRefundBanner: "100% Naudas atmaksas garantija.",
  dealerRefundInfoBody:
    "Pilna naudas atmaksa, ja dīleru datubāzē nav neviena ieraksta. Pakalpojums tiek uzskatīts par izpildītu, ja atrodama vismaz viena atzīme par odometra rādījumu.",
  dealerRefundInfoAria: "Naudas atmaksas nosacījumi",
  dealerBrandsAria: "Atbalstītie ražotāji",
  dealerBrandsClose: "Aizvērt",
  featureInfoAria: "Papildu informācija",
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
