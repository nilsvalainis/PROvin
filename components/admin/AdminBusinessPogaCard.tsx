import Link from "next/link";
import { BUSINESS_POGA_BLOCK_LABEL, UNKNOWN_PARTNER } from "@/lib/business-poga-stats";
import type { BusinessPogaPeriod } from "@/lib/business-poga-period";
import type { BusinessPogaStatsView } from "@/lib/business-poga-stats-load";

/** PROVIN Business pogas statistika. Makets: docs/makets-business-poga/statistika/ (Nils «jā» 05.11.2026). */

function n(v: number): string {
  return v.toLocaleString("lv-LV");
}

function eur(cents: number): string {
  return `${(cents / 100).toLocaleString("lv-LV", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function pct(v: number | null): string {
  if (v == null) return "-";
  return `${(v * 100).toLocaleString("lv-LV", { maximumFractionDigits: 1 })}%`;
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">{label}</p>
      <p className="mt-1 text-[1.05rem] font-semibold tabular-nums leading-none text-[var(--color-apple-text)]">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-[var(--color-provin-muted)]">{hint}</p> : null}
    </div>
  );
}

const pill = "rounded-full border px-3 py-1.5 text-[12px] transition";
const pillOn = "border-[var(--color-apple-text)] bg-[var(--color-apple-text)] text-white";
const pillOff = "border-slate-200 bg-white text-[var(--color-apple-text)] hover:border-slate-300";

function PeriodBar({ period, basePath }: { period: BusinessPogaPeriod; basePath: string }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {period.kind === "month" ? (
        <span className="mr-1 inline-flex items-center gap-2 text-[12.5px] font-semibold text-[var(--color-apple-text)]">
          <Link href={`${basePath}?bp=${period.prevMonth}`} className="px-1 font-normal text-[var(--color-provin-muted)]" aria-label="Iepriekšējais mēnesis">
            ‹
          </Link>
          {period.label}
          {period.nextMonth ? (
            <Link href={`${basePath}?bp=${period.nextMonth}`} className="px-1 font-normal text-[var(--color-provin-muted)]" aria-label="Nākamais mēnesis">
              ›
            </Link>
          ) : (
            <span className="px-1 font-normal text-slate-300">›</span>
          )}
        </span>
      ) : (
        <span className="mr-1 text-[12.5px] font-semibold text-[var(--color-apple-text)]">{period.label}</span>
      )}
      <Link href={basePath} className={`${pill} ${period.kind === "month" ? pillOn : pillOff}`}>
        Mēnesis
      </Link>
      <Link href={`${basePath}?bp=all`} className={`${pill} ${period.kind === "all" ? pillOn : pillOff}`}>
        Viss laiks
      </Link>
      <details className="relative">
        <summary className={`${pill} ${period.kind === "custom" ? pillOn : pillOff} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
          Periods: no - līdz
        </summary>
        <form action={basePath} method="get" className="absolute left-0 z-10 mt-2 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <label className="text-[11px] text-[var(--color-provin-muted)]">
            No
            <input type="date" name="bpFrom" defaultValue={period.from} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1 text-[12.5px]" />
          </label>
          <label className="text-[11px] text-[var(--color-provin-muted)]">
            Līdz
            <input type="date" name="bpTo" defaultValue={period.to} className="mt-1 block rounded-lg border border-slate-200 px-2 py-1 text-[12.5px]" />
          </label>
          <button type="submit" className={`${pill} ${pillOn}`}>
            Rādīt
          </button>
        </form>
      </details>
    </div>
  );
}

