import { NextResponse } from "next/server";

import { parseCtrDocumentChunk, parseCtrFinalize, verifyCtrIngestToken } from "@/lib/checkthisreg-ingest-logic";
import { finalizeCtrIngest, receiveCtrDocumentChunk, retryCtrPending } from "@/lib/checkthisreg-ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * CheckThisReg -> PROVIN pasūtījums (Hetzner `relay/provin-ctr-inbox`, Nila «jā» 27.11.2026).
 * `Authorization: Bearer <CTR_INGEST_TOKEN>` (≥ 24 zīmes; bez env - izslēgts, 401).
 * Body `action`:
 *  - "document": { ctrOrderId, md5, fileName, chunkIndex, chunkCount, chunkBase64 } - PDF daļās pa ≤ 2,5 MB
 *  - "finalize": { ctrOrderId, orderNumber, vin, manufacturer, product, emailKind: "ready"|"update", receivedAt,
 *                  ctrStatus, documents: [{ md5, fileName, size }] } - parsē, ievada pasūtījumā, AI komentāri, push
 *  - "retry_pending": gaidošie (pasūtījums vēl nebija) - mēģina vēlreiz
 * Maršruts neko nepērk un nesazinās ar CheckThisReg - tikai saņem Nila jau nopirkto.
 */
export async function POST(req: Request) {
  if (!verifyCtrIngestToken(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown> = {};
  try {
    const parsed = (await req.json()) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const fail = (e: unknown) => {
    console.error("[ctr-ingest] failed", e instanceof Error ? e.message.slice(0, 160) : "unknown");
    return { status: "error" as const, error: "internal" };
  };

  if (body.action === "document") {
    const chunk = parseCtrDocumentChunk(body);
    if ("error" in chunk) return NextResponse.json({ status: "invalid", error: chunk.error }, { status: 400 });
    const res = await receiveCtrDocumentChunk(chunk).catch(fail);
    return NextResponse.json(res, { status: res.status === "error" ? 503 : 200 });
  }
  if (body.action === "finalize") {
    const fin = parseCtrFinalize(body);
    if ("error" in fin) return NextResponse.json({ status: "invalid", error: fin.error }, { status: 400 });
    const res = await finalizeCtrIngest(fin).catch(fail);
    return NextResponse.json(res, { status: res.status === "error" ? 503 : 200 });
  }
  if (body.action === "retry_pending") {
    const res = await retryCtrPending().catch(fail);
    return NextResponse.json(res, { status: "status" in res ? 503 : 200 });
  }
  return NextResponse.json({ status: "invalid", error: "unknown_action" }, { status: 400 });
}
