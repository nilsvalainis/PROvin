import { NextResponse } from "next/server";

import { getClientIpFromRequest } from "@/lib/client-ip";
import { fetchCsddTechData } from "@/lib/csdd-tech-data";
import {
  MINI_CSDD_LOOKUP_TIMEOUT_MS,
  miniCsddModalVariantFromLookup,
  type MiniCsddModalVariant,
} from "@/lib/mini-csdd-eligibility";
import { isValidVinOrPlate, normalizeVin } from "@/lib/order-field-validation";
import { checkRateLimit } from "@/lib/rate-limit-memory";

export const runtime = "nodejs";
export const maxDuration = 10;

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 40;

function normal(): NextResponse {
  const body: { variant: MiniCsddModalVariant } = { variant: "normal" };
  return NextResponse.json(body);
}

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const rl = checkRateLimit(`mini-csdd:${ip}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!rl.ok) return normal();

  let raw: { vin?: unknown };
  try {
    raw = (await req.json()) as { vin?: unknown };
  } catch {
    return normal();
  }

  const vin = typeof raw.vin === "string" ? normalizeVin(raw.vin) : "";
  if (!vin || !isValidVinOrPlate(vin)) return normal();

  try {
    const result = await fetchCsddTechData(vin, { timeoutMs: MINI_CSDD_LOOKUP_TIMEOUT_MS });
    return NextResponse.json({ variant: miniCsddModalVariantFromLookup(result) });
  } catch {
    return normal();
  }
}
