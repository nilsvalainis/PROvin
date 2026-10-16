import { timingSafeEqual } from "node:crypto";

export const B2B_DEMO_ADMIN_SECRET_HEADER = "x-b2b-demo-admin-secret";

const MIN_SECRET_LEN = 16;

export function resolveB2bDemoAdminSecret(env: NodeJS.ProcessEnv = process.env): string {
  const dedicated = env.B2B_DEMO_ADMIN_SECRET?.trim() ?? "";
  if (dedicated.length >= MIN_SECRET_LEN) return dedicated;
  const admin = env.ADMIN_SECRET?.trim() ?? "";
  if (admin.length >= MIN_SECRET_LEN) return admin;
  return "";
}

export function b2bDemoAdminSecretConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveB2bDemoAdminSecret(env).length >= MIN_SECRET_LEN;
}

export function verifyB2bDemoAdminSecret(
  headerValue: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const secret = resolveB2bDemoAdminSecret(env);
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
