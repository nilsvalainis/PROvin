"use client";

import { Camera, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LISTING_PEEK_MAX_PHOTOS, type ListingPeekPhotoRef } from "@/lib/listing-peek-photos";

const ERROR_LABEL: Record<string, string> = {
  file_too_large: "Foto ir par lielu.",
  invalid_jpeg: "Šo failu nevar nolasīt kā fotogrāfiju.",
  limit: `Maksimums ${LISTING_PEEK_MAX_PHOTOS} fotogrāfijas.`,
  missing: "Vērtējums nav atrasts.",
  invalid: "Foto neizdevās pievienot.",
  error: "Augšupielāde neizdevās. Mēģini vēlreiz.",
};

function photoSrc(peekId: string, photoId: string): string {
  return `/api/admin/listing-peek-photo?id=${encodeURIComponent(peekId)}&photoId=${encodeURIComponent(photoId)}`;
}

export function AdminListingPeekPhotos({
  peekId,
  photos: initialPhotos,
}: {
  peekId: string;
  photos: ListingPeekPhotoRef[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropDepth = useRef(0);
  const incoming = initialPhotos.map((p) => p.id).join(",");
  const [photos, setPhotos] = useState<ListingPeekPhotoRef[]>(initialPhotos);
  const [busy, setBusy] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPhotos(incoming ? incoming.split(",").map((id) => ({ id })) : []);
  }, [incoming]);

  async function uploadFiles(list: FileList | File[] | null) {
    if (!list || list.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    let next = photos;
    try {
      for (const file of Array.from(list)) {
        if (next.length >= LISTING_PEEK_MAX_PHOTOS) {
          setError(ERROR_LABEL.limit);
          break;
        }
        const body = new FormData();
        body.set("id", peekId);
        body.set("file", file);
        const res = await fetch("/api/admin/listing-peek-photo", {
          method: "POST",
          credentials: "include",
          body,
        });
        if (!res.ok) {
          let reason = "error";
          try {
            const data = (await res.json()) as { error?: string };
            if (data.error && ERROR_LABEL[data.error]) reason = data.error;
          } catch {
            /* ignore */
          }
          setError(ERROR_LABEL[reason] ?? ERROR_LABEL.error);
          break;
        }
        const data = (await res.json()) as { id?: string };
        if (!data.id) {
          setError(ERROR_LABEL.error);
          break;
        }
        next = [...next, { id: data.id }];
        setPhotos(next);
      }
    } catch {
      setError(ERROR_LABEL.error);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removePhoto(photoId: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/listing-peek-photo", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: peekId, photoId }),
      });
      if (!res.ok) {
        setError(ERROR_LABEL.error);
        return;
      }
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch {
      setError(ERROR_LABEL.error);
    } finally {
      setBusy(false);
    }
  }

  const full = photos.length >= LISTING_PEEK_MAX_PHOTOS;
  const locked = busy || full;

  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        disabled={locked}
        className="sr-only"
        aria-label="Pievienot fotogrāfijas klientam"
        onChange={(e) => void uploadFiles(e.target.files)}
      />
      <div
        title="Fotogrāfijas aiziet klientam kopā ar e-pastu"
        onClick={() => {
          if (!locked) inputRef.current?.click();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dropDepth.current += 1;
          if (!locked) setDropActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = locked ? "none" : "copy";
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dropDepth.current = Math.max(0, dropDepth.current - 1);
          if (dropDepth.current === 0) setDropActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          dropDepth.current = 0;
          setDropActive(false);
          if (locked) return;
          void uploadFiles(e.dataTransfer.files);
        }}
        className={`flex min-h-11 cursor-pointer flex-wrap items-center gap-1.5 rounded-lg border border-dashed px-2 py-1.5 transition ${
          dropActive
            ? "border-[var(--color-provin-accent)] bg-[var(--color-provin-accent)]/10"
            : "border-slate-300 bg-slate-50/80 hover:border-[var(--color-provin-accent)]/50"
        } ${locked ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <button
          type="button"
          disabled={locked}
          onClick={(e) => {
            e.stopPropagation();
            if (!locked) inputRef.current?.click();
          }}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-apple-text)] disabled:cursor-not-allowed"
        >
          {busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Camera size={13} aria-hidden />}
          {full ? "Pilns" : "Ievilc vai izvēlies"}
        </button>
        <span className="text-[10px] uppercase tracking-[0.06em] text-[var(--color-provin-muted)]">
          klientam {photos.length}/{LISTING_PEEK_MAX_PHOTOS}
        </span>
        {photos.map((photo) => (
          <span key={photo.id} className="relative inline-flex">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoSrc(peekId, photo.id)}
              alt=""
              className="h-11 w-11 rounded-lg border border-slate-200 object-cover"
            />
            <button
              type="button"
              aria-label="Noņemt foto"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                void removePhoto(photo.id);
              }}
              className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-40"
            >
              <X size={10} aria-hidden />
            </button>
          </span>
        ))}
      </div>
      {error ? <p className="mt-1 text-[11px] text-amber-800">{error}</p> : null}
    </div>
  );
}
