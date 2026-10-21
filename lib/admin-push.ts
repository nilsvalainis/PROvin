/**
 * Sūta web push uz admin ierīcēm. Bez VAPID atslēgām (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY) klusi neko nedara.
 * Kļūda nekad neaptur galveno darbību (pasūtījumu, e-pastu).
 */
import "server-only";

import { listAdminPushSubscriptions, removeAdminPushSubscriptions } from "@/lib/admin-push-store";
import { safeAdminPushUrl, type AdminPushMessage } from "@/lib/admin-push-shared";

export function adminPushPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
}

export function isAdminPushConfigured(): boolean {
  return Boolean(adminPushPublicKey() && process.env.VAPID_PRIVATE_KEY?.trim());
}

/** PRO notikumi tikai adminam. IRISS notikumi visiem, kam ir abonements. */
function audienceAllows(userKey: string, audience: AdminPushMessage["audience"]): boolean {
  return audience === "pro" ? userKey === "admin" : true;
}

/** onlyUserKey: tikai šī lietotāja ierīces (pārbaudes paziņojumam). */
export async function sendAdminPush(msg: AdminPushMessage, onlyUserKey?: string): Promise<{ sent: number; removed: number }> {
  if (!isAdminPushConfigured()) return { sent: 0, removed: 0 };
  try {
    const webpush = (await import("web-push")).default;
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT?.trim() || "mailto:info@provin.lv",
      adminPushPublicKey(),
      process.env.VAPID_PRIVATE_KEY!.trim(),
    );
    const subs = (await listAdminPushSubscriptions()).filter((s) =>
      onlyUserKey ? s.userKey === onlyUserKey : audienceAllows(s.userKey, msg.audience),
    );
    const payload = JSON.stringify({ title: msg.title, body: msg.body, url: safeAdminPushUrl(msg.url), tag: msg.tag });
    const gone: string[] = [];
    let sent = 0;
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload, { TTL: 6 * 3600, urgency: "high" });
          sent += 1;
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) gone.push(s.endpoint);
        }
      }),
    );
    await removeAdminPushSubscriptions(gone).catch(() => undefined);
    return { sent, removed: gone.length };
  } catch (e) {
    console.error("[admin-push] send failed", e);
    return { sent: 0, removed: 0 };
  }
}
