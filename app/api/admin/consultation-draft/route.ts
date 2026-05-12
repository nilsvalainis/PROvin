/**
 * PROVIN SELECT konsultācijas JSON melnraksts (atsevišķi no `order-draft`).
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  listConsultationDraftRevisions,
  patchConsultationDraft,
  restoreConsultationDraftRevision,
} from "@/lib/admin-consultation-draft-store";
import type { ConsultationDraftOrderEdits, ConsultationDraftWorkspaceBody } from "@/lib/admin-consultation-draft-types";
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
    const revisions = await listConsultationDraftRevisions(sessionId, limit);
    return NextResponse.json({ ok: true, revisions });
  } catch (e) {
    console.error("[consultation-draft] GET", e);
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
    const result = await restoreConsultationDraftRevision(sessionId, revisionId);
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
    console.error("[consultation-draft] POST", e);
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}

function parseOrderEditsObject(v: unknown): ConsultationDraftOrderEdits | null {
  if (v === null || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const out: ConsultationDraftOrderEdits = {};
  if (typeof o.customerName === "string") out.customerName = o.customerName;
  if (typeof o.customerEmail === "string") out.customerEmail = o.customerEmail;
  if (typeof o.customerPhone === "string") out.customerPhone = o.customerPhone;
  if (typeof o.notes === "string") out.notes = o.notes;
  if (typeof o.internalComment === "string") out.internalComment = o.internalComment;
  if (typeof o.selectBrandModel === "string") out.selectBrandModel = o.selectBrandModel;
  if (typeof o.selectProductionYearsDpf === "string") out.selectProductionYearsDpf = o.selectProductionYearsDpf;
  if (typeof o.selectPlannedBudget === "string") out.selectPlannedBudget = o.selectPlannedBudget;
  if (typeof o.selectEngineType === "string") out.selectEngineType = o.selectEngineType;
  if (typeof o.selectTransmission === "string") out.selectTransmission = o.selectTransmission;
  if (typeof o.selectMaxMileage === "string") out.selectMaxMileage = o.selectMaxMileage;
  if (typeof o.selectExteriorColor === "string") out.selectExteriorColor = o.selectExteriorColor;
  if (typeof o.selectInteriorMaterial === "string") out.selectInteriorMaterial = o.selectInteriorMaterial;
  if (typeof o.selectRequiredEquipment === "string") out.selectRequiredEquipment = o.selectRequiredEquipment;
  if (typeof o.selectDesiredEquipment === "string") out.selectDesiredEquipment = o.selectDesiredEquipment;
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
