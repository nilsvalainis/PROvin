import { NextResponse } from "next/server";
import { acceptStaffInvite, peekStaffInvite } from "@/lib/staff-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token")?.trim() ?? "";
  if (!token) return NextResponse.json({ error: "Trūkst saites." }, { status: 400 });
  const peek = await peekStaffInvite(token);
  if (!peek) return NextResponse.json({ error: "Saite nav derīga vai ir beigusies." }, { status: 404 });
  return NextResponse.json({ ok: true, name: peek.name, email: peek.email, role: peek.role });
}

export async function POST(req: Request) {
  let body: { token?: string; password?: string };
  try {
    body = (await req.json()) as { token?: string; password?: string };
  } catch {
    return NextResponse.json({ error: "Nederīgs pieprasījums" }, { status: 400 });
  }
  const result = await acceptStaffInvite({
    token: typeof body.token === "string" ? body.token : "",
    password: typeof body.password === "string" ? body.password : "",
  });
  if (!result.ok) {
    const message =
      result.error === "weak_password"
        ? "Parolei jābūt vismaz 12 rakstzīmēm."
        : result.error === "expired"
          ? "Saite ir beigusies."
          : result.error === "used"
            ? "Saite jau ir izmantota."
            : result.error === "revoked"
              ? "Pieeja ir atsaukta."
              : "Saite nav derīga.";
    return NextResponse.json({ error: message }, { status: result.error === "weak_password" ? 400 : 404 });
  }
  return NextResponse.json({ ok: true });
}
