import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/admin-auth";
import { fetchCsddTechData } from "@/lib/csdd-tech-data";
import { isValidVinOrPlate, normalizePlateNumber, normalizeVin } from "@/lib/order-field-validation";

export const runtime = "nodejs";
export const maxDuration = 30;

function normalizeNr1(raw: string): string {
  const vin = normalizeVin(raw);
  if (isValidVinOrPlate(vin)) return vin;
  return normalizePlateNumber(raw);
}

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const nr1Raw =
    typeof body === "object" && body && "nr1" in body ? String((body as { nr1: unknown }).nr1) : "";
  const nr1 = normalizeNr1(nr1Raw);
  if (!nr1 || !isValidVinOrPlate(nr1)) {
    return NextResponse.json({ error: "invalid_nr1" }, { status: 400 });
  }

  const snapshot = await fetchCsddTechData(nr1);
  return NextResponse.json(snapshot);
}
