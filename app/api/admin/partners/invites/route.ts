import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  adminB2bInvitePriceError,
  toAdminB2bInviteJson,
  validateB2bInvitePricingInput,
} from "@/lib/b2b-partner-invite";
import { createB2bInvite, listOpenB2bInvites } from "@/lib/b2b-partner-invite-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readInvitePricingBody(req: Request) {
  const text = await req.text();
  if (!text.trim()) return { ok: true as const, raw: {} as Record<string, unknown> };
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed == null) return { ok: true as const, raw: {} as Record<string, unknown> };
    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false as const, error: "invalid_body" };
    }
    return { ok: true as const, raw: parsed as Record<string, unknown> };
  } catch {
    return { ok: false as const, error: "invalid_body" };
  }
}

export async function GET() {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const invites = await listOpenB2bInvites();
  return NextResponse.json({
    invites: invites.map(toAdminB2bInviteJson),
  });
}

export async function POST(req: Request) {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await readInvitePricingBody(req);
  if (!body.ok) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const validation = validateB2bInvitePricingInput(body.raw);
  if (!validation.ok) {
    return NextResponse.json(
      {
        error: validation.error,
        field: validation.field,
        reason: validation.reason,
        minCents: validation.minCents,
        message: adminB2bInvitePriceError(validation),
      },
      { status: 400 },
    );
  }

  const invite = await createB2bInvite(validation.pricing);
  return NextResponse.json({ invite: toAdminB2bInviteJson(invite) }, { status: 201 });
}
