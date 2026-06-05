"use client";

import { useId, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

import type { ListingAnalysisPhotoMeta } from "@/lib/listing-analysis-photo-types";
import { LISTING_ANALYSIS_MAX_PHOTOS } from "@/lib/listing-analysis-photo-types";
import { compressImageFileToJpegForConsultation } from "@/lib/consultation-photo-client-compress";

type Props = {
  sessionId: string;
  photos: ListingAnalysisPhotoMeta[];
  disabled: boolean;
  onPhotosStructuralCommit: (next: ListingAnalysisPhotoMeta[]) => void;
};

export function AdminListingAnalysisPhotos({
  sessionId,
  photos,
  disabled,
  onPhotosStructuralCommit,
}: Props) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imgSrc = (photoId: string) =>
    `/api/admin/listing-analysis-photo?sessionId=${encodeURIComponent(sessionId)}&photoId=${encodeURIComponent(photoId)}`;

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
        if (rolling.length >= LISTING_ANALYSIS_MAX_PHOTOS) break;
        let jpeg: File;
        try {
          jpeg = await compressImageFileToJpegForConsultation(file);
        } catch {
          setError(
            "Neizdevās apstrādāt attēlu (piem. HEIF/HEIC). Mēģini Safari vai eksportē JPG.",
          );
          continue;
        }
        const fd = new FormData();
        fd.set("sessionId", sessionId);
        fd.set("file", jpeg);
        const res = await fetch("/api/admin/listing-analysis-photo", {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: string; error?: string };
        if (!res.ok || !data.id) {
          setError(
            data.error === "photo_limit"
              ? `Sasniegts limits (${LISTING_ANALYSIS_MAX_PHOTOS} fotogrāfijas).`
              : data.error === "file_too_large"
                ? "Fails pēc kompresijas joprojām pārāk liels."
                : data.error === "invalid_jpeg"
                  ? "Serveris pieņem tikai JPEG pēc kompresijas."
                  : data.error === "store_disabled"
                    ? "Melnraksta glabātuve izslēgta — fotogrāfijas nevar saglabāt."
                    : "Augšupielāde neizdevās.",
          );
          continue;
        }
        rolling = [...rolling, { id: data.id }];
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
      await fetch("/api/admin/listing-analysis-photo", {
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

  return (
    <div className="mt-2 min-w-0 space-y-2 rounded-lg border border-[var(--admin-border-subtle)] bg-black/[0.02] p-2 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-medium uppercase tracking-wide text-[var(--color-provin-muted)]">
          Fotogrāfijas (PDF režģis)
        </p>
        {!disabled ? (
          <button
            type="button"
            onClick={pickFiles}
            disabled={disabled || busy || photos.length >= LISTING_ANALYSIS_MAX_PHOTOS}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1 text-[10px] font-medium text-[var(--admin-field-text)] disabled:opacity-45"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <ImagePlus className="h-3.5 w-3.5" aria-hidden />
            )}
            Pievienot
          </button>
        ) : null}
      </div>
      <input
        ref={fileRef}
        id={inputId}
        type="file"
        accept="image/*,.heic,.heif"
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
          Augšupielādē attēlus no sludinājuma (JPG, PNG, WEBP u.c.) — tie tiks saspiesti un iekļauti PDF zem komentāra.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <li
              key={p.id}
              className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-[var(--admin-field-border)] bg-black/[0.06] dark:bg-white/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgSrc(p.id)}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => void removePhoto(p.id)}
                  disabled={busy}
                  className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded bg-black/55 text-white opacity-0 transition group-hover:opacity-100 disabled:opacity-40"
                  aria-label="Noņemt fotogrāfiju"
                >
                  <Trash2 className="h-3 w-3" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
