/**
 * Locale-aware UI microcopy for the shared tp5/home pricing hero stack.
 * Latvian is the source. English, German (Sie) and Russian (вы) are native.
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
  /** Full OEM service-history tier title. */
  dealerCoverageFullTitle: string;
  dealerCoverageFullBody: string;
  /** Workshop-remarks tier title. */
  dealerCoverageWorkshopTitle: string;
  dealerCoverageWorkshopBody: string;
  /** Limited-coverage tier title. */
  dealerCoverageLimitedTitle: string;
  dealerCoverageLimitedBody: string;
  /** Refund guarantee short label next to info tip. */
  dealerRefundBanner: string;
  /** Refund guarantee tooltip body text. */
  dealerRefundInfoBody: string;
  /** Refund guarantee tooltip aria label. */
  dealerRefundInfoAria: string;
  /** Blue “Jaunums” label above the dealer tab. */
  newBadge: string;
  /** Unit-price suffix on the mobile pack card. */
  perReport: string;
  /** “Ieteicams” on the AUDITS mobile card. */
  recommended: string;
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
  catalogNavAria: "Pārlēkt uz pakalpojumu vai paraugiem",
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
  dealerCoverageFullTitle: "Pilna servisa vēsture",
  dealerCoverageFullBody:
    "Pilni oficiālo dīleru ieraksti: datumi, nobraukums, veiktie darbi un servisa vieta.",
  dealerCoverageWorkshopTitle: "Darbnīcas atzīmes",
  dealerCoverageWorkshopBody:
    "Atsaukumi, garantijas darbi un darbnīcas piezīmes. Ja atzīme sakrīt ar apkopes grafiku, tas bieži norāda, ka apkope ir bijusi.",
  dealerCoverageLimitedTitle: "Ierobežots pārklājums",
  dealerCoverageLimitedBody:
    "Dati parādās tikai daļā gadījumu. Tas atkarīgs no konkrētā auto ierakstiem un ražotāja sistēmas.",
  dealerRefundBanner:
    "100% Naudas atmaksas garantija.",
  dealerRefundInfoBody:
    "Pilna naudas atmaksa, ja dīleru datubāzē nav neviena ieraksta. Pakalpojums tiek uzskatīts par izpildītu 100% apjomā, ja atrodama vismaz viena atzīme par odometra rādījumu. Pieejamo datu apjomu nosaka oficiāli fiksētā vēsture.",
  dealerRefundInfoAria: "Naudas atmaksas nosacījumi",
  newBadge: "Jaunums",
  perReport: "par atskaiti",
  recommended: "Ieteicams",
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
  catalogNavAria: "Jump to a service or sample reports",
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
  dealerCoverageFullTitle: "Full service history",
  dealerCoverageFullBody:
    "Complete official dealership records: dates, mileage, work performed, and service location.",
  dealerCoverageWorkshopTitle: "Workshop remarks",
  dealerCoverageWorkshopBody:
    "Recalls, warranty work, and workshop notes. Where a note lines up with the service schedule, that often indicates a service was carried out.",
  dealerCoverageLimitedTitle: "Limited coverage",
  dealerCoverageLimitedBody:
    "Data is returned in only a share of cases. Results depend on the individual vehicle and manufacturer system availability.",
  dealerRefundBanner:
    "100% Refund guarantee.",
  dealerRefundInfoBody:
    "Full refund if no records exist in the dealer database. The service is considered fulfilled if at least one odometer reading is found. Available data volume depends on officially recorded history.",
  dealerRefundInfoAria: "Refund conditions",
  newBadge: "New",
  perReport: "per report",
  recommended: "Recommended",
};

const TP5_UI_COPY_DE: Tp5UiCopy = {
  cancelNote: "Die Zahlung wurde abgebrochen. Sie können es erneut versuchen.",
  checkoutErrorFallback: "Die Zahlung konnte nicht gestartet werden.",
  packageTabsAria: "Paket wählen",
  packageAriaSuffix: "-Paket",
  vinPlaceholder: "VIN eingeben",
  vinAria: "VIN oder Kennzeichen eingeben",
  listingPlaceholder: "Link zum Inserat einfügen",
  listingAria: "Link zum Inserat einfügen",
  featureIconRowAria: "Vorteile des PROVIN-Audits",
  transitionBannerAria: "Überblick über die PROVIN-Leistung",
  breakdownHeading: "PROVIN-Leistungen",
  catalogHeading: "LEISTUNGEN",
  catalogNavAria: "Zu einer Leistung oder zu Beispielberichten springen",
  goalLabel: "ZIEL",
  sampleReportLink: "Beispielbericht ansehen (PDF)",
  sampleReportPreviewLabel: "Beispielbericht",
  sampleReportEnlarge: "Vergrößern",
  sampleReportClose: "Schließen",
  sampleReportComingSoon: "Beispielbericht folgt in Kürze",
  turnaroundUrgencyCta: "Eilig?",
  turnaroundInfoAria: "Mehr zur eiligen Bearbeitung",
  turnaroundInfoBody: "Grunddaten und einen kurzen Kommentar können Sie innerhalb weniger Stunden erhalten.",
  turnaroundInfoPhoneLink: `📞 Anrufen: ${TP5_TURNAROUND_INFO_PHONE_LOCAL}`,
  dealerBrandsTrigger: "Unterstützte Hersteller",
  dealerBrandsAria: "Unterstützte Hersteller",
  dealerBrandsClose: "Schließen",
  dealerCoverageFullTitle: "Vollständige Servicehistorie",
  dealerCoverageFullBody:
    "Vollständige Einträge offizieller Händler: Daten, Laufleistung, ausgeführte Arbeiten und Servicestandort.",
  dealerCoverageWorkshopTitle: "Werkstattvermerke",
  dealerCoverageWorkshopBody:
    "Rückrufe, Garantiearbeiten und Werkstattnotizen. Deckt sich ein Vermerk mit dem Wartungsplan, deutet das oft darauf hin, dass eine Wartung stattgefunden hat.",
  dealerCoverageLimitedTitle: "Eingeschränkte Abdeckung",
  dealerCoverageLimitedBody:
    "Daten liegen nur in einem Teil der Fälle vor. Das hängt vom konkreten Fahrzeug und vom System des Herstellers ab.",
  dealerRefundBanner: "100 % Geld-zurück-Garantie.",
  dealerRefundInfoBody:
    "Volle Rückerstattung, wenn in der Händlerdatenbank kein Eintrag vorliegt. Die Leistung gilt als erbracht, sobald mindestens ein Kilometerstand gefunden wird. Der Umfang folgt der offiziell erfassten Historie.",
  dealerRefundInfoAria: "Bedingungen der Rückerstattung",
  newBadge: "Neu",
  perReport: "pro Bericht",
  recommended: "Empfohlen",
};

