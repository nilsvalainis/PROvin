/**
 * Pasūtījuma draft saglabāšana (JSON uz disku). Nav AI, nav smagu cilpu —
 * tikai validācija + `patchOrderDraft` (`orderEdits` merge ar iepriekšējo JSON, ne pilna aizvietošana).
 * 503 parasti nozīmē `store_disabled` vai rakstīšanas kļūdu (skat. `ADMIN_ORDER_DRAFT_DIR`).
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { listOrderDraftRevisions, patchOrderDraft, restoreOrderDraftRevision } from "@/lib/admin-order-draft-store";
import type { OrderDraftOrderEdits, OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";
import { mergePdfVisibility } from "@/lib/pdf-visibility";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const ok = await getAdminSession();
    if (!ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = new URL(req.url);
    const sessionId = (url.searchParams.get("sessionId") ?? "").trim();
    if (!sessionId) {
      return NextResponse.json({ error: "missing_sessionId" }, { status: 400 });
    }
    const limitRaw = Number(url.searchParams.get("limit") ?? "20");
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, Math.floor(limitRaw))) : 20;
    const revisions = await listOrderDraftRevisions(sessionId, limit);
    return NextResponse.json({ ok: true, revisions });
  } catch (e) {
    console.error("[order-draft] GET", e);
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ok = await getAdminSession();
    if (!ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    const b = body as Record<string, unknown>;
    const action = typeof b.action === "string" ? b.action.trim() : "";
    if (action !== "restore_revision") {
      return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }
    const sessionId = typeof b.sessionId === "string" ? b.sessionId.trim() : "";
    const revisionId = typeof b.revisionId === "string" ? b.revisionId.trim() : "";
    if (!sessionId) {
      return NextResponse.json({ error: "missing_sessionId" }, { status: 400 });
    }
    if (!revisionId) {
      return NextResponse.json({ error: "missing_revisionId" }, { status: 400 });
    }
    const result = await restoreOrderDraftRevision(sessionId, revisionId);
    if (!result.ok) {
      const err = result.error;
      if (err === "store_disabled") {
        return NextResponse.json({ error: err }, { status: 503 });
      }
      if (err === "invalid_session" || err === "invalid_revision") {
        return NextResponse.json({ error: err }, { status: 400 });
      }
      if (err === "revision_not_found") {
        return NextResponse.json({ error: err }, { status: 404 });
      }
      if (err.startsWith("write_failed")) {
        return NextResponse.json({ error: "write_failed", detail: err }, { status: 503 });
      }
      return NextResponse.json({ error: err }, { status: 500 });
    }
    return NextResponse.json({ ok: true, updatedAt: result.updatedAt });
  } catch (e) {
    console.error("[order-draft] POST", e);
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}

function parseOrderEditsObject(v: unknown): OrderDraftOrderEdits | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const out: OrderDraftOrderEdits = {};
  if (typeof o.vin === "string") out.vin = o.vin;
  if (typeof o.listingUrl === "string") out.listingUrl = o.listingUrl;
  if (typeof o.customerName === "string") out.customerName = o.customerName;
  if (typeof o.customerEmail === "string") out.customerEmail = o.customerEmail;
  if (typeof o.customerPhone === "string") out.customerPhone = o.customerPhone;
  if (typeof o.contactMethod === "string") out.contactMethod = o.contactMethod;
  if (typeof o.notes === "string") out.notes = o.notes;
  if (typeof o.internalComment === "string") out.internalComment = o.internalComment;
  return out;
}

function parseWorkspaceBody(v: unknown): OrderDraftWorkspaceBody | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  if (!o.sourceBlocks || typeof o.sourceBlocks !== "object") return undefined;
  return {
    sourceBlocks: o.sourceBlocks,
    iriss: typeof o.iriss === "string" ? o.iriss : "",
    apskatesPlāns: typeof o.apskatesPlāns === "string" ? o.apskatesPlāns : "",
    cenasAtbilstiba: typeof o.cenasAtbilstiba === "string" ? o.cenasAtbilstiba : "",
    previewConfirmed: Boolean(o.previewConfirmed),
    pdfVisibility: mergePdfVisibility(o.pdfVisibility),
  };
}

export async function PATCH(req: Request) {
  try {
    const ok = await getAdminSession();
    if (!ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }

    const b = body as Record<string, unknown>;
    const sessionId = typeof b.sessionId === "string" ? b.sessionId.trim() : "";
    if (!sessionId) {
      return NextResponse.json({ error: "missing_sessionId" }, { status: 400 });
    }

    const patch: {
      orderEdits?: OrderDraftOrderEdits;
      workspace?: OrderDraftWorkspaceBody | null;
    } = {};

    if ("orderEdits" in b) {
      const oe = parseOrderEditsObject(b.orderEdits);
      if (oe === null) {
        return NextResponse.json({ error: "invalid_orderEdits" }, { status: 400 });
      }
      patch.orderEdits = oe;
    }

    if ("workspace" in b) {
      if (b.workspace === null) {
        patch.workspace = null;
      } else {
        const w = parseWorkspaceBody(b.workspace);
        if (!w) {
          return NextResponse.json({ error: "invalid_workspace" }, { status: 400 });
        }
        patch.workspace = w;
      }
    }

    if (!("orderEdits" in patch) && patch.workspace === undefined) {
      return NextResponse.json({ error: "empty_patch" }, { status: 400 });
    }

    const result = await patchOrderDraft(sessionId, patch);

    if (!result.ok) {
      const err = result.error;
      if (err === "invalid_session") {
        return NextResponse.json({ error: err }, { status: 400 });
      }
      if (err === "not_found") {
        return NextResponse.json({ error: err }, { status: 404 });
      }
      if (err === "store_disabled") {
        return NextResponse.json({ error: err }, { status: 503 });
      }
      if (err === "invalid_workspace") {
        return NextResponse.json({ error: err }, { status: 400 });
      }
      if (err.startsWith("write_failed")) {
        return NextResponse.json({ error: "write_failed", detail: err }, { status: 503 });
      }
      if (err.startsWith("patch_failed")) {
        return NextResponse.json({ error: "patch_failed", detail: err }, { status: 500 });
      }
      return NextResponse.json({ error: err }, { status: 500 });
    }

    return NextResponse.json({ ok: true, updatedAt: result.updatedAt });
  } catch (e) {
    console.error("[order-draft] PATCH", e);
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}
