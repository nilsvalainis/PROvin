import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { parseListingPeekSendCommentInput } from "@/lib/listing-peek-send-comment-input";
import { sendListingPeekCustomerComment } from "@/lib/listing-peek-send-comment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const STATUS: Record<"invalid" | "smtp" | "missing" | "error", number> = {
  invalid: 400,
  smtp: 503,
  missing: 400,
  error: 502,
};

export async function POST(req: Request) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const parsed = parseListingPeekSendCommentInput(body as Record<string, unknown>);
  if (!parsed.ok) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const result = await sendListingPeekCustomerComment(parsed);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: STATUS[result.reason] });
  }
  return NextResponse.json({ ok: true });
}
