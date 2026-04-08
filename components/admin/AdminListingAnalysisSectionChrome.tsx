"use client";

import type { LucideIcon } from "lucide-react";
import { AdminProvinLucide, ADMIN_LUCIDE_SIZE } from "@/components/admin/AdminProvinLucide";

/** Augšējā „SLUDINĀJUMA ANALĪZE” josla — Lucide ikona (bez fona) + virsraksts + luksofors. */
export function ListingAnalysisMainBlockTitleRow({
  icon: Icon,
  title,
  trafficStripClass,
}: {
  icon: LucideIcon;
  title: string;
  trafficStripClass: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 border-b-0 bg-transparent px-2 py-1.5 ${trafficStripClass}`}
    >
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-provin-accent-soft)]">
        <AdminProvinLucide icon={Icon} size={ADMIN_LUCIDE_SIZE + 1} />
      </span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-600">{title}</span>
    </div>
  );
}

/**
 * Apakšsadaļas — smalka līnija zem virsraksta; ikona brīvi uz fona.
 */
export function ListingAnalysisSubsectionHeading({
  icon: Icon,
  title,
  compact,
  children,
}: {
  icon: LucideIcon;
  title: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  const titleClass = compact
    ? "text-[9px] font-medium uppercase tracking-wide text-slate-600"
    : "text-[10px] font-medium uppercase tracking-wide text-slate-600";
  return (
    <div className="min-w-0">
      <div className={`flex items-center gap-2 ${compact ? "gap-1.5" : ""}`}>
        <AdminProvinLucide icon={Icon} />
        <span className={titleClass}>{title}</span>
      </div>
      <div className="mt-2 border-t border-slate-200/55" />
      <div className={`min-w-0 ${compact ? "pt-1.5" : "pt-2"}`}>{children}</div>
    </div>
  );
}
