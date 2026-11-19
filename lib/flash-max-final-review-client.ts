import type { FlashMaxReviewFinding } from "@/lib/flash-max-final-review";

export type FlashMaxFinalReviewResponse =
  | { ok: true; findings: FlashMaxReviewFinding[] }
  | { ok: false; error: string };

/**
 * FLASH MAX noslēguma pārbaude (pārlūks). Tieši viens pieprasījums - bez tīkla atkārtojuma,
 * jo katrs izsaukums maksā. Kļūda nekad netiek izmesta: FLASH MAX rezultāts paliek.
 */
export async function postFlashMaxFinalReview(
  body: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<FlashMaxFinalReviewResponse> {
  try {
    const res = await fetchImpl("/api/admin/ai/flashmax-final-review", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { findings?: unknown; error?: unknown };
    if (!res.ok || !Array.isArray(data.findings)) {
      return { ok: false, error: typeof data.error === "string" ? data.error : `http_${res.status}` };
    }
    return { ok: true, findings: data.findings as FlashMaxReviewFinding[] };
  } catch {
    return { ok: false, error: "network" };
  }
}
