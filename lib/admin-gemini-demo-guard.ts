import "server-only";

import { geminiAllowsOrder } from "@/lib/admin-gemini-access";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";

export type GeminiDemoGuardResult =
  | { ok: true }
  | { ok: false; error: string; status: number; detail?: string };

/** Gemini admin automatizācija — pēc noklusējuma visiem pasūtījumiem (skat. GEMINI_DEMO_ONLY). */
export async function assertGeminiAllowedForSession(sessionId: string): Promise<GeminiDemoGuardResult> {
  const id = sessionId.trim();
  if (!id) {
    return { ok: false, error: "missing_session_id", status: 400, detail: "Trūkst sessionId pieprasījumā" };
  }

  const order = await getCheckoutSessionDetail(id);
  if (!order) {
    return {
      ok: false,
      error: "not_found",
      status: 404,
      detail:
        "Pasūtījums nav atrasts Stripe — pārbaudi sessionId, STRIPE_SECRET_KEY (Vercel) un vai maksājums ir apmaksāts",
    };
  }
  if (!geminiAllowsOrder(Boolean(order.isDemo))) {
    return { ok: false, error: "gemini_demo_only", status: 403 };
  }
  return { ok: true };
}
