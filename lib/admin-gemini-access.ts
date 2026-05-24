/**
 * Vai Gemini admin pogas/API drīkst strādāt ar konkrētu pasūtījumu.
 * Pēc noklusējuma — visiem (arī reāliem Stripe pasūtījumiem).
 * Iestati `GEMINI_DEMO_ONLY=1`, lai atgrieztos pie tikai DEMO režīma.
 */
export function geminiAllowsOrder(isDemo: boolean): boolean {
  const raw = process.env.GEMINI_DEMO_ONLY?.trim().toLowerCase() ?? "";
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") return isDemo;
  return true;
}
