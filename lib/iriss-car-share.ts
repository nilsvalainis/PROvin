/**
 * IRISS publiskā auto saite bez cenas + šķērssaites Autoparks / Loģistika / Pasūtījums.
 * Admin saišu UI un klienta lapa nekad neredz EUR. Kanons: makets A (26.10.2026).
 */

export const IRISS_CAR_SHARE_PATH_PREFIX = "/a";
export const IRISS_CAR_SHARE_BADGE = "Bez cenas";
export const IRISS_CAR_SHARE_CREATED_NOTE =
  "Klients redz auto, foto un pamatdatus. Cena netiek iekļauta.";
export const IRISS_CAR_SHARE_PUBLIC_BRAND = "Dzintarzeme Auto";
export const IRISS_CAR_SHARE_PUBLIC_LEGAL = "SIA ĪRISS";

export const IRISS_CAR_SHARE_STATUS_LV = {
  created: "Saite izveidota",
  sent: "Nosūtīts",
} as const;

export type IrissCarShareStatus = keyof typeof IRISS_CAR_SHARE_STATUS_LV;
export type IrissCarShareChannel = "whatsapp";
export type IrissSaitesKind = "logistika" | "autoparks" | "pasutijums";

const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;
const EURO_RE = /\b(?:€|eur)\b|\d[\d\s]*,\d{2}\s*€/i;

export type IrissSaitesCrossLink = {
  kind: IrissSaitesKind;
  href: string;
  title: string;
  subtitle: string;
};

export type IrissCarShareAdminView = {
  status: IrissCarShareStatus;
  statusLabel: string;
  badge: typeof IRISS_CAR_SHARE_BADGE;
  path: string;
  displayUrl: string;
  note: string;
  token: string;
};

export type IrissSaitesView = {
  crossLinks: IrissSaitesCrossLink[];
  share: IrissCarShareAdminView | null;
  phone: string;
};

export type IrissCarSharePublicView = {
  brand: typeof IRISS_CAR_SHARE_PUBLIC_BRAND;
  legalName: typeof IRISS_CAR_SHARE_PUBLIC_LEGAL;
  title: string;
  year: string;
  color: string;
  vin: string;
  mileage: string;
  hasPhoto: boolean;
};

export function isIrissCarSharePath(pathname: string): boolean {
  return pathname === IRISS_CAR_SHARE_PATH_PREFIX || pathname.startsWith(`${IRISS_CAR_SHARE_PATH_PREFIX}/`);
}

export function irissCarSharePublicPath(token: string): string {
  return `${IRISS_CAR_SHARE_PATH_PREFIX}/${token.trim()}`;
}

export function irissCarShareAbsoluteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}${irissCarSharePublicPath(token)}`;
}

export function isSafeIrissCarShareToken(token: string): boolean {
  const t = token.trim();
  if (!TOKEN_RE.test(t)) return false;
  if (t.includes("..")) return false;
  return true;
}

export function irissCarShareStatusLabel(status: IrissCarShareStatus): string {
  return IRISS_CAR_SHARE_STATUS_LV[status];
}

export function formatIrissCarShareDisplayUrl(origin: string, token: string): string {
  let host = "iriss.lv";
  try {
    const u = new URL(origin.includes("://") ? origin : `https://${origin}`);
    host = u.hostname.replace(/^www\./, "");
  } catch {
    host = origin.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || "iriss.lv";
  }
  return `${host}${irissCarSharePublicPath(token)}`;
}

const RIGA_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Riga",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const RIGA_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Riga",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatIrissCarShareSentNote(opts: {
  clientName: string;
  sentAt: string;
  channel?: IrissCarShareChannel;
  nowMs?: number;
}): string {
  const t = Date.parse(opts.sentAt);
  if (!opts.sentAt.trim() || !Number.isFinite(t)) return "";
  const now = opts.nowMs ?? Date.now();
  const sameDay = RIGA_DAY.format(new Date(t)) === RIGA_DAY.format(new Date(now));
  const parts = RIGA_PARTS.formatToParts(new Date(t));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const clock = `${get("hour")}:${get("minute")}`;
  const when = sameDay ? `šodien ${clock}` : `${get("day")}.${get("month")} ${clock}`;
  const name = opts.clientName.replace(/\s+/g, " ").trim();
  const channel = opts.channel === "whatsapp" ? "WhatsApp" : "";
  return [name, when, channel].filter(Boolean).join(" · ");
}

