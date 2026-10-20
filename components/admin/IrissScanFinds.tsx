"use client";

import { ExternalLink, Star, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { IrissListingHitStatus } from "@/lib/iriss-listing-match-client";
import type { IrissScanFindBucket, IrissScanFindCard } from "@/lib/iriss-scan-finds";

const BUCKETS: ReadonlyArray<{ id: IrissScanFindBucket; label: string }> = [
  { id: "new", label: "Jauni" },
  { id: "saved", label: "Saglabāti" },
  { id: "reject", label: "Neder" },
];

const SWIPE_PX = 72;

export function IrissScanFinds({
  finds,
  onStatus,
}: {
  finds: IrissScanFindCard[];
  onStatus: (card: IrissScanFindCard, status: IrissListingHitStatus) => void;
}) {
  const [bucket, setBucket] = useState<IrissScanFindBucket>("new");
  const counts = useMemo(() => {
    const c: Record<IrissScanFindBucket, number> = { new: 0, saved: 0, reject: 0 };
    for (const f of finds) c[f.bucket] += 1;
    return c;
  }, [finds]);
  const visible = finds.filter((f) => f.bucket === bucket);

  return (
    <section className="iriss-scan-finds">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.04em] text-[var(--ink2)]">
          Jaunākie atradumi
        </h2>
        <div className="iriss-pas-seg flex flex-wrap gap-1.5">
          {BUCKETS.map((b) => (
            <button
              key={b.id}
              type="button"
              aria-pressed={bucket === b.id}
              onClick={() => setBucket(b.id)}
              className="iriss-status-chip inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold"
            >
              {b.label}
              <span className="iriss-status-chip-count rounded-full px-1.5 text-[11px]">{counts[b.id]}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="mb-2 text-[11px] text-[var(--ink3)] md:hidden">pa kreisi X · pa labi ★</p>
      {visible.length === 0 ? (
        <p className="rounded-2xl bg-[var(--s1)] px-4 py-6 text-center text-[13px] text-[var(--ink3)] shadow-[var(--sh)]">
          Nav atradumu šajā sarakstā
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((card) => (
            <IrissScanFindRow key={`${card.orderId}|${card.listingId}`} card={card} onStatus={onStatus} />
          ))}
        </ul>
      )}
    </section>
  );
}

function IrissScanFindRow({
  card,
  onStatus,
}: {
  card: IrissScanFindCard;
  onStatus: (card: IrissScanFindCard, status: IrissListingHitStatus) => void;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [dx, setDx] = useState(0);

  function finish(next: number) {
    if (next <= -SWIPE_PX) onStatus(card, "noraidits");
    else if (next >= SWIPE_PX) onStatus(card, "interesants");
    setDx(0);
  }

  return (
    <li
      className="iriss-scan-find-card relative overflow-hidden rounded-3xl bg-[var(--s1)] shadow-[var(--sh)]"
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const mx = e.clientX - start.current.x;
        const my = e.clientY - start.current.y;
        if (Math.abs(mx) < 12 && Math.abs(my) < 12) return;
        if (Math.abs(my) > Math.abs(mx) + 8) return;
        setDx(Math.max(-96, Math.min(96, mx)));
      }}
      onPointerUp={() => {
        start.current = null;
        finish(dx);
      }}
      onPointerCancel={() => {
        start.current = null;
        setDx(0);
      }}
    >
      <div
        className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 p-3 max-md:grid-cols-1 motion-safe:transition-transform motion-safe:duration-150"
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
      >
        <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-[var(--s2)]">
          {card.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[16px] font-semibold text-[var(--ink)]">{card.title}</p>
            <span className="shrink-0 rounded-full bg-[var(--fill)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink2)]">
              {card.bucket === "saved" ? "Saglabāts" : card.bucket === "reject" ? "Neder" : "Jauns"}
            </span>
          </div>
          {card.spec ? <p className="mt-0.5 text-[12px] text-[var(--ink2)]">{card.spec}</p> : null}
          <p className="mt-2 text-[22px] font-semibold tracking-tight text-[var(--ink)]">
            {card.priceLabel || "Nav cenas"}
            {card.costLabel ? <span className="ml-2 text-[13px] font-medium text-[var(--ink2)]">{card.costLabel}</span> : null}
          </p>
          {card.budgetLabel ? (
            <p className={`mt-1 text-[12px] font-semibold ${card.budgetOk ? "text-emerald-700" : "text-[var(--warn)]"}`}>
              {card.budgetLabel}
            </p>
          ) : null}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--s2)] text-[var(--ink2)]"
              aria-label="Neder"
              title="Neder"
              onClick={() => onStatus(card, "noraidits")}
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              className={`inline-flex h-11 w-11 items-center justify-center rounded-full ${
                card.status === "interesants" ? "bg-amber-50 text-amber-500" : "bg-[var(--s2)] text-[var(--ink2)]"
              }`}
              aria-label="Saglabāt"
              title="Saglabāt"
              onClick={() => onStatus(card, card.status === "interesants" ? "skatits" : "interesants")}
            >
              <Star className={`h-5 w-5 ${card.status === "interesants" ? "fill-amber-400" : ""}`} aria-hidden />
            </button>
            {card.detailUrl ? (
              <a
                href={card.detailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex h-11 items-center gap-1.5 rounded-full bg-[var(--chip-active-bg)] px-4 text-[13px] font-semibold text-[var(--chip-active-fg)]"
              >
                <ExternalLink className="h-4 w-4" aria-hidden /> Atvērt izsolē
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
