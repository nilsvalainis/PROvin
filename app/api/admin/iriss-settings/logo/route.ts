import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { readIrissCompanyLogoFile } from "@/lib/iriss-company-settings-store";

export const runtime = "nodejs";

export async function GET() {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const file = await readIrissCompanyLogoFile();
  if (!file) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new NextResponse(new Uint8Array(file.bytes), {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Cache-Control": "private, max-age=60",
    },
  });
}
