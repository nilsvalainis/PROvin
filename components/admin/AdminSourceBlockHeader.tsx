"use client";

import type { SourceBlockKey } from "@/lib/admin-source-blocks";
import { SOURCE_BLOCK_ADMIN_TITLE_SIZE_CLASS, SOURCE_BLOCK_EXTERNAL_URL, SOURCE_BLOCK_LABELS } from "@/lib/admin-source-blocks";
import { AdminProvinLucide } from "@/components/admin/AdminProvinLucide";
import { SOURCE_BLOCK_LUCIDE } from "@/lib/admin-lucide-registry";
import type { TrafficFillLevel } from "@/lib/admin-block-traffic-status";
import { TRAFFIC_HEADER_STRIP_CLASS } from "@/lib/admin-block-traffic-status";

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

type Props = {
  blockKey: SourceBlockKey;
  className?: string;
  trafficFillLevel?: TrafficFillLevel;
};

export function AdminSourceBlockHeader({ blockKey, className = "mb-2", trafficFillLevel }: Props) {
  const label = SOURCE_BLOCK_LABELS[blockKey];
  const href = SOURCE_BLOCK_EXTERNAL_URL[blockKey];
  const Icon = SOURCE_BLOCK_LUCIDE[blockKey];

  const row = (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${label} — atvērt avotu jaunā cilnē`}
      className={`inline-flex max-w-full flex-1 items-center gap-2 font-medium uppercase tracking-wide underline-offset-2 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-provin-accent)] focus-visible:ring-offset-1 ${SOURCE_BLOCK_ADMIN_TITLE_SIZE_CLASS} text-slate-600`}
    >
      <AdminProvinLucide icon={Icon} />
      <span>{label}</span>
      <ExternalLinkIcon className="shrink-0 opacity-45 text-slate-500" />
    </a>
  );

  if (trafficFillLevel) {
    return (
      <div className={`mb-2 overflow-hidden rounded-t-lg ${TRAFFIC_HEADER_STRIP_CLASS[trafficFillLevel]}`}>
        <div className={`px-1.5 py-1 ${className}`}>{row}</div>
      </div>
    );
  }

  return <div className={className}>{row}</div>;
}
