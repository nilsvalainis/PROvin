/**
 * PROVIN SELECT konsultācijas JSON melnraksts (atsevišķi no `order-draft`).
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { patchConsultationDraft } from "@/lib/admin-consultation-draft-store";
import type { ConsultationDraftOrderEdits, ConsultationDraftWorkspaceBody } from "@/lib/admin-consultation-draft-types";
import { mergePdfVisibility } from "@/lib/pdf-visibility";

export const maxDuration = 60;
export const runtime = "nodejs";

function parseOrderEditsObject(v: unknown): ConsultationDraftOrderEdits | null {
  if (v === null || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const out: ConsultationDraftOrderEdits = {};
  if (typeof o.customerName === "string") out.customerName = o.customerName;
  if (typeof o.customerEmail === "string") out.customerEmail = o.customerEmail;
  if (typeof o.customerPhone === "string") out.customerPhone = o.customerPhone;
  if (typeof o.notes === "string") out.notes = o.notes;
  if (typeof o.internalComment === "string") out.internalComment = o.internalComment;
  return out;
}

function parseWorkspaceBody(v: unknown): ConsultationDraftWorkspaceBody | undefined {
  if (!v || typeof v !== "object") return undefined;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.slots)) return undefined;
  return {
    slots: o.slots as ConsultationDraftWorkspaceBody["slots"],
    irissApproved: typeof o.irissApproved === "string" ? o.irissApproved : "",
    previewConfirmed: Boolean(o.previewConfirmed),
    pdfVisibility: o.pdfVisibility ? mergePdfVisibility(o.pdfVisibility) : undefined,
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
      orderEdits?: ConsultationDraftOrderEdits;
      workspace?: ConsultationDraftWorkspaceBody | null;
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

    const result = await patchConsultationDraft(sessionId, patch);

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
      return NextResponse.json({ error: err }, { status: 500 });
    }

    return NextResponse.json({ ok: true, updatedAt: result.updatedAt });
  } catch (e) {
    console.error("[consultation-draft] PATCH", e);
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}
