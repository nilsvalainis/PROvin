import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import type { CopilotSourceKey } from "@/lib/admin-copilot-types";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { mergeSourceBlocksWithDefaults, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { attachUnmatchedCarfaxPdf, listCarfaxUnmatched, readServerCarfaxPdfMeta } from "@/lib/carfax-inbox";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Admin CARFAX bloks:
 *   GET  ?sessionId=&vin=  -> { serverPdf, unmatched } - vai PDF jau ienācis no pasta (servera melnrakstā) un
 *                            nepiesaistītie CARFAX PDF ar šo VIN.
 *   POST { sessionId, md5, sourceBlocks } -> nepiesaistīto PDF ieliek šim pasūtījumam; atgriež `patchedSourceBlocks`
 *                            (klients ieliek un saglabā pats, kā PDF augšupielādei).
 */
export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const sessionId = (url.searchParams.get("sessionId") ?? "").trim();
  const vin = normalizeVin(url.searchParams.get("vin") ?? "");
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  const [serverPdf, unmatched] = await Promise.all([readServerCarfaxPdfMeta(sessionId), isValidVin(vin) ? listCarfaxUnmatched() : []]);
  return NextResponse.json({ serverPdf, unmatched: unmatched.filter((x) => x.vin === vin) });
}

export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const md5 = typeof body.md5 === "string" ? body.md5.trim().toLowerCase() : "";
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  if (!/^[a-f0-9]{32}$/.test(md5)) return NextResponse.json({ error: "invalid_md5" }, { status: 400 });
  const blocks = mergeSourceBlocksWithDefaults((body.sourceBlocks ?? {}) as Partial<WorkspaceSourceBlocks>);
  const res = await attachUnmatchedCarfaxPdf({ sessionId, md5, prevBlock: blocks.carfax, csdd: blocks.csdd });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.error === "not_found" ? 404 : 422 });
  return NextResponse.json({
    ok: true,
    summary: res.summary,
    patchedSourceBlocks: { carfax: res.block },
    changedKeys: ["carfax"] satisfies CopilotSourceKey[],
  });
}
