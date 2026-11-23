/**
 * PRO admin telefonā - krāsas orientācijai (Nils 23.11: «vairāk jāizceļ pakalpojumu veids, vajag krāsas,
 * pamanāmākus statusus»). Tīra loģika bez server-only: produkta veids -> čipa krāsa, termiņš -> čipa tonis,
 * auto nosaukums no VIN (bezmaksas dekoders), ja melnrakstā CSDD markas/modeļa vēl nav.
 * Krāsas - `app/admin/mobile/order-colors.css`. Datorā nekas nemainās.
 */

import { auditDeadlineMs } from "@/lib/admin-audit-deadline";
import type { AdminMobileDeadlineTag } from "@/lib/admin-mobile-ds";
import { decodeVin } from "@/lib/vin-decode";
import { decodeVinModel } from "@/lib/vin-model-codes";

/** audits - PROVIN zils; dealer - teal; mini - dzeltens (kā datorā); business - violets; select - oranžs; other - neitrāls. */
export type AdminPhoneProductKind = "audits" | "dealer" | "mini" | "business" | "select" | "other";

/** `paidProductLabel` teksts -> produkta veids (viena vieta, lai saraksts un testi neatšķiras). */
export function adminPhoneProductKind(productLabel: string): AdminPhoneProductKind {
  const t = (productLabel ?? "").trim().toUpperCase();
  if (!t) return "other";
  if (t.includes("DĪLERA") || t.includes("DILERA")) return "dealer";
  if (t.includes("BUSINESS")) return "business";
  if (t.includes("MINI")) return "mini";
  if (t.includes("SELECT") || t.includes("KONSULT")) return "select";
  if (t.includes("AUDITS") || /\bPRO\b/.test(t)) return "audits";
  return "other";
}

/** Čipa tonis: ok - zaļš, warn - oranžs, err - sarkans, neutral - pelēks stikls. */
export type AdminPhoneChipTone = "ok" | "warn" | "err" | "neutral";

/** «Tuvu termiņam» telefonā: atlikušas < 12 h (oranžs čips). */
export const ADMIN_PHONE_DEADLINE_SOON_MS = 12 * 60 * 60 * 1000;

/** Termiņa čips: Kavē - sarkans; < 12 h - oranžs; Gatavs / atmaksāts - zaļš; pārējais neitrāls. */
export function adminPhoneDeadlineTone(
  tag: AdminMobileDeadlineTag,
  deadlineFromUnix: number,
  nowMs: number,
): AdminPhoneChipTone {
  if (tag.tone === "overdue") return "err";
  if (tag.tone === "done") return "ok";
  const left = auditDeadlineMs(deadlineFromUnix) - nowMs;
  return left < ADMIN_PHONE_DEADLINE_SOON_MS ? "warn" : "neutral";
}

/** «Nosūtīts» - zaļš, «Nav nosūtīts» - oranžs (darbs vēl jāizdara, nevis kļūda). */
export function adminPhoneSentTone(sentLabel: string): AdminPhoneChipTone {
  return sentLabel === "Nosūtīts" ? "ok" : "warn";
}

/** Auto no VIN bez ārējiem pieprasījumiem: «Volkswagen Golf», «BMW». Nezināms VIN -> null. */
export function adminPhoneCarFromVin(vin: string | null | undefined): string | null {
  const local = decodeVin(vin ?? "");
  if (!local.ok) return null;
  const model = decodeVinModel(local);
  if (model?.make && model.model) return `${model.make} ${model.model}`;
  return local.make ?? null;
}
