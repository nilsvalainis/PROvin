import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { runPersistenceHealthCheck } from "@/lib/admin-order-persistence-health";
import { isOrderDraftStorageDurable } from "@/lib/admin-order-draft-store";

export const runtime = "nodejs";

/** Admin: Blob/FS persistence health — produkcijas diagnostika. */
export async function GET() {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const report = await runPersistenceHealthCheck();
  return NextResponse.json({
    ...report,
    durableConfigured: isOrderDraftStorageDurable(),
  });
}
