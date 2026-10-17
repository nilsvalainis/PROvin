import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { resolveAdminSessionSecret } from "@/lib/admin-session-token";
import { exchangeGoogleContactsCode, GOOGLE_CONTACTS_OAUTH_COOKIE } from "@/lib/google-contacts";

export const runtime = "nodejs";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function htmlPage(title: string, body: string): NextResponse {
  const html = `<!doctype html>
<html lang="lv">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; color: #111827; }
    textarea { width: 100%; min-height: 7rem; font-family: ui-monospace, monospace; font-size: 12px; }
    p { line-height: 1.45; }
    .muted { color: #6b7280; font-size: 13px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${body}
</body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow" },
  });
}

function stateMatches(cookieVal: string, queryState: string): boolean {
  if (!cookieVal || cookieVal !== queryState) return false;
  const parts = cookieVal.split(".");
  if (parts.length !== 2) return false;
  const [nonce, sig] = parts;
  const secret = resolveAdminSessionSecret() || "dev";
  const expected = createHmac("sha256", secret).update(nonce).digest("hex");
  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get(GOOGLE_CONTACTS_OAUTH_COOKIE)?.value ?? "";
  cookieStore.delete(GOOGLE_CONTACTS_OAUTH_COOKIE);
  if (!stateMatches(cookieVal, state)) {
    return htmlPage("Google kontakti", "<p>Nederīgs OAuth stāvoklis. Sāciet vēlreiz no /api/admin/google-contacts/oauth</p>");
  }
  if (!code) {
    const err = url.searchParams.get("error") || "nav koda";
    return htmlPage("Google kontakti", `<p>Google neatļāva piekļuvi: ${escapeHtml(err)}</p>`);
  }
  const redirectUri = `${url.origin}/api/admin/google-contacts/oauth/callback`;
  const exchanged = await exchangeGoogleContactsCode(code, redirectUri);
  if (!exchanged.refreshToken) {
    return htmlPage(
      "Google kontakti",
      `<p>Neizdevās iegūt refresh token. ${escapeHtml(exchanged.error || "")}</p>
       <p class="muted">Google Console: OAuth klienta tips Web, authorized redirect URI jābūt šīs lapas adresei.</p>`,
    );
  }
  const token = exchanged.refreshToken;
  return htmlPage(
    "Google kontakti gatavi",
    `<p>Ielieciet šo vērtību Vercel Environment Variable <strong>GOOGLE_CONTACTS_REFRESH_TOKEN</strong> (Production un Preview), tad Redeploy.</p>
     <textarea readonly id="tok">${escapeHtml(token)}</textarea>
     <p class="muted">Šo lapu redzat tikai jūs kā administrators. Tokenu nepublicējiet.</p>`,
  );
}
