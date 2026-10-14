import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { patchIrissListingVehicleVin, readIrissListingsLatestView } from "@/lib/iriss-listings-aggregate-store";
import { isIrissListingsVinOcrEnabled, ocrVinFromListingPhotos } from "@/lib/iriss-listings-vin-ocr";
import { listingVinOcrIsCrossChecked } from "@/lib/iriss-listings-vin-from-photos";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

export const runtime = "nodejs";
export const maxDuration = 120;

const OCR_ROUTE_BUDGET_MS = 100_000;

const MISS_RETRY_MS = 7 * 86_400_000;

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isIrissListingsVinOcrEnabled()) {
    return NextResponse.json({ status: "skipped", reason: "disabled", vin: "" });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const id = body && typeof body === "object" && typeof (body as { vehicleId?: unknown }).vehicleId === "string" ? (body as { vehicleId: string }).vehicleId.trim() : "";
  if (!id) return NextResponse.json({ error: "missing_vehicle" }, { status: 400 });

  const view = await readIrissListingsLatestView();
  const vehicle = view?.vehicles.find((v) => v.id === id) ?? null;
  if (!vehicle) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const existing = vehicle.vin && isValidVin(normalizeVin(vehicle.vin)) ? normalizeVin(vehicle.vin) : "";
  if (existing && vehicle.vinSource !== "ocr_photo") {
    return NextResponse.json({
      status: "has_vin",
      vin: existing,
      vinSource: vehicle.vinSource ?? "source",
      vinOcrAlts: [] as string[],
    });
  }
  if (existing && listingVinOcrIsCrossChecked(vehicle.vinOcrStatus)) {
    return NextResponse.json({
      status: vehicle.vinOcrStatus,
      vin: existing,
      vinSource: "ocr_photo",
      vinOcrAlts: vehicle.vinOcrAlts ?? [],
      cached: true,
    });
  }

  const missAt = vehicle.vinOcrStatus === "miss" && vehicle.vinOcrAt ? Date.parse(vehicle.vinOcrAt) : NaN;
  if (Number.isFinite(missAt) && Date.now() - missAt < MISS_RETRY_MS) {
    return NextResponse.json({ status: "miss", vin: "", vinSource: "", vinOcrAlts: [] as string[], cached: true });
  }

  try {
    const r = await ocrVinFromListingPhotos(vehicle, { deadlineMs: Date.now() + OCR_ROUTE_BUDGET_MS });
    const at = new Date().toISOString();
    if (r.vin && r.vinOcrStatus === "confirmed") {
      const saved = await patchIrissListingVehicleVin(id, {
        vin: r.vin,
        vinSource: "ocr_photo",
        vinOcrAt: at,
        vinOcrStatus: r.vinOcrStatus,
        vinOcrAlts: r.alts,
      });
      return NextResponse.json({
        status: r.vinOcrStatus,
        vin: r.vin,
        vinSource: "ocr_photo",
        vinOcrAlts: r.alts,
        photosTried: r.photosTried,
        persisted: saved.persisted,
      });
    }
    await patchIrissListingVehicleVin(id, { vinOcrAt: at, vinOcrStatus: "miss", vinOcrAlts: [] });
    return NextResponse.json({ status: "miss", vin: "", vinSource: "", vinOcrAlts: [] as string[], photosTried: r.photosTried });
  } catch (e) {
    return NextResponse.json(
      { error: "ocr_failed", detail: e instanceof Error ? e.message : "unknown" },
      { status: 502 },
    );
  }
}
