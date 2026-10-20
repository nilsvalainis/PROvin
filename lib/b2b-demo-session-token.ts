import { createHmac, timingSafeEqual } from "node:crypto";
import { isSafeB2bDemoTenantId, isSafeB2bDemoUserId, normalizeB2bDemoEmail } from "@/lib/b2b-demo-ids";
import { isB2bDemoRole, type B2bDemoSession } from "@/lib/b2b-demo-types";

export const B2B_DEMO_SESSION_COOKIE = "iriss_b2b_demo_session";
export const B2B_DEMO_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const DEV_FALLBACK_SECRET = "provin-local-dev-secret-min-16-chars";

export function resolveB2bDemoSessionSecret(env: NodeJS.ProcessEnv = process.env): string {
  const dedicated = env.B2B_DEMO_SESSION_SECRET?.trim() ?? "";
  if (dedicated) return dedicated;
  if (env.NODE_ENV !== "production") return DEV_FALLBACK_SECRET;
  return "";
}

export function resolveB2bDemoWrapSecret(env: NodeJS.ProcessEnv = process.env): string {
  const dedicated = env.B2B_DEMO_TENANT_WRAP_SECRET?.trim() ?? "";
  if (dedicated) return dedicated;
  return resolveB2bDemoSessionSecret(env);
}

export function signB2bDemoSessionToken(session: B2bDemoSession, secret: string, nowMs = Date.now()): string {
  if (!secret || secret.length < 16) throw new Error("B2B demo session secret nav iestatīts.");
  const payload = Buffer.from(
    JSON.stringify({
      tenantId: session.tenantId,
      userId: session.userId,
      email: normalizeB2bDemoEmail(session.email),
      role: session.role,
      exp: nowMs + B2B_DEMO_SESSION_MAX_AGE_MS,
    }),
    "utf8",
  ).toString("base64url");
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function readB2bDemoSessionToken(token: string, secret: string, nowMs = Date.now()): B2bDemoSession | null {
  if (!secret || secret.length < 16) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  try {
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      tenantId?: unknown;
      userId?: unknown;
      email?: unknown;
      role?: unknown;
      exp?: unknown;
    };
    if (typeof data.exp !== "number" || data.exp <= nowMs) return null;
    const tenantId = typeof data.tenantId === "string" ? data.tenantId.trim() : "";
    const userId = typeof data.userId === "string" ? data.userId.trim() : "";
    const email = typeof data.email === "string" ? normalizeB2bDemoEmail(data.email) : "";
    if (!isSafeB2bDemoTenantId(tenantId) || !isSafeB2bDemoUserId(userId) || !email.includes("@")) return null;
    if (!isB2bDemoRole(data.role)) return null;
    return { tenantId, userId, email, role: data.role };
  } catch {
    return null;
  }
}
