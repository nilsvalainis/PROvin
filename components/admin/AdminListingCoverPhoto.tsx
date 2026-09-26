"use client";

import { Camera, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { compressImageFileToJpegForConsultation } from "@/lib/consultation-photo-client-compress";
import type { ListingAnalysisPhotoMeta } from "@/lib/listing-analysis-photo-types";

function photoSrc(sessionId: string, photoId: string): string {
  return `/api/admin/listing-analysis-photo?sessionId=${encodeURIComponent(sessionId)}&photoId=${encodeURIComponent(photoId)}`;
}

export function AdminListingCoverPhoto({
  sessionId,
  photo,
  disabled = false,
  onCommit,
}: {
  sessionId: string;
  photo?: ListingAnalysisPhotoMeta | null;
  disabled?: boolean;
  onCommit: (next: ListingAnalysisPhotoMeta | null) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropDepth = useRef(0);
  const [busy, setBusy] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = disabled || busy;
  const currentId = photo?.id ?? "";

  async function uploadFile(file: File | null) {
    if (!file || locked) return;
    setBusy(true);
    setError(null);
    try {
      const jpeg = await compressImageFileToJpegForConsultation(file);
      const body = new FormData();
      body.set("sessionId", sessionId);
      body.set("currentCount", "0");
      body.set("role", "cover");
      body.set("file", jpeg);
      const res = await fetch("/api/admin/listing-analysis-photo", {
        method: "POST",
        credentials: "include",
        body,
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setError(
          data.error === "file_too_large"
            ? "Bilde ir par lielu."
            : data.error === "invalid_jpeg"
              ? "Šo failu nevar nolasīt kā fotogrāfiju."
              : "Augšupielāde neizdevās. Mēģini vēlreiz.",
        );
        return;
      }
      const previousId = currentId;
      await onCommit({ id: data.id });
      if (previousId && previousId !== data.id) {
        void fetch("/api/admin/listing-analysis-photo", {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, photoId: previousId }),
        });
      }
    } catch {
      setError("Augšupielāde neizdevās. Mēģini vēlreiz.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removePhoto() {
    if (!currentId || locked) return;
    setBusy(true);
    setError(null);
    try {
      await onCommit(null);
      void fetch("/api/admin/listing-analysis-photo", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, photoId: currentId }),
      });
    } catch {
      setError("Neizdevās noņemt bildi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-[var(--color-provin-accent)]/45 bg-[var(--color-provin-accent)]/5 px-3 py-2.5">
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[12px] font-semibold text-[var(--color-apple-text)]">PDF augšas bilde</p>
        <p className="text-[11px] text-[var(--color-provin-muted)]">
          Sludinājuma ekrānuzņēmums vai auto fotogrāfija. PDF failā uzreiz zem baneriem.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        disabled={locked}
        className="sr-only"
        aria-label="PDF augšas bilde"
        onChange={(e) => void uploadFile(e.target.files?.[0] ?? null)}
      />
      <div
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
          void uploadFile(e.dataTransfer.files?.[0] ?? null);
        }}
        className={`flex min-h-[5.5rem] cursor-pointer items-center gap-3 rounded-lg border border-dashed px-3 py-2 transition ${
          dropActive
            ? "border-[var(--color-provin-accent)] bg-white"
            : "border-slate-300 bg-white/80 hover:border-[var(--color-provin-accent)]/60"
        } ${locked ? "cursor-not-allowed opacity-60" : ""}`}
      >
        {currentId ? (
          <span className="relative inline-flex shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoSrc(sessionId, currentId)}
              alt=""
              className="h-16 w-28 rounded-md border border-slate-200 object-cover"
            />
            <button
              type="button"
              aria-label="Noņemt PDF augšas bildi"
              disabled={locked}
              onClick={(e) => {
                e.stopPropagation();
                void removePhoto();
              }}
              className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm"
            >
              <X size={12} aria-hidden />
            </button>
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-apple-text)]">
          {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Camera size={15} aria-hidden />}
          {currentId ? "Nomainīt bildi" : "Ievilc vai izvēlies bildi"}
        </span>
      </div>
      {error ? <p className="mt-1 text-[11px] text-amber-800">{error}</p> : null}
    </div>
  );
}
