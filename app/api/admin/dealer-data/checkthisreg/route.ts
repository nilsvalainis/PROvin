import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { ctrChipLabel } from "@/lib/checkthisreg-ingest-logic";
import { readCtrOrderRecord } from "@/lib/checkthisreg-ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dīlera bloka čips: «CheckThisReg: dati ievadīti DD.MM» / «nav datu» / «jāapstrādā ar roku». */
export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim() ?? "";
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  const record = await readCtrOrderRecord(sessionId).catch(() => null);
  return NextResponse.json({ ok: true, record, chip: ctrChipLabel(record) });
}
