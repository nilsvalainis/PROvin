import { timingSafeEqual } from "crypto";

const MIN_SECRET_LEN = 16;

function resolveOperatorOrderSecret(): string {
  return process.env.OPERATOR_ORDER_SECRET?.trim() ?? "";
}

export function operatorOrderConfigured(): boolean {
  const secret = resolveOperatorOrderSecret();
  return secret.length >= MIN_SECRET_LEN;
}

export function verifyOperatorOrderKey(key: string): boolean {
  const secret = resolveOperatorOrderSecret();
  if (!secret || secret.length < MIN_SECRET_LEN) return false;
  if (!key) return false;
  try {
    const a = Buffer.from(key, "utf8");
    const b = Buffer.from(secret, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
