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
  /** Screen-reader heading of the package breakdown section. */
  breakdownHeading: string;
  /** Small uppercase label above each package goal paragraph. */
  goalLabel: string;
  /** Secondary text link under AUDITS CTA — opens sample PDF. */
  sampleReportLink: string;
  /** Secondary CTA inline on the turnaround bar (before the info icon). */
  turnaroundUrgencyCta: string;
  /** Aria / title for the turnaround info tip control. */
  turnaroundInfoAria: string;
  /** Popup heading for urgent delivery. */
  turnaroundInfoTitle: string;
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
  /** Refund guarantee banner above dealer CTA. */
  dealerRefundBanner: string;
};

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
  breakdownHeading: "PROVIN MINI un PROVIN AUDITS",
  goalLabel: "Mērķis",
  sampleReportLink: "Skatīt atskaites piemēru (PDF)",
  turnaroundUrgencyCta: "Vajag ātrāk (1-2h)?",
  turnaroundInfoAria: "Vairāk par steidzamu izpildi",
  turnaroundInfoTitle: "Vajag atskaiti steidzami?",
  turnaroundInfoBody: "Pamata datus un vispārēju komentāru iespējams saņemt 1–2h laikā.",
  turnaroundInfoPhoneLink: `📞 Zvanīt uzreiz: ${TP5_TURNAROUND_INFO_PHONE_LOCAL}`,
  dealerBrandsTrigger: "Atbalstītie ražotāji",
  dealerBrandsAria: "Atbalstītie ražotāji",
  dealerBrandsClose: "Aizvērt",
  dealerRefundBanner:
    "🛡️ 100% Naudas atmaksas garantija: Ja dīleru datubāzēs informācija netiks atrasta, veiksim pilnu naudas atmaksu.",
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
  breakdownHeading: "PROVIN MINI and PROVIN AUDIT",
  goalLabel: "Purpose",
  sampleReportLink: "View sample report (PDF)",
  turnaroundUrgencyCta: "Need it faster (1–2h)?",
  turnaroundInfoAria: "More about urgent delivery",
  turnaroundInfoTitle: "Need a report urgently?",
  turnaroundInfoBody: "Basic data and a general comment can be provided within 1–2 hours.",
  turnaroundInfoPhoneLink: `📞 Call now: ${TP5_TURNAROUND_INFO_PHONE_LOCAL}`,
  dealerBrandsTrigger: "Supported manufacturers",
  dealerBrandsAria: "Supported manufacturers",
  dealerBrandsClose: "Close",
  dealerRefundBanner:
    "🛡️ 100% refund guarantee: If no information is found in dealer databases, we will issue a full refund.",
};

export function getTp5UiCopy(locale?: string): Tp5UiCopy {
  return locale === "en" ? TP5_UI_COPY_EN : TP5_UI_COPY_LV;
}
