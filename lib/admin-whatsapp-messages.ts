/** WhatsApp iepriekš aizpildītais teksts — PROVIN AUDITS. */
export const WHATSAPP_PREFILL_AUDIT = `Sveiki! 

Nosūtu iegādāto PROVIN atskaiti. Ja ir jautājumi par atskaites datiem vai nepieciešama konsultācija, droši zvaniet. 

Būšu ļoti pateicīgs, ja atstāsiet atsauksmi par šo projektu Google. Paldies!
https://g.page/r/CamRaT51IPQ_EBM/review

Ar cieņu,
PROVIN.LV`;

/** WhatsApp iepriekš aizpildītais teksts — PROVIN SELECT stratēģiskā konsultācija. */
export const WHATSAPP_PREFILL_SELECT_CONSULTATION = `Sveiki!

Nosūtu Jums PROVIN SELECT stratēģisko konsultāciju. Visus papildu materiālus nosūtīju uz Jūsu e-pastu.

⚠️ Svarīgi: Sakarā ar tehniskiem uzlabojumiem, e-pasts dažkārt mēdz nonākt Spam mapē. Lūdzu, pārbaudiet!

Ja rodas jautājumi par konsultācijas ieteikumiem vai vēlaties palīdzību auto izvēlē, droši rakstiet šeit vai zvaniet. Labprāt palīdzēšu!

Ar cieņu,
PROVIN.LV`;

function vinLine(vin: string | null | undefined): string {
  const v = (vin ?? "").trim().toUpperCase();
  return v ? ` (VIN ${v})` : "";
}

function amountLine(amountEur?: string | null): string {
  const a = (amountEur ?? "").trim();
  return a || "24,99 €";
}

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

Ar cieņu,
PROVIN.LV`;
}

/** Apmaksa atcelta vai atgriezta pēc klienta lūguma, pirms darbs uzsākts. */
export function whatsappPrefillDealerPaymentCancelled(vin?: string | null): string {
  return `Sveiki!

Jūsu pasūtījums par oficiālā dīlera servisa vēsturi ir atcelts un maksājums atgriezts pilnā apmērā.${vinLine(vin)}

Nauda kontā parasti ir 5 līdz 10 darba dienu laikā, atkarībā no bankas.

Ja vēlaties pasūtīt atkārtoti vai ar citu VIN, droši rakstiet šeit.

Ar cieņu,
PROVIN.LV`;
}
