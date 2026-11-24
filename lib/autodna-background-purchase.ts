/**
 * AutoDNA maksas pirkums fonā (Hetzner relejs, ar kredītu www.autodna.lv kontā). Vienīgā atļautā ieeja: operators
 * nospiež admin pogu un apstiprina dialogu (Nila likums: "AutoDNA: pirkums tikai manuāli ar pogu + apstiprinājumu").
 * Automātiskās plūsmas (Stripe, cron, VIN SCAN, ātrais vērtējums) šo failu nedrīkst sasniegt - importu grafa tests
 * lib/autodna-auto.test.ts. AutoDNA partnera API (lib/autodna-api.ts) šeit netiek lietots.
 * Bez "server-only": dialoga teksts vajadzīgs arī admin panelim.
 */
import { CARVERTICAL_AUTOMATIC_FLOW_SOURCE_FILES } from "@/lib/carvertical-purchase";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

export const AUTODNA_PURCHASE_CONFIRM_LV =
  "AutoDNA atskaite ir maksas. Kontā tiks tērēts 1 kredīts. Pirkt tikai ja šim auto atskaite tiešām vajadzīga. Turpināt?";

/** Tās pašas automātiskās plūsmas, kas CarVertical (avotu ielase bez operatora pirkuma klikšķa). */
export const AUTODNA_AUTOMATIC_FLOW_SOURCE_FILES = CARVERTICAL_AUTOMATIC_FLOW_SOURCE_FILES;

export type AutodnaBackgroundPurchaseRequest = {
  vin: string;
  /** Jābūt tieši `true`. Automātiskais izsaucējs to nedrīkst iestatīt. */
  explicitOperatorConfirm: true;
};

export type AutodnaBackgroundPurchaseAuth = { ok: true; vin: string } | { ok: false; code: "invalid_vin" | "missing_confirm" };

/** Bez `explicitOperatorConfirm: true` (admin poga + apstiprinājuma dialogs) pirkums netiek sākts. */
export function authorizeAutodnaBackgroundPurchase(req: AutodnaBackgroundPurchaseRequest): AutodnaBackgroundPurchaseAuth {
  if (req.explicitOperatorConfirm !== true) return { ok: false, code: "missing_confirm" };
  const vin = normalizeVin(req.vin);
  if (!isValidVin(vin)) return { ok: false, code: "invalid_vin" };
  return { ok: true, vin };
}
