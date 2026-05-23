import "server-only";

import { getCheckoutSessionDetail } from "@/lib/admin-orders";

export type GeminiDemoGuardResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

/**
 * Gemini automatizācija drīkst darboties TIKAI ar DEMO pasūtījumiem —
 * neietekmē aktīvos / reālos klientu pasūtījumus.
 */
export async function assertGeminiAllowedForSession(sessionId: string): Promise<GeminiDemoGuardResult> {
  const id = sessionId.trim();
  if (!id) return { ok: false, error: "missing_session_id", status: 400 };

  const order = await getCheckoutSessionDetail(id);
  if (!order) return { ok: false, error: "not_found", status: 404 };
  if (!order.isDemo) {
    return { ok: false, error: "gemini_demo_only", status: 403 };
  }
  return { ok: true };
}
