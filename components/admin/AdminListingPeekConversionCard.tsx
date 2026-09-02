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

type Props = {
  stats: ListingPeekConversionStats;
  variant?: "full" | "compact";
};

export function AdminListingPeekConversionCard({ stats, variant = "full" }: Props) {
  const compact = variant === "compact";

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_2px_24px_rgba(15,23,42,0.05)]">
      <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">
        Ātrie vērtējumi → pirkums
      </h2>
      <p className="mt-3 text-[2rem] font-semibold tracking-tight text-[var(--color-apple-text)] tabular-nums">
        {formatRate(stats.conversionRatePct)}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--color-provin-muted)]">
        {stats.convertedPeople.toLocaleString("lv-LV")} no {stats.uniquePeople.toLocaleString("lv-LV")} unikālajiem
        klientiem pēc iesūtījuma apmaksāja kādu pakalpojumu.
      </p>
      {!compact ? (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px] sm:grid-cols-4">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.06em] text-[var(--color-provin-muted)]">Pieprasījumi</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-[var(--color-apple-text)]">
                {stats.peekCount.toLocaleString("lv-LV")}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.06em] text-[var(--color-provin-muted)]">Atbildēti</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-[var(--color-apple-text)]">
                {stats.commentSentPeeks.toLocaleString("lv-LV")}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.06em] text-[var(--color-provin-muted)]">Pasūtījumi</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-[var(--color-apple-text)]">
                {stats.orderCount.toLocaleString("lv-LV")}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.06em] text-[var(--color-provin-muted)]">Ieņēmumi</dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-[var(--color-apple-text)]">
                {formatEurFromCents(stats.revenueCents)}
              </dd>
            </div>
          </dl>
          {stats.byProduct.length > 0 ? (
            <ul className="mt-4 space-y-1.5 text-[13px] text-[var(--color-apple-text)]">
              {stats.byProduct.map((row) => (
                <li key={row.label} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">{row.label}</span>
                  <span className="shrink-0 tabular-nums text-[var(--color-provin-muted)]">
                    {row.people.toLocaleString("lv-LV")}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-4 text-[11px] leading-relaxed text-[var(--color-provin-muted)]">
            Sakritība pēc e-pasta vai tālruņa ar apmaksātu Stripe pasūtījumu pēc pirmā iesūtījuma. Demo un operatora
            testa konti nav iekļauti. Produkta rinda = pirmais pirkums pēc vērtējuma.
          </p>
        </>
      ) : null}
      <p className="mt-3 text-[12px]">
        {compact ? (
          <Link href="/admin/statistika" className="font-medium text-[var(--color-provin-accent)] hover:underline">
            Pilna statistika →
          </Link>
        ) : (
          <Link href="/admin/atras-vertesanas" className="font-medium text-[var(--color-provin-accent)] hover:underline">
            Ātrie vērtējumi →
          </Link>
        )}
      </p>
    </div>
  );
}
