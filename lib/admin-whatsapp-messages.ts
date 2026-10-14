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
    return "Ja Jums rodas papildu jautājumi, droši rakstiet šeit vai uz info@provin.lv.";
  }
  if (kind === "mini") {
    return "Ja Jums rodas kādi jautājumi, droši rakstiet šeit vai uz info@provin.lv, labprāt palīdzēsim!";
  }
  return "Ja Jums rodas kādi jautājumi vai nepieciešama papildu konsultācija, droši rakstiet šeit vai uz info@provin.lv, labprāt palīdzēsim!";
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
    parts.push("Jūsu pieprasītie oficiālā dīlera servisa vēstures dati ir sagatavoti.");
  } else if (opts.kind === "mini") {
    parts.push("Jūsu pasūtītā PROVIN MINI atskaite ir sagatavota.");
  } else {
    parts.push("Jūsu pasūtītā PROVIN AUDITS atskaite ir sagatavota.");
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

Nosūtu Jums PROVIN SELECT stratēģisko konsultāciju. Visus papildu materiālus nosūtīju uz Jūsu e-pastu.

⚠️ Svarīgi: Sakarā ar tehniskiem uzlabojumiem, e-pasts dažkārt mēdz nonākt Spam mapē. Lūdzu, pārbaudiet!

Ja rodas jautājumi par konsultācijas ieteikumiem vai vēlaties palīdzību auto izvēlē, droši rakstiet šeit vai zvaniet. Labprāt palīdzēšu!

Ar cieņu,
PROVIN.LV`;
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

Esam pārbaudījuši oficiālā dīlera servisa vēsturi Jūsu pasūtījumam. Diemžēl dati par šo automašīnu mūsu sistēmā nav pieejami.

Informācija par naudas atmaksu:
Summa: ${amount} (veikta pilnā apmērā uz to pašu maksājumu karti).

Piezīme: bankas izrakstā atmaksa var neparādīties kā jauns ienākošais maksājums, bet gan kā atcelta rezervētā summa.

Ja šo pārbaudi veicāt pirms auto iegādes, rekomendējam izmantot PROVIN AUDITS: padziļinātu auto vēstures pārbaudi, odometra atbilstības, negadījumu un risku analīzi.

Pasūtīt: https://provin.lv

Ja rodas jautājumi, rakstiet šeit vai uz info@provin.lv.

${clientMessageSignOff()}`;
}

/** Apmaksa atcelta vai atgriezta pēc klienta lūguma, pirms darbs uzsākts. */
export function whatsappPrefillDealerPaymentCancelled(vin?: string | null, templatesDoc?: MessageTemplatesDoc | null): string {
  const vars = {};
  const rendered = resolveMessageSync("wa.dealer.cancelled", vars, { doc: templatesDoc });
  if (rendered?.text) return rendered.text;

  return `Sveiki!

Jūsu pasūtījums par oficiālā dīlera servisa vēsturi ir atcelts un maksājums atgriezts pilnā apmērā.

Nauda kontā parasti ir 5 līdz 10 darba dienu laikā, atkarībā no bankas.

Ja vēlaties pasūtīt atkārtoti, droši rakstiet šeit.

${clientMessageSignOff()}`;
}
