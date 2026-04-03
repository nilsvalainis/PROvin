import { NextResponse } from "next/server";
import {
  adminAuthConfigured,
  setAdminSessionCookie,
  verifyAdminCredentials,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
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
