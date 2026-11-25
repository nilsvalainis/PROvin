import { NextResponse } from "next/server";

import { parseCarfaxInboxChunk } from "@/lib/carfax-inbox-logic";
import { receiveCarfaxInboxChunk, verifyPdfInboxToken } from "@/lib/carfax-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * CARFAX PDF no info@provin.lv pasta (Google Apps Script `processCarfaxPdfInbox`, docs/apps-script/csdd-pdf-inbox.md).
 * `Authorization: Bearer <CSDD_PDF_INBOX_TOKEN>` (tas pats tokens kā CSDD PDF; bez env >= 24 zīmēm - izslēgts).
 * Body: { md5, fileName, chunkIndex, chunkCount, chunkBase64, messageId?, receivedAt? } - PDF daļās pa ≤ 2,5 MB.
 * -> { status: "chunk_saved" | "attached" | "duplicate" | "unmatched" | "not_carfax" | "chunk_missing" | "md5_mismatch" }
 * Pasūtījums pēc VIN (priekšroka - nesen nospiests «Pirkt CARFAX»); nav pasūtījuma -> nepiesaistīto saraksts adminā.
 */
export async function POST(req: Request) {
  if (!verifyPdfInboxToken(req.headers.get("authorization"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const chunk = parseCarfaxInboxChunk(body);
  if ("error" in chunk) return NextResponse.json({ status: "invalid", error: chunk.error }, { status: 400 });
  const res = await receiveCarfaxInboxChunk(chunk).catch((e: unknown) => {
    console.error("[carfax-inbox] failed", e instanceof Error ? e.message.slice(0, 160) : "unknown");
    return { status: "error" as const, error: "internal" };
  });
  if (res.status === "error") return NextResponse.json(res, { status: 503 });
  return NextResponse.json(res);
}
