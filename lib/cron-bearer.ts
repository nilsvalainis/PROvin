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

/** Cron vārti: `Authorization: Bearer` pret CRON_SECRET (Vercel Cron to sūta) vai citiem dotajiem noslēpumiem. */
export function cronSecretGate(
  authorization: string | null | undefined,
  secrets: readonly (string | null | undefined)[] = [process.env.CRON_SECRET],
): { ok: true } | { ok: false; status: number; error: string } {
  const list = secrets.map((s) => s?.trim() ?? "").filter(Boolean);
  if (list.length === 0) return { ok: false, status: 503, error: "missing_cron_secret" };
  const auth = authorization?.trim() ?? "";
  if (!auth) return { ok: false, status: 401, error: "missing_authorization" };
  return bearerMatchesAnySecret(auth, list) ? { ok: true } : { ok: false, status: 403, error: "forbidden" };
}
