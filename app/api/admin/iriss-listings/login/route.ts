import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { handleIrissListingsLogin, parseIrissLoginRequest } from "@/lib/iriss-listings-login";

export const runtime = "nodejs";
/** close + sesijas pārbaude + 1 lapas testa nolasījums. */
export const maxDuration = 180;

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Nederīgs JSON." }, { status: 400 });
  }
  const parsed = parseIrissLoginRequest(raw);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const out = await handleIrissListingsLogin(parsed);
    return NextResponse.json(out.body, { status: out.status });
  } catch (e) {
    return NextResponse.json(
      { error: "login_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
