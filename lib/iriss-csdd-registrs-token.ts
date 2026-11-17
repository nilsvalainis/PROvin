import { timingSafeEqual } from "node:crypto";
import { extractBearerToken } from "@/lib/iriss-aivars-api-token";

/** Hetzner reģistra nolasījuma tokens (tikai `POST /api/iriss/csdd-registrs`). Vērtību nekad neizdrukā. */
export const IRISS_CSDD_REGISTRS_TOKEN_ENV = "IRISS_CSDD_REGISTRS_TOKEN";
const MIN_SECRET_LEN = 16;

export function verifyCsddRegistrsToken(headerValue: string | null, env: Record<string, string | undefined> = process.env): boolean {
  const secret = env[IRISS_CSDD_REGISTRS_TOKEN_ENV]?.trim() ?? "";
  if (secret.length < MIN_SECRET_LEN) return false;
  const presented = extractBearerToken(headerValue);
  if (!presented) return false;
  const a = Buffer.from(presented, "utf8");
  const b = Buffer.from(secret, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
