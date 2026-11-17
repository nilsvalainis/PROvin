import { readAutoparksState } from "@/lib/iriss-autoparks-store";
import { carV2Of, type AutoparksCarV2 } from "@/lib/iriss-autoparks-v2";
import { autoparksV2Json, requireAutoparksV2Api } from "@/lib/iriss-autoparks-v2-access";
import {
  normalizeBulkImportRow,
  planBulkImportRow,
  type BulkImportCurrentValues,
  type BulkImportFieldKey,
} from "@/lib/iriss-autoparks-v2-bulk-import";
import { readAutoparksV2State, updateCarV2 } from "@/lib/iriss-autoparks-v2-store";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 2000;

function currentValues(car: { make: string; model: string; plate: string; year: string; color: string }, v2: AutoparksCarV2): BulkImportCurrentValues {
  return {
    mileageKm: v2.tech.mileageKm,
    firstRegDate: v2.tech.firstRegDate,
    displacementCm3: v2.tech.displacementCm3,
    powerKw: v2.tech.powerKw,
    tyreSize: v2.tech.tyreSize,
    make: v2.fields.make || car.make,
    model: v2.fields.model || car.model,
    plate: v2.fields.plate || car.plate,
    year: v2.fields.year || car.year,
    color: v2.fields.color || car.color,
  };
}

type RowResult =
  | { vin: string; ok: false; error: "invalid_row" | "invalid_vin" | "not_found" }
  | { vin: string; ok: true; carId: string; updated: BulkImportFieldKey[]; skippedExisting: BulkImportFieldKey[]; invalid: BulkImportFieldKey[] };

/**
 * Admin bulk imports: VIN -> lauki (nobraukums, 1. reģistrācija, tilpums, jauda, riepas, marka, modelis,
 * numurzīme, gads, krāsa). Tikai staff/admin ar `pamatdati` tiesību (deny-by-default, tā pati, kas sargā
 * Pamatdati PATCH). Pēc noklusējuma aizpildītus laukus nepārraksta - jāprasa `?overwrite=1` (vai
 * `{"overwrite":true}` ķermenī), lai pārrakstītu lauku, kam jau ir vērtība. v1 dati netiek pārrakstīti
 * (kā J29 C) - importētās vērtības glabājas v2.
 */
export async function POST(req: Request) {
  const gate = await requireAutoparksV2Api("pamatdati");
  if (!gate.ok) return gate.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return autoparksV2Json({ error: "invalid_json" }, 400);
  }
  const rowsRaw = body.rows;
  if (!Array.isArray(rowsRaw)) return autoparksV2Json({ error: "missing_rows" }, 400);
  if (rowsRaw.length === 0) return autoparksV2Json({ error: "empty_rows" }, 400);
  if (rowsRaw.length > MAX_ROWS) return autoparksV2Json({ error: "too_many_rows", max: MAX_ROWS }, 400);

  const url = new URL(req.url);
  const overwrite = url.searchParams.get("overwrite") === "1" || body.overwrite === true;

  const [v1, v2State] = await Promise.all([readAutoparksState(), readAutoparksV2State()]);
  const byVin = new Map<string, string>();
  for (const car of v1.cars) {
    const v2 = carV2Of(v2State, car.id);
    const vin = normalizeVin(v2.fields.vin || car.vin);
    if (vin) byVin.set(vin, car.id);
  }
  /** Ja divas rindas vienā pieprasījumā norāda to pašu VIN, otrā redz pirmās jau ieplānotās vērtības. */
  const seenValues = new Map<string, BulkImportCurrentValues>();

  const results: RowResult[] = [];
  for (const raw of rowsRaw) {
    const row = normalizeBulkImportRow(raw);
    if (!row) {
      results.push({ vin: "", ok: false, error: "invalid_row" });
      continue;
    }
    const vin = normalizeVin(row.vin);
    if (!isValidVin(vin)) {
      results.push({ vin: row.vin, ok: false, error: "invalid_vin" });
      continue;
    }
    const carId = byVin.get(vin);
    if (!carId) {
      results.push({ vin, ok: false, error: "not_found" });
      continue;
    }
    const current =
      seenValues.get(carId) ??
      currentValues(
        v1.cars.find((c) => c.id === carId)!,
        carV2Of(v2State, carId),
      );
    const plan = planBulkImportRow(current, row.fields, overwrite);
    const updatedKeys = Object.keys(plan.updates) as BulkImportFieldKey[];
    const next: BulkImportCurrentValues = { ...current };
    for (const k of updatedKeys) {
      const value = plan.updates[k]!;
      if (k === "mileageKm" || k === "displacementCm3" || k === "powerKw") next[k] = Number(value);
      else next[k] = String(value);
    }
    seenValues.set(carId, next);
    if (updatedKeys.length > 0) {
      await updateCarV2(
        carId,
        (c) => {
          const hist: Array<{ field: string; from: unknown; to: unknown }> = [];
          for (const k of updatedKeys) {
            const value = plan.updates[k]!;
            switch (k) {
              case "mileageKm":
              case "displacementCm3":
              case "powerKw": {
                const field = `tech.${k}` as const;
                hist.push({ field, from: c.tech[k], to: value });
                c.tech[k] = typeof value === "number" ? value : Number(value);
                c.sources[field] = "csdd";
                break;
              }
              case "firstRegDate":
              case "tyreSize": {
                const field = `tech.${k}` as const;
                hist.push({ field, from: c.tech[k], to: value });
                c.tech[k] = String(value);
                c.sources[field] = "csdd";
                break;
              }
              case "make":
              case "model":
              case "plate":
              case "year":
              case "color": {
                hist.push({ field: k, from: c.fields[k], to: value });
                c.fields[k] = String(value);
                break;
              }
            }
          }
          return { result: c, history: hist };
        },
        { id: gate.actorId, name: `${gate.actorName} (bulk import)` },
      );
    }
    results.push({ vin, ok: true, carId, updated: updatedKeys, skippedExisting: plan.skippedExisting, invalid: plan.invalid });
  }

  const summary = {
    rows: results.length,
    matched: results.filter((r) => r.ok).length,
    notFound: results.filter((r) => !r.ok && r.error === "not_found").length,
    invalidVin: results.filter((r) => !r.ok && r.error === "invalid_vin").length,
    invalidRow: results.filter((r) => !r.ok && r.error === "invalid_row").length,
    fieldsUpdated: results.reduce((n, r) => n + (r.ok ? r.updated.length : 0), 0),
    fieldsSkippedExisting: results.reduce((n, r) => n + (r.ok ? r.skippedExisting.length : 0), 0),
  };
  return autoparksV2Json({ ok: true, overwrite, summary, results });
}
