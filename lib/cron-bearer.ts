import { timingSafeEqual } from "node:crypto";

/** `Authorization: Bearer <secret>` pret vienu vai vairākiem noslēpumiem, konstantā laikā. */
export function bearerMatchesAnySecret(
  authorization: string | null | undefined,
  secrets: readonly (string | null | undefined)[],
): boolean {
  const auth = authorization?.trim() ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const presented = Buffer.from(auth.slice("Bearer ".length), "utf8");
  let ok = false;
  for (const raw of secrets) {
    const secret = raw?.trim() ?? "";
    if (!secret) continue;
    const expected = Buffer.from(secret, "utf8");
    if (expected.length === presented.length && timingSafeEqual(expected, presented)) ok = true;
  }
  return ok;
}
