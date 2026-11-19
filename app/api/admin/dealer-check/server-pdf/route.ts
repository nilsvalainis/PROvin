import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { currentDealerCheckCreatorId } from "@/lib/dealer-check-actor";
import { readOwnedDealerCheck } from "@/lib/dealer-check-store";
import { isSafeDealerCheckId } from "@/lib/dealer-check";
import { renderDealerCheckPdf } from "@/lib/dealer-check-platform";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/** Servera PDF priekšskatījums / lejupielāde (tas pats fails, ko sūta e-pastā un liek Autoparkā). */
export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!isSafeDealerCheckId(id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  const record = await readOwnedDealerCheck(id, await currentDealerCheckCreatorId());
  if (!record) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const { pdf, filename } = await renderDealerCheckPdf(record);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[admin/dealer-check/server-pdf]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "render_failed" }, { status: 500 });
  }
}
