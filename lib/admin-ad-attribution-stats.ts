import {
  AD_CHANNEL_LABELS_LV,
  AD_CHANNELS,
  orderHasAdAttribution,
  type AdminOrderAttribution,
  type AdChannel,
} from "@/lib/ad-attribution";
import { eachIsoDateInclusive, type AdSpendProduct, type AdSpendRow } from "@/lib/admin-ad-spend";
import type { HeardAboutPeriod } from "@/lib/admin-heard-about-stats";
import { rigaCalendarDayKey } from "@/lib/admin-riga-calendar";
import { sumAdVisits, type AdVisitDoc } from "@/lib/admin-ad-visits";

export type AdsAttributionOrder = {
  id: string;
  created: number;
  amountTotal: number | null;
  isDemo?: boolean;
  isManual?: boolean;
  fulfillment?: string | null;
  heardAbout?: string | null;
  attribution?: AdminOrderAttribution | null;
};

export type AdsMetricRow = {
  key: string;
  label: string;
  channel?: AdChannel;
  spendEur: number;
  orders: number;
  revenueCents: number;
  visits: number;
  cpa: number | null;
  roas: number | null;
  conversionRatePct: number | null;
  clicks: number | null;
  tone: "green" | "amber" | "red" | "muted";
  campaigns?: AdsMetricRow[];
  keywords?: AdsMetricRow[];
};

export type AdsTrendPoint = {
  weekStart: string;
  label: string;
  spendEur: number;
  revenueCents: number;
};

export type AdsHeardCrossCheck = {
  heard: string;
  tracked: string;
  match: boolean;
  count: number;
};

export type AdsAttributionStats = {
  product: AdSpendProduct;
  period: HeardAboutPeriod;
  navDatu: boolean;
  navDatuReason: string | null;
  empty: boolean;
  spendEur: number;
  orderCount: number;
  attributedCount: number;
  unattributedCount: number;
  coveragePct: number | null;
  revenueCents: number;
  visits: number;
  conversionRatePct: number | null;
  cpa: number | null;
  roas: number | null;
  byChannel: AdsMetricRow[];
  trend: AdsTrendPoint[];
  heardCrossCheck: AdsHeardCrossCheck[];
};

function periodStartSec(period: HeardAboutPeriod, nowSec: number): number {
  if (period === "all") return Number.NEGATIVE_INFINITY;
  return nowSec - Number(period) * 86_400;
}

export function createdInAdsPeriod(createdSec: number, period: HeardAboutPeriod, nowSec: number): boolean {
  return createdSec >= periodStartSec(period, nowSec);
}

export function periodFromDay(period: HeardAboutPeriod, nowSec: number): string {
  if (period === "all") return "1970-01-01";
  return rigaCalendarDayKey((nowSec - Number(period) * 86_400) * 1000);
}

export function isCountableAdsOrder(order: AdsAttributionOrder): boolean {
  if (order.isDemo || order.isManual) return false;
  if ((order.fulfillment ?? "").trim() === "b2b_pack") return false;
  return true;
}

function ratio(num: number, den: number): number | null {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return null;
  return num / den;
}

export function adsRoasTone(roas: number | null): "green" | "amber" | "red" | "muted" {
  if (roas == null || !Number.isFinite(roas)) return "muted";
  if (roas < 1) return "red";
  if (roas < 2) return "amber";
  return "green";
}

function spendOverlaps(row: AdSpendRow, fromDay: string): boolean {
  const end = row.dateEnd || row.date;
  return end >= fromDay;
}

