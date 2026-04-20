"use client";

import { Menu, Pin, Trash2 } from "lucide-react";
import { motion, Reorder, useDragControls } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { IrissPasutijumiNewFab } from "@/components/admin/IrissPasutijumiNewFab";
import {
  buildListingPlatformChips,
  LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS,
  LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS,
} from "@/lib/iriss-listing-links";
import type { IrissPasutijumsListRow, IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

const BRAND_ICON_SLUGS: Record<string, string> = {
  volkswagen: "volkswagen",
  vw: "volkswagen",
  audi: "audi",
  bmw: "bmw",
  mercedes: "mercedes",
  "mercedes-benz": "mercedes",
  toyota: "toyota",
  skoda: "skoda",
  ford: "ford",
  volvo: "volvo",
  kia: "kia",
  hyundai: "hyundai",
  nissan: "nissan",
  peugeot: "peugeot",
  renault: "renault",
  opel: "opel",
  tesla: "tesla",
};

type SortMode =
  | "created_desc"
  | "created_asc"
  | "brand_asc"
  | "brand_desc"
  | "budget_asc"
  | "budget_desc"
  | "manual";

const ORDER_KEY = "iriss-order-manual-v1";
const SORT_KEY = "iriss-order-sort-v1";

function getBrandToken(brandModel: string): string {
  return brandModel
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
}

function getBrandLogoUrl(brandModel: string): string | null {
  const token = getBrandToken(brandModel);
  if (!token) return null;
  const slug = BRAND_ICON_SLUGS[token];
  if (!slug) return null;
  return `https://cdn.simpleicons.org/${slug}/111827`;
}

function getBrandFallbackLabel(brandModel: string): string {
  const token = getBrandToken(brandModel).toUpperCase();
  if (!token) return "AU";
  return token.length >= 2 ? token.slice(0, 2) : token;
}

function budgetToNumber(v: string): number {
  const m = v.replace(",", ".").match(/-?\d+(?:\.\d+)?/g);
  if (!m || m.length === 0) return Number.NaN;
  const parsed = Number.parseFloat(m.join(""));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function sortCore(rows: IrissPasutijumsListRow[], mode: SortMode, manualOrder: string[]): IrissPasutijumsListRow[] {
  if (mode === "manual") {
    const rank = new Map<string, number>();
    manualOrder.forEach((id, idx) => rank.set(id, idx));
    return [...rows].sort((a, b) => {
      const ra = rank.has(a.id) ? rank.get(a.id)! : Number.MAX_SAFE_INTEGER;
      const rb = rank.has(b.id) ? rank.get(b.id)! : Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
    });
  }
  if (mode === "created_desc") return [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  if (mode === "created_asc") return [...rows].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  if (mode === "brand_asc")
    return [...rows].sort((a, b) => a.brandModel.localeCompare(b.brandModel, "lv", { sensitivity: "base" }));
  if (mode === "brand_desc")
    return [...rows].sort((a, b) => b.brandModel.localeCompare(a.brandModel, "lv", { sensitivity: "base" }));
  if (mode === "budget_asc")
    return [...rows].sort((a, b) => {
      const na = budgetToNumber(a.totalBudget);
      const nb = budgetToNumber(b.totalBudget);
      if (!Number.isFinite(na) && !Number.isFinite(nb)) return 0;
      if (!Number.isFinite(na)) return 1;
      if (!Number.isFinite(nb)) return -1;
      return na - nb;
    });
  return [...rows].sort((a, b) => {
    const na = budgetToNumber(a.totalBudget);
    const nb = budgetToNumber(b.totalBudget);
    if (!Number.isFinite(na) && !Number.isFinite(nb)) return 0;
    if (!Number.isFinite(na)) return 1;
    if (!Number.isFinite(nb)) return -1;
    return nb - na;
  });
}

function sortRows(rows: IrissPasutijumsListRow[], mode: SortMode, manualOrder: string[]): IrissPasutijumsListRow[] {
  const pinned = rows.filter((r) => Boolean(r.pinnedAt)).sort((a, b) => (a.pinnedAt < b.pinnedAt ? 1 : a.pinnedAt > b.pinnedAt ? -1 : 0));
  const normal = rows.filter((r) => !r.pinnedAt);
  return [...pinned, ...sortCore(normal, mode, manualOrder)];
}

function rowFromRecord(rec: IrissPasutijumsRecord): IrissPasutijumsListRow {
  return {
    id: rec.id,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
    pinnedAt: rec.pinnedAt,
    brandModel: rec.brandModel.trim() || "—",
    totalBudget: rec.totalBudget.trim() || "—",
    phone: rec.phone.trim() || "—",
    listingLinkMobile: rec.listingLinkMobile,
    listingLinkAutobid: rec.listingLinkAutobid,
    listingLinkOpenline: rec.listingLinkOpenline,
    listingLinkAuto1: rec.listingLinkAuto1,
    listingLinksOther: rec.listingLinksOther,
  };
}

function IrissRowCard({
  row,
  canManualSort,
  swipeOpenId,
  setSwipeOpenId,
  onPin,
  onAskDelete,
}: {
  row: IrissPasutijumsListRow;
  canManualSort: boolean;
  swipeOpenId: string | null;
  setSwipeOpenId: (id: string | null) => void;
  onPin: (id: string) => void;
  onAskDelete: (id: string) => void;
}) {
  const dragControls = useDragControls();
  const chips = buildListingPlatformChips(
    {
      listingLinkMobile: row.listingLinkMobile,
      listingLinkAutobid: row.listingLinkAutobid,
      listingLinkOpenline: row.listingLinkOpenline,
      listingLinkAuto1: row.listingLinkAuto1,
      listingLinksOther: row.listingLinksOther,
    },
    5,
  );
  const brandLogoUrl = getBrandLogoUrl(row.brandModel);
  const brandFallback = getBrandFallbackLabel(row.brandModel);
  const isPinned = Boolean(row.pinnedAt);
  const isOpen = swipeOpenId === row.id;
  const openAllListings = () => {
    for (const chip of chips) {
      window.open(chip.href, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Reorder.Item value={row.id} dragListener={false} dragControls={dragControls} className="list-none" whileDrag={{ scale: 1.01 }}>
      <div className={`relative overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:border-slate-300/90 ${
        isPinned ? "border-amber-300/70 bg-amber-50/30" : "border-slate-200/90"
      }`}>
        <div className="absolute inset-y-0 right-0 z-0 flex md:hidden">
          <button
            type="button"
            onClick={() => onPin(row.id)}
            className="flex w-16 items-center justify-center bg-[var(--color-provin-accent)] text-white"
            aria-label={isPinned ? "Noņemt piespraušanu" : "Piespraust augšā"}
          >
            <Pin className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onAskDelete(row.id)}
            className="flex w-16 items-center justify-center bg-red-600 text-white"
            aria-label="Dzēst pasūtījumu"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <motion.div
          drag="x"
          dragConstraints={{ left: -128, right: 0 }}
          dragElastic={0.08}
          dragMomentum={false}
          animate={{ x: isOpen ? -128 : 0 }}
          onDragEnd={(_, info) => {
            if (info.offset.x < -44) setSwipeOpenId(row.id);
            else setSwipeOpenId(null);
          }}
          className="relative z-10 bg-white md:translate-x-0"
        >
          <div className="flex items-stretch">
            {canManualSort ? (
              <button
                type="button"
                onPointerDown={(e) => dragControls.start(e)}
                className="inline-flex shrink-0 items-center justify-center border-r border-slate-100/90 px-2 text-slate-500"
                title="Pieturi un velc, lai pārkārtotu"
                aria-label="Pārkārtot rindu"
              >
                <Menu className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
            <Link
              href={`/admin/iriss/pasutijumi/${encodeURIComponent(row.id)}`}
              aria-label={`Atvērt pasūtījumu: ${row.brandModel}`}
              className="flex min-w-0 flex-1 flex-row items-center gap-2.5 p-3 outline-none ring-[var(--color-provin-accent)]/30 transition hover:bg-slate-50/50 active:bg-slate-100/60 focus-visible:ring-2 sm:gap-3 sm:p-4"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex min-w-0 items-center gap-2">
                  {brandLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={brandLogoUrl}
                      alt={`${brandFallback} logo`}
                      loading="lazy"
                      className="h-5 w-5 shrink-0 rounded-sm border border-slate-200/90 bg-white p-[2px] sm:h-6 sm:w-6"
                    />
                  ) : (
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border border-slate-200/90 bg-slate-50 text-[9px] font-bold text-slate-600 sm:h-6 sm:w-6 sm:text-[10px]">
                      {brandFallback}
                    </span>
                  )}
                  <p className="truncate text-[14px] font-semibold leading-snug text-[var(--color-apple-text)] sm:text-[15px]">
                    {row.brandModel}
                  </p>
                  {isPinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden /> : null}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-[var(--color-provin-muted)] sm:text-[13px]">
                  <span>
                    <span className="font-medium text-[var(--color-apple-text)]">Budžets:</span> {row.totalBudget}
                  </span>
                  <span>
                    <span className="font-medium text-[var(--color-apple-text)]">Tālrunis:</span> {row.phone}
                  </span>
                </div>
              </div>
              <span className="hidden shrink-0 self-center rounded-full bg-[var(--color-provin-accent)] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm sm:inline-flex sm:px-3 sm:py-1.5 sm:text-[12px]">
                Atvērt
              </span>
            </Link>
            {chips.length > 0 ? (
              <div className="hidden items-center border-l border-slate-100/90 px-2 md:flex lg:px-3">
                <div role="group" aria-label="Sludinājumu platformu saites" className={LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS}>
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
                    onClick={openAllListings}
                    title="Atvērt visas saites"
                    aria-label="Atvērt visas saites"
                    className={`${LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS} bg-slate-700 text-white ring-1 ring-slate-800/35`}
                  >
                    ALL
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          {chips.length > 0 ? (
            <div className="md:hidden">
              <div className="border-t border-slate-100/90 bg-slate-50/40 px-3 py-2 sm:px-4 sm:py-2.5">
                <div role="group" aria-label="Sludinājumu platformu saites" className={LISTING_PLATFORM_CHIPS_SCROLL_ROW_CLASS}>
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
                    onClick={openAllListings}
                    title="Atvērt visas saites"
                    aria-label="Atvērt visas saites"
                    className={`${LISTING_PLATFORM_CHIP_ANCHOR_BASE_CLASS} bg-slate-700 text-white ring-1 ring-slate-800/35`}
                  >
                    ALL
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </motion.div>
      </div>
    </Reorder.Item>
  );
}

export function IrissPasutijumiListClient({ rows }: { rows: IrissPasutijumsListRow[] }) {
  const [localRows, setLocalRows] = useState<IrissPasutijumsListRow[]>(rows);
  const [sortMode, setSortMode] = useState<SortMode>("created_desc");
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  useEffect(() => {
    try {
      const savedSort = localStorage.getItem(SORT_KEY) as SortMode | null;
      const savedManual = localStorage.getItem(ORDER_KEY);
      if (savedSort) setSortMode(savedSort);
      if (savedManual) {
        const parsed = JSON.parse(savedManual) as unknown;
        if (Array.isArray(parsed)) setManualOrder(parsed.filter((x): x is string => typeof x === "string"));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SORT_KEY, sortMode);
    } catch {
      /* ignore */
    }
  }, [sortMode]);

  const sortedRows = useMemo(() => sortRows(localRows, sortMode, manualOrder), [localRows, sortMode, manualOrder]);
  const rowMap = useMemo(() => new Map(localRows.map((r) => [r.id, r])), [localRows]);
  const canManualSort = sortMode === "manual";

  const patchRow = async (id: string, mutator: (record: IrissPasutijumsRecord) => IrissPasutijumsRecord) => {
    setActionBusy(id);
    try {
      const getRes = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(id)}`, { credentials: "include" });
      if (!getRes.ok) return;
      const getData = (await getRes.json()) as { record?: IrissPasutijumsRecord };
      if (!getData?.record) return;
      const nextRecord = mutator(getData.record);
      const patchRes = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextRecord),
      });
      if (!patchRes.ok) return;
      const patchData = (await patchRes.json()) as { record?: IrissPasutijumsRecord };
      if (!patchData?.record) return;
      const nextRow = rowFromRecord(patchData.record);
      setLocalRows((prev) => prev.map((r) => (r.id === id ? nextRow : r)));
    } finally {
      setActionBusy(null);
    }
  };

  const onPin = (id: string) => {
    setSwipeOpenId(null);
    void patchRow(id, (record) => ({
      ...record,
      pinnedAt: record.pinnedAt ? "" : new Date().toISOString(),
    }));
  };

  const onConfirmDelete = async () => {
    const id = deleteTargetId;
    if (!id) return;
    setActionBusy(id);
    try {
      const res = await fetch(`/api/admin/iriss-pasutijumi/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) return;
      setLocalRows((prev) => prev.filter((r) => r.id !== id));
      setDeleteTargetId(null);
      setSwipeOpenId(null);
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <>
      <div className="mt-2 flex justify-end">
        <label className="flex items-center gap-2 text-[12px] text-[var(--color-provin-muted)]">
          Kārtot:
          <select
            className="min-h-10 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] font-medium text-[var(--color-apple-text)] shadow-sm outline-none focus:border-[var(--color-provin-accent)] focus:ring-2 focus:ring-[var(--color-provin-accent)]/25"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
          >
            <option value="created_desc">Pievienošanas datums (jaunākie)</option>
            <option value="created_asc">Pievienošanas datums (vecākie)</option>
            <option value="brand_asc">Marka/modelis (A-Z)</option>
            <option value="brand_desc">Marka/modelis (Z-A)</option>
            <option value="budget_asc">Cena (zemākā)</option>
            <option value="budget_desc">Cena (augstākā)</option>
            <option value="manual">Manuāli (pieturi un velc)</option>
          </select>
        </label>
      </div>

      <Reorder.Group
        axis="y"
        values={sortedRows.map((r) => r.id)}
        onReorder={(ids) => {
          if (!canManualSort) return;
          setManualOrder(ids);
          try {
            localStorage.setItem(ORDER_KEY, JSON.stringify(ids));
          } catch {
            /* ignore */
          }
        }}
        className="mt-3 space-y-2.5 sm:space-y-3"
      >
        {sortedRows.map((row) => (
          <IrissRowCard
            key={row.id}
            row={rowMap.get(row.id) ?? row}
            canManualSort={canManualSort}
            swipeOpenId={swipeOpenId}
            setSwipeOpenId={setSwipeOpenId}
            onPin={onPin}
            onAskDelete={setDeleteTargetId}
          />
        ))}
      </Reorder.Group>

      {deleteTargetId ? (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/45 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
          onClick={() => !actionBusy && setDeleteTargetId(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold text-[var(--color-apple-text)]">
              Vai tiešām vēlaties neatgriezeniski dzēst šo pasūtījumu?
            </h2>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                disabled={Boolean(actionBusy)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-[13px] font-medium text-[var(--color-apple-text)] shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                Atcelt
              </button>
              <button
                type="button"
                onClick={() => void onConfirmDelete()}
                disabled={Boolean(actionBusy)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white shadow-sm transition hover:bg-red-800 disabled:opacity-50"
              >
                {actionBusy ? "Dzēš…" : "Dzēst"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <IrissPasutijumiNewFab />
    </>
  );
}

