/**
 * Locale-aware UI microcopy for the shared tp5/home pricing hero stack.
 * Latvian is the source copy; anything other than `en` falls back to it.
 */

export type Tp5UiCopy = {
  /** `?atcelts=1` cancel note above the hero. */
  cancelNote: string;
  /** Fallback when the checkout API call fails without a message. */
  checkoutErrorFallback: string;
  /** Tier switcher `role="tablist"` aria-label. */
  packageTabsAria: string;
  /** Suffix appended to the tier title in the tab aria-label. */
  packageAriaSuffix: string;
  vinPlaceholder: string;
  vinAria: string;
  listingPlaceholder: string;
  listingAria: string;
  /** Desktop feature icon row aria-label. */
  featureIconRowAria: string;
  /** Transition banner section aria-label. */
  transitionBannerAria: string;
  /** Screen-reader / catalog page heading for package breakdown. */
  breakdownHeading: string;
  /** Visible H1/H2 on `/pakalpojumi`. */
  catalogHeading: string;
  /** Aria-label for desktop package jump tabs on `/pakalpojumi` (hidden on mobile). */
  catalogNavAria: string;
  /** Small uppercase label above each package goal paragraph. */
  goalLabel: string;
  /** Secondary text link under AUDITS CTA — opens sample PDF. */
  sampleReportLink: string;
  /** Catalog PDF preview chrome label. */
  sampleReportPreviewLabel: string;
  /** Catalog PDF preview enlarge control. */
  sampleReportEnlarge: string;
  /** Catalog PDF lightbox close. */
  sampleReportClose: string;
  /** Placeholder when a package has no sample PDF yet. */
  sampleReportComingSoon: string;
  /** Secondary CTA inline on the turnaround bar (before the info icon). */
  turnaroundUrgencyCta: string;
  /** Aria / title for the turnaround info tip control. */
  turnaroundInfoAria: string;
  /** Body text inside the turnaround info popup (phone shown separately). */
  turnaroundInfoBody: string;
  /** Clickable phone link label in the tip. */
  turnaroundInfoPhoneLink: string;
  /** Dealer brands trigger label. */
  dealerBrandsTrigger: string;
  /** Dealer brands popup aria / title. */
  dealerBrandsAria: string;
  /** Close button label for brands dialog. */
  dealerBrandsClose: string;
  /** Refund guarantee short label next to info tip. */
  dealerRefundBanner: string;
  /** Refund guarantee tooltip body text. */
  dealerRefundInfoBody: string;
  /** Refund guarantee tooltip aria label. */
  dealerRefundInfoAria: string;
};

/** Publiskais PROVIN MINI atskaites piemērs (`public/samples/…`). */
export const TP5_MINI_SAMPLE_REPORT_HREF = "/samples/provin-mini-piemers.pdf";

/** Publiskais PROVIN AUDITS atskaites piemērs (`public/samples/…`). */
export const TP5_AUDITS_SAMPLE_REPORT_HREF = "/samples/provin-audits-piemers.pdf";

/** Publiskais DĪLERA DATI atskaites piemērs (`public/samples/…`). */
export const TP5_DEALER_SAMPLE_REPORT_HREF = "/samples/provin-dilera-dati-piemers.pdf";

/** Tālrunis tipā / tel: — LV lokālais numurs bez +371. */
export const TP5_TURNAROUND_INFO_PHONE_LOCAL = "29502039";
export const TP5_TURNAROUND_INFO_PHONE_TEL = "+37129502039";

