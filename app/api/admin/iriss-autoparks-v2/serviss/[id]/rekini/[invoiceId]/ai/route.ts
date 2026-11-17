import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import { readServiceInvoiceAmountWithAi } from "@/lib/iriss-autoparks-v2-ai-invoice";
import { getAutoparksV2Serviss } from "@/lib/iriss-autoparks-v2-serviss-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string; invoiceId: string }> };

/** Pārlasīt rēķina summu ar AI (tikai ar Summām - ieteikums redzams tikai viņiem). */
export async function POST(_req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("serviss");
  if (!gate.ok) return gate.response;
  if (!gate.perms.summas) return autoparksV2Json({ error: "forbidden" }, 403);
  const { id, invoiceId } = await ctx.params;
  const res = await readServiceInvoiceAmountWithAi(id, invoiceId);
  if (res === "not_found") return autoparksV2Json({ error: "not_found" }, 404);
  if (res === "skipped") return autoparksV2Json({ error: "ai_unavailable" }, 503);
  return autoparksV2Json({ ok: true, serviss: await getAutoparksV2Serviss(id, gate.perms) });
}
