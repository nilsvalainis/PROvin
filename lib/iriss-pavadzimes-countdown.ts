export type WaybillCountdownStatus = "ok" | "soon" | "expired";

export type WaybillCountdown = {
  label: string;
  status: WaybillCountdownStatus;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function rigaYmd(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Riga",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function waybillCountdownStatus(validUntilIso: string, now = new Date()): WaybillCountdownStatus {
  const untilMs = Date.parse(validUntilIso);
  if (!Number.isFinite(untilMs)) return "expired";
  const remaining = untilMs - now.getTime();
  if (remaining <= 0) return "expired";
  if (remaining < DAY_MS || rigaYmd(new Date(untilMs)) === rigaYmd(now)) return "soon";
  return "ok";
}

/** LIVE atskaite: `HH:MM:SS` ja <24h, `Nd HH:MM` ja >=24h, `beigusies` ja beidzies. */
export function formatWaybillCountdown(validUntilIso: string, now = new Date()): WaybillCountdown {
  const status = waybillCountdownStatus(validUntilIso, now);
  if (status === "expired") return { label: "beigusies", status };
  const untilMs = Date.parse(validUntilIso);
  const remaining = Math.max(0, untilMs - now.getTime());
  const totalSec = Math.floor(remaining / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days >= 1) return { label: `${days}d ${pad2(hours)}:${pad2(mins)}`, status };
  return { label: `${pad2(hours)}:${pad2(mins)}:${pad2(secs)}`, status };
}

const EXPIRY_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Riga",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** `DD.MM HH:mm` Europe/Riga. */
export function formatWaybillExpiryDdMmHm(iso: string): string {
  const d = new Date(iso);
  if (!iso.trim() || Number.isNaN(d.getTime())) return "";
  const p = Object.fromEntries(
    EXPIRY_PARTS.formatToParts(d)
      .filter((x) => x.type !== "literal")
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return `${p.day}.${p.month} ${p.hour}:${p.minute}`;
}

/** Atlikušā derīguma daļa (izdošana → beigas), 0..1. */
export function waybillRemainingShare(issuedAt: string, validUntil: string, now = new Date()): number {
  const end = Date.parse(validUntil);
  if (!Number.isFinite(end)) return 0;
  const start = Date.parse(issuedAt);
  const span = Number.isFinite(start) && end > start ? end - start : DAY_MS;
  const remaining = end - now.getTime();
  if (remaining <= 0) return 0;
  return Math.min(1, remaining / span);
}

export type LvTransitPlateParts = {
  letter: string;
  digits: string;
  last: string;
};

/** `B193-7` / `B 193-7` → burts, trīs cipari, pēdējais cipars. */
export function parseLvTransitPlate(raw: string): LvTransitPlateParts | null {
  const compact = raw.trim().toUpperCase().replace(/\s+/g, "");
  const m = compact.match(/^([A-Z])(\d{3})-(\d)$/);
  if (!m) return null;
  return { letter: m[1]!, digits: m[2]!, last: m[3]! };
}

export const WAYBILL_COUNTDOWN_TEXT: Record<WaybillCountdownStatus, string> = {
  ok: "text-[#15803d]",
  soon: "text-[#c2410c]",
  expired: "text-[#b91c1c]",
};

export const WAYBILL_PROGRESS_FILL: Record<WaybillCountdownStatus, string> = {
  ok: "bg-[#22c55e]",
  soon: "bg-[#f97316]",
  expired: "bg-[#ef4444]",
};
