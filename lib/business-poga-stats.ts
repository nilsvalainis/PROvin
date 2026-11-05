/**
 * PROVIN Business pogas uzskaite pa dienām (Europe/Riga): klikšķi, bloķētie klikšķi un apmaksas sākumi
 * katram partnerim un auto (VIN). Apmaksātos pirkumus ņem no Stripe (`business-partner-sales`).
 * IP un klientu dati netiek glabāti.
 */

export const BUSINESS_POGA_BLOCK_REASONS = [
  "partner",
  "disabled",
  "referer",
  "listing",
  "vin",
  "rate",
  "listing_fetch",
  "vehicle_missing",
  "forwarded",
  "store",
] as const;
export type BusinessPogaBlockReason = (typeof BUSINESS_POGA_BLOCK_REASONS)[number];

export const BUSINESS_POGA_BLOCK_LABEL: Record<BusinessPogaBlockReason, string> = {
  partner: "Nezināms vai bloķēts partneris",
  disabled: "Poga izslēgta",
  referer: "Nav no partnera vietnes",
  listing: "Sludinājums nav partnera vietnē",
  vin: "Nav VIN vai numurzīmes",
  rate: "Pārāk daudz mēģinājumu",
  listing_fetch: "Sludinājumu neizdevās nolasīt",
  vehicle_missing: "VIN nav sludinājuma lapā",
  forwarded: "Pārsūtīta saite",
  store: "Tehniska kļūda",
};

export type BusinessPogaPartnerDay = {
  clicks: number;
  started: number;
  blocked: Partial<Record<BusinessPogaBlockReason, number>>;
};

export type BusinessPogaCarDay = { partnerId: string; vin: string; title: string; clicks: number; started: number };

export type BusinessPogaDay = {
  date: string;
  partners: Record<string, BusinessPogaPartnerDay>;
  /** Atslēga `partnerId|VIN`. */
  cars: Record<string, BusinessPogaCarDay>;
};

export type BusinessPogaEvent =
  | { type: "click"; partnerId: string; vin: string; title?: string }
  | { type: "blocked"; partnerId: string; reason: BusinessPogaBlockReason; vin?: string }
  | { type: "started"; partnerId: string; vin: string };

/** Nezināmiem partneriem (viltots ID) viena kopēja atslēga, lai dati neaug bezgalīgi. */
export const UNKNOWN_PARTNER = "unknown";

const PARTNER_RE = /^ptr_[a-f0-9]{16}$/;
const VIN_KEY_RE = /^[A-Z0-9]{3,17}$/;

export function emptyBusinessPogaDay(date: string): BusinessPogaDay {
  return { date, partners: {}, cars: {} };
}

function partnerKey(id: string): string {
  return PARTNER_RE.test(id) ? id : UNKNOWN_PARTNER;
}

function n(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

export function parseBusinessPogaDay(raw: unknown, date: string): BusinessPogaDay {
  const day = emptyBusinessPogaDay(date);
  if (!raw || typeof raw !== "object") return day;
  const o = raw as Record<string, unknown>;
  const partners = o.partners && typeof o.partners === "object" ? (o.partners as Record<string, unknown>) : {};
  for (const [id, v] of Object.entries(partners)) {
    if (id !== UNKNOWN_PARTNER && !PARTNER_RE.test(id)) continue;
    const p = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    const blockedRaw = (p.blocked && typeof p.blocked === "object" ? p.blocked : {}) as Record<string, unknown>;
    const blocked: BusinessPogaPartnerDay["blocked"] = {};
    for (const r of BUSINESS_POGA_BLOCK_REASONS) if (n(blockedRaw[r])) blocked[r] = n(blockedRaw[r]);
    day.partners[id] = { clicks: n(p.clicks), started: n(p.started), blocked };
  }
  const cars = o.cars && typeof o.cars === "object" ? (o.cars as Record<string, unknown>) : {};
  for (const [key, v] of Object.entries(cars)) {
    const c = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    const partnerId = typeof c.partnerId === "string" ? c.partnerId : "";
    const vin = typeof c.vin === "string" ? c.vin : "";
    if (!PARTNER_RE.test(partnerId) || !VIN_KEY_RE.test(vin) || key !== `${partnerId}|${vin}`) continue;
    day.cars[key] = {
      partnerId,
      vin,
      title: typeof c.title === "string" ? c.title.slice(0, 120) : "",
      clicks: n(c.clicks),
      started: n(c.started),
    };
  }
  return day;
}

/** Pieskaita notikumu (nemaina oriģinālu). */
export function applyBusinessPogaEvent(day: BusinessPogaDay, e: BusinessPogaEvent): BusinessPogaDay {
  const next: BusinessPogaDay = {
    date: day.date,
    partners: { ...day.partners },
    cars: { ...day.cars },
  };
  const pid = partnerKey(e.partnerId);
  const p = next.partners[pid] ?? { clicks: 0, started: 0, blocked: {} };
  const np: BusinessPogaPartnerDay = { clicks: p.clicks, started: p.started, blocked: { ...p.blocked } };
  if (e.type === "click") np.clicks += 1;
  if (e.type === "started") np.started += 1;
  if (e.type === "blocked") np.blocked[e.reason] = (np.blocked[e.reason] ?? 0) + 1;
  next.partners[pid] = np;

  const vin = (e.vin ?? "").toUpperCase();
  if ((e.type === "click" || e.type === "started") && pid !== UNKNOWN_PARTNER && VIN_KEY_RE.test(vin)) {
    const key = `${pid}|${vin}`;
    const c = next.cars[key] ?? { partnerId: pid, vin, title: "", clicks: 0, started: 0 };
    next.cars[key] = {
      ...c,
      title: e.type === "click" && e.title ? e.title.slice(0, 120) : c.title,
      clicks: c.clicks + (e.type === "click" ? 1 : 0),
      started: c.started + (e.type === "started" ? 1 : 0),
    };
  }
  return next;
}

export type BusinessPogaSale = { partnerId: string; created: number; amountCents: number; vin: string };

export type BusinessPogaPartnerSummary = {
  partnerId: string;
  clicks: number;
  blocked: number;
  started: number;
  paid: number;
  revenueCents: number;
  /** Apmaksāti / klikšķi; null, ja klikšķu nav. */
  conversion: number | null;
};

export type BusinessPogaCarSummary = {
  partnerId: string;
  vin: string;
  title: string;
  clicks: number;
  started: number;
  paid: number;
};

export type BusinessPogaSummary = {
  totals: Omit<BusinessPogaPartnerSummary, "partnerId">;
  partners: BusinessPogaPartnerSummary[];
  blockedByReason: { reason: BusinessPogaBlockReason; count: number }[];
  cars: BusinessPogaCarSummary[];
  /** Pa dienām grafikam. */
  daily: { date: string; clicks: number; paid: number }[];
};

function rigaDateOfUnix(sec: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Riga", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(sec * 1000),
  );
}

