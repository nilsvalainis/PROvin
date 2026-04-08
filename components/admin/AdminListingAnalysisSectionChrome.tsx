"use client";

import { SectionLineIcon } from "@/components/icons/SectionLineIcon";
import type { SectionIconId } from "@/lib/section-icons";

/** Maigi zils aplis — vienots ar „SLUDINĀJUMA ANALĪZE” galvenes ikonu. */
export function ListingAnalysisIconBubble({
  children,
  size = "md",
}: {
  children: React.ReactNode;
  size?: "md" | "sm";
}) {
  const dim = size === "md" ? "h-9 w-9" : "h-8 w-8";
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-sky-100/90 ring-1 ring-sky-200/50 ${dim}`}
    >
      {children}
    </span>
  );
}

/** Augšējā „SLUDINĀJUMA ANALĪZE” josla — lupa aplī + virsraksts + luksofors. */
export function ListingAnalysisMainBlockTitleRow({
  iconId,
  title,
  trafficStripClass,
}: {
  iconId: SectionIconId;
  title: string;
  trafficStripClass: string;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 border-b border-slate-100 bg-white px-2 py-2 ${trafficStripClass}`}
    >
      <ListingAnalysisIconBubble size="md">
        <SectionLineIcon id={iconId} />
      </ListingAnalysisIconBubble>
      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-900">{title}</span>
    </div>
  );
}

/**
 * Apakšsadaļa „Sludinājuma vēsture”, „Pārdevēja portrets”, utt. —
 * ikona aplī, mazāks virsraksts, tieva līnija, tad saturs.
 */
export function ListingAnalysisSubsectionHeading({
  iconId,
  title,
  compact,
  children,
}: {
  iconId: SectionIconId;
  title: string;
  /** AdminListingAnalysisSourceBlock kompaktais režīms — mazāks teksts. */
  compact?: boolean;
  children: React.ReactNode;
}) {
  const titleClass = compact
    ? "text-[9px] font-bold uppercase tracking-wide text-slate-900"
    : "text-[10px] font-bold uppercase tracking-wide text-slate-900";
  return (
    <div className="min-w-0">
      <div className={`flex items-center gap-2.5 ${compact ? "gap-2" : ""}`}>
        <ListingAnalysisIconBubble size="sm">
          <SectionLineIcon id={iconId} />
        </ListingAnalysisIconBubble>
        <span className={titleClass}>{title}</span>
      </div>
      <div className="mt-2.5 border-t border-slate-200/75" />
      <div className={`min-w-0 ${compact ? "pt-1.5" : "pt-2.5"}`}>{children}</div>
    </div>
  );
}
