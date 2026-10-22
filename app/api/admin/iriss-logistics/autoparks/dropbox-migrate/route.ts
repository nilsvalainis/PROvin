import { NextResponse } from "next/server";
import { runAutoparksBlobMigration } from "@/lib/iriss-autoparks-migrate";
import { irissLogisticsScopeHeader, requireIrissLogisticsApi } from "@/lib/iriss-logistics-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Autoparks Blob -> Dropbox migrācija (tikai admins). Noklusējums ir dry-run.
 * `{ "dryRun": false, "limit": 20 }` pārceļ nākamos 20 failus; atkārto, līdz `remaining` = 0.
 * `{ "verify": true }` pēc tam saskaita failus caur Dropbox API. Blob saturs netiek dzēsts.
 */
export async function POST(req: Request) {
  const gate = await requireIrissLogisticsApi();
  if (!gate.ok) return gate.response;
  if (gate.actor.kind !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403, headers: irissLogisticsScopeHeader() });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  try {
    const report = await runAutoparksBlobMigration({
      dryRun: body.dryRun !== false,
      limit: typeof body.limit === "number" ? body.limit : undefined,
      verify: body.verify === true,
    });
    return NextResponse.json({ ok: true, ...report }, { headers: irissLogisticsScopeHeader() });
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : "migration_failed";
    return NextResponse.json({ ok: false, error: msg }, { status: msg === "dropbox_not_configured" ? 503 : 500, headers: irissLogisticsScopeHeader() });
  }
}
