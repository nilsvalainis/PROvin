/**
 * Dīlera klienta e-pasta un WA šablonu melnraksti (rediģējami adminā).
 * Tīri stringi - der arī klienta komponentei, bez server-only.
 */

export const DEALER_NO_DATA_AUDIT_CTA_URL = "https://provin.lv";

function vinSuffix(vin?: string | null): string {
  const v = (vin ?? "").trim().toUpperCase();
  return v ? ` (VIN ${v})` : "";
}

function amountLine(amountEur?: string | null): string {
  const a = (amountEur ?? "").trim();
  return a || "24,99 €";
}

export type DealerClientEmailKind = "no_data" | "cancelled" | "ready";

export type DealerClientEmailDraft = {
  kind: DealerClientEmailKind;
  subject: string;
  text: string;
};

/** Soft CTA bloks (pirms auto iegādes → PROVIN AUDITS). */
export function dealerNoDataAuditCtaBlock(): string {
  return [
    "Ja šo pārbaudi veicāt pirms auto iegādes, rekomendējam izmantot PROVIN AUDITS: padziļinātu auto vēstures pārbaudi, odometra atbilstības, negadījumu un risku analīzi.",
    "",
    `Pasūtīt: ${DEALER_NO_DATA_AUDIT_CTA_URL}`,
  ].join("\n");
}

/**
 * E-pasts: OEM / dīlera datos nav ieraksta (ar vai bez jau veiktas atmaksas).
 * Noklusējums pēc atmaksas: A + soft CTA.
 */
export function buildDealerNoDataEmailDraft(opts: {
  vin?: string | null;
  amountEur?: string | null;
  /** true = teksts piemin, ka atmaksa jau veikta. */
  refunded?: boolean;
}): DealerClientEmailDraft {
  const vin = vinSuffix(opts.vin);
  const amount = amountLine(opts.amountEur);
  const refunded = opts.refunded === true;

  const subject = refunded
    ? "PROVIN.LV: dīlera dati nav pieejami, maksājums atgriezts"
    : "PROVIN.LV: dīlera dati nav pieejami";

  const refundBlock = refunded
    ? [
        "Informācija par naudas atmaksu:",
        `Summa: ${amount} (veikta pilnā apmērā uz to pašu maksājumu karti).`,
        "",
        "Piezīme: bankas izrakstā atmaksa var neparādīties kā jauns ienākošais maksājums, bet gan kā atcelta rezervētā summa.",
      ].join("\n")
    : [
        "Informācija par naudas atmaksu:",
        `Summa: ${amount} (atgriezīsim pilnā apmērā uz to pašu maksājumu karti).`,
        "",
        "Piezīme: bankas izrakstā atmaksa var neparādīties kā jauns ienākošais maksājums, bet gan kā atcelta rezervētā summa.",
      ].join("\n");

  const text = [
    "Labdien!",
    "",
    `Esam pārbaudījuši oficiālā dīlera servisa vēsturi Jūsu pasūtījumam${vin}. Diemžēl dati par šo automašīnu mūsu sistēmā nav pieejami.`,
    "",
    refundBlock,
    "",
    dealerNoDataAuditCtaBlock(),
    "",
    "Ja Jums rodas papildu jautājumi, droši rakstiet mums uz info@provin.lv.",
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
  const amount = amountLine(opts.amountEur);
  return {
    kind: "cancelled",
    subject: "PROVIN.LV: pasūtījums atcelts un maksājums atgriezts",
    text: [
      `Jūsu pasūtījums par oficiālā dīlera servisa vēsturi ir atcelts${vin}.`,
      "",
      `Atmaksa ${amount} veikta pilnā apmērā uz to pašu karti. Nauda kontā parasti ir 5 līdz 10 darba dienu laikā, atkarībā no bankas.`,
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
