"use client";

import { useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import type { ConsultationSlotPhotoMeta } from "@/lib/admin-consultation-draft-types";
import { CONSULTATION_MAX_PHOTOS_PER_SLOT } from "@/lib/admin-consultation-draft-types";
import { compressImageFileToJpegForConsultation } from "@/lib/consultation-photo-client-compress";

const inp =
  "mt-1 w-full rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1.5 text-[11px] text-[var(--admin-field-text)] placeholder:text-[var(--color-provin-muted)]";

type Props = {
  sessionId: string;
  slotIndex: number;
  photos: ConsultationSlotPhotoMeta[];
  disabled: boolean;
  /** Komentāru labojumi — vecāks tikai `setWs` (debounced saglabāšana). */
  onPhotosPatch: (next: ConsultationSlotPhotoMeta[]) => void;
  /** Pēc augšupielādes / dzēšanas — vecāks flush + tūlītējs PATCH. */
  onPhotosStructuralCommit: (next: ConsultationSlotPhotoMeta[]) => void;
};

export function AdminConsultationSlotPhotos({
  sessionId,
  slotIndex,
  photos,
  disabled,
  onPhotosPatch,
  onPhotosStructuralCommit,
}: Props) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imgSrc = (photoId: string) =>
    `/api/admin/consultation-slot-photo?sessionId=${encodeURIComponent(sessionId)}&photoId=${encodeURIComponent(photoId)}`;

  const pickFiles = () => {
    if (disabled || busy) return;
    setError(null);
    fileRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    e.target.value = "";
    if (!list?.length || disabled) return;
    setBusy(true);
    setError(null);
    try {
      let rolling = [...photos];
      for (const file of Array.from(list)) {
        if (rolling.length >= CONSULTATION_MAX_PHOTOS_PER_SLOT) break;
        let jpeg: File;
        try {
          jpeg = await compressImageFileToJpegForConsultation(file);
        } catch {
          setError(
            "Neizdevās apstrādāt attēlu (piem. HEIF/HEIC, ja pārlūks neatbalsta). Mēģini citu pārlūku vai eksportē JPG no Foto lietotnes.",
          );
          continue;
        }
        const fd = new FormData();
        fd.set("sessionId", sessionId);
        fd.set("slotIndex", String(slotIndex));
        fd.set("file", jpeg);
        const res = await fetch("/api/admin/consultation-slot-photo", {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
        if (!res.ok || !data.id) {
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
        onPhotosStructuralCommit(rolling);
      }
    } finally {
      setBusy(false);
    }
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
      const next = photos.filter((p) => p.id !== photoId);
      onPhotosStructuralCommit(next);
    } finally {
      setBusy(false);
    }
  };

  const setComment = (photoId: string, comment: string) => {
    onPhotosPatch(photos.map((p) => (p.id === photoId ? { ...p, comment } : p)));
  };

  return (
    <div className="min-w-0 space-y-2 rounded-lg border border-[var(--admin-border-subtle)] bg-black/[0.02] p-2 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
          Fotogrāfijas
        </h3>
        <button
          type="button"
          onClick={pickFiles}
          disabled={disabled || busy || photos.length >= CONSULTATION_MAX_PHOTOS_PER_SLOT}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1 text-[10px] font-medium text-[var(--admin-field-text)] disabled:opacity-45"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ImagePlus className="h-3.5 w-3.5" aria-hidden />}
          Pievienot
        </button>
      </div>
      <input
        ref={fileRef}
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={onFileChange}
        disabled={disabled || busy}
      />
      {disabled ? (
        <p className="text-[10px] text-amber-700 dark:text-amber-300">
          Melnraksta glabātuve izslēgta — fotogrāfijas nevar saglabāt serverī.
        </p>
      ) : null}
      {error ? <p className="text-[10px] text-red-600 dark:text-red-400">{error}</p> : null}
      {photos.length === 0 ? (
        <p className="text-[10px] text-[var(--color-provin-muted)]">
          JPEG tiek izveidots pirms augšupielādes (~ līdz 200 KB). iPhone: parasti der no Foto / kameras; ja kļūda — mēģini
          Safari vai eksportē kā JPG.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {photos.map((p) => (
            <li
              key={p.id}
              className="flex min-w-0 flex-col gap-1.5 rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-surface-elevated)] p-2"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded bg-black/[0.06] dark:bg-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgSrc(p.id)}
                  alt=""
                  className="h-full w-full object-contain"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <label className="block text-[9px] font-medium text-[var(--color-provin-muted)]">
                Komentārs
                <textarea
                  className={`${inp} mt-0.5 min-h-[52px] resize-y`}
                  rows={2}
                  value={p.comment}
                  onChange={(e) => setComment(p.id, e.target.value)}
                  disabled={disabled}
                  placeholder="Piezīme pie šīs fotogrāfijas…"
                />
              </label>
              <button
                type="button"
                onClick={() => void removePhoto(p.id)}
                disabled={disabled || busy}
                className="inline-flex items-center justify-center gap-1 self-start rounded border border-red-200/80 bg-red-50/80 px-2 py-1 text-[10px] font-medium text-red-800 hover:bg-red-100 disabled:opacity-45 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
              >
                <Trash2 className="h-3 w-3" aria-hidden />
                Noņemt
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
