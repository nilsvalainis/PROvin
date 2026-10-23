import { V2_VAT_MODES, type V2VatMode } from "@/lib/iriss-autoparks-v2";
import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import { parseEurInput } from "@/lib/iriss-autoparks-v2-format";
import { autoparksV2IegadeView } from "@/lib/iriss-autoparks-v2-iegade";
import { readAutoparksV2Car, updateCarV2 } from "@/lib/iriss-autoparks-v2-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Iegādes dokumenti (D2): faili, izsoles dati, PVN režīms; summas un pašizmaksa tikai ar tiesībām (citādi null). */
export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("iegade");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const view = await autoparksV2IegadeView(id, gate.perms);
  if (!view) return autoparksV2Json({ error: "not_found" }, 404);
  return autoparksV2Json({ ok: true, iegade: view });
}

const TEXT: Record<string, number> = { auction: 80, auctionNo: 60, purchaseDate: 10 };

export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("iegade");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return autoparksV2Json({ error: "invalid_json" }, 400);
  }
  if (!(await readAutoparksV2Car(id))) return autoparksV2Json({ error: "not_found" }, 404);
  const wantsSums = "purchasePriceEur" in body || "transportEur" in body;
  // Kas neredz summas, tas tās arī nemaina.
  if (wantsSums && !gate.perms.summas) return autoparksV2Json({ error: "forbidden" }, 403);
  const date = typeof body.purchaseDate === "string" ? body.purchaseDate.trim() : undefined;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return autoparksV2Json({ error: "invalid_date" }, 400);
  await updateCarV2(
    id,
    (c) => {
      const hist: Array<{ field: string; from: unknown; to: unknown }> = [];
      for (const k of Object.keys(TEXT) as Array<"auction" | "auctionNo" | "purchaseDate">) {
        if (typeof body[k] !== "string") continue;
        const v = (body[k] as string).trim().slice(0, TEXT[k]);
        hist.push({ field: `purchase.${k}`, from: c.purchase[k], to: v });
        c.purchase[k] = v;
      }
      if (typeof body.vatMode === "string" && (V2_VAT_MODES as readonly string[]).includes(body.vatMode)) {
        hist.push({ field: "purchase.vat", from: c.purchase.vat.mode, to: body.vatMode });
        c.purchase.vat = { mode: body.vatMode as V2VatMode, source: "manual", at: new Date().toISOString() };
      }
      for (const k of ["purchasePriceEur", "transportEur"] as const) {
        if (!(k in body)) continue;
        const raw = body[k];
        const v = raw === null || raw === "" ? null : typeof raw === "number" ? (Number.isFinite(raw) && raw >= 0 ? raw : null) : parseEurInput(String(raw));
        hist.push({ field: `purchase.${k}`, from: c.purchase[k], to: v });
        c.purchase[k] = v;
      }
      return { result: null, history: hist };
    },
    { id: gate.actorId, name: gate.actorName },
  );
  return autoparksV2Json({ ok: true, iegade: await autoparksV2IegadeView(id, gate.perms) });
}
