import { provinEmailSubject } from "@/lib/email/email-subject";
import { formatEurFromCents, type OrderUpsellKind } from "@/lib/order-upsell";
import { DEALER_CATALOG_CENTS, MINI_DEALER_ADDON_CENTS } from "@/lib/order-upsell";
import {
  MINI_TO_AUDITS_CAR_PLACEHOLDER,
  MINI_TO_AUDITS_NAME_PLACEHOLDER,
  MINI_TO_AUDITS_PAYMENT_LINK_PLACEHOLDER,
} from "@/lib/email/mini-to-audits-approved-text";
import { latvianVocativeFirstName } from "@/lib/email/mini-to-audits-recommendation";
import type { ReportReadyProductKind } from "@/lib/email/report-ready-copy";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

/** Valid 17-char VIN for {{vin}} / temats; otherwise empty so stale `({{vin}})` does not render as `()`. */
export function reportReadyVinVar(vin?: string | null): string {
  const raw = (vin ?? "").trim();
  return isValidVin(raw) ? normalizeVin(raw) : "";
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
  const files = opts.attachmentLines.filter((n) => n.trim());
  let pielikumi = "";
  // 06.11 (Nils "jā"): AUDITS arī rāda reāli pievienotos failus, ne fiksētu tekstu.
  if (opts.kind === "audits" && files.length === 0) {
    pielikumi = ["", "- Kopsavilkuma PDF atskaiti", "- Papildu materiālus un pielikumus"].join("\n");
  } else if ((opts.kind === "dealer" || opts.kind === "audits") && files.length > 0) {
    pielikumi = ["", ...files.map((n) => `- ${n}`)].join("\n");
  }
  const vars: Record<string, string> = {
    pielikumi,
    vin: reportReadyVinVar(opts.vin),
  };
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

/** MINI → AUDITS temats: „PROVIN · Ieteikums: PROVIN AUDITS · VW Golf · VIN”. */
export function miniToAuditsSubject(car?: string | null, vin?: string | null): string {
  return provinEmailSubject("Ieteikums: PROVIN AUDITS", { product: (car ?? "").trim() || null, vin });
}

export function buildWaReportReadyVars(opts: { kind: ReportReadyProductKind; vin?: string | null }): Record<string, string> {
  return {
    jautajumu_rinda: whatsappQuestionsLine(opts.kind),
    vin: reportReadyVinVar(opts.vin),
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
    temats: provinEmailSubject(refunded ? "Dīlera dati nav pieejami, nauda atgriezta" : "Dīlera dati nav pieejami", {
      vin: opts.vin,
    }),
    vin: reportReadyVinVar(opts.vin),
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
      vin: reportReadyVinVar(opts.vin),
    };
  }
  if (opts.kind === "dealer_to_audit") {
    return {
      jau_samaksats: prior,
      papildus_cena: charge,
      kopa: total,
      maksajuma_saite: opts.url,
      vin: reportReadyVinVar(opts.vin),
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
    vin: reportReadyVinVar(opts.vin),
    temats_auto: miniToAuditsSubject(carForSubject, opts.vin),
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
      vin: reportReadyVinVar(opts.vin),
    };
  }
  const vin = reportReadyVinVar(opts.vin);
  const lead = `Jūsu oficiālā dīlera datu pasūtījumam${vin ? ` (VIN ${vin})` : ""} varam sagatavot pilno PROVIN AUDITS tajā pašā pasūtījumā.`;
  return {
    lead,
    jau_samaksats: formatEurFromCents(opts.priorCents),
    papildus_cena: formatEurFromCents(opts.chargeCents),
    kopa: formatEurFromCents(opts.targetCents),
    maksajuma_saite: opts.url,
    vin,
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
    vin: reportReadyVinVar(opts.vin),
    temats_auto: miniToAuditsSubject(carForSubject, opts.vin),
  };
}
