import { NextResponse } from "next/server";
import { loginB2bDemoUser } from "@/lib/b2b-demo-auth";
import { bootstrapFirstB2bDemoTenant } from "@/lib/b2b-demo-seed";
import { isUsableB2bDemoPassword } from "@/lib/b2b-demo-users";
import { getClientIpFromRequest } from "@/lib/client-ip";
import { isValidOrderEmail } from "@/lib/order-field-validation";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = getClientIpFromRequest(req);
  const limited = await checkRateLimit(`b2b-demo-bootstrap:${ip}`, 5, 15 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Pārāk daudz mēģinājumu." }, { status: 429 });
  }

  let body: { email?: string; password?: string; companyName?: string; ownerName?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Nederīgs pieprasījums." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
  const ownerName = typeof body.ownerName === "string" ? body.ownerName.trim() : "";
  if (!isValidOrderEmail(email) || !isUsableB2bDemoPassword(password) || !companyName) {
    return NextResponse.json({ error: "Nepieciešams e-pasts, parole (min. 8) un uzņēmuma nosaukums." }, { status: 400 });
  }

  try {
    await bootstrapFirstB2bDemoTenant({
      email,
      password,
      companyName,
      ownerName: ownerName || email,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Neizdevās izveidot dīleri." }, { status: 400 });
  }

  const login = await loginB2bDemoUser(email, password);
  if (!login.ok) {
    return NextResponse.json({ error: login.error }, { status: 401 });
  }
  return NextResponse.json({ ok: true, tenantId: login.session.tenantId, role: login.session.role });
}
