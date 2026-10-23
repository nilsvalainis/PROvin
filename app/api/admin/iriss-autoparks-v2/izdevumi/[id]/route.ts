import { randomUUID } from "node:crypto";
import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import { parseEurInput } from "@/lib/iriss-autoparks-v2-format";
import { readAutoparksV2Car, updateCarV2 } from "@/lib/iriss-autoparks-v2-store";
import type { V2Expense } from "@/lib/iriss-autoparks-v2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function view(expenses: V2Expense[], summas: boolean) {
  const rows = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).map((e) => ({ id: e.id, text: e.text, date: e.date, amountEur: summas ? e.amountEur : null }));
  const total = summas ? Math.round(expenses.reduce((s, e) => s + (e.amountEur ?? 0), 0) * 100) / 100 : null;
  return { rows, totalEur: total, canSums: summas };
}

/** Citi izdevumi: teksts, datums, summa (summa tikai ar Summām). */
export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("izdevumi");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const found = await readAutoparksV2Car(id);
  if (!found) return autoparksV2Json({ error: "not_found" }, 404);
  return autoparksV2Json({ ok: true, izdevumi: view(found.v2.expenses, gate.perms.summas) });
}

/** `{ id?, text?, amountEur?, date?, remove? }` - jauns (bez id) vai labojums. Summu bez tiesības nevar mainīt. */
export async function PATCH(req: Request, ctx: Ctx) {
  const gate = await requireAutoparksV2Api("izdevumi");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return autoparksV2Json({ error: "invalid_json" }, 400);
  }
  if ("amountEur" in body && !gate.perms.summas) return autoparksV2Json({ error: "forbidden" }, 403);
  if (typeof body.date === "string" && body.date && !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) return autoparksV2Json({ error: "invalid_date" }, 400);
  if (!(await readAutoparksV2Car(id))) return autoparksV2Json({ error: "not_found" }, 404);
  const v2 = await updateCarV2(
    id,
    (c) => {
      const hist: Array<{ field: string; from: unknown; to: unknown }> = [];
      let e = typeof body.id === "string" ? c.expenses.find((x) => x.id === body.id) : undefined;
      if (e && body.remove === true) {
        hist.push({ field: "expense", from: `${e.text} ${e.amountEur ?? ""}`.trim(), to: "" });
        c.expenses = c.expenses.filter((x) => x !== e);
        return { result: c, history: hist };
      }
      if (!e) {
        const text = typeof body.text === "string" ? body.text.trim().slice(0, 300) : "";
        if (!text) return { result: c };
        e = { id: `aex-${randomUUID()}`, text: "", amountEur: null, date: new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Riga" }), fileIds: [] };
        c.expenses.push(e);
      }
      if (typeof body.text === "string") {
        hist.push({ field: "expense.text", from: e.text, to: body.text.trim().slice(0, 300) });
        e.text = body.text.trim().slice(0, 300);
      }
      if (typeof body.date === "string" && body.date) {
        hist.push({ field: "expense.date", from: e.date, to: body.date });
        e.date = body.date;
      }
      if ("amountEur" in body) {
        const v = body.amountEur === null || body.amountEur === "" ? null : parseEurInput(String(body.amountEur));
        hist.push({ field: "expense.amount", from: e.amountEur, to: v });
        e.amountEur = v;
      }
      return { result: c, history: hist };
    },
    { id: gate.actorId, name: gate.actorName },
  );
  return autoparksV2Json({ ok: true, izdevumi: view(v2.expenses, gate.perms.summas) });
}
