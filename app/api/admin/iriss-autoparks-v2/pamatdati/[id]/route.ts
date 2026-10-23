import { autoparksV2Basics, V2_FIELD_KEYS } from "@/lib/iriss-autoparks-v2";
import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import { readAutoparksV2Car, refreshAutoparksV2Tech, updateCarV2 } from "@/lib/iriss-autoparks-v2-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Pamatdati (T2, T8): auto, tehniskie dati, CSDD reģistrs. Cenas šeit nav vispār. */
export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("pamatdati");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const found = await readAutoparksV2Car(id);
  if (!found) return autoparksV2Json({ error: "not_found" }, 404);
  const v2 = await refreshAutoparksV2Tech(found.car, found.v2, { id: gate.actorId, name: gate.actorName }).catch(() => found.v2);
  return autoparksV2Json({ ok: true, basics: autoparksV2Basics(found.car, v2) });
}

const TEXT_MAX: Record<string, number> = { plate: 16, location: 120, arrivedAt: 10, tyreSize: 40 };

/** Autosave vienam vai vairākiem laukiem. v1 lauki (numurzīme, vieta, atvests) glabājas v2 - v1 netiek pārrakstīts. */
export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("pamatdati");
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
  const text = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim().slice(0, TEXT_MAX[k]) : undefined);
  const arrived = text("arrivedAt");
  if (arrived !== undefined && arrived !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(arrived)) return autoparksV2Json({ error: "invalid_date" }, 400);
  const v2 = await updateCarV2(
    id,
    (c) => {
      const hist: Array<{ field: string; from: unknown; to: unknown }> = [];
      for (const k of V2_FIELD_KEYS) {
        let v = text(k);
        if (v === undefined) continue;
        if (k === "plate") v = v.toUpperCase();
        hist.push({ field: k, from: c.fields[k] || found.car[k], to: v });
        c.fields[k] = v;
      }
      const tyre = text("tyreSize");
      if (tyre !== undefined) {
        hist.push({ field: "tech.tyreSize", from: c.tech.tyreSize, to: tyre });
        c.tech.tyreSize = tyre;
        c.sources["tech.tyreSize"] = "manual";
      }
      return { result: c, history: hist };
    },
    { id: gate.actorId, name: gate.actorName },
  );
  return autoparksV2Json({ ok: true, basics: autoparksV2Basics(found.car, v2) });
}
