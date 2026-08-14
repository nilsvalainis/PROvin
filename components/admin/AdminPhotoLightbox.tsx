"use client";

import { useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type AdminLightboxPhoto = {
  id: string;
  src: string;
  /** Virsraksts virs attēla — piem. grupas nosaukums vai komentārs. */
  caption?: string;
};

type Props = {
  photos: AdminLightboxPhoto[];
  /** Aktīvā attēla indekss; `null` — aizvērts. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

/** Pilnekrāna priekšskatījums — režģa sīktēli ir par maziem, lai novērtētu bildi. */
export function AdminPhotoLightbox({ photos, index, onIndexChange, onClose }: Props) {
  const open = index !== null && index >= 0 && index < photos.length;

  const step = useCallback(
    (delta: number) => {
      if (index === null || photos.length === 0) return;
      const next = (index + delta + photos.length) % photos.length;
      onIndexChange(next);
    },
    [index, onIndexChange, photos.length],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, open, step]);

  if (!open) return null;
  const photo = photos[index]!;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fotogrāfijas priekšskatījums"
      className="fixed inset-0 z-[120] flex flex-col bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-white/90">
            {index + 1} / {photos.length}
          </p>
          {photo.caption?.trim() ? (
            <p className="mt-0.5 max-w-[70vw] truncate text-[11px] text-white/70">{photo.caption}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Aizvērt priekšskatījumu"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center gap-2 px-2 pb-4">
        {photos.length > 1 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            aria-label="Iepriekšējā fotogrāfija"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.src}
          alt={photo.caption ?? ""}
          className="mx-auto max-h-full min-h-0 max-w-full flex-1 object-contain"
          onClick={(e) => e.stopPropagation()}
          decoding="async"
        />
        {photos.length > 1 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            aria-label="Nākamā fotogrāfija"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}
