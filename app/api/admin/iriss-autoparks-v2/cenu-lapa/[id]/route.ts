import { autoparksV2Basics } from "@/lib/iriss-autoparks-v2";
import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import { autoparksV2PriceSheet } from "@/lib/iriss-autoparks-v2-cenu-lapa";
import { parseEurInput } from "@/lib/iriss-autoparks-v2-format";
import { readAutoparksV2Car, updateCarV2 } from "@/lib/iriss-autoparks-v2-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Cenu lapa (D4). Bez pašizmaksas un iepirkuma cenas. */
export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("cenu_lapa");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const found = await readAutoparksV2Car(id);
  if (!found) return autoparksV2Json({ error: "not_found" }, 404);
  return autoparksV2Json({ ok: true, cenuLapa: autoparksV2PriceSheet(found.car, found.v2, autoparksV2Basics(found.car, found.v2)) });
}

/** `{ displayName?, equipmentLine?, salePriceEur?, listPriceEur? }` -> v2 (v1 netiek pārrakstīts). */
export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("cenu_lapa");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return autoparksV2Json({ error: "invalid_json" }, 400);
  }
  const found = await readAutoparksV2Car(id);
  if (!found) return autoparksV2Json({ error: "not_found" }, 404);
  const v2 = await updateCarV2(
    id,
    (c) => {
      const hist: Array<{ field: string; from: unknown; to: unknown }> = [];
      for (const [k, max] of [["displayName", 160], ["equipmentLine", 300]] as const) {
        if (typeof body[k] !== "string") continue;
        const v = (body[k] as string).trim().slice(0, max);
        hist.push({ field: `priceSheet.${k}`, from: c.priceSheet[k], to: v });
        c.priceSheet[k] = v;
      }
      for (const k of ["salePriceEur", "listPriceEur"] as const) {
        if (!(k in body)) continue;
        const v = body[k] === null || body[k] === "" ? null : parseEurInput(String(body[k]));
        hist.push({ field: `priceSheet.${k}`, from: c.priceSheet[k], to: v });
        c.priceSheet[k] = v;
      }
      return { result: c, history: hist };
    },
    { id: gate.actorId, name: gate.actorName },
  );
  return autoparksV2Json({ ok: true, cenuLapa: autoparksV2PriceSheet(found.car, v2, autoparksV2Basics(found.car, v2)) });
}
