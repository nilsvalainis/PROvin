import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { normalizeAdSpendInput, parseAdSpendCsv } from "@/lib/admin-ad-spend";
import { addAdSpendRows, deleteAdSpendRow, readAdSpendRows } from "@/lib/admin-ad-spend-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await readAdSpendRows();
  return NextResponse.json({ rows });
}

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  if (typeof body.csv === "string") {
    const parsed = parseAdSpendCsv(body.csv);
    if (parsed.rows.length === 0) {
      return NextResponse.json({ error: parsed.errors[0] ?? "Tukšs CSV.", errors: parsed.errors }, { status: 400 });
    }
    const rows = await addAdSpendRows(parsed.rows);
    return NextResponse.json({ rows, imported: parsed.rows.length, errors: parsed.errors });
  }
  const row = normalizeAdSpendInput(body);
  if (!row) return NextResponse.json({ error: "Nederīgi izdevumu lauki." }, { status: 400 });
  const rows = await addAdSpendRows([row]);
  return NextResponse.json({ rows });
}

export async function DELETE(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const rows = await deleteAdSpendRow(id);
  return NextResponse.json({ rows });
}
