"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { Star, Trash2, Undo2 } from "lucide-react";

import type { IrissOfferAttachment } from "@/lib/iriss-pasutijumi-types";
import {
  deleteOfferImages,
  moveOfferImage,
  offerImageDeleteToast,
  offerImageGridSrc,
  resolveOfferCoverId,
  restoreOfferImageSession,
  setOfferCoverPhoto,
  toggleOfferImageSelection,
  type OfferImageFrame,
} from "@/lib/iriss-offer-image-sorter";

const toolBtn =
  "inline-flex h-9 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 text-[12px] font-semibold text-[var(--color-apple-text)] disabled:opacity-40";

type Frame = OfferImageFrame<IrissOfferAttachment>;

function SortableOfferThumb({
  attachment,
  index,
  cover,
  selected,
  disabled,
  onToggle,
  onCover,
}: {
  attachment: IrissOfferAttachment;
  index: number;
  cover: boolean;
  selected: boolean;
  disabled: boolean;
  onToggle: (id: string) => void;
  onCover: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: attachment.id,
    disabled,
  });
  const src = offerImageGridSrc(attachment);

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: "none",
        opacity: isDragging ? 0.35 : 1,
        zIndex: isDragging ? 2 : undefined,
      }}
      className={`relative aspect-square overflow-hidden rounded-xl border bg-slate-100 ${
        selected
          ? "border-[var(--color-provin-accent)] ring-2 ring-[var(--color-provin-accent)]/50"
          : "border-slate-200"
      } ${disabled ? "" : "cursor-grab active:cursor-grabbing"}`}
      {...attributes}
      {...(disabled ? {} : listeners)}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL / Blob miniatūra
        <img src={src} alt="" className="pointer-events-none h-full w-full object-cover" draggable={false} />
      ) : (
        <span className="pointer-events-none absolute inset-0 bg-slate-200" />
      )}
      <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        {index + 1}
      </span>
      {cover ? (
        <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-[var(--color-provin-accent)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
          Vāks
        </span>
      ) : null}
      <button
        type="button"
        aria-pressed={selected}
        aria-label={selected ? "Noņemt atlasi" : "Atlasīt attēlu"}
        disabled={disabled}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(attachment.id);
        }}
        className={`absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full border text-[12px] font-bold shadow-sm ${
          selected ? "border-[var(--color-provin-accent)] bg-[var(--color-provin-accent)] text-white" : "border-white/80 bg-black/45 text-white"
        }`}
      >
        {selected ? "✓" : ""}
      </button>
      <button
        type="button"
        aria-label="Iestatīt kā vāka foto"
        title="Vāka foto"
        disabled={disabled}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onCover(attachment.id);
        }}
        className="absolute bottom-1 right-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white shadow-sm"
      >
        <Star className={`h-3.5 w-3.5 ${cover ? "fill-white" : ""}`} aria-hidden />
      </button>
    </li>
  );
}

export function IrissOfferImageSorter({
  attachments,
  coverId,
  disabled = false,
  onChange,
}: {
  attachments: IrissOfferAttachment[];
  coverId: string;
  disabled?: boolean;
  onChange: (next: { attachments: IrissOfferAttachment[]; coverId: string }) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const undoStack = useRef<Frame[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [toast, setToast] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const cover = resolveOfferCoverId(attachments, coverId);
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
  }, [apply, attachments, cover, pushUndo, selectedIds, showToast]);

  const onDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
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
  const active = attachments.find((att) => att.id === activeId) ?? null;
  const activeSrc = active ? offerImageGridSrc(active) : "";

  if (attachments.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={toolBtn} disabled={disabled || selectedIds.length !== 1} onClick={() => selectedIds[0] && onCover(selectedIds[0])}>
          <Star className="h-3.5 w-3.5" aria-hidden />
          Vāka foto
        </button>
        <button type="button" className={toolBtn} disabled={disabled || selectedIds.length === 0} onClick={onDeleteSelected}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Dzēst{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
        </button>
        <button type="button" className={toolBtn} disabled={disabled || undoCount === 0} onClick={undo}>
          <Undo2 className="h-3.5 w-3.5" aria-hidden />
          Atsaukt
        </button>
      </div>
      <p className="mt-2 text-[10px] font-medium text-slate-500">
        Velc attēlu, lai mainītu secību. Ķeksītis atlasa vairākus. Pirmais ir vāks.
      </p>
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
                disabled={disabled}
                onToggle={onToggle}
                onCover={onCover}
              />
            ))}
          </ul>
        </SortableContext>
        <DragOverlay>
          {activeSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={activeSrc} alt="" className="h-24 w-24 rounded-xl object-cover shadow-lg" />
          ) : null}
        </DragOverlay>
      </DndContext>
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
