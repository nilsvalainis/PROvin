import "server-only";

import { aiAllowsOrder } from "@/lib/admin-ai-access";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { getStripeCheckoutSessionMeta } from "@/lib/admin-stripe-cache";

export type AiDemoGuardResult =
  | { ok: true }
  | { ok: false; error: string; status: number; detail?: string };

/** AI admin automatizācija — pēc noklusējuma visiem pasūtījumiem (skat. AI_DEMO_ONLY). */
export async function assertAiAllowedForSession(sessionId: string): Promise<AiDemoGuardResult> {
  const id = sessionId.trim();
  if (!id) {
    return { ok: false, error: "missing_session_id", status: 400, detail: "Trūkst sessionId pieprasījumā" };
  }

  const orderMeta = await getStripeCheckoutSessionMeta(id, () => getCheckoutSessionDetail(id));
  if (!orderMeta) {
    return {
      ok: false,
      error: "not_found",
      status: 404,
      detail:
        "Pasūtījums nav atrasts Stripe — pārbaudi sessionId, STRIPE_SECRET_KEY (Vercel) un vai maksājums ir apmaksāts",
    };
  }
  if (!aiAllowsOrder(Boolean(orderMeta.isDemo))) {
    return { ok: false, error: "ai_demo_only", status: 403 };
  }
  return { ok: true };
}
