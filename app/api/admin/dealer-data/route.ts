/**
 * Dīlera datu automātiskās ielases statuss un manuāla pārstartēšana (admin).
 *
 * GET  ?sessionId=cs_…  - statuss dīlera avota blokam.
 * POST { sessionId, vin?, force? } - palaiž ielasi vēlreiz. Ja VIN nav, bet ir LV numurzīme -
 *   vispirms CSDD numurs → VIN, tad tā pati ielase.
 * POST { sessionId, reparseFromRaw: true, resetAiNotes? } - pārparsē no saglabātā RAW bez maksas
 *   pieprasījuma (atsaka ar 409, ja kāds OneAuto maksas solis vēl vajadzīgs).
 */
import { NextResponse, after } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import { reparseDealerDataFromRaw, runDealerDataJob } from "@/lib/dealer-data-job";
import { readDealerDataJob } from "@/lib/dealer-data-job-store";
import { syncDealerJobWithDraftData } from "@/lib/dealer-manual-data-sync";
import {
  dealerDataJobSuggestsRefund,
  dealerDataJobWaitsForUpstream,
  describeDealerDataJob,
} from "@/lib/dealer-data-job-types";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { resolveOrderVinFromPlate, runOrderDownstreamAfterPlateVin } from "@/lib/order-plate-vin-resolve";
import { classifyOrderVinOrPlateInput, orderVinPlateFailLabel } from "@/lib/order-vin-plate-resolution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sessionId = new URL(req.url).searchParams.get("sessionId")?.trim() ?? "";
  if (!isSafeOrderDraftSessionId(sessionId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }
  // «Datu nav», bet dīlera dati melnrakstā ievadīti manuāli -> «Ielasīts», bez atmaksas ieteikuma (BF 27.11, S7).
  const job = await syncDealerJobWithDraftData(sessionId, { job: await readDealerDataJob(sessionId) });
  return NextResponse.json({
    ok: true,
    job,
    label: describeDealerDataJob(job),
    suggestsRefund: dealerDataJobSuggestsRefund(job),
  });
}

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const sessionId = String(o.sessionId ?? "").trim();
  if (!isSafeOrderDraftSessionId(sessionId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }

  if (o.reparseFromRaw === true) {
    const reparsed = await reparseDealerDataFromRaw({ sessionId, resetAiNotes: o.resetAiNotes === true });
    const afterJob = await readDealerDataJob(sessionId);
    const blocked = String(reparsed.reason ?? "").startsWith("reparse_blocked:");
    return NextResponse.json(
      {
        ...reparsed,
        job: afterJob,
        label: describeDealerDataJob(afterJob),
        suggestsRefund: dealerDataJobSuggestsRefund(afterJob),
      },
      { status: reparsed.ok ? 200 : blocked ? 409 : 502 },
    );
  }

  const existing = await readDealerDataJob(sessionId);
  let vin = normalizeVin(String(o.vin || existing?.vin || ""));
  if (!isValidVin(vin)) {
    // «Palaist ar VIN», kad pasūtījumā ir tikai LV numurzīme (Nils 26.11): vispirms CSDD numurs → VIN.
    const plateInput = classifyOrderVinOrPlateInput(String(o.vin || existing?.plate || ""));
    if (plateInput.kind !== "plate") {
      return NextResponse.json({ error: "invalid_vin" }, { status: 400 });
    }
    const resolved = await resolveOrderVinFromPlate(sessionId, {
      stripeVin: plateInput.plate,
      force: true,
      runDownstream: false,
    });
    if (!resolved.effectiveVin) {
      const job = await readDealerDataJob(sessionId);
      const label =
        resolved.reason === "in_progress"
          ? `CSDD vaicājums numuram ${plateInput.plate} jau notiek - pārbaudi pēc minūtes`
          : orderVinPlateFailLabel(plateInput.plate, resolved.resolution?.failKind);
      return NextResponse.json(
        { ok: false, error: "plate_vin_not_found", message: label, job, label, suggestsRefund: dealerDataJobSuggestsRefund(job) },
        { status: 422 },
      );
    }
    vin = resolved.effectiveVin;
    // Bezmaksas avoti + VIN SCAN paralēli dīlera ielasei (abi iekļaujas funkcijas 300 s).
    const downstream = runOrderDownstreamAfterPlateVin(sessionId, { vin }).catch((err) =>
      console.error("[admin dealer-data] plate→vin downstream:", err),
    );
    after(() => downstream);
  }

  const plateVin = isValidVin(normalizeVin(String(o.vin || existing?.vin || ""))) ? undefined : vin;
  const result = await runDealerDataJob({
    sessionId,
    vin,
    trigger: "manual",
    // Operators redz cenu brīdinājumu UI pusē, tāpēc šeit `force` ir apzināts.
    force: o.force === true,
    skipAi: o.skipAi === true,
  });
  const job = await readDealerDataJob(sessionId);

  return NextResponse.json(
    {
      ...result,
      job,
      label: describeDealerDataJob(job),
      // OneAuto serveris neatbild: operators redz skaidru tekstu, nevis kodu «upstream_retry_wait».
      ...(dealerDataJobWaitsForUpstream(job) ? { message: describeDealerDataJob(job) } : {}),
      suggestsRefund: dealerDataJobSuggestsRefund(job),
      ...(plateVin ? { plateVin } : {}),
    },
    { status: result.ok ? 200 : 502 },
  );
}
