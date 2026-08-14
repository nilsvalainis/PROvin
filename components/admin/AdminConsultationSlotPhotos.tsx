"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImagePlus, Loader2, Maximize2, Trash2 } from "lucide-react";
import type { ConsultationSlotPhotoMeta } from "@/lib/admin-consultation-draft-types";
import { CONSULTATION_MAX_PHOTOS_PER_SLOT } from "@/lib/admin-consultation-draft-types";
import { compressImageFileToJpegForConsultation } from "@/lib/consultation-photo-client-compress";
import { AdminPhotoLightbox, type AdminLightboxPhoto } from "@/components/admin/AdminPhotoLightbox";

const inp =
  "mt-1 w-full rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1.5 text-[11px] text-[var(--admin-field-text)] placeholder:text-[var(--color-provin-muted)]";

const IMAGE_FILE_RE = /\.(jpe?g|png|webp|gif|heic|heif)$/i;

type Props = {
  sessionId: string;
  slotIndex: number;
  photos: ConsultationSlotPhotoMeta[];
  disabled: boolean;
  /** Komentāru labojumi — vecāks tikai `setWs` (debounced saglabāšana). */
  onPhotosPatch: (next: ConsultationSlotPhotoMeta[]) => void;
  /** Pēc augšupielādes / dzēšanas / kārtošanas — vecāks flush + tūlītējs PATCH. */
  onPhotosStructuralCommit: (next: ConsultationSlotPhotoMeta[]) => void;
};

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return IMAGE_FILE_RE.test(file.name);
}

function collectImageFiles(list: FileList | File[] | null | undefined): File[] {
  if (!list?.length) return [];
  return Array.from(list).filter(isImageFile);
}

function SortableSlotPhoto({
  photo,
  position,
  src,
  disabled,
  busy,
  onRemove,
  onZoom,
  onComment,
}: {
  photo: ConsultationSlotPhotoMeta;
  position: number;
  src: string;
  disabled: boolean;
  busy: boolean;
  onRemove: () => void;
  onZoom: () => void;
  onComment: (comment: string) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: photo.id, disabled: disabled || busy });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`flex min-w-0 flex-col gap-1.5 rounded-md border bg-[var(--admin-surface-elevated)] p-2 ${
        isDragging
          ? "border-[var(--color-provin-accent)] ring-2 ring-[var(--color-provin-accent)]/40"
          : "border-[var(--admin-field-border)]"
      }`}
    >
      <div className="group relative aspect-[4/3] w-full overflow-hidden rounded bg-black/[0.06] dark:bg-white/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="h-full w-full object-contain"
          loading="lazy"
          decoding="async"
          draggable={false}
        />
        <span className="pointer-events-none absolute left-1 top-1 inline-flex min-w-[1.1rem] justify-center rounded bg-black/60 px-1 py-px text-[9px] font-semibold leading-tight text-white">
          {position}
        </span>
        <span className="absolute right-1 top-1 flex gap-1">
          <button
            type="button"
            onClick={onZoom}
            aria-label="Apskatīt lielu"
            className="inline-flex h-6 w-6 items-center justify-center rounded bg-black/55 text-white transition hover:bg-black/75"
          >
            <Maximize2 className="h-3 w-3" aria-hidden />
          </button>
          {!disabled ? (
            /** Atsevišķs rokturis — citādi vilkšana traucētu komentāra laukam. */
            <button
              type="button"
              ref={setActivatorNodeRef}
              {...attributes}
              {...listeners}
              aria-label={`Pārkārtot fotogrāfiju ${position}`}
              style={{ touchAction: "none" }}
              className="inline-flex h-6 w-6 cursor-grab items-center justify-center rounded bg-black/55 text-white transition hover:bg-black/75 active:cursor-grabbing"
            >
              <GripVertical className="h-3 w-3" aria-hidden />
            </button>
          ) : null}
        </span>
      </div>
      <label className="block text-[9px] font-medium text-[var(--color-provin-muted)]">
        Komentārs
        <textarea
          className={`${inp} mt-0.5 min-h-[52px] resize-y`}
          rows={2}
          value={photo.comment}
          onChange={(e) => onComment(e.target.value)}
          disabled={disabled}
          placeholder="Piezīme pie šīs fotogrāfijas…"
        />
      </label>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled || busy}
        className="inline-flex items-center justify-center gap-1 self-start rounded border border-red-200/80 bg-red-50/80 px-2 py-1 text-[10px] font-medium text-red-800 hover:bg-red-100 disabled:opacity-45 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
      >
        <Trash2 className="h-3 w-3" aria-hidden />
        Noņemt
      </button>
    </li>
  );
}

