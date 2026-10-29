import { NextResponse } from "next/server";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { fetchFreeVinDetails } from "@/lib/free-vin-details";
import { checkRateLimit } from "@/lib/rate-limit";
import { decodeVin } from "@/lib/vin-decode";

export const runtime = "nodejs";
export const maxDuration = 20;

/** NHTSA ir bez maksas, bet aizsargājam pret skreiperiem: 20 / 10 min un 100 / dienā no IP. */
const BURST_MAX = 20;
const BURST_WINDOW_MS = 10 * 60 * 1000;
const DAY_MAX = 100;
const DAY_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Publisks bezmaksas VIN dekods: lokālā WMI daļa + NHTSA vPIC (tikai Ziemeļamerikas VIN: rūpnīca, motors). */
export async function GET(req: Request) {
  const vinRaw = new URL(req.url).searchParams.get("vin") ?? "";
  const local = decodeVin(vinRaw.slice(0, 40));
  if (!local.ok) return NextResponse.json({ error: `invalid_vin_${local.error}` }, { status: 400 });

  const ip = getClientIpFromRequest(req);
  for (const [key, max, win] of [
    [`vin-dekoders-burst:${ip}`, BURST_MAX, BURST_WINDOW_MS],
    [`vin-dekoders-day:${ip}`, DAY_MAX, DAY_WINDOW_MS],
  ] as const) {
    const rl = await checkRateLimit(key, max, win);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "rate_limited", retryAfterSec: rl.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }
  }

  const details = await fetchFreeVinDetails(local);
  return NextResponse.json(
    { vin: local.vin, local, ...details },
    // NHTSA dati par VIN nemainās; CDN kešs taupa limitus un NHTSA.
    { headers: { "Cache-Control": details.vpic ? "public, s-maxage=604800, stale-while-revalidate=86400" : "no-store" } },
  );
}
