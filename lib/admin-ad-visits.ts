import { AD_CHANNELS, isAdChannel, type AdChannel } from "@/lib/ad-attribution";

export type AdVisitDayMap = Record<string, number>;

export type AdVisitDoc = {
  version: 1;
  updatedAt: string;
  days: Record<string, AdVisitDayMap>;
};

export type AdVisitIncrement = {
  channel: AdChannel;
  campaign: string;
  term: string;
};

export function emptyAdVisitDoc(): AdVisitDoc {
  return { version: 1, updatedAt: new Date(0).toISOString(), days: {} };
}

export function adVisitKey(channel: string, campaign?: string, term?: string): string {
  if (term && campaign) return `${channel}|${campaign}|${term}`;
  if (campaign) return `${channel}|${campaign}`;
  return channel;
}

export function parseAdVisitIncrement(raw: unknown): AdVisitIncrement | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!isAdChannel(o.channel)) return null;
  const campaign = typeof o.campaign === "string" ? o.campaign.trim().slice(0, 80) : "";
  const term = typeof o.term === "string" ? o.term.trim().slice(0, 80) : "";
  return { channel: o.channel, campaign, term };
}

export function applyAdVisitIncrement(doc: AdVisitDoc, inc: AdVisitIncrement, dayKey: string): AdVisitDoc {
  const days = { ...doc.days };
  const bucket = { ...(days[dayKey] ?? {}) };
  const bump = (key: string) => {
    bucket[key] = (bucket[key] ?? 0) + 1;
  };
  bump(adVisitKey(inc.channel));
  if (inc.campaign) bump(adVisitKey(inc.channel, inc.campaign));
  if (inc.campaign && inc.term) bump(adVisitKey(inc.channel, inc.campaign, inc.term));
  days[dayKey] = bucket;
  return { version: 1, updatedAt: new Date().toISOString(), days };
}

export function sumAdVisits(
  doc: AdVisitDoc,
  opts: { fromDay?: string; channel?: AdChannel; campaign?: string; term?: string },
): number {
  let total = 0;
  const key = opts.channel ? adVisitKey(opts.channel, opts.campaign, opts.term) : null;
  for (const [day, map] of Object.entries(doc.days)) {
    if (opts.fromDay && day < opts.fromDay) continue;
    if (key) {
      total += map[key] ?? 0;
      continue;
    }
    for (const ch of AD_CHANNELS) {
      total += map[ch] ?? 0;
    }
  }
  return total;
}

export function parseAdVisitDoc(raw: unknown): AdVisitDoc {
  if (!raw || typeof raw !== "object") return emptyAdVisitDoc();
  const o = raw as Partial<AdVisitDoc>;
  const days: Record<string, AdVisitDayMap> = {};
  if (o.days && typeof o.days === "object") {
    for (const [day, map] of Object.entries(o.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !map || typeof map !== "object") continue;
      const clean: AdVisitDayMap = {};
      for (const [k, n] of Object.entries(map)) {
        if (typeof n === "number" && Number.isFinite(n) && n > 0) clean[k] = Math.floor(n);
      }
      days[day] = clean;
    }
  }
  return {
    version: 1,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date().toISOString(),
    days,
  };
}