function ratio(a: number, b: number): number | null {
  return b > 0 ? a / b : null;
}

/** Apkopo dienas un Stripe pirkumus periodā. `partnerId` - tikai vienam partnerim. */
export function summarizeBusinessPoga(
  days: BusinessPogaDay[],
  sales: BusinessPogaSale[],
  opts: { from: string; to: string; partnerId?: string },
): BusinessPogaSummary {
  const inRange = (d: string) => d >= opts.from && d <= opts.to;
  const want = (pid: string) => !opts.partnerId || pid === opts.partnerId;
  const parts = new Map<string, BusinessPogaPartnerSummary>();
  const get = (pid: string) => {
    let s = parts.get(pid);
    if (!s) {
      s = { partnerId: pid, clicks: 0, blocked: 0, started: 0, paid: 0, revenueCents: 0, conversion: null };
      parts.set(pid, s);
    }
    return s;
  };
  const reasons = new Map<BusinessPogaBlockReason, number>();
  const cars = new Map<string, BusinessPogaCarSummary>();
  const daily = new Map<string, { date: string; clicks: number; paid: number }>();

  for (const day of days) {
    if (!inRange(day.date)) continue;
    const dd = daily.get(day.date) ?? { date: day.date, clicks: 0, paid: 0 };
    for (const [pid, p] of Object.entries(day.partners)) {
      if (!want(pid)) continue;
      const s = get(pid);
      s.clicks += p.clicks;
      s.started += p.started;
      dd.clicks += p.clicks;
      for (const [r, c] of Object.entries(p.blocked) as [BusinessPogaBlockReason, number][]) {
        s.blocked += c;
        reasons.set(r, (reasons.get(r) ?? 0) + c);
      }
    }
    for (const [key, c] of Object.entries(day.cars)) {
      if (!want(c.partnerId)) continue;
      const cur = cars.get(key) ?? { partnerId: c.partnerId, vin: c.vin, title: "", clicks: 0, started: 0, paid: 0 };
      cur.clicks += c.clicks;
      cur.started += c.started;
      if (c.title) cur.title = c.title;
      cars.set(key, cur);
    }
    daily.set(day.date, dd);
  }

  for (const sale of sales) {
    const d = rigaDateOfUnix(sale.created);
    if (!inRange(d) || !want(sale.partnerId)) continue;
    const s = get(sale.partnerId);
    s.paid += 1;
    s.revenueCents += sale.amountCents;
    const dd = daily.get(d) ?? { date: d, clicks: 0, paid: 0 };
    dd.paid += 1;
    daily.set(d, dd);
    if (sale.vin) {
      const key = `${sale.partnerId}|${sale.vin.toUpperCase()}`;
      const cur = cars.get(key) ?? { partnerId: sale.partnerId, vin: sale.vin.toUpperCase(), title: "", clicks: 0, started: 0, paid: 0 };
      cur.paid += 1;
      cars.set(key, cur);
    }
  }

  const partners = [...parts.values()]
    .map((s) => ({ ...s, conversion: ratio(s.paid, s.clicks) }))
    .sort((a, b) => b.clicks - a.clicks || b.paid - a.paid);
  const totals = partners.reduce(
    (t, s) => ({
      clicks: t.clicks + s.clicks,
      blocked: t.blocked + s.blocked,
      started: t.started + s.started,
      paid: t.paid + s.paid,
      revenueCents: t.revenueCents + s.revenueCents,
      conversion: null,
    }),
    { clicks: 0, blocked: 0, started: 0, paid: 0, revenueCents: 0, conversion: null as number | null },
  );
  totals.conversion = ratio(totals.paid, totals.clicks);

  return {
    totals,
    partners,
    blockedByReason: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    cars: [...cars.values()].sort((a, b) => b.paid - a.paid || b.clicks - a.clicks),
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/** Datumi no-līdz (ieskaitot), max 400 dienas. */
export function businessPogaDateRange(from: string, to: string): string[] {
  const out: string[] = [];
  const start = Date.parse(`${from}T12:00:00Z`);
  const end = Date.parse(`${to}T12:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return out;
  for (let t = start; t <= end && out.length < 400; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}
