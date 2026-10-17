import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { readGoogleContactsConfig, upsertGoogleContactForOrder } from "@/lib/google-contacts";
import { applyGoogleContactSync, orderHasMatchableGoogleContact } from "@/lib/iriss-google-contact-fields";
import {
  isSafeIrissPasutijumsId,
  readIrissPasutijums,
  writeIrissPasutijums,
} from "@/lib/iriss-pasutijumi-store";
import { irissWorkspaceRevision } from "@/lib/iriss-pasutijumi-save-safety";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!isSafeIrissPasutijumsId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const rec = await readIrissPasutijums(id);
  if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const configured = Boolean(readGoogleContactsConfig());
  if (!configured) {
    return NextResponse.json({
      ok: true,
      status: "unconfigured",
      googleContactsConfigured: false,
      record: rec,
    });
  }
  if (!orderHasMatchableGoogleContact(rec)) {
    return NextResponse.json({
      ok: true,
      status: "skipped",
      googleContactsConfigured: true,
      record: rec,
    });
  }
  const result = await upsertGoogleContactForOrder(rec);
  const next = applyGoogleContactSync(rec, result);
  const w = await writeIrissPasutijums(next, { expectedWorkspaceRevision: irissWorkspaceRevision(rec) });
  const saved = w.ok ? w.record : next;
  return NextResponse.json({
    ok: result.status !== "error",
    status: result.status,
    googleContactsConfigured: true,
    record: saved,
    workspaceRevision: saved.workspaceRevision,
  });
}
