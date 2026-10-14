import { formatEurFromCents, type OrderUpsellKind } from "@/lib/order-upsell";
import { DEALER_CATALOG_CENTS, MINI_DEALER_ADDON_CENTS } from "@/lib/order-upsell";
import {
  MINI_TO_AUDITS_CAR_PLACEHOLDER,
  MINI_TO_AUDITS_NAME_PLACEHOLDER,
  MINI_TO_AUDITS_PAYMENT_LINK_PLACEHOLDER,
  MINI_TO_AUDITS_VIN_PLACEHOLDER,
} from "@/lib/email/mini-to-audits-approved-text";
import { latvianVocativeFirstName } from "@/lib/email/mini-to-audits-recommendation";
import { clientMessageSignOff, googleReviewPlainBlock, type ReportReadyProductKind } from "@/lib/email/report-ready-copy";
import { defaultAuditsCtaBlock, defaultRefundBankNote } from "@/lib/messages/shared-blocks";

export function vinSuffixForEmail(vin?: string | null): string {
  const v = (vin ?? "").trim().toUpperCase();
  return v ? ` (VIN ${v})` : "";
}

export function vinPhraseForBody(vin?: string | null): string {
  const v = (vin ?? "").trim().toUpperCase();
  return v ? ` transportlīdzeklim ar VIN ${v}` : "";
}

export function vinLineWa(vin?: string | null): string {
  const v = (vin ?? "").trim().toUpperCase();
  return v ? ` (VIN ${v})` : "";
}

export function amountLineDefault(amountEur?: string | null): string {
  const a = (amountEur ?? "").trim();
  return a || "24,99 €";
}

export function reportReadyTemplateId(kind: ReportReadyProductKind): string {
  return `email.report_ready.${kind}`;
}

export function waReportReadyTemplateId(kind: ReportReadyProductKind): string {
  return `wa.report_ready.${kind}`;
}

export function buildReportReadyEmailVars(opts: {
  kind: ReportReadyProductKind;
  vin: string;
  attachmentLines: string[];
  includeGoogleReview?: boolean;
}): Record<string, string> {
  const vin = opts.vin.trim();
  const files = opts.attachmentLines.filter((n) => n.trim());
  let pielikumi = "";
  if (opts.kind === "audits") {
    pielikumi = ["", "- Kopsavilkuma PDF atskaiti", "- Papildu materiālus un pielikumus"].join("\n");
  } else if (opts.kind === "dealer" && files.length > 0) {
    pielikumi = ["", ...files.map((n) => `- ${n}`)].join("\n");
  }
  return {
    vin,
    pielikumi,
    google_atsauksme: opts.includeGoogleReview ? googleReviewPlainBlock() : "",
    paraksts: clientMessageSignOff(),
  };
}

export function whatsappQuestionsLine(kind: ReportReadyProductKind): string {
  if (kind === "dealer") {
    return "Ja Jums rodas papildu jautājumi, droši rakstiet šeit vai uz info@provin.lv.";
  }
  if (kind === "mini") {
    return "Ja Jums rodas kādi jautājumi, droši rakstiet šeit vai uz info@provin.lv, labprāt palīdzēsim!";
  }
  return "Ja Jums rodas kādi jautājumi vai nepieciešama papildu konsultācija, droši rakstiet šeit vai uz info@provin.lv, labprāt palīdzēsim!";
}

export function buildWaReportReadyVars(opts: { kind: ReportReadyProductKind; vin?: string | null }): Record<string, string> {
  return {
    vin_phrase: vinPhraseForBody(opts.vin),
    jautajumu_rinda: whatsappQuestionsLine(opts.kind),
    google_atsauksme: googleReviewPlainBlock(),
    paraksts: clientMessageSignOff(),
  };
}

export function buildDealerNoDataVars(opts: {
  vin?: string | null;
  amountEur?: string | null;
  refunded: boolean;
}): Record<string, string> {
  return {
    vin_suffix: vinSuffixForEmail(opts.vin),
    summa: amountLineDefault(opts.amountEur),
    refund_piezime: defaultRefundBankNote(),
    audits_cta: defaultAuditsCtaBlock(),
    paraksts: clientMessageSignOff(),
  };
}

