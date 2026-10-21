import { isAutoparksStatus } from "@/lib/iriss-autoparks";
import type { AutoparksCarInput } from "@/lib/iriss-autoparks-store";

function num(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function text(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/** API ievade auto laukiem. Ja lietotājs neredz summas, cenas ignorē (nevar nejauši nodzēst). */
export function parseAutoparksCarInput(body: Record<string, unknown>, hideSums: boolean): AutoparksCarInput {
  const out: AutoparksCarInput = {
    vin: text(body.vin),
    make: text(body.make),
    model: text(body.model),
    year: text(body.year),
    plate: text(body.plate),
    color: text(body.color),
    location: text(body.location),
    arrivedAt: text(body.arrivedAt),
    mileageKm: num(body.mileageKm),
    status: isAutoparksStatus(body.status) ? body.status : undefined,
  };
  if (!hideSums) {
    out.purchasePriceEur = num(body.purchasePriceEur);
    out.salePriceEur = num(body.salePriceEur);
  }
  for (const key of Object.keys(out) as (keyof AutoparksCarInput)[]) {
    if (out[key] === undefined) delete out[key];
  }
  return out;
}
