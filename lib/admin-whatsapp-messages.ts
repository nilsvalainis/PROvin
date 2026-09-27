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

function vinPhrase(vin?: string | null): string {
  const v = (vin ?? "").trim().toUpperCase();
  return v ? ` transportlīdzeklim ar VIN ${v}` : "";
}

function vinLine(vin: string | null | undefined): string {
  const v = (vin ?? "").trim().toUpperCase();
  return v ? ` (VIN ${v})` : "";
}

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
export function whatsappPrefillReportReady(opts: {
  kind: ReportReadyProductKind;
  vin?: string | null;
}): string {
  const vin = vinPhrase(opts.vin);
  const parts: string[] = ["Labdien!", ""];

  if (opts.kind === "dealer") {
    parts.push(`Jūsu pieprasītie oficiālā dīlera servisa vēstures dati${vin} ir sagatavoti.`);
  } else if (opts.kind === "mini") {
    parts.push(`Jūsu pasūtītā PROVIN MINI atskaite${vin} ir sagatavota.`);
  } else {
    parts.push(`Jūsu pasūtītā PROVIN AUDITS atskaite${vin} ir sagatavota.`);
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

/** Noklusējums vietām bez produkta konteksta (ātrie vērtējumi). */
export const WHATSAPP_PREFILL_AUDIT = whatsappPrefillReportReady({ kind: "audits" });

/** WhatsApp iepriekš aizpildītais teksts — PROVIN SELECT stratēģiskā konsultācija. */
export const WHATSAPP_PREFILL_SELECT_CONSULTATION = `Sveiki!

Nosūtu Jums PROVIN SELECT stratēģisko konsultāciju. Visus papildu materiālus nosūtīju uz Jūsu e-pastu.

⚠️ Svarīgi: Sakarā ar tehniskiem uzlabojumiem, e-pasts dažkārt mēdz nonākt Spam mapē. Lūdzu, pārbaudiet!

Ja rodas jautājumi par konsultācijas ieteikumiem vai vēlaties palīdzību auto izvēlē, droši rakstiet šeit vai zvaniet. Labprāt palīdzēšu!

Ar cieņu,
PROVIN.LV`;

/**
 * OEM / dīlera datos nav ierakstu, nauda atgriezta.
 * Noklusējums: A + soft CTA uz PROVIN AUDITS.
 */
export function whatsappPrefillDealerNoDataRefunded(
  vin?: string | null,
  amountEur?: string | null,
): string {
  const amount = amountLine(amountEur);
  return `Labdien!

Esam pārbaudījuši oficiālā dīlera servisa vēsturi Jūsu pasūtījumam${vinLine(vin)}. Diemžēl dati par šo automašīnu mūsu sistēmā nav pieejami.

Informācija par naudas atmaksu:
Summa: ${amount} (veikta pilnā apmērā uz to pašu maksājumu karti).

Piezīme: bankas izrakstā atmaksa var neparādīties kā jauns ienākošais maksājums, bet gan kā atcelta rezervētā summa.

Ja šo pārbaudi veicāt pirms auto iegādes, rekomendējam izmantot PROVIN AUDITS: padziļinātu auto vēstures pārbaudi, odometra atbilstības, negadījumu un risku analīzi.

Pasūtīt: https://provin.lv

Ja rodas jautājumi, rakstiet šeit vai uz info@provin.lv.

${clientMessageSignOff()}`;
}

/** Apmaksa atcelta vai atgriezta pēc klienta lūguma, pirms darbs uzsākts. */
export function whatsappPrefillDealerPaymentCancelled(vin?: string | null): string {
  return `Sveiki!

Jūsu pasūtījums par oficiālā dīlera servisa vēsturi ir atcelts un maksājums atgriezts pilnā apmērā.${vinLine(vin)}

Nauda kontā parasti ir 5 līdz 10 darba dienu laikā, atkarībā no bankas.

Ja vēlaties pasūtīt atkārtoti vai ar citu VIN, droši rakstiet šeit.

${clientMessageSignOff()}`;
}
