import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { patchIrissListingVehicleVin, readIrissListingsLatestView } from "@/lib/iriss-listings-aggregate-store";
import { isIrissListingsVinOcrEnabled, ocrVinFromListingPhotos } from "@/lib/iriss-listings-vin-ocr";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  if (existing) {
    return NextResponse.json({
      status: "has_vin",
      vin: existing,
      vinSource: vehicle.vinSource ?? "source",
    });
  }

  const missAt = vehicle.vinOcrStatus === "miss" && vehicle.vinOcrAt ? Date.parse(vehicle.vinOcrAt) : NaN;
  if (Number.isFinite(missAt) && Date.now() - missAt < MISS_RETRY_MS) {
    return NextResponse.json({ status: "miss", vin: "", vinSource: "", cached: true });
  }

  try {
    const r = await ocrVinFromListingPhotos(vehicle);
    const at = new Date().toISOString();
    if (r.vin) {
      const saved = await patchIrissListingVehicleVin(id, {
        vin: r.vin,
        vinSource: "ocr_photo",
        vinOcrAt: at,
        vinOcrStatus: "found",
      });
      return NextResponse.json({
        status: "found",
        vin: r.vin,
        vinSource: "ocr_photo",
        photosTried: r.photosTried,
        persisted: saved.persisted,
      });
    }
    await patchIrissListingVehicleVin(id, { vinOcrAt: at, vinOcrStatus: "miss" });
    return NextResponse.json({ status: "miss", vin: "", vinSource: "", photosTried: r.photosTried });
  } catch (e) {
    return NextResponse.json(
      { error: "ocr_failed", detail: e instanceof Error ? e.message : "unknown" },
      { status: 502 },
    );
  }
}
