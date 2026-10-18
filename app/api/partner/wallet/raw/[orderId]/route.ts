import { NextResponse } from "next/server";
import { isSafeOrderDraftSessionId, readOrderDraft } from "@/lib/admin-order-draft-store";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { resolveActiveB2bPartner } from "@/lib/b2b-partner-auth";
import { partnerNotesMatchId } from "@/lib/b2b-partner-orders";
import { parseB2bWalletOrderMarks } from "@/lib/b2b-wallet";
import { refundB2bWalletOrderIfNoData } from "@/lib/b2b-wallet-refund";
import { readDealerDataJob } from "@/lib/dealer-data-job-store";
import { buildOneautoDisplay, filledOneautoServiceEvents, type OneautoProductId } from "@/lib/oneauto-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ orderId: string }> };

/** RAW dīlera dati partnerim: OEM ieraksti oriģinālā, bez tulkojuma un apstrādes. */
export async function GET(_req: Request, ctx: Ctx) {
  const partner = await resolveActiveB2bPartner();
  if (!partner) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { orderId } = await ctx.params;
  const id = orderId.trim();
  if (!isSafeOrderDraftSessionId(id)) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const draft = await readOrderDraft(id);
  const notes = draft?.orderEdits?.notes ?? "";
  const marks = parseB2bWalletOrderMarks(notes);
  if (!draft || !partnerNotesMatchId(notes, partner.id) || !marks || marks.product !== "dealer_raw") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let job = await readDealerDataJob(id);
  if (job?.status === "no_data" && !job.refund) {
    await refundB2bWalletOrderIfNoData(id).catch(() => null);
    job = await readDealerDataJob(id);
  }

  const status = job?.status ?? "pending";
  const base = {
    orderId: id,
    vin: draft.orderEdits?.vin ?? job?.vin ?? "",
    status,
    refunded: Boolean(job?.refund),
    refundCents: job?.refund?.amountCents ?? 0,
  };
  if (status !== "done") return NextResponse.json({ ...base, serviceTimeline: [], vehicle: [] });

  const ingest = mergeSourceBlocksWithDefaults(draft.workspace?.sourceBlocks).auto_records.oneautoIngest;
  const payloads: Partial<Record<OneautoProductId, unknown>> = {};
  for (const [key, result] of Object.entries(ingest?.results ?? {})) {
    if (result?.payload != null) payloads[key as OneautoProductId] = result.payload;
  }
  const display = buildOneautoDisplay(payloads);
  const serviceTimeline = filledOneautoServiceEvents(display.serviceTimeline);
  return NextResponse.json({
    ...base,
    fetchedAt: ingest?.fetchedAt ?? null,
    serviceTimeline: serviceTimeline.length > 0 ? serviceTimeline : ingest?.serviceTimelineOriginal ?? [],
    vehicle: display.powertrain.filter((row) => row.label.trim() && row.value.trim()),
  });
}
