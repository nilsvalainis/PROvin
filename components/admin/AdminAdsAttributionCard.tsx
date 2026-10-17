"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import {
  AD_CHANNEL_LABELS_LV,
  AD_PAID_CHANNELS,
  type AdPaidChannel,
} from "@/lib/ad-attribution";
import {
  adsRoasTone,
  computeAdsAttributionStats,
  formatAdsCents,
  formatAdsEur,
  formatAdsRoas,
  formatAdsRoasExplain,
  type AdsAttributionOrder,
  type AdsMetricRow,
} from "@/lib/admin-ad-attribution-stats";
import { AD_SPEND_CSV_TEMPLATE, type AdSpendProduct, type AdSpendRow } from "@/lib/admin-ad-spend";
import { HEARD_ABOUT_PERIODS, type HeardAboutPeriod } from "@/lib/admin-heard-about-stats";
import { emptyAdVisitDoc, type AdVisitDoc } from "@/lib/admin-ad-visits";

const toneClass: Record<ReturnType<typeof adsRoasTone>, string> = {
  green: "text-emerald-700",
  amber: "text-amber-700",
  red: "text-red-700",
  muted: "text-[#8e8e93]",
};

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5" title={hint}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">{label}</p>
      <p className="mt-1 text-[1.05rem] font-semibold tabular-nums leading-none text-[var(--color-apple-text)]">{value}</p>
      <p className="mt-1.5 text-[11px] leading-snug text-[var(--color-provin-muted)]">{hint}</p>
    </div>
  );
}

function MetricCells({ row }: { row: AdsMetricRow }) {
  return (
    <>
      <span className="w-16 shrink-0 text-right tabular-nums text-[12px]">{formatAdsEur(row.spendEur)}</span>
      <span className="w-10 shrink-0 text-right tabular-nums text-[12px]">{row.orders}</span>
      <span className="w-16 shrink-0 text-right tabular-nums text-[12px]">{formatAdsCents(row.revenueCents)}</span>
      <span className={`w-14 shrink-0 text-right tabular-nums text-[12px] ${toneClass[row.tone]}`}>
        {row.roas == null ? "nav datu" : formatAdsRoas(row.roas)}
      </span>
      <span className="hidden w-14 shrink-0 text-right tabular-nums text-[12px] text-[#8e8e93] sm:block">
        {row.conversionRatePct == null ? "nav datu" : `${row.conversionRatePct.toLocaleString("lv-LV", { maximumFractionDigits: 1 })}%`}
      </span>
    </>
  );
}

