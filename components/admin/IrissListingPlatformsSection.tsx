"use client";

import { Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import {
  buildListingPlatformChips,
  LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS,
  LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS,
} from "@/lib/iriss-listing-links";
import type { IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

const inp =
  "min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[13px] text-[var(--color-apple-text)] shadow-sm outline-none focus:border-[var(--color-provin-accent)] focus:ring-2 focus:ring-[var(--color-provin-accent)]/25 sm:text-[15px]";

const lbl = "mb-0.5 block text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]";

export function IrissListingPlatformChipsRow({ rec }: { rec: IrissPasutijumsRecord }) {
  const chips = useMemo(() => buildListingPlatformChips(rec, 5), [rec]);
  const openAll = useCallback(() => {
    for (const chip of chips) {
      window.open(chip.href, "_blank", "noopener,noreferrer");
    }
  }, [chips]);
  if (chips.length === 0) return null;
  return (
    <div className={`mb-2 ${LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS}`}>
      {chips.map((c, i) => (
        <a
          key={`${c.href}-${i}`}
          href={c.href}
          target="_blank"
          rel="noopener noreferrer"
          title={c.title}
          className={`${LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS} ${c.chipClass}`}
        >
          {c.letter}
        </a>
      ))}
      <button
        type="button"
        onClick={openAll}
        title="Atvērt visas saites"
        aria-label="Atvērt visas saites"
        className={`${LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS} bg-slate-700 text-white ring-1 ring-slate-800/35`}
      >
        ALL
      </button>
    </div>
  );
}

type Props = {
  rec: IrissPasutijumsRecord;
  onPatch: (patch: Partial<IrissPasutijumsRecord>) => void;
};

export function IrissListingPlatformsFields({ rec, onPatch }: Props) {
  const setOther = (idx: number, v: string) => {
    const next = [...rec.listingLinksOther];
    next[idx] = v;
    onPatch({ listingLinksOther: next });
  };
  const addOther = () => {
    onPatch({ listingLinksOther: [...rec.listingLinksOther, ""] });
  };
  const removeOther = (idx: number) => {
    const next = rec.listingLinksOther.filter((_, i) => i !== idx);
    onPatch({ listingLinksOther: next.length ? next : [""] });
  };

  return (
    <div className="mt-3 border-t border-slate-200/80 pt-3">
      <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--color-provin-muted)]">
        Sludinājumu platformas (saites)
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="min-w-0">
          <span className={lbl}>Mobile</span>
          <input
            className={inp}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://…"
            value={rec.listingLinkMobile}
            onChange={(e) => onPatch({ listingLinkMobile: e.target.value })}
          />
        </label>
        <label className="min-w-0">
          <span className={lbl}>Autobid</span>
          <input
            className={inp}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://…"
            value={rec.listingLinkAutobid}
            onChange={(e) => onPatch({ listingLinkAutobid: e.target.value })}
          />
        </label>
        <label className="min-w-0">
          <span className={lbl}>Openline</span>
          <input
            className={inp}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://…"
            value={rec.listingLinkOpenline}
            onChange={(e) => onPatch({ listingLinkOpenline: e.target.value })}
          />
        </label>
        <label className="min-w-0">
          <span className={lbl}>Auto1</span>
          <input
            className={inp}
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://…"
            value={rec.listingLinkAuto1}
            onChange={(e) => onPatch({ listingLinkAuto1: e.target.value })}
          />
        </label>
      </div>
      <div className="mt-2 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={lbl}>Citi</span>
          <button
            type="button"
            onClick={addOther}
            className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:bg-slate-50"
            title="Pievienot vēl vienu saites lauku"
          >
            <Plus className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            Rinda
          </button>
        </div>
        {rec.listingLinksOther.map((line, idx) => (
          <div key={idx} className="flex min-w-0 items-start gap-1.5">
            <input
              className={`${inp} min-w-0 flex-1`}
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://…"
              value={line}
              onChange={(e) => setOther(idx, e.target.value)}
              aria-label={`Citi — saite ${idx + 1}`}
            />
            <button
              type="button"
              onClick={() => removeOther(idx)}
              disabled={rec.listingLinksOther.length <= 1}
              className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200/90 bg-white text-slate-500 shadow-sm transition hover:bg-red-50 hover:text-red-700 disabled:pointer-events-none disabled:opacity-35"
              title="Noņemt rindu"
              aria-label="Noņemt rindu"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
