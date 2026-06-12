/**
 * Manuālie pasūtījumi — izveide, Summas/Laika labošana un dzēšana no admin saraksta.
 * Pasūtījumiem, kas neienāk caur tiešsaistes formu (individuāli piedāvājumi).
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  createManualOrder,
  deleteManualOrder,
  updateManualOrder,
} from "@/lib/admin-manual-orders";

export const runtime = "nodejs";

function storeErrorStatus(error: string): number {
  if (error === "not_found") return 404;
  if (error === "invalid_id" || error === "invalid_created" || error === "invalid_amount") return 400;
  return 503;
}

export async function POST() {
  try {
    const ok = await getAdminSession();
    if (!ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const res = await createManualOrder();
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: storeErrorStatus(res.error) });
    }
    return NextResponse.json({ ok: true, record: res.record });
  } catch (e) {
    console.error("[manual-orders] POST", e);
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const ok = await getAdminSession();
    if (!ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const body = (await req.json().catch(() => null)) as {
      id?: unknown;
      created?: unknown;
      amountTotal?: unknown;
    } | null;
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!id) {
      return NextResponse.json({ error: "missing_id" }, { status: 400 });
    }

    const patch: { created?: number; amountTotal?: number | null } = {};
    if (body?.created !== undefined) {
      if (typeof body.created !== "number" || !Number.isFinite(body.created)) {
        return NextResponse.json({ error: "invalid_created" }, { status: 400 });
      }
      patch.created = body.created;
    }
    if (body?.amountTotal !== undefined) {
      if (body.amountTotal === null) {
        patch.amountTotal = null;
      } else if (typeof body.amountTotal === "number" && Number.isFinite(body.amountTotal)) {
        patch.amountTotal = body.amountTotal;
      } else {
        return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
      }
    }
    if (patch.created === undefined && patch.amountTotal === undefined) {
      return NextResponse.json({ error: "empty_patch" }, { status: 400 });
    }

    const res = await updateManualOrder(id, patch);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: storeErrorStatus(res.error) });
    }
    return NextResponse.json({ ok: true, record: res.record });
  } catch (e) {
    console.error("[manual-orders] PATCH", e);
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const ok = await getAdminSession();
    if (!ok) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const url = new URL(req.url);
    const id = (url.searchParams.get("id") ?? "").trim();
    if (!id) {
      return NextResponse.json({ error: "missing_id" }, { status: 400 });
    }
    const res = await deleteManualOrder(id);
    if (!res.ok) {
      return NextResponse.json({ error: res.error }, { status: storeErrorStatus(res.error) });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[manual-orders] DELETE", e);
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}
