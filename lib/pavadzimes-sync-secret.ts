import { timingSafeEqual } from "node:crypto";

const MIN_SECRET_LEN = 16;

function resolveSecret(): string {
  return process.env.PAVADZIMES_SYNC_SECRET?.trim() ?? "";
}

export function pavadzimesSyncSecretConfigured(): boolean {
  return resolveSecret().length >= MIN_SECRET_LEN;
}

export function verifyPavadzimesSyncSecret(headerValue: string | null): boolean {
  const secret = resolveSecret();
  if (!secret || secret.length < MIN_SECRET_LEN) return false;
  if (!headerValue) return false;
  try {
    const a = Buffer.from(headerValue, "utf8");
    const b = Buffer.from(secret, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