export function irissCarShareNote(opts: {
  status: IrissCarShareStatus;
  clientName?: string;
  sentAt?: string;
  channel?: IrissCarShareChannel;
  nowMs?: number;
}): string {
  if (opts.status === "sent") {
    const sent = formatIrissCarShareSentNote({
      clientName: opts.clientName ?? "",
      sentAt: opts.sentAt ?? "",
      channel: opts.channel,
      nowMs: opts.nowMs,
    });
    if (sent) return sent;
  }
  return IRISS_CAR_SHARE_CREATED_NOTE;
}

export function buildIrissCarShareAdminView(opts: {
  token: string;
  status: IrissCarShareStatus;
  origin: string;
  clientName?: string;
  sentAt?: string;
  channel?: IrissCarShareChannel;
  nowMs?: number;
}): IrissCarShareAdminView {
  return {
    status: opts.status,
    statusLabel: irissCarShareStatusLabel(opts.status),
    badge: IRISS_CAR_SHARE_BADGE,
    path: irissCarSharePublicPath(opts.token),
    displayUrl: formatIrissCarShareDisplayUrl(opts.origin, opts.token),
    note: irissCarShareNote(opts),
    token: opts.token,
  };
}

export function buildIrissCarShareMessage(opts: { url: string; vehicle: string }): string {
  const vehicle = opts.vehicle.replace(/\s+/g, " ").trim().slice(0, 160);
  return [vehicle, "", opts.url].filter((line, i) => line || i === 1).join("\n").trim();
}

export function buildIrissCarShareWhatsAppUrl(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  const encoded = encodeURIComponent(text);
  if (digits.length >= 8) return `https://wa.me/${digits}?text=${encoded}`;
  return `https://wa.me/?text=${encoded}`;
}

export function saitesCrossLinkTitle(kind: IrissSaitesKind): string {
  if (kind === "logistika") return "Loģistika";
  if (kind === "autoparks") return "Autoparks";
  return "Pasūtījums";
}

export function formatSaitesDotLine(parts: Array<string | null | undefined>): string {
  return parts.map((p) => (p ?? "").replace(/\s+/g, " ").trim()).filter(Boolean).join(" · ");
}

const LOGISTICS_STATUS_SHORT: Record<string, string> = {
  in_transit_to_warehouse: "Ceļā",
  waiting_transport: "Ceļā",
  scheduled: "Ceļā",
  pickup_confirmed: "Ceļā",
  ready_for_pickup: "Gatavs",
  ready: "Gatavs",
  picked_up: "Izņemts",
  delivered: "Piegādāts",
};

export function logisticsSaitesStatusShort(status: string, fallback = ""): string {
  return LOGISTICS_STATUS_SHORT[status] || fallback;
}

export function logisticsSaitesCity(address: string, snapshotCity?: string): string {
  const city = (snapshotCity ?? "").trim();
  if (city) return city;
  const first = address.split(",")[0]?.trim() ?? "";
  return first.slice(0, 40);
}

export function formatPasutijumsSaitesSubtitle(clientFirstName: string, offerTitle: string): string {
  return formatSaitesDotLine([clientFirstName.trim(), offerTitle.trim() || "Piedāvājums 1"]);
}

export function autoparksSaitesHref(carId: string): string {
  return `/admin/iriss/autoparks-v2/${encodeURIComponent(carId)}`;
}

export function logistikaSaitesHref(orderId: string): string {
  return `/admin/iriss/logistika?car=${encodeURIComponent(orderId)}`;
}

export function pasutijumsSaitesHref(orderId: string): string {
  return `/admin/iriss/pasutijumi/${encodeURIComponent(orderId)}`;
}

export function carShareTextHasPrice(text: string): boolean {
  return EURO_RE.test(text);
}

export function assertCarShareViewHasNoPrice(view: IrissSaitesView | IrissCarSharePublicView | IrissCarShareAdminView): boolean {
  return !carShareTextHasPrice(JSON.stringify(view));
}
