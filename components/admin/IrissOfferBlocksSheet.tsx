"use client";

/**
 * j61: "Secība un papildu bloki" - telefonā AdminMobileSheet, datorā tas pats saturs zem pogas.
 * Iebūvētās sadaļas (Transportlīdzeklis, Izsole, Cenas ...) šeit tikai redzamas ar stāvokli - tās labo
 * savā cilnē ar zaļo sviru. Papildu "Teksts" / "Tabula" blokus var pievienot, labot, vilkt (≡) un dzēst (×).
 */

import { useState, type ReactNode } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronRight, Menu, Plus, X } from "lucide-react";
import { AdminMobileSheet } from "@/components/admin/mobile/AdminMobileChrome";
import { useAdminMobileViewport } from "@/components/admin/useAdminMobileViewport";
import {
  addIrissOfferBlock,
  addIrissOfferBlockRow,
  irissOfferBlockPlaceLabel,
  isIrissOfferExtraBlock,
  moveIrissOfferBlockTo,
  removeIrissOfferBlockRow,
  removeIrissOfferExtraBlock,
  upsertIrissOfferBlockRow,
  type IrissOfferBlock,
} from "@/lib/iriss-offer-blocks";

const fieldClass =
  "min-h-[44px] w-full min-w-0 rounded-[11px] border border-slate-200 bg-white px-3 py-2 text-[16px] text-[var(--color-apple-text)] outline-none focus:border-[var(--color-provin-accent)] focus:ring-2 focus:ring-[var(--color-provin-accent)]/20 sm:text-[14px]";
const iconBtn =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 disabled:opacity-40";
const addBtn =
  "inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[15px] font-semibold text-[var(--color-apple-text)] shadow-sm transition hover:bg-slate-50";