function rigaWeekStart(dayIso: string): string {
  const date = new Date(`${dayIso}T12:00:00.000Z`);
  const weekday = date.getUTCDay();
  const offset = weekday === 0 ? 6 : weekday - 1;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

function weekLabel(weekStart: string): string {
  const end = new Date(`${weekStart}T12:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  const a = weekStart.slice(8, 10);
  const b = end.toISOString().slice(8, 10);
  const month = weekStart.slice(5, 7);
  return `${a}.${month}.-${b}.${end.toISOString().slice(5, 7)}.`;
}

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function metric(args: {
  key: string;
  label: string;
  channel?: AdChannel;
  spendEur: number;
  orders: AdsAttributionOrder[];
  visits: number;
  clicks: number | null;
}): AdsMetricRow {
  const revenueCents = args.orders.reduce((sum, o) => sum + (typeof o.amountTotal === "number" ? o.amountTotal : 0), 0);
  const orderCount = args.orders.length;
  const roas = ratio(revenueCents / 100, args.spendEur);
  return {
    key: args.key,
    label: args.label,
    channel: args.channel,
    spendEur: args.spendEur,
    orders: orderCount,
    revenueCents,
    visits: args.visits,
    cpa: ratio(args.spendEur, orderCount),
    roas,
    conversionRatePct: ratio(orderCount * 100, args.visits),
    clicks: args.clicks,
    tone: adsRoasTone(roas),
  };
}

function heardToChannels(heard: string): AdChannel[] {
  const h = heard.trim().toLowerCase();
  if (h === "google" || h === "youtube") return ["google", "organic_google"];
  if (h === "tiktok") return ["tiktok"];
  if (h === "facebook" || h === "instagram") return ["meta"];
  if (h === "cits" || h === "other") return ["other", "direct"];
  return [];
}

export function computeAdsAttributionStats(args: {
  orders: readonly AdsAttributionOrder[];
  spend: readonly AdSpendRow[];
  visits: AdVisitDoc;
  period: HeardAboutPeriod;
  nowSec: number;
  product: AdSpendProduct;
}): AdsAttributionStats {
  const fromDay = periodFromDay(args.period, args.nowSec);
  const spendRows = args.spend.filter((s) => s.product === args.product && spendOverlaps(s, fromDay));
  const spendEur = spendRows.reduce((sum, s) => sum + s.spendEur, 0);

  if (args.product === "iriss") {
    return {
      product: "iriss",
      period: args.period,
      navDatu: true,
      navDatuReason: "IRISS pasūtījumi nav Stripe sesijas. Reklāmas piesaiste šeit nav datu.",
      empty: spendRows.length === 0,
      spendEur,
      orderCount: 0,
      attributedCount: 0,
      unattributedCount: 0,
      coveragePct: null,
      revenueCents: 0,
      visits: 0,
      conversionRatePct: null,
      cpa: null,
      roas: null,
      byChannel: [],
      trend: [],
      heardCrossCheck: [],
    };
  }

  const inPeriod = args.orders.filter(
    (o) => isCountableAdsOrder(o) && createdInAdsPeriod(o.created, args.period, args.nowSec),
  );
  const attributed = inPeriod.filter((o) => orderHasAdAttribution(o.attribution));
  const unattributedCount = inPeriod.length - attributed.length;
  const revenueCents = attributed.reduce((sum, o) => sum + (typeof o.amountTotal === "number" ? o.amountTotal : 0), 0);
  const visits = sumAdVisits(args.visits, { fromDay });

  const spendByChannel = new Map<AdChannel, { spend: number; clicks: number }>();
  const spendByCampaign = new Map<string, { spend: number; clicks: number; channel: AdChannel; label: string }>();
  const spendByKeyword = new Map<string, { spend: number; clicks: number; channel: AdChannel; campaign: string; label: string }>();
  for (const row of spendRows) {
    const ch = row.channel;
    const cur = spendByChannel.get(ch) ?? { spend: 0, clicks: 0 };
    cur.spend += row.spendEur;
    if (row.clicks != null) cur.clicks += row.clicks;
    spendByChannel.set(ch, cur);
    if (row.campaign.trim()) {
      const k = `${ch}|${norm(row.campaign)}`;
      const c = spendByCampaign.get(k) ?? { spend: 0, clicks: 0, channel: ch, label: row.campaign.trim() };
      c.spend += row.spendEur;
      if (row.clicks != null) c.clicks += row.clicks;
      spendByCampaign.set(k, c);
    }
    if (row.keyword.trim()) {
      const k = `${ch}|${norm(row.campaign)}|${norm(row.keyword)}`;
      const c = spendByKeyword.get(k) ?? {
        spend: 0,
        clicks: 0,
        channel: ch,
        campaign: row.campaign.trim(),
        label: row.keyword.trim(),
      };
      c.spend += row.spendEur;
      if (row.clicks != null) c.clicks += row.clicks;
      spendByKeyword.set(k, c);
    }
  }

  const ordersByChannel = new Map<AdChannel, AdsAttributionOrder[]>();
  const ordersByCampaign = new Map<string, AdsAttributionOrder[]>();
  const ordersByKeyword = new Map<string, AdsAttributionOrder[]>();
  for (const order of attributed) {
    const a = order.attribution!;
    const ch = a.channel ?? "direct";
    ordersByChannel.set(ch, [...(ordersByChannel.get(ch) ?? []), order]);
    if (a.campaign) {
      const k = `${ch}|${norm(a.campaign)}`;
      ordersByCampaign.set(k, [...(ordersByCampaign.get(k) ?? []), order]);
    }
    if (a.term) {
      const k = `${ch}|${norm(a.campaign)}|${norm(a.term)}`;
      ordersByKeyword.set(k, [...(ordersByKeyword.get(k) ?? []), order]);
    }
  }

  const byChannel: AdsMetricRow[] = AD_CHANNELS.map((ch) => {
    const s = spendByChannel.get(ch) ?? { spend: 0, clicks: 0 };
    const chOrders = ordersByChannel.get(ch) ?? [];
    const chVisits = sumAdVisits(args.visits, { fromDay, channel: ch });
    const row = metric({
      key: ch,
      label: AD_CHANNEL_LABELS_LV[ch],
      channel: ch,
      spendEur: s.spend,
      orders: chOrders,
      visits: chVisits,
      clicks: s.clicks > 0 ? s.clicks : null,
    });
    const campaignKeys = new Set<string>();
    for (const k of spendByCampaign.keys()) if (k.startsWith(`${ch}|`)) campaignKeys.add(k);
    for (const k of ordersByCampaign.keys()) if (k.startsWith(`${ch}|`)) campaignKeys.add(k);
    row.campaigns = [...campaignKeys]
      .map((k) => {
        const meta = spendByCampaign.get(k);
        const label = meta?.label ?? k.slice(ch.length + 1);
        const campVisits = sumAdVisits(args.visits, { fromDay, channel: ch, campaign: label });
        const camp = metric({
          key: k,
          label,
          channel: ch,
          spendEur: meta?.spend ?? 0,
          orders: ordersByCampaign.get(k) ?? [],
          visits: campVisits,
          clicks: meta && meta.clicks > 0 ? meta.clicks : null,
        });
        const kwKeys = new Set<string>();
        for (const kk of spendByKeyword.keys()) if (kk.startsWith(`${k}|`)) kwKeys.add(kk);
        for (const kk of ordersByKeyword.keys()) if (kk.startsWith(`${k}|`)) kwKeys.add(kk);
        camp.keywords = [...kwKeys]
          .map((kk) => {
            const km = spendByKeyword.get(kk);
            return metric({
              key: kk,
              label: km?.label ?? kk.split("|").slice(-1)[0] ?? kk,
              channel: ch,
              spendEur: km?.spend ?? 0,
              orders: ordersByKeyword.get(kk) ?? [],
              visits: 0,
              clicks: km && km.clicks > 0 ? km.clicks : null,
            });
          })
          .sort((a, b) => b.orders - a.orders || b.spendEur - a.spendEur);
        return camp;
      })
      .sort((a, b) => b.orders - a.orders || b.spendEur - a.spendEur);
    return row;
  }).filter(
    (row) =>
      row.orders > 0 ||
      row.spendEur > 0 ||
      row.visits > 0 ||
      row.channel === "google" ||
      row.channel === "meta" ||
      row.channel === "tiktok",
  );

  const trendMap = new Map<string, { spend: number; revenue: number }>();
  for (const row of spendRows) {
    const days = eachIsoDateInclusive(row.date, row.dateEnd || row.date);
    const share = days.length > 0 ? row.spendEur / days.length : row.spendEur;
    for (const day of days) {
      if (day < fromDay) continue;
      const week = rigaWeekStart(day);
      const cur = trendMap.get(week) ?? { spend: 0, revenue: 0 };
      cur.spend += share;
      trendMap.set(week, cur);
    }
  }
  for (const order of attributed) {
    const day = rigaCalendarDayKey(order.created * 1000);
    const week = rigaWeekStart(day);
    const cur = trendMap.get(week) ?? { spend: 0, revenue: 0 };
    cur.revenue += typeof order.amountTotal === "number" ? order.amountTotal : 0;
    trendMap.set(week, cur);
  }
  const trend = [...trendMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekStart, v]) => ({
      weekStart,
      label: weekLabel(weekStart),
      spendEur: Math.round(v.spend * 100) / 100,
      revenueCents: v.revenue,
    }));

  const cross = new Map<string, AdsHeardCrossCheck>();
  for (const order of inPeriod) {
    const heard = order.heardAbout?.trim();
    if (!heard) continue;
    const tracked = order.attribution?.channel
      ? AD_CHANNEL_LABELS_LV[order.attribution.channel]
      : "nav datu";
    const match = order.attribution?.channel
      ? heardToChannels(heard).includes(order.attribution.channel)
      : false;
    const key = `${heard}|${tracked}|${match ? 1 : 0}`;
    const cur = cross.get(key) ?? { heard, tracked, match, count: 0 };
    cur.count += 1;
    cross.set(key, cur);
  }

  const empty = spendRows.length === 0 && attributed.length === 0 && visits === 0;

  return {
    product: "provin",
    period: args.period,
    navDatu: false,
    navDatuReason: null,
    empty,
    spendEur,
    orderCount: inPeriod.length,
    attributedCount: attributed.length,
    unattributedCount,
    coveragePct: ratio(attributed.length * 100, inPeriod.length),
    revenueCents,
    visits,
    conversionRatePct: ratio(attributed.length * 100, visits),
    cpa: ratio(spendEur, attributed.length),
    roas: ratio(revenueCents / 100, spendEur),
    byChannel,
    trend,
    heardCrossCheck: [...cross.values()].sort((a, b) => b.count - a.count),
  };
}

export function formatAdsEur(amount: number | null): string {
  if (amount == null || !Number.isFinite(amount)) return "nav datu";
  return `${amount.toLocaleString("lv-LV", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function formatAdsCents(cents: number | null): string {
  if (cents == null || !Number.isFinite(cents)) return "nav datu";
  return formatAdsEur(cents / 100);
}

export function formatAdsRoas(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "nav datu";
  return `${value.toLocaleString("lv-LV", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}×`;
}

export function formatAdsRoasExplain(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "nav datu";
  const back = (value).toLocaleString("lv-LV", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${formatAdsRoas(value)} = par 1 € atgriezās ${back} €`;
}

export function adsAttributionExportCsv(stats: AdsAttributionStats, spend: readonly AdSpendRow[]): string {
  const lines = [
    "section,key,label,spend_eur,orders,revenue_eur,cpa,roas,visits,cvr_pct,clicks",
  ];
  const push = (section: string, row: AdsMetricRow) => {
    lines.push(
      [
        section,
        row.key,
        csvCell(row.label),
        row.spendEur.toFixed(2),
        String(row.orders),
        (row.revenueCents / 100).toFixed(2),
        row.cpa == null ? "" : row.cpa.toFixed(2),
        row.roas == null ? "" : row.roas.toFixed(2),
        String(row.visits),
        row.conversionRatePct == null ? "" : row.conversionRatePct.toFixed(1),
        row.clicks == null ? "" : String(row.clicks),
      ].join(","),
    );
  };
  push("kopa", {
    key: stats.product,
    label: stats.navDatu ? "nav datu" : "provin.lv",
    spendEur: stats.spendEur,
    orders: stats.attributedCount,
    revenueCents: stats.revenueCents,
    visits: stats.visits,
    cpa: stats.cpa,
    roas: stats.roas,
    conversionRatePct: stats.conversionRatePct,
    clicks: null,
    tone: "muted",
  });
  for (const ch of stats.byChannel) {
    push("channel", ch);
    for (const camp of ch.campaigns ?? []) {
      push("campaign", camp);
      for (const kw of camp.keywords ?? []) push("keyword", kw);
    }
  }
  lines.push("");
  lines.push("spend_id,date,date_end,product,channel,campaign,keyword,spend_eur,clicks,impressions");
  for (const s of spend) {
    lines.push(
      [
        s.id,
        s.date,
        s.dateEnd,
        s.product,
        s.channel,
        csvCell(s.campaign),
        csvCell(s.keyword),
        s.spendEur.toFixed(2),
        s.clicks ?? "",
        s.impressions ?? "",
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
