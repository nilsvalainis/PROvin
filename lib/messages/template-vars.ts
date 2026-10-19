import { formatEurFromCents, type OrderUpsellKind } from "@/lib/order-upsell";
import { DEALER_CATALOG_CENTS, MINI_DEALER_ADDON_CENTS } from "@/lib/order-upsell";
import {
  MINI_TO_AUDITS_CAR_PLACEHOLDER,
  MINI_TO_AUDITS_NAME_PLACEHOLDER,
  MINI_TO_AUDITS_PAYMENT_LINK_PLACEHOLDER,
} from "@/lib/email/mini-to-audits-approved-text";
import { latvianVocativeFirstName } from "@/lib/email/mini-to-audits-recommendation";
import type { ReportReadyProductKind } from "@/lib/email/report-ready-copy";

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
  const files = opts.attachmentLines.filter((n) => n.trim());
  let pielikumi = "";
  if (opts.kind === "audits") {
    pielikumi = ["", "- Kopsavilkuma PDF atskaiti", "- Papildu materiālus un pielikumus"].join("\n");
  } else if (opts.kind === "dealer" && files.length > 0) {
    pielikumi = ["", ...files.map((n) => `- ${n}`)].join("\n");
  }
  const vars: Record<string, string> = { pielikumi };
  if (!opts.includeGoogleReview) vars.google_atsauksme = "";
  return vars;
}

export function whatsappQuestionsLine(kind: ReportReadyProductKind): string {
  if (kind === "dealer") {
    return "Ja rodas jautājumi, rakstiet šeit vai uz info@provin.lv. Labprāt palīdzēsim.";
  }
  if (kind === "mini") {
    return "Ja rodas jautājumi, rakstiet šeit vai uz info@provin.lv. Labprāt palīdzēsim.";
  }
  return "Ja rodas jautājumi vai vajadzīga papildu konsultācija, rakstiet šeit vai uz info@provin.lv. Labprāt palīdzēsim.";
}

export function buildWaReportReadyVars(opts: { kind: ReportReadyProductKind; vin?: string | null }): Record<string, string> {
  return {
    jautajumu_rinda: whatsappQuestionsLine(opts.kind),
  };
}

export function buildDealerNoDataVars(opts: {
  vin?: string | null;
  amountEur?: string | null;
  refunded: boolean;
}): Record<string, string> {
  const summa = amountLineDefault(opts.amountEur);
  const refunded = opts.refunded === true;
  return {
    temats: refunded
      ? "PROVIN.LV: dīlera dati nav pieejami, maksājums atgriezts"
      : "PROVIN.LV: dīlera dati nav pieejami",
    atmaksa_rinda: refunded
      ? `Summa: ${summa} (veikta pilnā apmērā uz to pašu maksājumu karti).`
      : `Summa: ${summa} (atgriezīsim pilnā apmērā uz to pašu maksājumu karti).`,
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
  const prior = formatEurFromCents(opts.priorCents);
  const charge = formatEurFromCents(opts.chargeCents);
  const total = formatEurFromCents(opts.targetCents);
  if (opts.kind === "mini_to_dealer") {
    return {
      papildus_cena: charge,
      kataloga_cena: formatEurFromCents(DEALER_CATALOG_CENTS),
      maksajuma_saite: opts.url,
    };
  }
  if (opts.kind === "dealer_to_audit") {
    return {
      jau_samaksats: prior,
      papildus_cena: charge,
      kopa: total,
      maksajuma_saite: opts.url,
    };
  }
  const vards = latvianVocativeFirstName(opts.customerName) || MINI_TO_AUDITS_NAME_PLACEHOLDER;
  const auto = (opts.car ?? "").trim() || MINI_TO_AUDITS_CAR_PLACEHOLDER;
  const carForSubject = (opts.car ?? "").trim();
  return {
    vards,
    auto,
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
      papildus_cena: emailVars.papildus_cena ?? "",
      maksajuma_saite: opts.url,
    };
  }
  const lead = "Jūsu oficiālā dīlera datu pasūtījumam varam sagatavot pilno PROVIN AUDITS tajā pašā pasūtījumā.";
  return {
    lead,
    jau_samaksats: formatEurFromCents(opts.priorCents),
    papildus_cena: formatEurFromCents(opts.chargeCents),
    kopa: formatEurFromCents(opts.targetCents),
    maksajuma_saite: opts.url,
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
  const pay = (opts.paymentUrl ?? "").trim() || MINI_TO_AUDITS_PAYMENT_LINK_PLACEHOLDER;
  const starpiba = opts.differencePrice.replace(/\s*€\s*$/u, "").trim();
  const carForSubject = (opts.car ?? "").trim();
  return {
    vards,
    auto,
    starpiba,
    maksajuma_saite: pay,
    temats_auto: carForSubject ? `Jūsu PROVIN MINI pasūtījums: ${carForSubject}` : "Jūsu PROVIN MINI pasūtījums",
  };
}
