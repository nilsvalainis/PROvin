import { NextResponse } from "next/server";
import { loginB2bDemoUser } from "@/lib/b2b-demo-auth";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit-memory";
import { ensureB2bDemoSeed } from "@/lib/b2b-demo-seed";

export const runtime = "nodejs";

const LOGIN_MAX_PER_WINDOW = 20;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const limited = checkRateLimit(`b2b-demo-login:${ip}`, LOGIN_MAX_PER_WINDOW, LOGIN_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Pārāk daudz mēģinājumu. Uzgaidi un mēģini vēlreiz." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as { email?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Nederīgs pieprasījums." }, { status: 400 });
  }

  await ensureB2bDemoSeed();
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const result = await loginB2bDemoUser(email, password);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    tenantId: result.session.tenantId,
    role: result.session.role,
  });
}