export function AdminAdsAttributionCard({
  orders,
  initialSpend,
  visits,
  nowSec,
}: {
  orders: AdsAttributionOrder[];
  initialSpend: AdSpendRow[];
  visits: AdVisitDoc;
  nowSec: number;
}) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<HeardAboutPeriod>("30");
  const [product, setProduct] = useState<AdSpendProduct>("provin");
  const [spend, setSpend] = useState(initialSpend);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    dateEnd: new Date().toISOString().slice(0, 10),
    channel: "google" as AdPaidChannel,
    campaign: "",
    spendEur: "",
  });

  const stats = useMemo(
    () => computeAdsAttributionStats({ orders, spend, visits: visits ?? emptyAdVisitDoc(), period, nowSec, product }),
    [orders, spend, visits, period, nowSec, product],
  );
  const spendForProduct = spend.filter((s) => s.product === product);
  const maxTrend = Math.max(1, ...stats.trend.map((t) => Math.max(t.spendEur, t.revenueCents / 100)));

  async function refresh(next: AdSpendRow[]) {
    setSpend(next);
  }

  async function postSpend(body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ad-spend", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { rows?: AdSpendRow[]; error?: string };
      if (!res.ok || !data.rows) throw new Error(data.error || "Neizdevās saglabāt.");
      await refresh(data.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Neizdevās saglabāt.");
    } finally {
      setBusy(false);
    }
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    await postSpend({
      date: form.date,
      dateEnd: form.dateEnd,
      product,
      channel: form.channel,
      campaign: form.campaign,
      spendEur: form.spendEur,
    });
  }

  async function onCsv(file: File | null) {
    if (!file) return;
    const text = await file.text();
    await postSpend({ csv: text });
  }

  async function onDelete(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ad-spend?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json()) as { rows?: AdSpendRow[]; error?: string };
      if (!res.ok || !data.rows) throw new Error(data.error || "Neizdevās dzēst.");
      await refresh(data.rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Neizdevās dzēst.");
    } finally {
      setBusy(false);
    }
  }

  const exportHref = `/api/admin/ad-attribution/export?period=${period}&product=${product}`;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 p-5 text-left sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-provin-muted)]">Reklāmas</p>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-apple-text)]">Iztērēts pret pasūtījumiem</h2>
          <p className="mt-0.5 truncate text-[12.5px] text-[var(--color-provin-muted)]">
            {stats.navDatu
              ? "IRISS: nav datu"
              : stats.empty
                ? "Vēl nav datu šajā periodā"
                : `${formatAdsEur(stats.spendEur)} · ${stats.attributedCount} pasūtījumi · ${formatAdsRoasExplain(stats.roas)}`}
          </p>
        </div>
        <p className="text-[2rem] font-semibold leading-none tabular-nums text-[var(--color-apple-text)]">
          {stats.empty || stats.navDatu ? "-" : formatAdsRoas(stats.roas).replace("×", "")}
        </p>
        <ChevronDown className={`h-5 w-5 shrink-0 text-[#8e8e93] transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open ? (
        <div className="border-t border-slate-100 px-5 pb-5 pt-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-[9px] bg-[#e9e9ee] p-[2px]" role="tablist" aria-label="Periods">
              {HEARD_ABOUT_PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={period === p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`h-7 rounded-[7px] px-3 text-[12.5px] ${period === p.id ? "bg-white font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "font-medium text-[#3a3a3c]"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="inline-flex rounded-[9px] bg-[#e9e9ee] p-[2px]" role="tablist" aria-label="Produkts">
              {(
                [
                  ["provin", "provin.lv"],
                  ["iriss", "IRISS"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={product === id}
                  onClick={() => setProduct(id)}
                  className={`h-7 rounded-[7px] px-3 text-[12.5px] ${product === id ? "bg-white font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "font-medium text-[#3a3a3c]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <a href={exportHref} className="ml-auto text-[12.5px] font-medium text-[var(--color-provin-accent)] hover:underline">
              Lejupielādēt CSV
            </a>
          </div>

          {stats.navDatu ? (
            <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-[13px] text-[var(--color-provin-muted)]">
              {stats.navDatuReason} Izdevumus var ievadīt zemāk, bet pasūtījumi, CPA un ROAS paliek „nav datu”.
            </p>
          ) : stats.empty ? (
            <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-[13px] leading-relaxed text-[var(--color-provin-muted)]">
              <p className="font-medium text-[var(--color-apple-text)]">Vēl nav ko rādīt.</p>
              <p className="mt-1">
                1) Klients piekrīt analītikai. 2) Jauna apmaksa saglabā avotu (kanāls, kampaņa, atslēgvārds). 3) Šeit
                ieraksti Google Ads / Meta / TikTok izdevumus vai ielādē CSV. Vecie pasūtījumi paliek „nav datu”.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                <Kpi label="Iztērēts" value={formatAdsEur(stats.spendEur)} hint="Cik eiro ielikti reklāmās šajā periodā." />
                <Kpi
                  label="Pasūtījumi no reklāmām"
                  value={String(stats.attributedCount)}
                  hint="Apmaksāti pasūtījumi, kuriem ir avota dati (ne „nav datu”)."
                />
                <Kpi label="Ieņēmumi" value={formatAdsCents(stats.revenueCents)} hint="Summa no pasūtījumiem ar avota datiem." />
                <Kpi
                  label="Cena par 1 pasūtījumu"
                  value={stats.cpa == null ? "nav datu" : formatAdsEur(stats.cpa)}
                  hint="CPA: iztērēts eiro dalīts ar pasūtījumiem no reklāmām."
                />
                <Kpi
                  label="Atdeve"
                  value={formatAdsRoasExplain(stats.roas)}
                  hint="ROAS. Zem 1× nozīmē, ka reklāma atmaksājas sliktāk par ieguldījumu."
                />
              </div>

              <p className="mt-4 text-[12.5px] text-[var(--color-provin-muted)]">
                Avota pārklājums: {stats.attributedCount} no {stats.orderCount} jaunajiem / skaitītajiem pasūtījumiem
                {stats.coveragePct != null
                  ? ` (${stats.coveragePct.toLocaleString("lv-LV", { maximumFractionDigits: 0 })}%)`
                  : ""}
                . {stats.unattributedCount} rāda „nav datu” (veci pasūtījumi vai nav piekrišanas). Konversija no
                apmeklējuma:{" "}
                {stats.conversionRatePct == null
                  ? "nav datu"
                  : `${stats.conversionRatePct.toLocaleString("lv-LV", { maximumFractionDigits: 1 })}%`}{" "}
                ({stats.visits} piekrituši apmeklējumi).
              </p>

              {stats.trend.length > 0 ? (
                <div className="mt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-provin-muted)]">
                    Nedēļas: izdevumi un ieņēmumi
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {stats.trend.map((w) => (
                      <li key={w.weekStart} className="flex items-center gap-2 text-[12px]">
                        <span className="w-24 shrink-0 tabular-nums text-[#8e8e93]">{w.label}</span>
                        <span className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#f2f2f7]">
                          <span
                            className="absolute inset-y-0 left-0 rounded-full bg-slate-400/80"
                            style={{ width: `${(w.spendEur / maxTrend) * 100}%` }}
                          />
                          <span
                            className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-provin-accent)]/80"
                            style={{ width: `${(w.revenueCents / 100 / maxTrend) * 100}%` }}
                          />
                        </span>
                        <span className="w-28 shrink-0 text-right tabular-nums text-[#8e8e93]">
                          {formatAdsEur(w.spendEur)} / {formatAdsCents(w.revenueCents)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[11px] text-[#8e8e93]">Pelēks: iztērēts. Krāsains: ieņēmumi.</p>
                </div>
              ) : null}

              <div className="mt-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-provin-muted)]">
                  Kanāli
                </p>
                <ul className="mt-2 divide-y divide-slate-100">
                  {stats.byChannel.map((row) => {
                    const on = picked === row.key;
                    return (
                      <li key={row.key}>
                        <button
                          type="button"
                          onClick={() => setPicked(on ? null : row.key)}
                          aria-expanded={on}
                          className="flex w-full items-center gap-2 py-2 text-left"
                        >
                          <ChevronRight className={`h-4 w-4 shrink-0 text-[#c7c7cc] transition ${on ? "rotate-90" : ""}`} />
                          <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{row.label}</span>
                          <MetricCells row={row} />
                        </button>
                        {on && (row.campaigns?.length ?? 0) > 0 ? (
                          <ul className="mb-2 ml-7 overflow-hidden rounded-xl bg-[#f8f8f9]">
                            {row.campaigns!.map((camp) => (
                              <li key={camp.key} className="border-b border-slate-100 last:border-b-0">
                                <div className="flex items-center gap-2 px-3 py-2">
                                  <span className="min-w-0 flex-1 truncate text-[12.5px]">{camp.label}</span>
                                  <MetricCells row={camp} />
                                </div>
                                {camp.keywords?.map((kw) => (
                                  <div key={kw.key} className="flex items-center gap-2 px-3 pb-2 pl-6 text-[12px] text-[#8e8e93]">
                                    <span className="min-w-0 flex-1 truncate">{kw.label}</span>
                                    <MetricCells row={kw} />
                                  </div>
                                ))}
                              </li>
                            ))}
                          </ul>
                        ) : on ? (
                          <p className="mb-2 ml-7 text-[12px] text-[#8e8e93]">Šim kanālam nav kampaņu rindu.</p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>

              {stats.heardCrossCheck.length > 0 ? (
                <div className="mt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-provin-muted)]">
                    Salīdzinājums ar „Kur uzzināja”
                  </p>
                  <ul className="mt-2 divide-y divide-slate-100 text-[12.5px]">
                    {stats.heardCrossCheck.map((row) => (
                      <li key={`${row.heard}-${row.tracked}-${row.match}`} className="flex gap-3 py-1.5">
                        <span className="w-24 shrink-0">{row.heard}</span>
                        <span className="min-w-0 flex-1">{row.tracked}</span>
                        <span className={row.match ? "text-emerald-700" : "text-amber-700"}>
                          {row.match ? "sakrīt" : "atšķiras"}
                        </span>
                        <span className="tabular-nums text-[#8e8e93]">{row.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}

          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-provin-muted)]">
              Izdevumu ievade
            </p>
            <form onSubmit={onAdd} className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="text-[12px]">
                No
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-[13px]"
                />
              </label>
              <label className="text-[12px]">
                Līdz
                <input
                  type="date"
                  required
                  value={form.dateEnd}
                  onChange={(e) => setForm((f) => ({ ...f, dateEnd: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-[13px]"
                />
              </label>
              <label className="text-[12px]">
                Kanāls
                <select
                  value={form.channel}
                  onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as AdPaidChannel }))}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-[13px]"
                >
                  {AD_PAID_CHANNELS.map((ch) => (
                    <option key={ch} value={ch}>
                      {AD_CHANNEL_LABELS_LV[ch]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[12px]">
                Kampaņa
                <input
                  value={form.campaign}
                  onChange={(e) => setForm((f) => ({ ...f, campaign: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-[13px]"
                  placeholder="piem. vin-audit"
                />
              </label>
              <label className="text-[12px] sm:col-span-2">
                Summa €
                <input
                  required
                  inputMode="decimal"
                  value={form.spendEur}
                  onChange={(e) => setForm((f) => ({ ...f, spendEur: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-2 text-[13px]"
                  placeholder="45.00"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="h-9 rounded-lg bg-[var(--color-apple-text)] text-[13px] font-semibold text-white disabled:opacity-50 sm:col-span-2"
              >
                Saglabāt izdevumus
              </button>
            </form>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-[12.5px]">
              <label className="font-medium text-[var(--color-provin-accent)]">
                CSV imports
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(e) => {
                    void onCsv(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
              </label>
              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(AD_SPEND_CSV_TEMPLATE)}\n`}
                download="provin-reklamas-izdevumi-paraugs.csv"
                className="text-[var(--color-provin-muted)] hover:underline"
              >
                Lejupielādēt veidni
              </a>
              <span className="text-[#8e8e93]">Kolonnas: date, channel, campaign, spend. Pēc izvēles: clicks, impressions.</span>
            </div>
            {error ? <p className="mt-2 text-[12px] text-red-700">{error}</p> : null}

            {spendForProduct.length > 0 ? (
              <ul className="mt-3 divide-y divide-slate-100 text-[12.5px]">
                {spendForProduct.map((row) => (
                  <li key={row.id} className="flex items-center gap-2 py-1.5">
                    <span className="w-36 shrink-0 tabular-nums text-[#8e8e93]">
                      {row.date}
                      {row.dateEnd !== row.date ? ` - ${row.dateEnd}` : ""}
                    </span>
                    <span className="w-20 shrink-0">{AD_CHANNEL_LABELS_LV[row.channel]}</span>
                    <span className="min-w-0 flex-1 truncate">{row.campaign || "-"}</span>
                    <span className="shrink-0 tabular-nums">{formatAdsEur(row.spendEur)}</span>
                    <button type="button" disabled={busy} onClick={() => void onDelete(row.id)} className="text-[#8e8e93] hover:text-red-700">
                      Dzēst
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
