import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getClientIpFromHeaders } from "@/lib/client-ip";
import { loadIrissPdPhoto } from "@/lib/iriss-piedavajumi-photo";
import { readIrissPdByToken } from "@/lib/iriss-piedavajumi-store";
import { isSafeIrissPdToken } from "@/lib/iriss-piedavajumi-types";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hidden() {
  return new NextResponse(null, { status: 404, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
}

/** Klienta piedāvājuma bilde (tikai nosūtītam/apstiprinātam). Avota adrese netiek atklāta. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string; n: string }> }) {
  const { token, n } = await params;
  const index = Number.parseInt(n, 10);
  if (!isSafeIrissPdToken(token) || !Number.isInteger(index) || index < 0 || index > 99) return hidden();
  const rl = await checkRateLimit(`iriss-pd-foto:${getClientIpFromHeaders(await headers())}`, 600, 10 * 60 * 1000);
  if (!rl.ok) return hidden();
  const rec = await readIrissPdByToken(token);
  if (!rec || (rec.status !== "sent" && rec.status !== "approved")) return hidden();
  const size = new URL(req.url).searchParams.get("s") === "full" ? "full" : "thumb";
  const photo = await loadIrissPdPhoto(rec, index, size);
  if (!photo) return hidden();
  return new NextResponse(new Uint8Array(photo.bytes), {
    headers: {
      "Content-Type": photo.type,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
}
