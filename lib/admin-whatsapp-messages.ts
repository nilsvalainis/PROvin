/**
 * WhatsApp iepriekš aizpildītie teksti (pasūtījuma pogas un dīlera josla).
 * SELECT šablonu neaiztiekam; IRISS sadaļa ir citā failā.
 */
import {
  clientMessageSignOff,
  googleReviewPlainBlock,
  resolveReportReadyProductKind,
  type ReportReadyProductKind,
} from "@/lib/email/report-ready-copy";
import { resolveMessageSync } from "@/lib/messages/resolve-message";
import { buildWaReportReadyVars, waReportReadyTemplateId } from "@/lib/messages/template-vars";
import type { MessageTemplatesDoc } from "@/lib/messages/types";

function amountLine(amountEur?: string | null): string {
  const a = (amountEur ?? "").trim();
  return a || "24,99 €";
}

function whatsappQuestionsLine(kind: ReportReadyProductKind): string {
  if (kind === "dealer") {
    return "Ja rodas jautājumi, rakstiet šeit vai uz info@provin.lv. Labprāt palīdzēsim.";
  }
  if (kind === "mini") {
    return "Ja rodas jautājumi, rakstiet šeit vai uz info@provin.lv. Labprāt palīdzēsim.";
  }
  return "Ja rodas jautājumi vai vajadzīga papildu konsultācija, rakstiet šeit vai uz info@provin.lv. Labprāt palīdzēsim.";
}

/** Gatavs ziņojums pēc e-pasta šablona (pielikumu sarakstu WA neiekļauj). */
export function whatsappPrefillReportReady(
  opts: { kind: ReportReadyProductKind; vin?: string | null },
  templatesDoc?: MessageTemplatesDoc | null,
): string {
  const vars = buildWaReportReadyVars(opts);
  const rendered = resolveMessageSync(waReportReadyTemplateId(opts.kind), vars, { doc: templatesDoc });
  if (rendered?.text) return rendered.text;

  const parts: string[] = ["Labdien!", ""];
  if (opts.kind === "dealer") {
    parts.push("Jūsu pasūtītie oficiālā dīlera dati ir gatavi.");
  } else if (opts.kind === "mini") {
    parts.push("Jūsu PROVIN MINI atskaite ir gatava.");
  } else {
    parts.push("Jūsu PROVIN AUDITS atskaite ir gatava.");
  }
  parts.push("", whatsappQuestionsLine(opts.kind), "", googleReviewPlainBlock(), "", clientMessageSignOff());
  return parts.join("\n");
}

export function whatsappPrefillForOrder(args: {
  checkoutLine?: string | null;
  amountTotalCents?: number | null;
  vin?: string | null;
}): string {
  const kind = resolveReportReadyProductKind(args);
  return whatsappPrefillReportReady({
    kind,
    vin: args.vin,
  });
}

export function whatsappPrefillSelectConsultation(templatesDoc?: MessageTemplatesDoc | null): string {
  const rendered = resolveMessageSync("wa.select_consultation", {}, { doc: templatesDoc });
  if (rendered?.text) return rendered.text;
  return `Sveiki!

Nosūtu Jums PROVIN SELECT stratēģisko konsultāciju. Papildu materiālus nosūtīju uz Jūsu e-pastu.

Svarīgi: ja e-pastu neredzat, pārbaudiet arī mapi „Spam” (surogātpasts).

Ja rodas jautājumi par ieteikumiem vai vajag palīdzību auto izvēlē, rakstiet šeit vai zvaniet. Labprāt palīdzēšu.

${clientMessageSignOff()}`;
}

/**
 * OEM / dīlera datos nav ierakstu, nauda atgriezta.
 * Noklusējums: A + soft CTA uz PROVIN AUDITS.
 */
export function whatsappPrefillDealerNoDataRefunded(
  vin?: string | null,
  amountEur?: string | null,
  templatesDoc?: MessageTemplatesDoc | null,
): string {
  const vars = {
    summa: amountLine(amountEur),
  };
  const rendered = resolveMessageSync("wa.dealer.no_data_refunded", vars, { doc: templatesDoc });
  if (rendered?.text) return rendered.text;

  const amount = amountLine(amountEur);
  return `Labdien!

Pārbaudījām Jūsu auto. Diemžēl oficiālā dīlera dati par to nav pieejami.

Atmaksājām ${amount} pilnā apmērā uz karti, ar kuru maksājāt.

Piezīme: bankas izrakstā atmaksa var neparādīties kā jauns ienākošais maksājums, bet gan kā atcelta rezervētā summa.

Ja auto vēl tikai plānojat pirkt, iesakām PROVIN AUDITS: padziļinātu vēstures pārbaudi ar nobraukuma, negadījumu un risku analīzi.

Pasūtīt: https://provin.lv

Ja rodas jautājumi, rakstiet šeit vai uz info@provin.lv.

${clientMessageSignOff()}`;
}

/** Apmaksa atcelta vai atgriezta pēc klienta lūguma, pirms darbs uzsākts. */
export function whatsappPrefillDealerPaymentCancelled(vin?: string | null, templatesDoc?: MessageTemplatesDoc | null): string {
  const vars = {};
  const rendered = resolveMessageSync("wa.dealer.cancelled", vars, { doc: templatesDoc });
  if (rendered?.text) return rendered.text;

  return `Labdien!

Atcēlām Jūsu oficiālā dīlera datu pasūtījumu un atmaksājām visu summu.

Atkarībā no bankas nauda kontā parasti parādās 5 līdz 10 darba dienu laikā.

Ja vēlaties pasūtīt atkārtoti, rakstiet šeit.

${clientMessageSignOff()}`;
}
