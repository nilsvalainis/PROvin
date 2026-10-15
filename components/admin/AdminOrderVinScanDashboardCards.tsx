"use client";

import Link from "next/link";
import { ScanLine } from "lucide-react";

import { AdminProvinLucide } from "@/components/admin/AdminProvinLucide";
import { orderVinScanDashboardSubtitle, type OrderVinScanDashboardCard } from "@/lib/order-vin-scan";

function counts(card: OrderVinScanDashboardCard): string {
  if (card.status === "running") return "pārbauda…";
  const bits = [`${card.found} info`];
  const problems = card.error + card.blocked + card.timeout + card.configMissing;
  if (card.none > 0 && problems === 0) bits.push(`${card.none} nav`);
  if (card.error) bits.push(`${card.error} kļūda`);
  if (card.blocked) bits.push(`${card.blocked} bloķē`);
  if (card.timeout) bits.push(`${card.timeout} noildze`);
  if (card.configMissing) bits.push(`${card.configMissing} nav atslēgas`);
  return bits.join(" · ");
}

export function AdminOrderVinScanDashboardCards({
  cards,
}: {
  cards: OrderVinScanDashboardCard[];
}) {
  if (cards.length === 0) return null;
  return (
    <section className="mt-3" aria-label="VIN SCAN jaunie pasūtījumi">
      <h2 className="mb-1.5 flex items-center gap-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93]">
        <AdminProvinLucide icon={ScanLine} size={14} />
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
  );
}