export function buildUpsellEmailVars(opts: {
  kind: OrderUpsellKind;
  vin?: string | null;
  url: string;
  priorCents: number;
  chargeCents: number;
  targetCents: number;
  customerName?: string | null;
  car?: string | null;
}): Record<string, string> {
  const vin_suffix = vinSuffixForEmail(opts.vin);
  const prior = formatEurFromCents(opts.priorCents);
  const charge = formatEurFromCents(opts.chargeCents);
  const total = formatEurFromCents(opts.targetCents);
  if (opts.kind === "mini_to_dealer") {
    return {
      vin_suffix,
      papildus_cena: charge,
      kataloga_cena: formatEurFromCents(DEALER_CATALOG_CENTS),
      maksajuma_saite: opts.url,
      paraksts: clientMessageSignOff(),
    };
  }
  if (opts.kind === "dealer_to_audit") {
    return {
      vin_suffix,
      jau_samaksats: prior,
      papildus_cena: charge,
      kopa: total,
      maksajuma_saite: opts.url,
      paraksts: clientMessageSignOff(),
    };
  }
  const vards = latvianVocativeFirstName(opts.customerName) || MINI_TO_AUDITS_NAME_PLACEHOLDER;
  const auto = (opts.car ?? "").trim() || MINI_TO_AUDITS_CAR_PLACEHOLDER;
  const vin = (opts.vin ?? "").trim().toUpperCase() || MINI_TO_AUDITS_VIN_PLACEHOLDER;
  const carForSubject = (opts.car ?? "").trim();
  return {
    vards,
    auto,
    vin,
    starpiba: charge.replace(/\s*€\s*$/u, "").trim(),
    maksajuma_saite: opts.url,
    temats_auto: carForSubject ? `Jūsu PROVIN MINI pasūtījums: ${carForSubject}` : "Jūsu PROVIN MINI pasūtījums",
  };
}

export function buildUpsellWaVars(opts: {
  kind: OrderUpsellKind;
  vin?: string | null;
  url: string;
  priorCents: number;
  chargeCents: number;
  targetCents: number;
  customerName?: string | null;
  car?: string | null;
}): Record<string, string> {
  if (opts.kind === "mini_to_audit") {
    return buildUpsellEmailVars(opts);
  }
  const emailVars = buildUpsellEmailVars(opts);
  if (opts.kind === "mini_to_dealer") {
    return {
      vin_suffix: emailVars.vin_suffix ?? "",
      papildus_cena: emailVars.papildus_cena ?? "",
      maksajuma_saite: opts.url,
      paraksts: clientMessageSignOff(),
    };
  }
  const vin_suffix = vinSuffixForEmail(opts.vin);
  const lead = `Jūsu oficiālā dīlera datu pasūtījumam${vin_suffix} varam sagatavot pilno PROVIN AUDITS tajā pašā pasūtījumā.`;
  return {
    lead,
    jau_samaksats: formatEurFromCents(opts.priorCents),
    papildus_cena: formatEurFromCents(opts.chargeCents),
    kopa: formatEurFromCents(opts.targetCents),
    maksajuma_saite: opts.url,
    paraksts: clientMessageSignOff(),
  };
}

export function miniToAuditsVarsFromDraftInput(opts: {
  customerName?: string | null;
  vin?: string | null;
  car?: string | null;
  paymentUrl?: string | null;
  differencePrice: string;
}): Record<string, string> {
  const vards = latvianVocativeFirstName(opts.customerName) || MINI_TO_AUDITS_NAME_PLACEHOLDER;
  const auto = (opts.car ?? "").trim().replace(/\s+/g, " ") || MINI_TO_AUDITS_CAR_PLACEHOLDER;
  const vin = (opts.vin ?? "").trim().toUpperCase() || MINI_TO_AUDITS_VIN_PLACEHOLDER;
  const pay = (opts.paymentUrl ?? "").trim() || MINI_TO_AUDITS_PAYMENT_LINK_PLACEHOLDER;
  const starpiba = opts.differencePrice.replace(/\s*€\s*$/u, "").trim();
  const carForSubject = (opts.car ?? "").trim();
  return {
    vards,
    auto,
    vin,
    starpiba,
    maksajuma_saite: pay,
    temats_auto: carForSubject ? `Jūsu PROVIN MINI pasūtījums: ${carForSubject}` : "Jūsu PROVIN MINI pasūtījums",
  };
}