function Chart({ daily }: { daily: { date: string; clicks: number; paid: number }[] }) {
  const max = Math.max(1, ...daily.map((d) => d.clicks));
  if (!daily.some((d) => d.clicks || d.paid)) return null;
  return (
    <div className="mt-5">
      <div className="flex h-[90px] items-end gap-[3px] border-b border-slate-100">
        {daily.map((d) => (
          <div
            key={d.date}
            title={`${d.date.slice(8, 10)}.${d.date.slice(5, 7)}: ${d.clicks} klikšķi, ${d.paid} apmaksāti`}
            className="relative flex-1 rounded-t-[3px] bg-slate-200"
            style={{ height: `${Math.max(2, (d.clicks / max) * 100)}%` }}
          >
            {d.paid ? (
              <i
                className="absolute inset-x-0 bottom-0 rounded-t-[3px] bg-[#2563eb]"
                style={{ height: `${Math.min(100, (d.paid / Math.max(1, d.clicks)) * 100)}%`, minHeight: 3 }}
              />
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-4 text-[11px] text-[var(--color-provin-muted)]">
        <span>
          <b className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-slate-200 align-middle" />
          Klikšķi dienā
        </span>
        <span>
          <b className="mr-1.5 inline-block h-2 w-2 rounded-sm bg-[#2563eb] align-middle" />
          Apmaksāti
        </span>
      </div>
    </div>
  );
}

function fillDays(from: string, to: string, daily: { date: string; clicks: number; paid: number }[]) {
  const by = new Map(daily.map((d) => [d.date, d]));
  const out: { date: string; clicks: number; paid: number }[] = [];
  const end = Date.parse(`${to}T12:00:00Z`);
  for (let t = Date.parse(`${from}T12:00:00Z`); t <= end && out.length < 400; t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10);
    out.push(by.get(date) ?? { date, clicks: 0, paid: 0 });
  }
  return out;
}

const th = "pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-provin-muted)]";
const td = "border-t border-slate-100 py-2 tabular-nums";

export function AdminBusinessPogaCard({
  view,
  period,
  basePath,
  partnerLabel,
}: {
  view: BusinessPogaStatsView;
  period: BusinessPogaPeriod;
  basePath: string;
  /** Partnera lapā: tikai šis partneris, bez partneru tabulas. */
  partnerLabel?: string;
}) {
  const { summary: s, partnerNames } = view;
  const t = s.totals;
  const name = (id: string) => (id === UNKNOWN_PARTNER ? "Nezināms partneris" : (partnerNames[id] ?? id));
  const startedToPaid = t.started ? t.paid / t.started : null;
  const shownCars = s.cars.slice(0, 10);

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-provin-muted)]">
            PROVIN Business poga · {partnerLabel ?? "partneru vietnes"}
          </p>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-apple-text)]">Klikšķis → pirkums</h2>
        </div>
        <p className="text-[2rem] font-semibold leading-none tabular-nums text-[var(--color-apple-text)]">{pct(t.conversion)}</p>
      </div>
      <PeriodBar period={period} basePath={basePath} />
      <p className="mt-3 text-[13px] text-[var(--color-provin-muted)]">
        {n(t.paid)} apmaksāti pasūtījumi no {n(t.clicks)} klikšķiem
        {partnerLabel ? "." : ` ${n(s.partners.filter((p) => p.partnerId !== UNKNOWN_PARTNER).length)} partneru vietnēs.`}
        {view.salesOk ? "" : " Stripe pirkumus neizdevās nolasīt."}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Kpi label="Klikšķi" value={n(t.clicks)} hint="atvērta apmaksas lapa" />
        <Kpi label="Bloķēti" value={n(t.blocked)} hint="saite netika atvērta" />
        <Kpi label="Apmaksa sākta" value={n(t.started)} hint="aizgāja līdz Stripe" />
        <Kpi label="Apmaksāti" value={n(t.paid)} hint={t.started ? `${pct(startedToPaid)} no sāktajiem` : undefined} />
        <Kpi label="Ieņēmumi" value={eur(t.revenueCents)} />
      </div>

      <Chart daily={fillDays(period.from, period.to, s.daily)} />

      {!partnerLabel && s.partners.length ? (
        <div className="mt-5 overflow-x-auto">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">Pa partneriem</p>
          <table className="mt-1 w-full min-w-[560px] text-[13px]">
            <thead>
              <tr className="text-right">
                <th className={`${th} text-left`}>Partneris</th>
                <th className={th}>Klikšķi</th>
                <th className={th}>Bloķēti</th>
                <th className={th}>Sākta</th>
                <th className={th}>Apmaksāti</th>
                <th className={th}>Ieņēmumi</th>
                <th className={th}>Konv.</th>
              </tr>
            </thead>
            <tbody>
              {s.partners.map((p) => (
                <tr key={p.partnerId} className="text-right text-[var(--color-apple-text)]">
                  <td className={`${td} text-left`}>
                    {p.partnerId === UNKNOWN_PARTNER ? (
                      name(p.partnerId)
                    ) : (
                      <Link href={`/admin/partneri/${p.partnerId}`} className="hover:underline">
                        {name(p.partnerId)}
                      </Link>
                    )}
                  </td>
                  <td className={td}>{n(p.clicks)}</td>
                  <td className={td}>{n(p.blocked)}</td>
                  <td className={td}>{n(p.started)}</td>
                  <td className={td}>{n(p.paid)}</td>
                  <td className={td}>{eur(p.revenueCents)}</td>
                  <td className={td}>{pct(p.conversion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {s.blockedByReason.length ? (
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">Bloķēto iemesli</p>
            <ul className="mt-1.5 divide-y divide-slate-100 border-t border-slate-100">
              {s.blockedByReason.map((r) => (
                <li key={r.reason} className="flex justify-between gap-3 py-1.5 text-[13px]">
                  <span className="text-[var(--color-apple-text)]">{BUSINESS_POGA_BLOCK_LABEL[r.reason]}</span>
                  <span className="font-medium tabular-nums text-[var(--color-provin-muted)]">{n(r.count)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">Klikšķis → apmaksa</p>
          <ul className="mt-1.5 divide-y divide-slate-100 border-t border-slate-100 text-[13px]">
            <li className="flex justify-between py-1.5">
              <span>Klikšķis → apmaksa sākta</span>
              <span className="font-medium tabular-nums text-[var(--color-provin-muted)]">{pct(t.clicks ? t.started / t.clicks : null)}</span>
            </li>
            <li className="flex justify-between py-1.5">
              <span>Sākta → apmaksāta</span>
              <span className="font-medium tabular-nums text-[var(--color-provin-muted)]">{pct(startedToPaid)}</span>
            </li>
          </ul>
        </div>
      </div>

      {shownCars.length ? (
        <div className="mt-5 overflow-x-auto">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">Pa auto</p>
          <CarTable cars={shownCars} name={name} showPartner={!partnerLabel} />
          {s.cars.length > shownCars.length ? (
            <details className="mt-2">
              <summary className="cursor-pointer list-none text-[12.5px] text-[var(--color-provin-accent)] [&::-webkit-details-marker]:hidden">
                Visi auto ({n(s.cars.length)}) ›
              </summary>
              <CarTable cars={s.cars.slice(10)} name={name} showPartner={!partnerLabel} />
            </details>
          ) : null}
        </div>
      ) : null}

      {period.from < "2026-11-06" ? (
        <p className="mt-4 text-[11px] text-[var(--color-provin-muted)]">Klikšķus uzskaita no 05.11.2026; pirkumi ir no Stripe.</p>
      ) : null}
    </section>
  );
}

function CarTable({
  cars,
  name,
  showPartner,
}: {
  cars: BusinessPogaStatsView["summary"]["cars"];
  name: (id: string) => string;
  showPartner: boolean;
}) {
  return (
    <table className="mt-1 w-full min-w-[520px] text-[13px]">
      <thead>
        <tr className="text-right">
          <th className={`${th} text-left`}>Auto</th>
          <th className={`${th} text-left`}>VIN</th>
          {showPartner ? <th className={`${th} text-left`}>Partneris</th> : null}
          <th className={th}>Klikšķi</th>
          <th className={th}>Statuss</th>
        </tr>
      </thead>
      <tbody>
        {cars.map((c) => (
          <tr key={`${c.partnerId}|${c.vin}`} className="text-right text-[var(--color-apple-text)]">
            <td className={`${td} text-left`}>{c.title || "-"}</td>
            <td className={`${td} text-left font-mono text-[12px]`}>{c.vin}</td>
            {showPartner ? <td className={`${td} text-left`}>{name(c.partnerId)}</td> : null}
            <td className={td}>{n(c.clicks)}</td>
            <td className={`${td} ${c.paid ? "font-semibold text-emerald-600" : "text-[var(--color-provin-muted)]"}`}>
              {c.paid ? `Apmaksāts${c.paid > 1 ? ` ×${c.paid}` : ""}` : "Nav pirkts"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
