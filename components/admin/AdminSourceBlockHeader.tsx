"use client";

import type { SourceBlockKey } from "@/lib/admin-source-blocks";
import {
  SOURCE_BLOCK_ADMIN_TITLE_COLOR,
  SOURCE_BLOCK_ADMIN_TITLE_SIZE_CLASS,
  SOURCE_BLOCK_EXTERNAL_URL,
  SOURCE_BLOCK_LABELS,
} from "@/lib/admin-source-blocks";

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
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
  /** Noklusējums: mb-2 */
  className?: string;
};

export function AdminSourceBlockHeader({ blockKey, className = "mb-2" }: Props) {
  const label = SOURCE_BLOCK_LABELS[blockKey];
  const href = SOURCE_BLOCK_EXTERNAL_URL[blockKey];
  const color = SOURCE_BLOCK_ADMIN_TITLE_COLOR[blockKey];

  const content = (
    <>
      <span>{label}</span>
      <ExternalLinkIcon className="shrink-0 opacity-80" />
    </>
  );

  return (
    <div className={className}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${label} — atvērt avotu jaunā cilnē`}
        className={`inline-flex max-w-full items-center gap-1.5 font-bold uppercase tracking-wide underline-offset-2 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-provin-accent)] focus-visible:ring-offset-1 ${SOURCE_BLOCK_ADMIN_TITLE_SIZE_CLASS} ${color}`}
      >
        {content}
      </a>
    </div>
  );
}
