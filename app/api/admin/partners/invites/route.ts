import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { b2bInviteRegisterPath } from "@/lib/b2b-partner-invite";
import { createB2bInvite, listOpenB2bInvites } from "@/lib/b2b-partner-invite-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const invites = await listOpenB2bInvites();
  return NextResponse.json({
    invites: invites.map((row) => ({
      token: row.token,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      path: b2bInviteRegisterPath(row.token),
    })),
  });
}

export async function POST() {
  const ok = await getAdminSession();
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const invite = await createB2bInvite();
  return NextResponse.json(
    {
      invite: {
        token: invite.token,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt,
        path: b2bInviteRegisterPath(invite.token),
      },
    },
    { status: 201 },
  );
}
