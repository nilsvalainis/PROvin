import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createNextPkdCommissionInvoiceDraft } from "@/lib/pkd-commission-invoice-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const ok = await getAdminSession();
  if (!ok) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const created = await createNextPkdCommissionInvoiceDraft();
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (e) {
    console.error("[api/admin/pkd-commission-invoice/create]", e);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}
