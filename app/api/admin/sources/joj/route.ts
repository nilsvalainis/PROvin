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
import { normalizeJojKnownLot } from "@/lib/vin-scan/parse-joj";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

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
  const knownLot =
    normalizeJojKnownLot(o.knownLot) ??
    normalizeJojKnownLot({ lot: prev.jojIngest?.lot, domain: prev.jojIngest?.lotDomain });
  const retryPhotoGroups = Array.isArray(o.retryPhotoGroups)
    ? o.retryPhotoGroups
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const rec = item as { title?: unknown; urls?: unknown };
          const title = typeof rec.title === "string" ? rec.title.trim().slice(0, 120) : "";
          const urls = Array.isArray(rec.urls)
            ? rec.urls.filter((u): u is string => typeof u === "string" && u.trim().startsWith("https://"))
            : [];
          if (urls.length === 0) return null;
          return { title: title || "JoJ", urls };
        })
        .filter((row): row is { title: string; urls: string[] } => Boolean(row))
    : undefined;

  try {
    const result = await fetchJojAsvMerge({
      vin,
      prev,
      sessionId,
      listingUrl: listingUrl || undefined,
      skipCache,
      knownLot,
      retryPhotoGroups,
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
      failedPhotoGroups: result.failedPhotoGroups,
      failedPhotoCount: result.failedPhotoGroups.reduce((n, g) => n + g.urls.length, 0),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[admin/sources/joj]", msg);
    return NextResponse.json({ error: "upstream_error", detail: msg }, { status: 502 });
  }
}