const TP5_UI_COPY_LV: Tp5UiCopy = {
  cancelNote: "Maksājums tika atcelts. Vari mēģināt vēlreiz.",
  checkoutErrorFallback: "Neizdevās sākt maksājumu.",
  packageTabsAria: "Izvēlies paketi",
  packageAriaSuffix: " pakete",
  vinPlaceholder: "Ievadi VIN kodu",
  vinAria: "Ievadi VIN kodu vai valsts numurzīmi",
  listingPlaceholder: "Iekopē sludinājuma linku",
  listingAria: "Iekopē sludinājuma linku",
  featureIconRowAria: "PROVIN audita pakalpojumu priekšrocības",
  transitionBannerAria: "PROVIN pakalpojuma kopsavilkums",
  breakdownHeading: "PROVIN pakalpojumi",
  catalogHeading: "PAKALPOJUMI",
  catalogNavAria: "Pārlēkt uz pakalpojumu",
  goalLabel: "MĒRĶIS",
  sampleReportLink: "Skatīt atskaites piemēru (PDF)",
  sampleReportPreviewLabel: "Atskaites piemērs",
  sampleReportEnlarge: "Pietuvināt",
  sampleReportClose: "Aizvērt",
  sampleReportComingSoon: "Atskaites piemērs drīzumā",
  turnaroundUrgencyCta: "Steidzami?",
  turnaroundInfoAria: "Vairāk par steidzamu izpildi",
  turnaroundInfoBody: "Pamata datus un vispārēju komentāru iespējams saņemt dažu stundu laikā.",
  turnaroundInfoPhoneLink: `📞 Zvanīt: ${TP5_TURNAROUND_INFO_PHONE_LOCAL}`,
  dealerBrandsTrigger: "Atbalstītie ražotāji",
  dealerBrandsAria: "Atbalstītie ražotāji",
  dealerBrandsClose: "Aizvērt",
  dealerRefundBanner:
    "100% Naudas atmaksas garantija.",
  dealerRefundInfoBody:
    "Pilna naudas atmaksa, ja dīleru datubāzē nav neviena ieraksta. Pakalpojums tiek uzskatīts par izpildītu 100% apjomā, ja atrodama vismaz viena atzīme par odometra rādījumu. Pieejamo datu apjomu nosaka oficiāli fiksētā vēsture.",
  dealerRefundInfoAria: "Naudas atmaksas nosacījumi",
};

const TP5_UI_COPY_EN: Tp5UiCopy = {
  cancelNote: "The payment was cancelled. You can try again.",
  checkoutErrorFallback: "Could not start the payment.",
  packageTabsAria: "Choose a package",
  packageAriaSuffix: " package",
  vinPlaceholder: "Enter VIN code",
  vinAria: "Enter a VIN code or licence plate number",
  listingPlaceholder: "Paste the listing link",
  listingAria: "Paste the listing link",
  featureIconRowAria: "PROVIN audit service benefits",
  transitionBannerAria: "PROVIN service overview",
  breakdownHeading: "PROVIN services",
  catalogHeading: "SERVICES",
  catalogNavAria: "Jump to a service",
  goalLabel: "Purpose",
  sampleReportLink: "View sample report (PDF)",
  sampleReportPreviewLabel: "Sample report",
  sampleReportEnlarge: "Enlarge",
  sampleReportClose: "Close",
  sampleReportComingSoon: "Sample report coming soon",
  turnaroundUrgencyCta: "Urgent?",
  turnaroundInfoAria: "More about urgent delivery",
  turnaroundInfoBody: "Basic data and a general comment can be provided within a few hours.",
  turnaroundInfoPhoneLink: `📞 Call: ${TP5_TURNAROUND_INFO_PHONE_LOCAL}`,
  dealerBrandsTrigger: "Supported manufacturers",
  dealerBrandsAria: "Supported manufacturers",
  dealerBrandsClose: "Close",
  dealerRefundBanner:
    "100% Refund guarantee.",
  dealerRefundInfoBody:
    "Full refund if no records exist in the dealer database. The service is considered fulfilled if at least one odometer reading is found. Available data volume depends on officially recorded history.",
  dealerRefundInfoAria: "Refund conditions",
};

export function getTp5UiCopy(locale?: string): Tp5UiCopy {
  return locale === "en" ? TP5_UI_COPY_EN : TP5_UI_COPY_LV;
}
