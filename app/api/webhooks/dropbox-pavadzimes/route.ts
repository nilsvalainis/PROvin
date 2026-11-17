import { after, NextResponse } from "next/server";
import { verifyDropboxWebhookSignature } from "@/lib/dropbox-webhook-signature";
import { runAutoparksDropboxSync } from "@/lib/iriss-autoparks-dropbox-sync";
import { runIrissPavadzimesDropboxSync } from "@/lib/iriss-pavadzimes-store";

export const runtime = "nodejs";
export const maxDuration = 120;

function dropboxAppSecret(): string {
  return process.env.DROPBOX_APP_SECRET?.trim() ?? "";
}

export async function GET(req: Request) {
  const challenge = new URL(req.url).searchParams.get("challenge");
  if (!challenge) {
    return NextResponse.json({ error: "missing_challenge" }, { status: 400 });
  }
  return new NextResponse(challenge, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(req: Request) {
  const secret = dropboxAppSecret();
  if (!secret) {
    return NextResponse.json({ error: "dropbox_not_configured" }, { status: 503 });
  }
  const raw = await req.text();
  const sig = req.headers.get("X-Dropbox-Signature");
  if (!verifyDropboxWebhookSignature(raw, sig, secret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 403 });
  }

  after(async () => {
    try {
      await runIrissPavadzimesDropboxSync();
    } catch (e) {
      console.error("[dropbox-pavadzimes webhook sync]", e instanceof Error ? e.message : e);
    }
    // Tas pats Dropbox app webhook: Autoparks /STOCK izmaiņas (kursors, tikai jaunās izmaiņas).
    try {
      const r = await runAutoparksDropboxSync();
      if (!r.ok && r.error !== "dropbox_not_configured") console.error("[dropbox autoparks webhook sync]", r.error);
    } catch (e) {
      console.error("[dropbox autoparks webhook sync]", e instanceof Error ? e.message : e);
    }
  });

  return NextResponse.json({ ok: true });
}
