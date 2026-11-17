import { after } from "next/server";
import { isAutoparksOwner } from "@/lib/iriss-autoparks";
import { linkAutoparksCarToDropbox } from "@/lib/iriss-autoparks-dropbox-sync";
import { createAutoparksCar, readAutoparksState } from "@/lib/iriss-autoparks-store";
import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import { autoparksV2ListRows } from "@/lib/iriss-autoparks-v2-list";
import { readAutoparksV2State } from "@/lib/iriss-autoparks-v2-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Saraksts (T1, D1). Bez summām. */
export async function GET() {
  const gate = await requireAutoparksV2Api("pamatdati");
  if (!gate.ok) return gate.response;
  const [v1, v2] = await Promise.all([readAutoparksState(), readAutoparksV2State()]);
  return autoparksV2Json({ ok: true, cars: autoparksV2ListRows(v1.cars, v2) });
}

/** "+ Auto": jauns ieraksts (vecie netiek aiztikti); /STOCK mape tiek sasaistīta pēc atbildes. */
export async function POST(req: Request) {
  const gate = await requireAutoparksV2Api("pamatdati");
  if (!gate.ok) return gate.response;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return autoparksV2Json({ error: "invalid_json" }, 400);
  }
  const t = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : "");
  const vin = t("vin").replace(/[\s-]/g, "");
  if (!t("make").trim() && !t("model").trim() && !vin) return autoparksV2Json({ error: "missing_car" }, 400);
  const car = await createAutoparksCar(
    {
      make: t("make"),
      model: t("model"),
      vin,
      year: t("year"),
      color: t("color"),
      status: "in_transit",
      owner: isAutoparksOwner(body.owner) ? body.owner : "IRISS",
    },
    { id: gate.actorId, name: gate.actorName },
  );
  after(() => linkAutoparksCarToDropbox(car.id));
  return autoparksV2Json({ ok: true, id: car.id });
}
