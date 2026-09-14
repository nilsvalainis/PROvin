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
  return v ? `\nVIN: ${v}` : "";
}

/**
 * OEM datubāzē par šo VIN nav ierakstu, un nauda ir atgriezta.
 * Neapgalvo, ka auto nav apkalpots: daļa ražotāju šos datus nenodod.
 */
export function whatsappPrefillDealerNoDataRefunded(vin?: string | null): string {
  return `Sveiki!

Pārbaudīju oficiālā dīlera servisa vēsturi Jūsu pasūtījumam.${vinLine(vin)}

Ražotāja datubāzē par šo automašīnu ierakstu nav. Tas nenozīmē, ka auto nav apkalpots: daļa ražotāju un neatkarīgo servisu datus šajā sistēmā nenodod.

Tā kā datus piegādāt nevaru, maksājumu atgriezu pilnā apmērā. Nauda kontā parasti ir 5 līdz 10 darba dienu laikā, atkarībā no bankas.

Ja vēlaties, varu pastāstīt, kā servisa vēsturi pārbaudīt citos avotos.

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
