import { NextResponse, after } from "next/server";
import { recordSourceOutcomes } from "@/lib/source-health-store";

import { requireIrissSectionApi } from "@/lib/staff-auth";
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
  const gate = await requireIrissSectionApi("vin");
  if (!gate.ok) return gate.response;

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
  const csddOk = snapshot.found || /nav atrast|nav reģistr|not found/i.test(snapshot.message);
  after(() => recordSourceOutcomes([{ id: "csdd", ok: csddOk, msg: snapshot.message }]));
  return NextResponse.json(snapshot);
}
