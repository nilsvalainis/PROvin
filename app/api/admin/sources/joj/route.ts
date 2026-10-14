/**
 * ASV sadaļa: JoJ Copart/IAAI ielāde (admin).
 * Servera env: `JOJ_API_KEY`, opcionāli `JOJ_API_BASE_URL`.
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { fetchJojAsvMerge } from "@/lib/joj-asv-api";
import { normalizeAsvBlock } from "@/lib/asv-report";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const vin = normalizeVin(String(o.vin ?? ""));
  if (!isValidVin(vin)) {
    return NextResponse.json({ error: "invalid_vin" }, { status: 400 });
  }
  const sessionRaw = typeof o.sessionId === "string" ? o.sessionId.trim() : "";
  const sessionId = sessionRaw && isSafeOrderDraftSessionId(sessionRaw) ? sessionRaw : undefined;
  const listingUrl = typeof o.listingUrl === "string" ? o.listingUrl.trim().slice(0, 2000) : "";
  const skipCache = o.skipCache === true;
  const prev = normalizeAsvBlock(o.block);

  try {
    const result = await fetchJojAsvMerge({
      vin,
      prev,
      sessionId,
      listingUrl: listingUrl || undefined,
      skipCache,
    });
    if (result.error === "missing_joj_credentials") {
      return NextResponse.json(
        { error: "missing_joj_credentials", jojIngest: result.jojIngest, parse: result.parse },
        { status: 503 },
      );
    }
    if (result.parse.status === "unknown") {
      return NextResponse.json(
        {
          error: "upstream_error",
          summary: result.parse.summary,
          jojIngest: result.jojIngest,
          block: result.block,
          costUsd: result.costUsd,
          storedPhotoGroups: result.storedPhotoGroups,
        },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      vin,
      costUsd: result.costUsd,
      parse: { status: result.parse.status, summary: result.parse.summary },
      jojIngest: result.jojIngest,
      block: result.block,
      storedPhotoGroups: result.storedPhotoGroups,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[admin/sources/joj]", msg);
    return NextResponse.json({ error: "upstream_error", detail: msg }, { status: 502 });
  }
}
