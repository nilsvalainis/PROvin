import { NextResponse } from "next/server";
import {
  adminAuthConfigured,
  setAdminSessionCookie,
  verifyAdminCredentials,
} from "@/lib/admin-auth";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit-memory";

export const runtime = "nodejs";

/** Brīdinājums pret bruteforce (atmiņā; serverless — katram instancēm sava). */
const LOGIN_MAX_PER_WINDOW = 20;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const limited = checkRateLimit(`admin-login:${ip}`, LOGIN_MAX_PER_WINDOW, LOGIN_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Pārāk daudz mēģinājumu. Uzgaidi un mēģini vēlreiz." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  if (!adminAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Administratora vide nav konfigurēta (ADMIN_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD).",
      },
      { status: 503 }
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = (await req.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Nederīgs pieprasījums" }, { status: 400 });
  }

  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!verifyAdminCredentials(username, password)) {
    return NextResponse.json({ error: "Nepareizs lietotājvārds vai parole" }, { status: 401 });
  }

  await setAdminSessionCookie();
  return NextResponse.json({ ok: true });
}