function ExtraBlockEditor({
  block,
  blocks,
  setBlocks,
}: {
  block: IrissOfferBlock;
  blocks: IrissOfferBlock[];
  setBlocks: (next: IrissOfferBlock[]) => void;
}) {
  const setTitle = (title: string) => setBlocks(blocks.map((b) => (b.id === block.id ? { ...b, title } : b)));
  return (
    <div className="space-y-2 pb-3 pl-11">
      <input className={`${fieldClass} font-semibold`} value={block.title} aria-label="Bloka virsraksts" onChange={(e) => setTitle(e.target.value)} />
      {block.kind === "table" ? (
        <>
          {(block.rows ?? []).map((row) => (
            <div key={row.id} className="flex items-start gap-1.5">
              <div className="grid min-w-0 flex-1 grid-cols-1 gap-1.5 sm:grid-cols-2">
                <input
                  className={fieldClass}
                  value={row.label}
                  placeholder="Nosaukums"
                  aria-label="Rindas nosaukums"
                  onChange={(e) => setBlocks(upsertIrissOfferBlockRow(blocks, block.id, { ...row, label: e.target.value }))}
                />
                <input
                  className={fieldClass}
                  value={row.value}
                  placeholder="Vērtība"
                  aria-label="Rindas vērtība"
                  onChange={(e) => setBlocks(upsertIrissOfferBlockRow(blocks, block.id, { ...row, value: e.target.value }))}
                />
              </div>
              <button
                type="button"
                className={iconBtn}
                aria-label="Dzēst rindu"
                title="Dzēst rindu"
                onClick={() => setBlocks(removeIrissOfferBlockRow(blocks, block.id, row.id))}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="inline-flex h-11 items-center gap-1 rounded-xl px-2 text-[14px] font-semibold text-[var(--color-provin-accent)]"
            onClick={() => setBlocks(addIrissOfferBlockRow(blocks, block.id))}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Pievienot rindu
          </button>
        </>
      ) : (
        <>
          <textarea
            className={`${fieldClass} min-h-[110px] resize-y`}
            value={block.html ?? ""}
            aria-label={block.title || "Teksts"}
            onChange={(e) => setBlocks(blocks.map((b) => (b.id === block.id ? { ...b, html: e.target.value } : b)))}
          />
          <p className="text-[12px] text-slate-500">Virsraksts sākas ar #. Treknraksts ar **. Garās svītras tiek aizstātas ar `-`.</p>
        </>
      )}
    </div>
  );
}

function ExtraBlockRow({
  block,
  open,
  onToggleOpen,
  onRemove,
  children,
}: {
  block: IrissOfferBlock;
  open: boolean;
  onToggleOpen: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 2 : undefined }}
      className={`border-b border-slate-100 bg-white ${isDragging ? "shadow-lg" : ""}`}
    >
      <div className="flex min-h-[52px] items-center gap-1">
        <button
          type="button"
          ref={setActivatorNodeRef}
          className={`${iconBtn} cursor-grab touch-none text-slate-400 active:cursor-grabbing`}
          aria-label={`Vilkt: ${block.title}`}
          {...attributes}
          {...listeners}
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <button type="button" className="flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center text-left" onClick={onToggleOpen} aria-expanded={open}>
          <span className="w-full truncate text-[15px] text-[var(--color-apple-text)]">{block.title || "Bloks"}</span>
          <span className="text-[12px] text-slate-500">
            {irissOfferBlockPlaceLabel(block, 0)}
            {block.visible ? "" : " · paslēpts"}
          </span>
        </button>
        <button type="button" className={iconBtn} aria-label={`Dzēst bloku: ${block.title}`} title="Dzēst bloku" onClick={onRemove}>
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      {open ? children : null}
    </li>
  );
}

function BlocksList({
  blocks,
  photoCount,
  setBlocks,
}: {
  blocks: IrissOfferBlock[];
  photoCount: number;
  setBlocks: (next: IrissOfferBlock[]) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const builtIn = blocks.filter((b) => !isIrissOfferExtraBlock(b));
  const extras = blocks.filter((b) => isIrissOfferExtraBlock(b));
  const onDragEnd = (event: DragEndEvent) => {
    const overId = event.over ? String(event.over.id) : "";
    if (overId) setBlocks(moveIrissOfferBlockTo(blocks, String(event.active.id), overId));
  };
  const add = (kind: "text" | "table") => {
    const next = addIrissOfferBlock(blocks, kind);
    setBlocks(next);
    setOpenId(next[next.length - 1]?.id ?? null);
  };

  return (
    <div>
      <ul className="list-none">
        {builtIn.map((b) => (
          <li key={b.id} className="flex min-h-[52px] items-center gap-1 border-b border-slate-100">
            <span className="w-11 shrink-0" aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] text-[var(--color-apple-text)]">{b.title}</span>
              <span className="text-[12px] text-slate-500">{irissOfferBlockPlaceLabel(b, photoCount)}</span>
            </span>
            <span className={`shrink-0 pr-2 text-[12px] font-medium ${b.visible ? "text-emerald-700" : "text-amber-700"}`}>
              {b.visible ? "Rāda" : "Paslēpts"}
            </span>
          </li>
        ))}
      </ul>
      {extras.length ? (
        <>
          <p className="mt-3 text-[12px] text-slate-500">Papildu bloki - PDF un saitē aiz Cenām. Velc ≡, lai mainītu secību.</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={extras.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <ul className="list-none">
                {extras.map((b) => (
                  <ExtraBlockRow
                    key={b.id}
                    block={b}
                    open={openId === b.id}
                    onToggleOpen={() => setOpenId((id) => (id === b.id ? null : b.id))}
                    onRemove={() => setBlocks(removeIrissOfferExtraBlock(blocks, b.id))}
                  >
                    <ExtraBlockEditor block={b} blocks={blocks} setBlocks={setBlocks} />
                  </ExtraBlockRow>
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button type="button" className={addBtn} onClick={() => add("text")}>
          + Teksts
        </button>
        <button type="button" className={addBtn} onClick={() => add("table")}>
          + Tabula
        </button>
      </div>
    </div>
  );
}

export function IrissOfferBlocksSheet({
  blocks,
  photoCount,
  onChange,
}: {
  /** Jau atrisināti bloki (resolveIrissOfferBlocks). */
  blocks: IrissOfferBlock[];
  photoCount: number;
  onChange: (next: IrissOfferBlock[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const mobile = useAdminMobileViewport();
  const extraCount = blocks.filter((b) => isIrissOfferExtraBlock(b)).length;
  const list = <BlocksList blocks={blocks} photoCount={photoCount} setBlocks={onChange} />;

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[52px] w-full items-center justify-between gap-2 rounded-2xl border border-slate-200/80 bg-white px-3.5 text-left transition hover:bg-slate-50"
      >
        <span className="text-[15px] font-semibold text-[var(--color-apple-text)]">Secība un papildu bloki</span>
        <span className="inline-flex items-center gap-1 text-[14px] tabular-nums text-slate-500">
          {extraCount > 0 ? `+${extraCount}` : blocks.length}
          <ChevronRight className={`h-4 w-4 transition ${open && !mobile ? "rotate-90" : ""}`} aria-hidden />
        </span>
      </button>
      {mobile ? (
        <AdminMobileSheet open={open} title="Secība un papildu bloki" onClose={() => setOpen(false)} opaque zIndex={140}>
          {list}
        </AdminMobileSheet>
      ) : open ? (
        <div className="mt-2 rounded-2xl border border-slate-200/80 bg-white px-3 pb-3 pt-1">{list}</div>
      ) : null}
    </>
  );
}
