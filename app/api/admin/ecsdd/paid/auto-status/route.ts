import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { markCsddPaidAutoApplied, recheckCsddPaidAuto } from "@/lib/csdd-paid-auto";
import { csddPaidAutoStatusLv, type CsddPaidAutoJob } from "@/lib/csdd-paid-auto-logic";
import { readCsddPaidAutoJob } from "@/lib/csdd-paid-auto-store";
import { buildCsddLocalParseFromText } from "@/lib/csdd-pdf-ingest";
import { readOrderDropboxRecord } from "@/lib/order-dropbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function view(job: CsddPaidAutoJob | null) {
  if (!job) return null;
  const pending = job.state === "found" && !job.appliedAt && job.rawText;
  const parsed = pending ? buildCsddLocalParseFromText(job.rawText!, "e.csdd maksas izziņa") : null;
  return {
    state: job.state,
    label: csddPaidAutoStatusLv(job),
    plate: job.plate,
    smsSentAt: job.smsSentAt ?? null,
    foundAt: job.foundAt ?? null,
    appliedAt: job.appliedAt ?? null,
    // Tikai, ja servera ielasīšana neizdevās: admin ievieto pats (tas pats ceļš kā pogai).
    ...(parsed ? { rawText: parsed.rawUnprocessedData || job.rawText, fields: parsed.fields } : {}),
  };
}

/** Admin: automātiskās CSDD maksas izziņas statuss + pasūtījuma Dropbox mape. */
export async function GET(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim() ?? "";
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  const [job, dropbox] = await Promise.all([readCsddPaidAutoJob(sessionId), readOrderDropboxRecord(sessionId)]);
  return NextResponse.json({
    job: view(job),
    dropbox: dropbox ? { state: dropbox.state, path: dropbox.path ?? null, error: dropbox.error ?? null } : null,
  });
}

/** `recheck` - "gaida apmaksu" -> vēl 30 min aptauja bez jaunas SMS; `applied` - admin ievietoja izziņu pats. */
export async function POST(req: Request) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!isSafeOrderDraftSessionId(sessionId)) return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  if (body.action === "recheck") return NextResponse.json({ job: view(await recheckCsddPaidAuto(sessionId)) });
  if (body.action === "applied") return NextResponse.json({ job: view(await markCsddPaidAutoApplied(sessionId)) });
  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
