import { NextResponse } from "next/server";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { VIN_CHECK_CTAS, VIN_CHECK_SOURCES, type VinCheckCta, type VinCheckSource } from "@/lib/vin-check-stats";
import { recordVinCheckEvent } from "@/lib/vin-check-stats-store";

export const runtime = "nodejs";
export const maxDuration = 10;

/** VIN dekodera CTA klikšķi (konversijai statistikā). Tikai skaitītājs, bez VIN. */
export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const rl = await checkRateLimit(`vin-dekoders-event:${ip}`, 30, 10 * 60 * 1000);
  if (!rl.ok) return new NextResponse(null, { status: 204 });
  let body: { cta?: unknown; src?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const cta = (VIN_CHECK_CTAS as readonly string[]).includes(String(body.cta)) ? (body.cta as VinCheckCta) : null;
  const source = (VIN_CHECK_SOURCES as readonly string[]).includes(String(body.src)) ? (body.src as VinCheckSource) : "direct";
  if (cta) await recordVinCheckEvent({ type: "cta", cta, source });
  return new NextResponse(null, { status: 204 });
}
