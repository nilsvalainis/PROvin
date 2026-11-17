import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import { listAutoparksV2History } from "@/lib/iriss-autoparks-v2-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Vēsture pa auto (kurš, kad, lauks, no-uz). Tikai administrators (nav sadaļu kartē). */
export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("vesture");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  return autoparksV2Json({ ok: true, history: await listAutoparksV2History(id) });
}
