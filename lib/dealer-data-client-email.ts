/**
 * Dīlera klienta e-pasta un WA šablonu melnraksti (rediģējami adminā).
 * Tīri stringi - der arī klienta komponentei, bez server-only.
 */

import { clientMessageSignOff } from "@/lib/email/report-ready-copy";
import { resolveMessageSync } from "@/lib/messages/resolve-message";
import { buildDealerNoDataVars } from "@/lib/messages/template-vars";
import type { MessageTemplatesDoc } from "@/lib/messages/types";

import { DEALER_NO_DATA_AUDIT_CTA_URL } from "@/lib/messages/shared-blocks";

export { DEALER_NO_DATA_AUDIT_CTA_URL };

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
export function buildDealerNoDataEmailDraft(
  opts: {
    vin?: string | null;
    amountEur?: string | null;
    /** true = teksts piemin, ka atmaksa jau veikta. */
    refunded?: boolean;
  },
  templatesDoc?: MessageTemplatesDoc | null,
): DealerClientEmailDraft {
  const refunded = opts.refunded === true;
  const id = "email.dealer.no_data";
  const vars = buildDealerNoDataVars({ vin: opts.vin, amountEur: opts.amountEur, refunded });
  const rendered = resolveMessageSync(id, vars, { doc: templatesDoc });
  if (rendered?.subject && rendered.text) {
    return { kind: "no_data", subject: rendered.subject, text: rendered.text };
  }

  const varsFallback = buildDealerNoDataVars({ vin: opts.vin, amountEur: opts.amountEur, refunded });
  const subject = varsFallback.temats ?? "PROVIN.LV: dīlera dati nav pieejami";
  const text = [
    "Labdien!",
    "",
    "Dīlera servisa vēsture šim pasūtījumam nav pieejama.",
    "",
    varsFallback.atmaksa_rinda,
    "",
    dealerNoDataAuditCtaBlock(),
    "",
    "Jautājumi: info@provin.lv",
    "",
    clientMessageSignOff(),
  ].join("\n");
  return { kind: "no_data", subject, text };
}

export function buildDealerCancelledEmailDraft(
  opts: { vin?: string | null; amountEur?: string | null },
  templatesDoc?: MessageTemplatesDoc | null,
): DealerClientEmailDraft {
  const id = "email.dealer.cancelled";
  const vars = { summa: amountLine(opts.amountEur) };
  const rendered = resolveMessageSync(id, vars, { doc: templatesDoc });
  if (rendered?.subject && rendered.text) {
    return { kind: "cancelled", subject: rendered.subject, text: rendered.text };
  }
  const amount = amountLine(opts.amountEur);
  return {
    kind: "cancelled",
    subject: "PROVIN.LV: pasūtījums atcelts un maksājums atgriezts",
    text: [
      "Jūsu pasūtījums par oficiālā dīlera servisa vēsturi ir atcelts.",
      "",
      `Atmaksa ${amount} veikta pilnā apmērā uz to pašu karti. Nauda kontā parasti ir 5 līdz 10 darba dienu laikā, atkarībā no bankas.`,
      "",
      "Ja vēlaties pasūtīt atkārtoti, atbildiet uz šo e-pastu.",
      "",
      clientMessageSignOff(),
    ].join("\n"),
  };
}

/** E-pasts ar dīlera PDF pielikumu - operators rediģē pirms sūtīšanas. */
export function buildDealerReadyEmailDraft(
  opts: { vin?: string | null },
  templatesDoc?: MessageTemplatesDoc | null,
): DealerClientEmailDraft {
  const id = "email.dealer.ready_pdf";
  const rendered = resolveMessageSync(id, {}, { doc: templatesDoc });
  if (rendered?.subject && rendered.text) {
    return { kind: "ready", subject: rendered.subject, text: rendered.text };
  }
  return {
    kind: "ready",
    subject: "PROVIN.LV: oficiālā dīlera dati pielikumā",
    text: [
      `Labdien!`,
      "",
      "Nosūtam oficiālā dīlera servisa vēsturi Jūsu pasūtījumam. Dokuments pievienots PDF pielikumā.",
      "",
      "Ja rodas jautājumi, atbildiet uz šo e-pastu (info@provin.lv).",
      "",
      clientMessageSignOff(),
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
