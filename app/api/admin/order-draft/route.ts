import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { patchOrderDraft } from "@/lib/admin-order-draft-store";
import type { OrderDraftOrderEdits, OrderDraftWorkspaceBody } from "@/lib/admin-order-draft-types";

export const maxDuration = 30;

function parseOrderEditsObject(v: unknown): OrderDraftOrderEdits | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const out: OrderDraftOrderEdits = {};
  if (typeof o.vin === "string") out.vin = o.vin;
  if (typeof o.listingUrl === "string") out.listingUrl = o.listingUrl;
  if (typeof o.notes === "string") out.notes = o.notes;
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
    previewConfirmed: Boolean(o.previewConfirmed),
  };
}

export async function PATCH(req: Request) {
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
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "store_disabled"
          ? 503
          : result.error === "invalid_workspace"
            ? 400
            : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, updatedAt: result.updatedAt });
}
