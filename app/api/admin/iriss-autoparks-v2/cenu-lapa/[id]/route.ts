import { autoparksV2Basics, isV2PriceSheetState, normalizeV2PriceSheetSafety } from "@/lib/iriss-autoparks-v2";
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

/** `{ displayName?, equipmentLine?, salePriceEur?, listPriceEur?, safety?, sheetState?, showPlannedPrice?, rowVisibility? }` -> v2 (v1 netiek pārrakstīts). */
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
        // Nenolasāma summa netiek saglabāta kā tukša (lauks netiek iztīrīts, Nils 28.10).
        if (v === null && body[k] !== null && body[k] !== "") continue;
        hist.push({ field: `priceSheet.${k}`, from: c.priceSheet[k], to: v });
        c.priceSheet[k] = v;
      }
      if ("safety" in body) {
        // Drošības tabula (Nils 28.10): ķeksīši no admin formas.
        const v = normalizeV2PriceSheetSafety(body.safety);
        if (v) {
          hist.push({ field: "priceSheet.safety", from: c.priceSheet.safety ?? null, to: v });
          c.priceSheet.safety = v;
        }
      }
      if ("sheetState" in body) {
        // Lapas stāvoklis (Nils 20.11): "auto"/null = automātiski; normal/soon/reserved - manuāli. Glabā tikai manuālo izvēli.
        const raw = body.sheetState;
        const v = raw === null || raw === "auto" ? null : isV2PriceSheetState(raw) ? raw : undefined;
        if (v !== undefined) {
          hist.push({ field: "priceSheet.sheetState", from: c.priceSheet.sheetState ?? null, to: v });
          c.priceSheet.sheetState = v;
        }
      }
      if (body.rowVisibility && typeof body.rowVisibility === "object" && !Array.isArray(body.rowVisibility)) {
        // «Dati lapai» rindu rādīt/slēpt (Nils 20.11): sapludina ar esošo.
        const next = { ...(c.priceSheet.rowVisibility ?? {}) };
        for (const [k, v] of Object.entries(body.rowVisibility as Record<string, unknown>)) {
          if (/^[a-zA-Z0-9]{1,40}$/.test(k) && typeof v === "boolean") next[k] = v;
        }
        hist.push({ field: "priceSheet.rowVisibility", from: c.priceSheet.rowVisibility ?? {}, to: next });
        c.priceSheet.rowVisibility = next;
      }
      if (typeof body.showPlannedPrice === "boolean") {
        hist.push({ field: "priceSheet.showPlannedPrice", from: c.priceSheet.showPlannedPrice ?? null, to: body.showPlannedPrice });
        c.priceSheet.showPlannedPrice = body.showPlannedPrice;
      }
      return { result: c, history: hist };
    },
    { id: gate.actorId, name: gate.actorName },
  );
  return autoparksV2Json({ ok: true, cenuLapa: autoparksV2PriceSheet(found.car, v2, autoparksV2Basics(found.car, v2)) });
}
