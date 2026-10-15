import { NextResponse } from "next/server";
import { runIrissPavadzimesDropboxSync } from "@/lib/iriss-pavadzimes-store";
import { verifyPavadzimesSyncSecret } from "@/lib/pavadzimes-sync-secret";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const secret = req.headers.get("x-sync-secret");
  if (!verifyPavadzimesSyncSecret(secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const out = await runIrissPavadzimesDropboxSync();
    return NextResponse.json({
      ok: out.ok,
      updatedAt: out.updatedAt,
      itemCount: out.itemCount,
      indexChanged: out.indexChanged,
      pendingParse: out.pendingParse,
      dropboxConfigured: out.dropboxConfigured,
      dropboxError: out.dropboxError,
    });
  } catch (e) {
    console.error("[iriss pavadzimes sync]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "sync_failed" }, { status: 500 });
  }
}
