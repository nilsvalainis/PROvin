import { isAutoparksOwner } from "@/lib/iriss-autoparks";
import { autoparksV2Basics, v2Num, V2_FIELD_KEYS } from "@/lib/iriss-autoparks-v2";
import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import { readAutoparksV2Car, refreshAutoparksV2Tech, updateCarV2 } from "@/lib/iriss-autoparks-v2-store";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

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

const TEXT_MAX: Record<string, number> = {
  plate: 16,
  location: 120,
  arrivedAt: 10,
  tyreSize: 40,
  gearbox: 40,
  engine: 60,
  make: 60,
  model: 80,
  vin: 32,
  year: 4,
  color: 40,
  owner: 4,
};

/**
 * Autosave vienam vai vairākiem laukiem. v1 lauki (numurzīme, vieta, atvests, marka, modelis, VIN, gads, krāsa,
 * īpašnieks) glabājas v2 - v1 pats netiek pārrakstīts (J29 C, J29 B papildus). CSDD tehniskos laukus
 * (1. reģ., tilpums, jauda, nobraukums) pēc ar roku labojuma imports vairs nepārraksta
 * (`refreshAutoparksV2Tech` pilda tikai tukšus laukus; nobraukumam CSDD reģistra importa nav).
 */
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
  const vin = text("vin");
  if (vin !== undefined && vin !== "" && !isValidVin(vin)) return autoparksV2Json({ error: "invalid_vin" }, 400);
  const firstRegDate = text("firstRegDate");
  if (firstRegDate !== undefined && firstRegDate !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(firstRegDate)) return autoparksV2Json({ error: "invalid_date" }, 400);
  const year = text("year");
  if (year !== undefined && year !== "" && !/^(19|20)\d{2}$/.test(year)) return autoparksV2Json({ error: "invalid_year" }, 400);
  const owner = text("owner");
  if (owner !== undefined && owner !== "" && !isAutoparksOwner(owner.toUpperCase())) return autoparksV2Json({ error: "invalid_owner" }, 400);
  const hasDisplacement = Object.prototype.hasOwnProperty.call(body, "displacementCm3");
  const hasPowerKw = Object.prototype.hasOwnProperty.call(body, "powerKw");
  const hasMileage = Object.prototype.hasOwnProperty.call(body, "mileageKm");
  const v2 = await updateCarV2(
    id,
    (c) => {
      const hist: Array<{ field: string; from: unknown; to: unknown }> = [];
      for (const k of V2_FIELD_KEYS) {
        let v = text(k);
        if (v === undefined) continue;
        if (k === "plate" || k === "owner") v = v.toUpperCase();
        if (k === "vin") v = normalizeVin(v);
        const from = c.fields[k] || found.car[k];
        hist.push({ field: k, from, to: v });
        c.fields[k] = v;
        // "Atvests" J52b LABOJUMS: ar roku notīrīts v2 pārraksts (tukšs) nedrīkst atgriezties pie
        // v1 `car.arrivedAt` - `sources` atzīme liek `autoparksV2Basics` ticēt v2 vērtībai pat tukšai.
        if (k === "arrivedAt") c.sources[k] = "manual";
        // Labots VIN/numurzīme var padarīt CSDD meklēšanu veiksmīgu - neļaut iepriekšējam
        // neveiksmīgam mēģinājumam (ar vecu/tukšu identifikatoru) bloķēt atkārtotu mēģinājumu nedēļu.
        if ((k === "vin" || k === "plate") && v !== from) c.tech.csddCheckedAt = "";
      }
      const tyre = text("tyreSize");
      if (tyre !== undefined) {
        hist.push({ field: "tech.tyreSize", from: c.tech.tyreSize, to: tyre });
        c.tech.tyreSize = tyre;
        c.sources["tech.tyreSize"] = "manual";
      }
      const gearbox = text("gearbox");
      if (gearbox !== undefined) {
        hist.push({ field: "tech.gearbox", from: c.tech.gearbox, to: gearbox });
        c.tech.gearbox = gearbox;
        c.sources["tech.gearbox"] = "manual";
      }
      const engine = text("engine");
      if (engine !== undefined) {
        hist.push({ field: "tech.engine", from: c.tech.engine, to: engine });
        c.tech.engine = engine;
        c.sources["tech.engine"] = "manual";
      }
      if (firstRegDate !== undefined) {
        hist.push({ field: "tech.firstRegDate", from: c.tech.firstRegDate, to: firstRegDate });
        c.tech.firstRegDate = firstRegDate;
        c.sources["tech.firstRegDate"] = "manual";
      }
      if (hasDisplacement) {
        const cm3 = v2Num(body.displacementCm3);
        hist.push({ field: "tech.displacementCm3", from: c.tech.displacementCm3, to: cm3 });
        c.tech.displacementCm3 = cm3;
        c.sources["tech.displacementCm3"] = "manual";
      }
      if (hasPowerKw) {
        const kw = v2Num(body.powerKw);
        hist.push({ field: "tech.powerKw", from: c.tech.powerKw, to: kw });
        c.tech.powerKw = kw;
        c.sources["tech.powerKw"] = "manual";
      }
      if (hasMileage) {
        const km = v2Num(body.mileageKm);
        hist.push({ field: "tech.mileageKm", from: c.tech.mileageKm, to: km });
        c.tech.mileageKm = km;
        c.sources["tech.mileageKm"] = "manual";
      }
      return { result: c, history: hist };
    },
    { id: gate.actorId, name: gate.actorName },
  );
  return autoparksV2Json({ ok: true, basics: autoparksV2Basics(found.car, v2) });
}
