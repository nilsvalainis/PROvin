/**
 * Vai AI admin pogas/API drīkst strādāt ar konkrētu pasūtījumu.
 * Pēc noklusējuma — visiem (arī reāliem Stripe pasūtījumiem).
 * Iestati `AI_DEMO_ONLY=1`, lai atgrieztos pie tikai DEMO režīma.
 */
export function aiAllowsOrder(isDemo: boolean): boolean {
  const raw = process.env.AI_DEMO_ONLY?.trim().toLowerCase() ?? "";
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") return isDemo;
  return true;
}
