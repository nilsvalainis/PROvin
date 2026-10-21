"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminMobileIcon } from "@/components/admin/mobile/AdminMobileIcon";
import { AdminMobileSheet } from "@/components/admin/mobile/AdminMobileChrome";
import { formatAdminMobileBadgeCount } from "@/lib/admin-mobile-collapse";
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
  const [sheet, setSheet] = useState<null | "vin">(null);
  const vinBadge = formatAdminMobileBadgeCount(autoN);
  return (
    <>
      {showMobile ? (
      <div className="md:hidden">
        {/* Rīta kopsavilkums ir galvenes izvēlnē "Darbības"; VIN SCAN rinda tikai tad, kad ir aktīvi darbi. */}
        {autoN > 0 ? (
          <button
            type="button"
            onClick={() => setSheet("vin")}
            className="am-press relative flex min-h-11 w-full items-center gap-2 rounded-[14px] bg-[var(--fill-secondary)] px-3 text-left text-[14px] font-medium text-[var(--label)]"
          >
            <AdminMobileIcon name="vinParbaude" className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">VIN SCAN · {vinBadge} auto</span>
            <AdminMobileIcon name="uzPrieksu" className="h-3.5 w-3.5 shrink-0 text-[var(--label-secondary)]" />
          </button>
        ) : null}
        <AdminMobileSheet
          open={sheet === "vin"}
          title="VIN SCAN"
          subtitle={`${autoN} auto · ${infoN} info${timeoutN ? ` · ${timeoutN} noildzes` : ""}`}
          onClose={() => setSheet(null)}
        >
          <div className="space-y-2">
            {cards.length === 0 ? (
              <p className="text-[14px] text-[var(--label-secondary)]">Šobrīd nav aktīvu VIN SCAN darbu.</p>
            ) : (
              cards.map((card) => (
                <Link
                  key={card.sessionId}
                  href={card.href}
                  className="am-press flex min-h-[50px] items-center gap-3 rounded-[18px] bg-[var(--fill-secondary)] px-4"
                  onClick={() => setSheet(null)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-[var(--label)]">{card.title}</span>
                    <span className="block truncate text-[13px] text-[var(--label-secondary)]">
                      {orderVinScanDashboardSubtitle(card)} · {counts(card)}
                    </span>
                  </span>
                  <AdminMobileIcon name="uzPrieksu" className="h-4 w-4 text-[var(--label-secondary)]" />
                </Link>
              ))
            )}
            <Link
              href="/admin/vin-scan"
              className="am-press flex h-[50px] items-center justify-between rounded-[18px] bg-[var(--fill-secondary)] px-4 text-[16px] text-[var(--label)]"
              onClick={() => setSheet(null)}
            >
              Atvērt VIN pārbaudi
              <AdminMobileIcon name="uzPrieksu" className="h-4 w-4" />
            </Link>
          </div>
        </AdminMobileSheet>
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
