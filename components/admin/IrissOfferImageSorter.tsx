"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, Menu, Star, Trash2, Undo2 } from "lucide-react";

import { AdminPhotoLightbox } from "@/components/admin/AdminPhotoLightbox";

import type { IrissOfferAttachment } from "@/lib/iriss-pasutijumi-types";
import {
  deleteOfferImages,
  moveOfferImage,
  offerImageDeleteToast,
  offerImageFullSrc,
  offerImageGridSrc,
  resolveOfferCoverId,
  restoreOfferImageSession,
  setOfferCoverPhoto,
  toggleOfferImageSelection,
  type OfferImageFrame,
} from "@/lib/iriss-offer-image-sorter";

const toolBtn =
  "inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 text-[15px] font-semibold text-[var(--color-apple-text)] shadow-sm transition hover:bg-slate-50 disabled:opacity-40 sm:text-[14px]";
const viewerBtn =
  "inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/10 px-4 text-[15px] font-semibold text-white transition hover:bg-white/20 disabled:opacity-40 sm:min-w-[160px] sm:flex-none";

type Frame = OfferImageFrame<IrissOfferAttachment>;

/** j61: "view" - pieskāriens atver skatītāju; "select" - atlase ar 44 px atzīmēm; "sort" - vilkšana ar ≡. */
export type OfferImageSorterMode = "view" | "select" | "sort";

/** Datorā ar peli vilkšana atļauta arī parastajā režīmā (kā līdz šim); telefonā tikai "Kārtot". */
function useFinePointerDesktop(): boolean {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px) and (pointer: fine)");
    const sync = () => setFine(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return fine;
}

