import { NextResponse } from "next/server";
import { getAdminOrStaffActor } from "@/lib/staff-auth";
import { adminPushPublicKey, isAdminPushConfigured, sendAdminPush } from "@/lib/admin-push";
import {
  adminPushUserKey,
  isAdminPushStoreEnabled,
  removeAdminPushSubscriptions,
  saveAdminPushSubscription,
} from "@/lib/admin-push-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Vai push ieslēgts serverī un publiskā VAPID atslēga abonēšanai. */
export async function GET() {
  const actor = await getAdminOrStaffActor();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const ready = isAdminPushConfigured() && isAdminPushStoreEnabled();
  return NextResponse.json({ configured: ready, publicKey: ready ? adminPushPublicKey() : "" });
}

/** { subscription } saglabā šo ierīci; { test: true } nosūta pārbaudes paziņojumu. */
export async function POST(req: Request) {
  const actor = await getAdminOrStaffActor();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdminPushConfigured() || !isAdminPushStoreEnabled()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as {
    subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
    test?: unknown;
  } | null;
  const userKey = adminPushUserKey(actor);
  if (body?.test === true) {
    const r = await sendAdminPush({
      title: "PROVIN",
      body: "Paziņojumi šajā ierīcē strādā",
      url: "/admin/pro",
      tag: "test",
      audience: userKey === "admin" ? "pro" : "iriss",
    }, userKey);
    return NextResponse.json({ ok: true, sent: r.sent });
  }
  const s = body?.subscription;
  const endpoint = typeof s?.endpoint === "string" ? s.endpoint : "";
  const p256dh = typeof s?.keys?.p256dh === "string" ? s.keys.p256dh : "";
  const auth = typeof s?.keys?.auth === "string" ? s.keys.auth : "";
  if (!endpoint.startsWith("https://") || !p256dh || !auth) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  }
  await saveAdminPushSubscription({ endpoint, keys: { p256dh, auth }, userKey, createdAt: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const actor = await getAdminOrStaffActor();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  if (endpoint) await removeAdminPushSubscriptions([endpoint], adminPushUserKey(actor)).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
