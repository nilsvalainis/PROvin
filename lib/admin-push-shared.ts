/**
 * Web push paziņojumi admin lietotnei (iPhone: pievienota sākuma ekrānam, iOS 16.4+).
 * Teksti bez klienta e-pasta un tālruņa, jo redzami bloķētajā ekrānā.
 */

export type AdminPushAudience = "pro" | "iriss";

export type AdminPushMessage = {
  title: string;
  body: string;
  /** Kur atvērt pēc pieskāriena (tikai /admin/...). */
  url: string;
  /** Vienāds tag aizstāj iepriekšējo paziņojumu, nevis krāj. */
  tag: string;
  audience: AdminPushAudience;
};

export type AdminPushSubscriptionRecord = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userKey: string;
  createdAt: string;
};

/** Pēdējās 6 VIN zīmes, pietiek atpazīt, bet neizpauž visu. */
export function pushVinTail(vin: string | null | undefined): string {
  const v = (vin ?? "").trim().toUpperCase();
  return v.length >= 6 ? `…${v.slice(-6)}` : v;
}

export function adminPushNewOrderMessage(p: { sessionId: string; vin: string | null; amountTotal: string | null; currency: string | null }): AdminPushMessage {
  const amount = p.amountTotal ? ` · ${p.amountTotal} ${p.currency === "EUR" || !p.currency ? "€" : p.currency}` : "";
  const vin = pushVinTail(p.vin);
  return {
    title: "Jauns pasūtījums",
    body: `${vin ? `VIN ${vin}` : "Bez VIN"}${amount}`,
    url: `/admin/orders/${encodeURIComponent(p.sessionId)}`,
    tag: `order-${p.sessionId}`,
    audience: "pro",
  };
}

export function adminPushQuickEvalMessage(p: { id: string; vin: string | null }): AdminPushMessage {
  const vin = pushVinTail(p.vin);
  return {
    title: "Jauns ātrais vērtējums",
    body: vin ? `VIN ${vin} gaida atbildi` : "Sludinājums gaida atbildi",
    url: "/admin/atras-vertesanas",
    tag: `peek-${p.id}`,
    audience: "pro",
  };
}

export function adminPushSlaMessage(p: { sessionId: string; vin: string | null; remainingLabel: string }): AdminPushMessage {
  const vin = pushVinTail(p.vin);
  return {
    title: "Audita termiņš tuvojas",
    body: `${p.remainingLabel} atlicis${vin ? ` · VIN ${vin}` : ""}`,
    url: `/admin/orders/${encodeURIComponent(p.sessionId)}`,
    tag: `sla-${p.sessionId}`,
    audience: "pro",
  };
}

export function adminPushMorningMessage(c: { open: number; urgent: number; overdue: number; newPeeksLast24h: number }): AdminPushMessage {
  const parts = [`${c.open} atvērti`];
  if (c.urgent) parts.push(`${c.urgent} steidzami`);
  if (c.overdue) parts.push(`${c.overdue} nokavēti`);
  if (c.newPeeksLast24h) parts.push(`${c.newPeeksLast24h} jauni ātrie`);
  return {
    title: "Rīta kopsavilkums",
    body: parts.join(" · "),
    url: "/admin/kopsavilkums",
    tag: "morning-summary",
    audience: "pro",
  };
}

/** Tikai admin iekšējās adreses, lai paziņojums nevar aizvest citur. */
export function safeAdminPushUrl(url: string): string {
  return /^\/admin(\/|$)/.test(url) && !url.startsWith("//") ? url : "/admin";
}
