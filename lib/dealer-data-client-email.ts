/**
 * Dīlera klienta e-pasta un WA šablonu melnraksti (rediģējami adminā).
 * Tīri stringi - der arī klienta komponentei, bez server-only.
 */

function vinSuffix(vin?: string | null): string {
  const v = (vin ?? "").trim().toUpperCase();
  return v ? ` (VIN ${v})` : "";
}

export type DealerClientEmailKind = "no_data" | "cancelled" | "ready";

export type DealerClientEmailDraft = {
  kind: DealerClientEmailKind;
  subject: string;
  text: string;
};

/** E-pasts: OEM datos nav ieraksta (ar vai bez jau veiktas atmaksas). */
export function buildDealerNoDataEmailDraft(opts: {
  vin?: string | null;
  amountEur?: string | null;
  /** true = teksts piemin, ka atmaksa jau veikta. */
  refunded?: boolean;
}): DealerClientEmailDraft {
  const vin = vinSuffix(opts.vin);
  const amount = (opts.amountEur ?? "").trim();
  const refunded = opts.refunded === true;

  const subject = refunded
    ? "PROVIN.LV: dīlera dati nav pieejami, maksājums atgriezts"
    : "PROVIN.LV: dīlera dati nav pieejami";

  const refundLine = refunded
    ? `Atmaksa${amount ? ` ${amount}` : ""} veikta pilnā apmērā uz to pašu karti. Nauda kontā parasti ir 5 līdz 10 darba dienu laikā, atkarībā no bankas.`
    : "Tā kā datus piegādāt nevaram, maksājumu atgriezīsim pilnā apmērā. Nauda kontā parasti ir 5 līdz 10 darba dienu laikā pēc atmaksas, atkarībā no bankas.";

  const text = [
    `Pārbaudījām oficiālā dīlera servisa vēsturi Jūsu pasūtījumam${vin}. Ražotāja datubāzē par šo automašīnu ierakstu nav.`,
    "",
    "Tas nenozīmē, ka auto nav apkalpots: daļa ražotāju un neatkarīgo servisu datus šajā sistēmā nenodod.",
    "",
    refundLine,
    "",
    "Ja rodas jautājumi, atbildiet uz šo e-pastu (info@provin.lv).",
    "",
    "Ar cieņu,",
    "PROVIN.LV",
  ].join("\n");

  return { kind: "no_data", subject, text };
}

export function buildDealerCancelledEmailDraft(opts: {
  vin?: string | null;
  amountEur?: string | null;
}): DealerClientEmailDraft {
  const vin = vinSuffix(opts.vin);
  const amount = (opts.amountEur ?? "").trim();
  return {
    kind: "cancelled",
    subject: "PROVIN.LV: pasūtījums atcelts un maksājums atgriezts",
    text: [
      `Jūsu pasūtījums par oficiālā dīlera servisa vēsturi ir atcelts${vin}.`,
      "",
      `Atmaksa${amount ? ` ${amount}` : ""} veikta pilnā apmērā uz to pašu karti. Nauda kontā parasti ir 5 līdz 10 darba dienu laikā, atkarībā no bankas.`,
      "",
      "Ja vēlaties pasūtīt atkārtoti vai ar citu VIN, atbildiet uz šo e-pastu.",
      "",
      "Ar cieņu,",
      "PROVIN.LV",
    ].join("\n"),
  };
}

/** E-pasts ar dīlera PDF pielikumu - operators rediģē pirms sūtīšanas. */
export function buildDealerReadyEmailDraft(opts: { vin?: string | null }): DealerClientEmailDraft {
  const vin = vinSuffix(opts.vin);
  return {
    kind: "ready",
    subject: "PROVIN.LV: oficiālā dīlera dati pielikumā",
    text: [
      `Labdien!`,
      "",
      `Nosūtam oficiālā dīlera servisa vēsturi Jūsu pasūtījumam${vin}. Dokuments pievienots PDF pielikumā.`,
      "",
      "Ja rodas jautājumi, atbildiet uz šo e-pastu (info@provin.lv).",
      "",
      "Ar cieņu,",
      "PROVIN.LV",
    ].join("\n"),
  };
}

/** Plain text → vienkāršs HTML rindkopām (operatora rediģētais teksts). */
export function plainTextToEmailHtmlParagraphs(text: string): string {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return blocks
    .map((block) => {
      const esc = block
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/\n/g, "<br/>");
      return `<p style="margin:0 0 12px;font-size:15px;color:#1d1d1f;line-height:1.6;">${esc}</p>`;
    })
    .join("\n");
}
