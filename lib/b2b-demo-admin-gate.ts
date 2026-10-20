import "server-only";

import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { B2B_DEMO_ADMIN_SECRET_HEADER, verifyB2bDemoAdminSecret } from "@/lib/b2b-demo-admin-secret";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/rate-limit";

export async function requireB2bDemoPlatformAdmin(
  req: Request,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  if (await getAdminSession()) return { ok: true };

  const header = req.headers.get(B2B_DEMO_ADMIN_SECRET_HEADER);
  if (header) {
    const ip = getClientIpFromRequest(req);
    const limited = await checkRateLimit(`b2b-demo-admin:${ip}`, 20, 15 * 60 * 1000);
    if (!limited.ok) {
      return { ok: false, response: NextResponse.json({ error: "Pārāk daudz mēģinājumu." }, { status: 429 }) };
    }
    if (verifyB2bDemoAdminSecret(header)) return { ok: true };
  }

  return {
    ok: false,
    response: NextResponse.json({ error: "Nepieciešama administratora piekļuve." }, { status: 401 }),
  };
}
