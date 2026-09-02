import Link from "next/link";
import type { ListingPeekConversionStats } from "@/lib/listing-peek-conversion";

function formatEurFromCents(cents: number): string {
  return new Intl.NumberFormat("lv-LV", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatRate(pct: number | null): string {
  if (pct == null) return "—";
  return `${pct.toLocaleString("lv-LV", { maximumFractionDigits: 1 })}%`;
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
        {label}
      </p>
      <p className="mt-1 text-[1.05rem] font-semibold tabular-nums leading-none text-[var(--color-apple-text)]">
        {value}
      </p>
    </div>
  );
}

type Props = {
  stats: ListingPeekConversionStats;
  variant?: "full" | "compact";
};

export function AdminListingPeekConversionCard({ stats, variant = "full" }: Props) {
  const compact = variant === "compact";

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-provin-muted)]">
            Ātrie vērtējumi
          </p>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-apple-text)]">
            Iesūtītie → pirkums
          </h2>
        </div>
        <p className="text-[2.25rem] font-semibold leading-none tracking-tight text-[var(--color-apple-text)] tabular-nums">
          {formatRate(stats.conversionRatePct)}
        </p>
      </div>
      <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-[var(--color-provin-muted)]">
        {stats.convertedPeople.toLocaleString("lv-LV")} no {stats.uniquePeople.toLocaleString("lv-LV")} unikālajiem
        klientiem pēc iesūtījuma apmaksāja pakalpojumu.
      </p>
      {!compact ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label="Pieprasījumi" value={stats.peekCount.toLocaleString("lv-LV")} />
            <Kpi label="Klienti" value={stats.uniquePeople.toLocaleString("lv-LV")} />
            <Kpi label="Pirkumi" value={stats.orderCount.toLocaleString("lv-LV")} />
            <Kpi label="Ieņēmumi" value={formatEurFromCents(stats.revenueCents)} />
          </div>
          {stats.byProduct.length > 0 ? (
            <ul className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
              {stats.byProduct.map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                  <span className="min-w-0 truncate text-[var(--color-apple-text)]">{row.label}</span>
                  <span className="shrink-0 font-medium tabular-nums text-[var(--color-provin-muted)]">
                    {row.people.toLocaleString("lv-LV")}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      <p className="mt-4 text-[12px]">
        {compact ? (
          <Link href="/admin/statistika" className="font-medium text-[var(--color-provin-accent)] hover:underline">
            Pilna statistika
          </Link>
        ) : (
          <Link href="/admin/atras-vertesanas" className="font-medium text-[var(--color-provin-accent)] hover:underline">
            Ātrie vērtējumi
          </Link>
        )}
      </p>
    </section>
  );
}