export function AdminConsultationSlotPhotos({
  sessionId,
  slotIndex,
  photos,
  disabled,
  onPhotosPatch,
  onPhotosStructuralCommit,
}: Props) {
  const inputId = useId();
  const dropDepthRef = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [lightboxId, setLightboxId] = useState<string | null>(null);

  const atLimit = photos.length >= CONSULTATION_MAX_PHOTOS_PER_SLOT;

  const imgSrc = useCallback(
    (photoId: string) =>
      `/api/admin/consultation-slot-photo?sessionId=${encodeURIComponent(sessionId)}&photoId=${encodeURIComponent(photoId)}`,
    [sessionId],
  );

  const uploadFiles = useCallback(
    async (incoming: File[]) => {
      const files = collectImageFiles(incoming);
      if (files.length === 0 || disabled) return;
      setBusy(true);
      setError(null);
      try {
        let rolling = [...photos];
        let added = 0;
        for (const file of files) {
          if (rolling.length >= CONSULTATION_MAX_PHOTOS_PER_SLOT) {
            setError(`Sasniegts fotogrāfiju limits (${CONSULTATION_MAX_PHOTOS_PER_SLOT} vienā sadaļā).`);
            break;
          }
          setStatusLine(`Apstrādā: ${file.name}…`);
          let jpeg: File;
          try {
            jpeg = await compressImageFileToJpegForConsultation(file);
          } catch {
            setError(
              "Neizdevās apstrādāt attēlu (piem. HEIF/HEIC, ja pārlūks neatbalsta). Mēģini citu pārlūku vai eksportē JPG no Foto lietotnes.",
            );
            continue;
          }
          setStatusLine(`Augšupielādē: ${file.name}…`);
          const fd = new FormData();
          fd.set("sessionId", sessionId);
          fd.set("slotIndex", String(slotIndex));
          fd.set("file", jpeg);
          let data: { ok?: boolean; id?: string; error?: string } = {};
          let httpOk = false;
          try {
            const res = await fetch("/api/admin/consultation-slot-photo", {
              method: "POST",
              body: fd,
              credentials: "include",
            });
            httpOk = res.ok;
            data = (await res.json().catch(() => ({}))) as typeof data;
          } catch {
            data = {};
          }
          if (!httpOk || !data.id) {
            setError(
              data.error === "slot_photo_limit"
                ? `Sasniegts fotogrāfiju limits (${CONSULTATION_MAX_PHOTOS_PER_SLOT} vienā sadaļā).`
                : data.error === "file_too_large"
                  ? "Fails pēc kompresijas joprojām pārāk liels."
                  : data.error === "invalid_jpeg"
                    ? "Serveris pieņem tikai JPEG pēc kompresijas."
                    : "Augšupielāde neizdevās.",
            );
            continue;
          }
          rolling = [...rolling, { id: data.id, comment: "" }];
          added += 1;
          onPhotosStructuralCommit(rolling);
        }
        setStatusLine(added > 0 ? `Pievienotas ${added} fotogrāfijas.` : null);
      } finally {
        setBusy(false);
        window.setTimeout(() => setStatusLine(null), 3000);
      }
    },
    [disabled, onPhotosStructuralCommit, photos, sessionId, slotIndex],
  );

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    /**
     * `input.files` ir dzīvs saraksts — `value = ""` to iztukšo. Tāpēc vispirms kopija masīvā,
     * citādi izvēle caur failu pārlūku klusi neizdarīja neko.
     */
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0 || disabled) return;
    await uploadFiles(files);
  };

  const removePhoto = async (photoId: string) => {
    if (disabled || busy) return;
    setBusy(true);
    setError(null);
    try {
      await fetch("/api/admin/consultation-slot-photo", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, photoId }),
      });
      onPhotosStructuralCommit(photos.filter((p) => p.id !== photoId));
    } finally {
      setBusy(false);
    }
  };

  const setComment = (photoId: string, comment: string) => {
    onPhotosPatch(photos.map((p) => (p.id === photoId ? { ...p, comment } : p)));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const from = photos.findIndex((p) => p.id === active.id);
      const to = photos.findIndex((p) => p.id === over.id);
      if (from < 0 || to < 0) return;
      onPhotosStructuralCommit(arrayMove(photos, from, to));
    },
    [onPhotosStructuralCommit, photos],
  );

  const lightboxPhotos = useMemo<AdminLightboxPhoto[]>(
    () => photos.map((p) => ({ id: p.id, src: imgSrc(p.id), caption: p.comment?.trim() || undefined })),
    [imgSrc, photos],
  );
  const lightboxIndex = lightboxId ? lightboxPhotos.findIndex((p) => p.id === lightboxId) : -1;

  return (
    <div className="min-w-0 space-y-2 rounded-lg border border-[var(--admin-border-subtle)] bg-black/[0.02] p-2 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
          Fotogrāfijas · {photos.length}/{CONSULTATION_MAX_PHOTOS_PER_SLOT}
        </h3>
        <label
          htmlFor={inputId}
          className={`inline-flex items-center gap-1 rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1 text-[10px] font-medium text-[var(--admin-field-text)] ${
            disabled || busy || atLimit
              ? "pointer-events-none opacity-45"
              : "cursor-pointer hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
          }`}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ImagePlus className="h-3.5 w-3.5" aria-hidden />}
          Pievienot
        </label>
      </div>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
        multiple
        className="sr-only"
        onChange={(e) => void onFileChange(e)}
        disabled={disabled || busy || atLimit}
      />
      {disabled ? (
        <p className="text-[10px] text-amber-700 dark:text-amber-300">
          Melnraksta glabātuve izslēgta — fotogrāfijas nevar saglabāt serverī.
        </p>
      ) : null}

      {!disabled ? (
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dropDepthRef.current += 1;
            setDropActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dropDepthRef.current = Math.max(0, dropDepthRef.current - 1);
            if (dropDepthRef.current === 0) setDropActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            dropDepthRef.current = 0;
            setDropActive(false);
            if (busy || atLimit) return;
            void uploadFiles(Array.from(e.dataTransfer.files ?? []));
          }}
          className={`rounded-md border border-dashed px-3 py-2.5 text-[10px] leading-snug transition-colors ${
            dropActive
              ? "border-[var(--color-provin-accent)] bg-[var(--color-provin-accent-soft)]/40 text-[var(--color-provin-accent)]"
              : "border-[var(--admin-field-border)] bg-black/[0.02] text-[var(--color-provin-muted)] dark:bg-white/[0.02]"
          } ${atLimit ? "opacity-45" : ""}`}
        >
          Velc attēlus šeit vai izmanto „Pievienot”. JPEG tiek izveidots pirms augšupielādes (~līdz 200 KB); iPhone HEIC —
          ja kļūda, mēģini Safari vai eksportē JPG.
        </div>
      ) : null}

      {statusLine ? (
        <p className="flex items-center gap-1.5 text-[10px] text-[var(--color-provin-accent)]">
          {busy ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden /> : null}
          {statusLine}
        </p>
      ) : null}
      {error ? <p className="text-[10px] text-red-600 dark:text-red-400">{error}</p> : null}

      {photos.length > 1 ? (
        <p className="text-[10px] text-[var(--color-provin-muted)]">
          Secību maini, velkot no rokturja augšējā labajā stūrī; numurs = vieta PDF.
        </p>
      ) : null}

      {photos.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {photos.map((p, index) => (
                <SortableSlotPhoto
                  key={p.id}
                  photo={p}
                  position={index + 1}
                  src={imgSrc(p.id)}
                  disabled={disabled}
                  busy={busy}
                  onRemove={() => void removePhoto(p.id)}
                  onZoom={() => setLightboxId(p.id)}
                  onComment={(comment) => setComment(p.id, comment)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : null}

      <AdminPhotoLightbox
        photos={lightboxPhotos}
        index={lightboxIndex >= 0 ? lightboxIndex : null}
        onIndexChange={(i) => setLightboxId(lightboxPhotos[i]?.id ?? null)}
        onClose={() => setLightboxId(null)}
      />
    </div>
  );
}
