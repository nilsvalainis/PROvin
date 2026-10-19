"use client";

import Link from "next/link";
import { AdminMobileIcon } from "@/components/admin/mobile/AdminMobileIcon";
import { orderVinScanDashboardSubtitle, type OrderVinScanDashboardCard } from "@/lib/order-vin-scan";

function counts(card: OrderVinScanDashboardCard): string {
  if (card.status === "running") return "pārbauda…";
  const bits = [`${card.found} info`];
  const problems = card.error + card.blocked + card.timeout + card.configMissing;
  if (card.none > 0 && problems === 0) bits.push(`${card.none} nav`);
  if (card.error) bits.push(`${card.error} kļūda`);
  if (card.blocked) bits.push(`${card.blocked} bloķē`);
  if (card.timeout) bits.push(`${card.timeout} noildzes`);
  if (card.configMissing) bits.push(`${card.configMissing} nav atslēgas`);
  return bits.join(" · ");
}

export function AdminOrderVinScanDashboardCards({
  cards,
  surface = "all",
}: {
  cards: OrderVinScanDashboardCard[];
  surface?: "all" | "mobile" | "desktop";
}) {
  const autoN = cards.length;
  const infoN = cards.reduce((n, c) => n + c.found, 0);
  const timeoutN = cards.reduce((n, c) => n + c.timeout, 0);
  const showMobile = surface !== "desktop";
  const showDesktop = surface !== "mobile";
  return (
    <>
      {showMobile ? (
      <div className="overflow-hidden rounded-[18px] bg-[var(--am-s1)] shadow-[var(--am-card-shadow)] md:hidden">
        <Link href="/admin/kopsavilkums" className="am-press flex min-h-[50px] items-center gap-3 px-4">
          <AdminMobileIcon name="rits" className="h-5 w-5 text-[var(--am-ink2)]" />
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-semibold text-[var(--am-ink)]">Rīta kopsavilkums</span>
            <span className="block text-[13px] text-[var(--am-ink2)]">Termiņi šodien</span>
          </span>
          <AdminMobileIcon name="uzPrieksu" className="h-4 w-4 text-[var(--am-ink3)]" />
        </Link>
        {cards.length > 0 ? (
          <Link href="/admin/vin-scan" className="am-press flex min-h-[50px] items-center gap-3 border-t border-[var(--am-hair)] px-4">
            <AdminMobileIcon name="vinParbaude" className="h-5 w-5 text-[var(--am-ink2)]" />
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-semibold text-[var(--am-ink)]">VIN SCAN</span>
              <span className="block text-[13px] text-[var(--am-ink2)]">
                {autoN} auto · {infoN} info{timeoutN ? ` · ${timeoutN} noildzes` : ""}
              </span>
            </span>
            <span className="mr-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--am-badge)] px-1 text-[10px] font-semibold text-[var(--am-badge-ink)]">
              {autoN}
            </span>
            <AdminMobileIcon name="uzPrieksu" className="h-4 w-4 text-[var(--am-ink3)]" />
          </Link>
        ) : null}
      </div>
      ) : null}
      {showDesktop && cards.length > 0 ? (
        <section className="mt-3 hidden md:block" aria-label="VIN SCAN jaunie pasūtījumi">
          <h2 className="mb-1.5 flex items-center gap-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93]">
            VIN SCAN
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <li key={card.sessionId}>
                <Link
                  href={card.href}
                  className="flex min-h-[46px] items-center gap-3 rounded-2xl border border-[#e5e5ea] bg-white px-3 py-2 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-[var(--color-apple-text)]">{card.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-[#8e8e93]">{orderVinScanDashboardSubtitle(card)}</p>
                  </div>
                  <span className="shrink-0 text-[11px] font-medium tabular-nums text-[#8e8e93]">{counts(card)}</span>
                  <span className="shrink-0 text-[12px] font-semibold text-[var(--color-provin-accent)]">Atvērt</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
