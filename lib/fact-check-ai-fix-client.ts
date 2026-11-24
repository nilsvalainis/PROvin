import type { FactCheckAiFixFlag } from "@/lib/fact-check-ai-fix";
import type { FlashMaxReviewFinding } from "@/lib/flash-max-final-review";

export type FactCheckAiFixResponse = { ok: true; findings: FlashMaxReviewFinding[] } | { ok: false; error: string };

/** Faktu pārbaudes «Labot» (pārlūks). Viens pieprasījums, bez atkārtojuma; kļūda netiek izmesta. */
export async function postFactCheckAiFix(
  body: Record<string, unknown> & { text: string; fieldLabel?: string; flags: FactCheckAiFixFlag[] },
  fetchImpl: typeof fetch = fetch,
): Promise<FactCheckAiFixResponse> {
  try {
    const res = await fetchImpl("/api/admin/ai/fact-check-fix", {
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
