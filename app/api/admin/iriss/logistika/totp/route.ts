import { NextResponse } from "next/server";
import { requireLogisticsApi } from "@/lib/staff-auth";
import { confirmStaffTotp, findStaffUserById, setStaffTotpSecret } from "@/lib/staff-store";
import { generateTotpSecret, totpAuthUrl, verifyTotpCode } from "@/lib/staff-totp";
import { getClientIpFromRequest } from "@/lib/client-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Loģistikas lietotājs pats var ieslēgt 2FA. Admin to dara no lietotāju lapas. */
export async function POST(req: Request) {
  const gate = await requireLogisticsApi();
  if (!gate.ok) return gate.response;
  if (gate.actor.kind !== "staff") {
    return NextResponse.json({ error: "2FA šeit ieslēdz pats lietotājs." }, { status: 400 });
  }
  let body: { action?: string; code?: string };
  try {
    body = (await req.json()) as { action?: string; code?: string };
  } catch {
    return NextResponse.json({ error: "Nederīgs pieprasījums" }, { status: 400 });
  }
  const userId = gate.actor.user.id;
  if (body.action === "start") {
    const secret = generateTotpSecret();
    await setStaffTotpSecret(userId, secret);
    return NextResponse.json({
      ok: true,
      secret,
      otpauth: totpAuthUrl({ secret, account: gate.actor.user.email, issuer: "IRISS" }),
    });
  }
  if (body.action === "confirm") {
    const user = await findStaffUserById(userId);
    if (!user?.totpSecret || !verifyTotpCode(user.totpSecret, typeof body.code === "string" ? body.code : "")) {
      return NextResponse.json({ error: "Nepareizs 2FA kods" }, { status: 401 });
    }
    await confirmStaffTotp({
      userId,
      actorId: userId,
      ip: getClientIpFromRequest(req),
      userAgent: req.headers.get("user-agent") ?? "",
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Nederīga darbība" }, { status: 400 });
}
