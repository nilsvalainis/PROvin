/**
 * Cloudflare Turnstile (free) partneru login.
 *
 * Nils izveido atslēgas Cloudflare Dashboard → Turnstile (bez maksas) un ieliek Vercel:
 * - NEXT_PUBLIC_TURNSTILE_SITE_KEY  (publiskā site key, widgetam)
 * - TURNSTILE_SECRET_KEY            (servera secret, siteverify)
 *
 * Ja kāds no tiem trūkst vai neder, karogs ir izslēgts un login strādā kā līdz šim.
 * Atslēgas kodā neizdomājam un žurnālos nedrukājam.
 */

export const TURNSTILE_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/siteverify";
export const TURNSTILE_SITE_KEY_ENV = "NEXT_PUBLIC_TURNSTILE_SITE_KEY";
export const TURNSTILE_SECRET_KEY_ENV = "TURNSTILE_SECRET_KEY";

const KEY_RE = /^[0-9A-Za-z_-]{10,80}$/;

export function parseTurnstileKey(raw: string | null | undefined): string | null {
  const v = raw?.trim() ?? "";
  if (!v || v === "0") return null;
  if (!KEY_RE.test(v)) return null;
  return v;
}

export function getTurnstileSiteKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return parseTurnstileKey(env[TURNSTILE_SITE_KEY_ENV]);
}

export function getTurnstileSecretKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return parseTurnstileKey(env[TURNSTILE_SECRET_KEY_ENV]);
}

/** Widget + servera pārbaude tikai tad, ja ir abas derīgas atslēgas. */
export function isPartnerLoginTurnstileEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(getTurnstileSiteKey(env) && getTurnstileSecretKey(env));
}

export function parseTurnstileToken(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const token = raw.trim();
  if (token.length < 20 || token.length > 4096) return null;
  if (/\s/.test(token)) return null;
  return token;
}

export type TurnstileVerifyResult = { ok: true } | { ok: false; reason: "missing" | "rejected" | "unavailable" };

export async function verifyTurnstileToken(args: {
  token: string | null;
  remoteIp?: string | null;
  secret?: string | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<TurnstileVerifyResult> {
  const token = parseTurnstileToken(args.token);
  const secret = parseTurnstileKey(args.secret ?? process.env[TURNSTILE_SECRET_KEY_ENV]);
  if (!token || !secret) return { ok: false, reason: "missing" };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), args.timeoutMs ?? 5_000);
  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", token);
    const ip = args.remoteIp?.trim() ?? "";
    if (ip) body.set("remoteip", ip);

    const res = await (args.fetchImpl ?? fetch)(TURNSTILE_SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!res.ok) return { ok: false, reason: "unavailable" };
    const data = (await res.json()) as { success?: unknown };
    return data.success === true ? { ok: true } : { ok: false, reason: "rejected" };
  } catch {
    return { ok: false, reason: "unavailable" };
  } finally {
    clearTimeout(timer);
  }
}

export type PartnerLoginTurnstileGate =
  | { ok: true; required: false }
  | { ok: true; required: true }
  | { ok: false; required: true; status: 400; error: "turnstile_required" | "turnstile_failed" };

/**
 * Ja karogs izslēgts: laiž cauri (login kā šodien).
 * Ja ieslēgts: tokenu pārbauda pirms parole/rate-limit, lai svešinieki nevarētu triggerot lockout.
 */
export async function gatePartnerLoginTurnstile(args: {
  token: unknown;
  remoteIp?: string | null;
  env?: NodeJS.ProcessEnv;
  verify?: typeof verifyTurnstileToken;
}): Promise<PartnerLoginTurnstileGate> {
  const env = args.env ?? process.env;
  if (!isPartnerLoginTurnstileEnabled(env)) {
    return { ok: true, required: false };
  }
  const token = parseTurnstileToken(args.token);
  if (!token) {
    return { ok: false, required: true, status: 400, error: "turnstile_required" };
  }
  const verified = await (args.verify ?? verifyTurnstileToken)({
    token,
    remoteIp: args.remoteIp,
    secret: getTurnstileSecretKey(env),
  });
  if (!verified.ok) {
    return { ok: false, required: true, status: 400, error: "turnstile_failed" };
  }
  return { ok: true, required: true };
}
