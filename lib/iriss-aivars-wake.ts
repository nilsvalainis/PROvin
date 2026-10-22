/**
 * Aivara (Grok aģents) pamodināšana, kad rindā ienāk pavadzīmes pieprasījums.
 * Fire-and-forget: POST uz ārējo rutīnas webhook ar īsu timeout; kļūda nekad netraucē rindai.
 * Payloadā tikai darba id - nekad komentārs vai cits lietotāja teksts.
 */

export const IRISS_AIVARS_WAKE_URL_ENV = "IRISS_AIVARS_WAKE_URL";
export const IRISS_AIVARS_WAKE_TOKEN_ENV = "IRISS_AIVARS_WAKE_TOKEN";
export const AIVARS_WAKE_TIMEOUT_MS = 3000;

export type AivarsWakeResult =
  | { ok: true; status: number }
  | { ok: false; reason: "not_configured" | "invalid_url" | "invalid_job_id" | "http_error" | "network_error"; status?: number };

type WakeEnv = Record<string, string | undefined>;

export function aivarsWakeUrl(env: WakeEnv = process.env): URL | null {
  const raw = env[IRISS_AIVARS_WAKE_URL_ENV]?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Pamodina Aivaru par darbu `jobId`. Nekad nemet kļūdu. */
export async function wakeAivars(
  jobId: string,
  opts: { env?: WakeEnv; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<AivarsWakeResult> {
  const env = opts.env ?? process.env;
  if (!env[IRISS_AIVARS_WAKE_URL_ENV]?.trim()) return { ok: false, reason: "not_configured" };
  const url = aivarsWakeUrl(env);
  if (!url) return { ok: false, reason: "invalid_url" };
  if (!/^wbr_[a-z0-9]+$/i.test(jobId)) return { ok: false, reason: "invalid_job_id" };
  const token = env[IRISS_AIVARS_WAKE_TOKEN_ENV]?.trim();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await (opts.fetchImpl ?? fetch)(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ jobId }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? AIVARS_WAKE_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn("[iriss-waybill] aivars_wake_http", res.status);
      return { ok: false, reason: "http_error", status: res.status };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    console.warn("[iriss-waybill] aivars_wake_failed", err instanceof Error ? err.name : "error");
    return { ok: false, reason: "network_error" };
  }
}
