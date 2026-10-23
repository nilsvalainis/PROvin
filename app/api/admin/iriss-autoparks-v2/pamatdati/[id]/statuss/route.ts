import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import { changeAutoparksStatusV2, undoAutoparksStatusV2 } from "@/lib/iriss-autoparks-v2-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * `{ status }` - maiņa ar 1 pieskārienu (T6), atbildē `historyId` atsaukšanai.
 * `{ undo: historyId }` - atsaukt savu maiņu 5 s laikā (T10); ja cits jau mainīja vai laiks beidzies - 409.
 */
export async function POST(req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("pamatdati");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return autoparksV2Json({ error: "invalid_json" }, 400);
  }
  const actor = { id: gate.actorId, name: gate.actorName };
  if (typeof body.undo === "string") {
    const res = await undoAutoparksStatusV2(id, body.undo, actor);
    if (!res.ok) return autoparksV2Json({ error: res.reason }, res.reason === "not_found" ? 404 : 409);
    return autoparksV2Json({ ok: true, status: res.status });
  }
  // "Pārdots" un arhīvs paliek v1 plūsmā; statusu drīkst mainīt ikviens ar Pamatdatu tiesību.
  const res = await changeAutoparksStatusV2(id, body.status, actor);
  if (!res.ok) {
    const code = res.reason === "invalid" ? 400 : res.reason === "not_found" ? 404 : 409;
    return autoparksV2Json({ error: res.reason }, code);
  }
  return autoparksV2Json({ ok: true, status: res.status, historyId: res.historyId });
}
