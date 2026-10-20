import { NextResponse } from "next/server";

import { getClientIpFromRequest } from "@/lib/client-ip";
import { fetchCsddTechData } from "@/lib/csdd-tech-data";
import {
  MINI_CSDD_LOOKUP_TIMEOUT_MS,
  miniCsddModalVariantFromLookup,
  type MiniCsddModalVariant,
} from "@/lib/mini-csdd-eligibility";
import { isValidVinOrPlate, normalizeVin } from "@/lib/order-field-validation";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 10;

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 40;
/** Viens CSDD pieprasījums uz VIN 6 h laikā (instances atmiņā): mazāk ārējo izsaukumu un ļaunprātības. */
const VARIANT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const VARIANT_CACHE_MAX = 500;
const variantCache = new Map<string, { variant: MiniCsddModalVariant; at: number }>();

function cachedVariant(vin: string): MiniCsddModalVariant | null {
  const hit = variantCache.get(vin);
  if (!hit) return null;
  if (Date.now() - hit.at > VARIANT_CACHE_TTL_MS) {
    variantCache.delete(vin);
    return null;
  }
  return hit.variant;
}

function rememberVariant(vin: string, variant: MiniCsddModalVariant): void {
  if (variantCache.size >= VARIANT_CACHE_MAX) {
    const oldest = variantCache.keys().next().value;
    if (oldest !== undefined) variantCache.delete(oldest);
  }
  variantCache.set(vin, { variant, at: Date.now() });
}

function normal(): NextResponse {
  const body: { variant: MiniCsddModalVariant } = { variant: "normal" };
  return NextResponse.json(body);
}

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const rl = await checkRateLimit(`mini-csdd:${ip}`, MAX_PER_WINDOW, WINDOW_MS);
  if (!rl.ok) return normal();

  let raw: { vin?: unknown };
  try {
    raw = (await req.json()) as { vin?: unknown };
  } catch {
    return normal();
  }

  const vin = typeof raw.vin === "string" ? normalizeVin(raw.vin) : "";
  if (!vin || !isValidVinOrPlate(vin)) return normal();

  const cached = cachedVariant(vin);
  if (cached) return NextResponse.json({ variant: cached });

  try {
    const result = await fetchCsddTechData(vin, { timeoutMs: MINI_CSDD_LOOKUP_TIMEOUT_MS });
    const variant = miniCsddModalVariantFromLookup(result);
    // Īslaicīgu kļūdu (taimauts, CSDD nav pieejams) nekešo.
    if (result.found || variant === "warning") rememberVariant(vin, variant);
    return NextResponse.json({ variant });
  } catch {
    return normal();
  }
}