function SortableOfferThumb({
  attachment,
  index,
  cover,
  selected,
  mode,
  dragEnabled,
  onToggle,
  onOpen,
}: {
  attachment: IrissOfferAttachment;
  index: number;
  cover: boolean;
  selected: boolean;
  mode: OfferImageSorterMode;
  dragEnabled: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: attachment.id,
    disabled: !dragEnabled,
  });
  const src = offerImageGridSrc(attachment);
  const selecting = mode === "select";
  const sorting = mode === "sort";

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // Ārpus "Kārtot" pirksts ritina lapu - vilkšana nekonkurē ar ritināšanu.
        touchAction: sorting ? "none" : "manipulation",
        opacity: isDragging ? 0.35 : 1,
        zIndex: isDragging ? 2 : undefined,
      }}
      className={`relative aspect-square overflow-hidden rounded-xl bg-slate-100 ${
        selected ? "ring-[3px] ring-[#0a84ff]" : "ring-1 ring-slate-200"
      } ${dragEnabled ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"}`}
      {...attributes}
      {...(dragEnabled ? listeners : {})}
      aria-label={selecting ? `${selected ? "Noņemt atlasi" : "Atlasīt"}: bilde ${index + 1}` : `Bilde ${index + 1}`}
      onClick={() => (selecting ? onToggle(attachment.id) : sorting ? undefined : onOpen(attachment.id))}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL / Blob miniatūra
        <img src={src} alt="" className="pointer-events-none h-full w-full object-cover" draggable={false} />
      ) : (
        <span className="pointer-events-none absolute inset-0 bg-slate-200" />
      )}
      <span style={{ color: "#fff" }} className="pointer-events-none absolute left-1.5 top-1.5 min-w-[22px] rounded-[7px] bg-black/55 px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums text-white">
        {index + 1}
      </span>
      {cover ? (
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-lg bg-white px-2 py-0.5 text-[11px] font-bold text-[#111] shadow-sm">
          Vāks
        </span>
      ) : null}
      {selecting ? (
        <span
          aria-hidden
          style={{ color: "#fff" }}
          className={`pointer-events-none absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-sm ${
            selected ? "border-white bg-[#0a84ff] text-white" : "border-white bg-black/25"
          }`}
        >
          {selected ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
        </span>
      ) : null}
      {sorting ? (
        <span
          aria-hidden
          style={{ color: "#fff" }}
          className="pointer-events-none absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white"
        >
          <Menu className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </li>
  );
}

export function IrissOfferImageSorter({
  attachments,
  coverId,
  disabled = false,
  fullSrc,
  onChange,
  addButton = null,
  onModeChange,
}: {
  attachments: IrissOfferAttachment[];
  coverId: string;
  disabled?: boolean;
  /** Pilnā attēla adrese saglabātām bildēm (ja pārlūkā ir tikai sīktēls). */
  fullSrc?: (att: IrissOfferAttachment) => string;
  onChange: (next: { attachments: IrissOfferAttachment[]; coverId: string }) => void;
  /** "+ Pievienot" poga rīkjoslā blakus Atlasīt / Kārtot. */
  addButton?: ReactNode;
  /** Atlases režīmā telefonā apakšā ir sava josla - izsaucējs paslēpj kājeni. */
  onModeChange?: (mode: OfferImageSorterMode) => void;
}) {
  const [mode, setModeState] = useState<OfferImageSorterMode>("view");
  const finePointer = useFinePointerDesktop();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const undoStack = useRef<Frame[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [toast, setToast] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const draggedAt = useRef(0);
  const toastTimer = useRef<number | null>(null);
  const cover = resolveOfferCoverId(attachments, coverId);
  const setMode = useCallback(
    (next: OfferImageSorterMode) => {
      setModeState(next);
      setSelectedIds([]);
      onModeChange?.(next);
    },
    [onModeChange],
  );
  useEffect(() => {
    if (attachments.length === 0 && mode !== "view") setMode("view");
  }, [attachments.length, mode, setMode]);
  const dragEnabled = !disabled && (mode === "sort" || (mode === "view" && finePointer));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    setSelectedIds((ids) => ids.filter((id) => attachments.some((att) => att.id === id)));
  }, [attachments]);

  useEffect(() => {
    return () => {
      if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const currentFrame = useCallback(
    (): Frame => ({
      images: attachments,
      coverId: cover,
      selectedIds,
    }),
    [attachments, cover, selectedIds],
  );

  const pushUndo = useCallback(() => {
    undoStack.current.push(currentFrame());
    if (undoStack.current.length > 40) undoStack.current.shift();
    setUndoCount(undoStack.current.length);
  }, [currentFrame]);

  const showToast = useCallback((text: string) => {
    setToast(text);
    if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 8000);
  }, []);

  const apply = useCallback(
    (nextAttachments: IrissOfferAttachment[], nextCover: string | null) => {
      onChange({ attachments: nextAttachments, coverId: nextCover ?? "" });
    },
    [onChange],
  );

  const undo = useCallback(() => {
    const snapshot = undoStack.current.pop();
    setUndoCount(undoStack.current.length);
    if (!snapshot) return;
    const restored = restoreOfferImageSession(snapshot, currentFrame());
    setSelectedIds(restored.selectedIds);
    apply(restored.images, restored.coverId);
    setToast("");
  }, [apply, currentFrame]);

  const onToggle = useCallback((id: string) => {
    setSelectedIds((ids) => toggleOfferImageSelection(ids, id));
  }, []);

  const onCover = useCallback(
    (id: string) => {
      const next = setOfferCoverPhoto(attachments, id);
      if (!next || (next.coverId === cover && next.images.every((img, i) => img.id === attachments[i]?.id))) return;
      pushUndo();
      setSelectedIds([]);
      apply(next.images, next.coverId);
    },
    [apply, attachments, cover, pushUndo],
  );

  const onDeleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const next = deleteOfferImages(attachments, cover, selectedIds);
    if (next.removed.length === 0) return;
    pushUndo();
    setSelectedIds([]);
    apply(next.images, next.coverId);
    showToast(offerImageDeleteToast(next.removed.length));
    setMode("view");
  }, [apply, attachments, cover, pushUndo, selectedIds, setMode, showToast]);

  const onCoverSelected = useCallback(() => {
    const id = selectedIds[0];
    if (selectedIds.length !== 1 || !id) return;
    onCover(id);
    setMode("view");
  }, [onCover, selectedIds, setMode]);

  const onDragStart = useCallback((event: DragStartEvent) => {
    draggedAt.current = Date.now();
    setActiveId(String(event.active.id));
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      draggedAt.current = Date.now();
      setActiveId(null);
      const overId = event.over ? String(event.over.id) : "";
      const active = String(event.active.id);
      if (!overId || active === overId) return;
      const next = moveOfferImage(attachments, active, overId);
      if (next.every((img, i) => img.id === attachments[i]?.id)) return;
      pushUndo();
      apply(next, next[0]?.id ?? null);
    },
    [apply, attachments, pushUndo],
  );

  const onDragCancel = useCallback(() => setActiveId(null), []);
  // Pēc vilkšanas pārlūks var atsūtīt "click" - tad skatu neatveram.
  const onOpen = useCallback((id: string) => {
    if (Date.now() - draggedAt.current < 400) return;
    setViewId(id);
  }, []);
  const viewIndex = viewId ? attachments.findIndex((att) => att.id === viewId) : -1;

  const onDeleteOne = useCallback(
    (id: string) => {
      const next = deleteOfferImages(attachments, cover, [id]);
      if (next.removed.length === 0) return;
      pushUndo();
      setSelectedIds((ids) => ids.filter((x) => x !== id));
      const idx = attachments.findIndex((att) => att.id === id);
      const neighbour = next.images[Math.min(idx, next.images.length - 1)];
      setViewId(neighbour ? neighbour.id : null);
      apply(next.images, next.coverId);
      showToast(offerImageDeleteToast(1));
    },
    [apply, attachments, cover, pushUndo, showToast],
  );
  const active = attachments.find((att) => att.id === activeId) ?? null;
  const activeSrc = active ? offerImageGridSrc(active) : "";

  const selCount = selectedIds.length;

  return (
    <div className="mt-3">
      {mode === "view" ? (
        <div className="flex items-center gap-2">
          <button type="button" className={toolBtn} disabled={disabled || attachments.length === 0} onClick={() => setMode("select")}>
            Atlasīt
          </button>
          <button type="button" className={toolBtn} disabled={disabled || attachments.length < 2} onClick={() => setMode("sort")}>
            Kārtot
          </button>
          {addButton}
        </div>
      ) : mode === "select" ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[15px] font-semibold text-[var(--color-apple-text)]" role="status">
            {selCount > 0 ? `Atlasītas ${selCount}` : "Pieskaries bildēm"}
          </p>
          <button
            type="button"
            className="inline-flex h-11 min-w-[120px] items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-[15px] font-semibold text-[#0a84ff] shadow-sm"
            style={{ color: "#0a84ff" }}
            onClick={() => setMode("view")}
          >
            Atcelt
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[14px] text-slate-500">Velc bildi uz jauno vietu</p>
          <button
            type="button"
            className="inline-flex h-11 min-w-[120px] items-center justify-center rounded-xl bg-[#1d1d1f] px-4 text-[15px] font-semibold text-white"
            style={{ color: "#fff", background: "#1d1d1f" }}
            onClick={() => setMode("view")}
          >
            Gatavs
          </button>
        </div>
      )}
      {undoCount > 0 && mode === "view" && !toast ? (
        <div className="mt-1 flex justify-end">
          <button
            type="button"
            className="inline-flex h-11 items-center gap-1.5 rounded-xl px-2 text-[13px] font-semibold text-slate-600 disabled:opacity-40"
            disabled={disabled}
            onClick={undo}
          >
            <Undo2 className="h-4 w-4" aria-hidden />
            Atsaukt pēdējo
          </button>
        </div>
      ) : null}
      {attachments.length > 0 ? (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <SortableContext items={attachments.map((att) => att.id)} strategy={rectSortingStrategy}>
          <ul className="mt-2 grid list-none grid-cols-3 gap-2 sm:grid-cols-4">
            {attachments.map((att, index) => (
              <SortableOfferThumb
                key={att.id}
                attachment={att}
                index={index}
                cover={att.id === cover}
                selected={selectedIds.includes(att.id)}
                mode={mode}
                dragEnabled={dragEnabled}
                onToggle={onToggle}
                onOpen={onOpen}
              />
            ))}
          </ul>
        </SortableContext>
        <DragOverlay>
          {activeSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={activeSrc} alt="" className="h-28 w-28 rotate-2 rounded-xl object-cover shadow-xl" />
          ) : null}
        </DragOverlay>
      </DndContext>
      ) : null}
      {mode === "select" ? (
        <div className="fixed inset-x-0 bottom-0 z-10 flex gap-2 border-t border-slate-200/80 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:mt-3 sm:border-0 sm:p-0">
          <button
            type="button"
            className={`${toolBtn} h-12 text-red-600`}
            style={{ color: "#dc2626" }}
            disabled={disabled || selCount === 0}
            onClick={onDeleteSelected}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Dzēst{selCount > 0 ? ` (${selCount})` : ""}
          </button>
          <button type="button" className={`${toolBtn} h-12`} disabled={disabled || selCount !== 1} onClick={onCoverSelected}>
            <Star className="h-4 w-4" aria-hidden />
            Padarīt par vāku
          </button>
        </div>
      ) : null}
      <AdminPhotoLightbox
        photos={attachments.map((att) => ({
          id: att.id,
          src: (att.dataUrl ? "" : fullSrc?.(att)) || offerImageFullSrc(att),
          thumbSrc: offerImageGridSrc(att),
        }))}
        index={viewIndex >= 0 ? viewIndex : null}
        onIndexChange={(i) => setViewId(attachments[i]?.id ?? null)}
        onClose={() => setViewId(null)}
        thumbnails
        actions={(i) => {
          const att = attachments[i];
          if (!att) return null;
          return (
            <>
              <button type="button" className={viewerBtn} disabled={disabled || att.id === cover} onClick={() => onCover(att.id)}>
                <Star className={`h-4 w-4 ${att.id === cover ? "fill-white" : ""}`} aria-hidden />
                {att.id === cover ? "Vāks" : "Padarīt par vāku"}
              </button>
              <button type="button" className={`${viewerBtn} text-[#ff453a]`} style={{ color: "#ff453a" }} disabled={disabled} onClick={() => onDeleteOne(att.id)}>
                <Trash2 className="h-4 w-4" aria-hidden />
                Dzēst
              </button>
            </>
          );
        }}
      />
      {toast ? (
        <div
          className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-slate-900 px-3 py-2 text-[12px] text-white"
          role="status"
        >
          <span>{toast}</span>
          <button type="button" className="font-semibold text-white underline" onClick={undo}>
            Atsaukt
          </button>
        </div>
      ) : null}
    </div>
  );
}
