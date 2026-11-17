import { after } from "next/server";
import { sendAdminPush } from "@/lib/admin-push";
import { servissPatchAddition, servissPushMessage } from "@/lib/iriss-autoparks-v2-serviss-notify";
import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import { getAutoparksV2Serviss, patchAutoparksV2Serviss } from "@/lib/iriss-autoparks-v2-serviss-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Serviss (T3, T5, T7). Rēķinu summas un AI ieteikums - tikai ar Summām (citādi null). */
export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("serviss");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const view = await getAutoparksV2Serviss(id, gate.perms);
  if (!view) return autoparksV2Json({ error: "not_found" }, 404);
  return autoparksV2Json({ ok: true, serviss: view });
}

/** `{ notes }`, `{ problem: { id?, text?, fixedByService?, confirmedByUs?, remove? } }`, `{ invoice: { id, amountEur | acceptAi } }`. */
export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("serviss");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return autoparksV2Json({ error: "invalid_json" }, 400);
  }
  const res = await patchAutoparksV2Serviss(id, body, gate.perms, { id: gate.actorId, name: gate.actorName });
  if (res === "forbidden") return autoparksV2Json({ error: "forbidden" }, 403);
  if (res === "not_found") return autoparksV2Json({ error: "not_found" }, 404);
  // Nils 27.10: paziņojums tikai Nilam, ja pievienoja kāds cits.
  const push = servissPushMessage({ actorKind: gate.actor.kind, actorName: gate.actorName, carId: id, what: servissPatchAddition(body) });
  if (push) after(() => sendAdminPush(push).then(() => undefined).catch(() => undefined));
  return autoparksV2Json({ ok: true, serviss: await getAutoparksV2Serviss(id, gate.perms) });
}