const TP5_UI_COPY_RU: Tp5UiCopy = {
  cancelNote: "Оплата отменена. Можно попробовать ещё раз.",
  checkoutErrorFallback: "Не удалось начать оплату.",
  packageTabsAria: "Выберите пакет",
  packageAriaSuffix: ", пакет",
  vinPlaceholder: "Введите VIN",
  vinAria: "Введите VIN или госномер",
  listingPlaceholder: "Вставьте ссылку на объявление",
  listingAria: "Вставьте ссылку на объявление",
  featureIconRowAria: "Что даёт аудит PROVIN",
  transitionBannerAria: "Кратко об услуге PROVIN",
  breakdownHeading: "Услуги PROVIN",
  catalogHeading: "УСЛУГИ",
  catalogNavAria: "Перейти к услуге или примерам отчётов",
  goalLabel: "ЦЕЛЬ",
  sampleReportLink: "Смотреть пример отчёта (PDF)",
  sampleReportPreviewLabel: "Пример отчёта",
  sampleReportEnlarge: "Увеличить",
  sampleReportClose: "Закрыть",
  sampleReportComingSoon: "Пример отчёта скоро",
  turnaroundUrgencyCta: "Срочно?",
  turnaroundInfoAria: "Подробнее о срочном выполнении",
  turnaroundInfoBody: "Базовые данные и короткий комментарий можно получить в течение нескольких часов.",
  turnaroundInfoPhoneLink: `📞 Позвонить: ${TP5_TURNAROUND_INFO_PHONE_LOCAL}`,
  dealerBrandsTrigger: "Поддерживаемые производители",
  dealerBrandsAria: "Поддерживаемые производители",
  dealerBrandsClose: "Закрыть",
  dealerCoverageFullTitle: "Полная сервисная история",
  dealerCoverageFullBody:
    "Полные записи официальных дилеров: даты, пробег, выполненные работы и место сервиса.",
  dealerCoverageWorkshopTitle: "Отметки мастерской",
  dealerCoverageWorkshopBody:
    "Отзывные кампании, гарантийные работы и заметки мастерской. Если отметка совпадает с графиком обслуживания, это часто значит, что обслуживание было.",
  dealerCoverageLimitedTitle: "Ограниченное покрытие",
  dealerCoverageLimitedBody:
    "Данные есть только в части случаев. Это зависит от конкретного автомобиля и системы производителя.",
  dealerRefundBanner: "Гарантия возврата 100 %.",
  dealerRefundInfoBody:
    "Полный возврат, если в дилерской базе нет ни одной записи. Услуга считается выполненной, если найден хотя бы один показатель одометра. Объём данных определяет официально зафиксированная история.",
  dealerRefundInfoAria: "Условия возврата",
  newBadge: "Новое",
  perReport: "за отчёт",
  recommended: "Рекомендуем",
};

export function getTp5UiCopy(locale?: string): Tp5UiCopy {
  if (locale === "en") return TP5_UI_COPY_EN;
  if (locale === "de") return TP5_UI_COPY_DE;
  if (locale === "ru") return TP5_UI_COPY_RU;
  return TP5_UI_COPY_LV;
}

export type DealerCoverageCopy = Pick<
  Tp5UiCopy,
  | "dealerCoverageFullTitle"
  | "dealerCoverageFullBody"
  | "dealerCoverageWorkshopTitle"
  | "dealerCoverageWorkshopBody"
  | "dealerCoverageLimitedTitle"
  | "dealerCoverageLimitedBody"
>;

export type DealerBrandsTipCopy = DealerCoverageCopy &
  Pick<Tp5UiCopy, "dealerBrandsTrigger" | "dealerBrandsAria" | "dealerBrandsClose">;

export function getDealerCoverageTierCopy(
  copy: DealerCoverageCopy,
  id: "full" | "workshop" | "limited",
): { title: string; body: string } {
  if (id === "full") {
    return { title: copy.dealerCoverageFullTitle, body: copy.dealerCoverageFullBody };
  }
  if (id === "workshop") {
    return { title: copy.dealerCoverageWorkshopTitle, body: copy.dealerCoverageWorkshopBody };
  }
  return { title: copy.dealerCoverageLimitedTitle, body: copy.dealerCoverageLimitedBody };
}
