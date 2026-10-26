import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import { loadIrissSaitesView, sendIrissSaitesWhatsApp } from "@/lib/iriss-car-share-resolve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("pamatdati");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const loaded = await loadIrissSaitesView("autoparks", id).catch(() => null);
  if (!loaded) return autoparksV2Json({ error: "not_found" }, 404);
  return autoparksV2Json({ ok: true, ...loaded });
}

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("pamatdati");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  let action = "";
  try {
    const body = (await req.json()) as { action?: string };
    action = typeof body.action === "string" ? body.action : "";
  } catch {
    return autoparksV2Json({ error: "invalid_json" }, 400);
  }
  if (action !== "sent") return autoparksV2Json({ error: "invalid_action" }, 400);
  const loaded = await sendIrissSaitesWhatsApp("autoparks", id, gate.actorName).catch(() => null);
  if (!loaded) return autoparksV2Json({ error: "not_found" }, 404);
  return autoparksV2Json({ ok: true, ...loaded });
}
