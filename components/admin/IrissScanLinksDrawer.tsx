"use client";

import { ExternalLink, Plus, X } from "lucide-react";
import { useRef } from "react";
import { useModalBackdropClose } from "@/hooks/useModalBackdropClose";
import {
  addIrissListingLinkRow,
  coerceIrissListingLinkList,
  IRISS_LISTING_LINKS_PER_SOURCE_MAX,
  irissListingLinkUrlError,
  removeIrissListingLinkRow,
  setIrissListingLinkRow,
} from "@/lib/iriss-listing-link-lists";
import { IRISS_SCAN_SOURCES, type IrissScanLinkKey } from "@/lib/iriss-scan-sources";
import { nextStableRowKeys } from "@/lib/iriss-stable-row-keys";
import type { IrissScanRecord } from "@/lib/iriss-scan-types";

function SourceGroup({
  label,
  links,
  onChange,
}: {
  label: string;
  links: readonly string[];
  onChange: (next: string[]) => void;
}) {
  const rows = coerceIrissListingLinkList(links);
  const canAdd = rows.length < IRISS_LISTING_LINKS_PER_SOURCE_MAX;
  const rowKeysRef = useRef<string[]>(nextStableRowKeys([], rows.length));
  rowKeysRef.current = nextStableRowKeys(rowKeysRef.current, rows.length);
  return (
    <section className="mb-4 last:mb-0">
      <h3 className="mb-1 px-1 text-[12px] font-semibold text-[var(--ink2)]">{label}</h3>
      <div className="overflow-hidden rounded-2xl bg-[var(--s1)] shadow-[var(--sh)]">
        {rows.map((line, idx) => {
          const err = irissListingLinkUrlError(line);
          const open = line.trim() && !err ? line.trim() : null;
          return (
            <div key={rowKeysRef.current[idx] ?? `row-${idx}`} className="border-b border-[var(--hair)] last:border-b-0">
              <div className="flex min-h-[44px] items-center gap-1 pl-3 pr-1">
                <input
                  data-bare
                  className={`min-w-0 flex-1 bg-transparent py-2.5 text-[15px] outline-none placeholder:text-[var(--ink3)] ${
                    err ? "text-[var(--bad)]" : "text-[var(--ink)]"
                  }`}
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  placeholder="https://..."
                  value={line}
                  onChange={(e) => onChange(setIrissListingLinkRow(rows, idx, e.target.value))}
                  aria-label={`${label} - saite ${idx + 1}`}
                  aria-invalid={Boolean(err)}
                />
                {open ? (
                  <a
                    href={open}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--acc)] hover:bg-[var(--fill)]"
                    title="Atvērt"
                    aria-label="Atvērt saiti"
                  >
                    <ExternalLink className="h-4 w-4" aria-hidden />
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    rowKeysRef.current = nextStableRowKeys(rowKeysRef.current, rows.length - 1, idx);
                    onChange(removeIrissListingLinkRow(rows, idx));
                  }}
                  disabled={rows.length <= 1 && !line.trim()}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--ink3)] hover:bg-[var(--bad-soft)] hover:text-[var(--bad)] disabled:invisible"
                  title="Noņemt saiti"
                  aria-label="Noņemt saiti"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              {err ? <p className="px-3 pb-2 text-[11px] text-[var(--bad)]">{err}</p> : null}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => onChange(addIrissListingLinkRow(rows))}
          disabled={!canAdd}
          className="flex min-h-[44px] w-full items-center gap-1.5 px-3 text-left text-[14px] font-medium text-[var(--acc)] hover:bg-[var(--fill)] disabled:opacity-35"
        >
          <Plus className="h-4 w-4" aria-hidden /> Pievienot saiti
        </button>
      </div>
    </section>
  );
}

export function IrissScanLinksDrawer({
  open,
  rec,
  onClose,
  onChangeLinks,
}: {
  open: boolean;
  rec: IrissScanRecord;
  onClose: () => void;
  onChangeLinks: (key: IrissScanLinkKey, next: string[]) => void;
}) {
  const backdropClose = useModalBackdropClose(onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-black/40 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6" {...backdropClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="iriss-scan-links-title"
        className="max-h-[min(88vh,44rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-[var(--bg-base)] p-4 shadow-[var(--gsh)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="iriss-scan-links-title" className="text-[16px] font-semibold text-[var(--ink)]">
            Rediģēt saites
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--s1)] text-[var(--ink2)] shadow-[var(--sh)]"
            aria-label="Aizvērt"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {IRISS_SCAN_SOURCES.map((s) => (
          <SourceGroup key={s.key} label={s.label} links={rec[s.key]} onChange={(next) => onChangeLinks(s.key, next)} />
        ))}
      </div>
    </div>
  );
}
