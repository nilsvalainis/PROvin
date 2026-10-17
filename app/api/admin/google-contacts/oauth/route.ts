import { createHmac, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { resolveAdminSessionSecret } from "@/lib/admin-session-token";
import {
  GOOGLE_CONTACTS_OAUTH_COOKIE,
  googleContactsAuthorizeUrl,
  googleContactsOAuthClient,
} from "@/lib/google-contacts";

export const runtime = "nodejs";

function signState(nonce: string): string {
  const secret = resolveAdminSessionSecret() || "dev";
  const sig = createHmac("sha256", secret).update(nonce).digest("hex");
  return `${nonce}.${sig}`;
}

export async function GET(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!googleContactsOAuthClient()) {
    return NextResponse.json(
      { error: "Nav GOOGLE_CONTACTS_CLIENT_ID vai GOOGLE_CONTACTS_CLIENT_SECRET." },
      { status: 400 },
    );
  }
  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/admin/google-contacts/oauth/callback`;
  const nonce = randomBytes(16).toString("hex");
  const state = signState(nonce);
  const url = googleContactsAuthorizeUrl(redirectUri, state);
  if (!url) return NextResponse.json({ error: "oauth_unconfigured" }, { status: 400 });
  const res = NextResponse.redirect(url);
  res.cookies.set(GOOGLE_CONTACTS_OAUTH_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/admin/google-contacts",
    maxAge: 600,
  });
  return res;
}
