import { timingSafeEqual } from "node:crypto";

/** Servisa atslēga Aivara aģentam. Vercel env; nosaukumu dokumentē .env.example. Nekad neizdrukā vērtību. */
export const IRISS_AIVARS_API_TOKEN_ENV = "IRISS_AIVARS_API_TOKEN";
const MIN_SECRET_LEN = 16;

function resolveToken(): string {
  return process.env[IRISS_AIVARS_API_TOKEN_ENV]?.trim() ?? "";
}

export function irissAivarsApiTokenConfigured(): boolean {
  return resolveToken().length >= MIN_SECRET_LEN;
}

export function extractBearerToken(headerValue: string | null): string {
  const raw = headerValue?.trim() ?? "";
  if (!raw) return "";
  const m = /^Bearer\s+(.+)$/i.exec(raw);
  return (m?.[1] ?? raw).trim();
}

export function verifyIrissAivarsApiToken(headerValue: string | null): boolean {
  const secret = resolveToken();
  if (secret.length < MIN_SECRET_LEN) return false;
  const presented = extractBearerToken(headerValue);
  if (!presented) return false;
  try {
    const a = Buffer.from(presented, "utf8");
    const b = Buffer.from(secret, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
