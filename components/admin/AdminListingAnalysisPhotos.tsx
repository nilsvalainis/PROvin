"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { GripVertical, ImagePlus, Loader2, Trash2 } from "lucide-react";

import type { ListingAnalysisPhotoMeta } from "@/lib/listing-analysis-photo-types";
import { LISTING_ANALYSIS_MAX_PHOTOS } from "@/lib/listing-analysis-photo-types";
import { compressImageFileToJpegForConsultation } from "@/lib/consultation-photo-client-compress";

type UploadPhase = "compressing" | "uploading" | "saving" | "done" | "error";

type PendingUpload = {
  key: string;
  fileName: string;
  phase: UploadPhase;
  previewUrl: string;
  error?: string;
};

type Props = {
  sessionId: string;
  photos: ListingAnalysisPhotoMeta[];
  disabled: boolean;
  onPhotosStructuralCommit: (next: ListingAnalysisPhotoMeta[]) => void | Promise<void>;
};

function uploadErrorMessage(error: string | undefined, detail?: string): string {
  if (error === "photo_limit") return `Sasniegts limits (${LISTING_ANALYSIS_MAX_PHOTOS} fotogrāfijas).`;
  if (error === "file_too_large") return "Fails pēc kompresijas joprojām pārāk liels.";
  if (error === "invalid_jpeg") return "Serveris pieņem tikai JPEG pēc kompresijas.";
  if (error === "store_disabled") return "Servera glabātuve nav pieejama — pārbaudi ADMIN_ORDER_DRAFT_* / Blob env.";
  if (error === "write_failed") {
    return detail === "blob_write_failed"
      ? "Neizdevās saglabāt Blob — pārbaudi BLOB_READ_WRITE_TOKEN."
      : "Neizdevās saglabāt failu serverī.";
  }
  if (error === "write_verify_failed") {
    return "Fails augšupielādēts, bet neizdevās apstiprināt — mēģini vēlreiz.";
  }
  if (error === "not_found") return "Pasūtījums nav atrasts.";
  if (detail) return detail.slice(0, 180);
  return "Augšupielāde neizdevās.";
}

function phaseLabel(phase: UploadPhase, fileName: string): string {
  switch (phase) {
    case "compressing":
      return `Apstrādā: ${fileName}…`;
    case "uploading":
      return `Augšupielādē: ${fileName}…`;
    case "saving":
      return `Saglabā darba zonā: ${fileName}…`;
    case "done":
      return `Pievienots: ${fileName}`;
    case "error":
      return `Kļūda: ${fileName}`;
  }
}

export function AdminListingAnalysisPhotos({
  sessionId,
  photos,
  disabled,
  onPhotosStructuralCommit,
}: Props) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<Map<string, string>>(new Map());
  const dragIndexRef = useRef<number | null>(null);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const serverImgSrc = useCallback(
    (photoId: string) =>
      `/api/admin/listing-analysis-photo?sessionId=${encodeURIComponent(sessionId)}&photoId=${encodeURIComponent(photoId)}&v=${encodeURIComponent(photoId.slice(-8))}`,
    [sessionId],
  );

  const displaySrc = useCallback(
    (photoId: string) => previewUrlsRef.current.get(photoId) ?? serverImgSrc(photoId),
    [serverImgSrc],
  );

  useEffect(() => {
    return () => {
      for (const url of previewUrlsRef.current.values()) URL.revokeObjectURL(url);
      previewUrlsRef.current.clear();
    };
  }, []);

  const pickFiles = () => {
    if (disabled || busy) return;
    setError(null);
    fileRef.current?.click();
  };

  const processFiles = async (list: FileList | File[]) => {
    if (!list.length || disabled) return;
    setBusy(true);
    setError(null);
    setStatusLine(null);
    let rolling = [...photos];
    const files = Array.from(list);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        if (rolling.length >= LISTING_ANALYSIS_MAX_PHOTOS) {
          setError(`Sasniegts limits (${LISTING_ANALYSIS_MAX_PHOTOS} fotogrāfijas).`);
          break;
        }
        const key = `pending_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`;
        const previewUrl = URL.createObjectURL(file);
        setPending((p) => [
          ...p,
          { key, fileName: file.name, phase: "compressing", previewUrl },
        ]);
        setStatusLine(`Apstrādā ${i + 1}/${files.length}: ${file.name}`);

        let jpeg: File;
        try {
          jpeg = await compressImageFileToJpegForConsultation(file);
        } catch {
          URL.revokeObjectURL(previewUrl);
          setPending((p) =>
            p.map((x) =>
              x.key === key ? { ...x, phase: "error" as const, error: "Neizdevās apstrādāt attēlu" } : x,
            ),
          );
          setError("Neizdevās apstrādāt attēlu (piem. HEIF/HEIC). Mēģini Safari vai eksportē JPG.");
          continue;
        }

        setPending((p) => p.map((x) => (x.key === key ? { ...x, phase: "uploading" } : x)));
        setStatusLine(`Augšupielādē ${i + 1}/${files.length}…`);

        const fd = new FormData();
        fd.set("sessionId", sessionId);
        fd.set("currentCount", String(rolling.length));
        fd.set("file", jpeg);
        const res = await fetch("/api/admin/listing-analysis-photo", {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          id?: string;
          error?: string;
          detail?: string;
        };
        if (!res.ok || !data.id) {
          URL.revokeObjectURL(previewUrl);
          const msg = uploadErrorMessage(data.error, data.detail);
          setPending((p) =>
            p.map((x) => (x.key === key ? { ...x, phase: "error" as const, error: msg } : x)),
          );
          setError(msg);
          continue;
        }

        previewUrlsRef.current.set(data.id, previewUrl);
        rolling = [...rolling, { id: data.id }];
        setPending((p) => p.map((x) => (x.key === key ? { ...x, phase: "saving" } : x)));
        setStatusLine(`Saglabā darba zonā ${i + 1}/${files.length}…`);
        await onPhotosStructuralCommit(rolling);
        setPending((p) => p.filter((x) => x.key !== key));
        setStatusLine(`Pievienots ${i + 1}/${files.length}.`);
      }
    } finally {
      setBusy(false);
      window.setTimeout(() => setStatusLine(null), 3500);
      setPending((p) => p.filter((x) => x.phase === "error"));
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    e.target.value = "";
    if (!list?.length) return;
    await processFiles(list);
  };

  const onDropZone = async (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled || busy) return;
    const files = e.dataTransfer.files;
    if (!files?.length) return;
    await processFiles(files);
  };

  const removePhoto = async (photoId: string) => {
    if (disabled || busy) return;
    setBusy(true);
    setError(null);
    setStatusLine("Dzēš fotogrāfiju…");
    try {
      await fetch("/api/admin/listing-analysis-photo", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, photoId }),
      });
      const cached = previewUrlsRef.current.get(photoId);
      if (cached) {
        URL.revokeObjectURL(cached);
        previewUrlsRef.current.delete(photoId);
      }
      await onPhotosStructuralCommit(photos.filter((p) => p.id !== photoId));
    } finally {
      setBusy(false);
      setStatusLine(null);
    }
  };

  const commitReorder = useCallback(
    async (next: ListingAnalysisPhotoMeta[]) => {
      setStatusLine("Saglabā secību…");
      try {
        await onPhotosStructuralCommit(next);
      } finally {
        window.setTimeout(() => setStatusLine(null), 1500);
      }
    },
    [onPhotosStructuralCommit],
  );

  const onDragStart = (index: number) => {
    if (disabled || busy) return;
    dragIndexRef.current = index;
  };

  const onDragOverItem = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (disabled || busy) return;
    setDragOverIndex(index);
  };

  const onDropItem = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    if (from == null || from === dropIndex || disabled || busy) return;
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(dropIndex, 0, moved);
    void commitReorder(next);
  };

  const onDragEnd = () => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  };

  return (
    <div
      className="mt-2 min-w-0 space-y-2 rounded-lg border border-[var(--admin-border-subtle)] bg-black/[0.02] p-2 dark:bg-white/[0.03]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => void onDropZone(e)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-medium uppercase tracking-wide text-[var(--color-provin-muted)]">
          Fotogrāfijas (PDF režģis)
        </p>
        {!disabled ? (
          <button
            type="button"
            onClick={pickFiles}
            disabled={busy || photos.length >= LISTING_ANALYSIS_MAX_PHOTOS}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1 text-[10px] font-medium text-[var(--admin-field-text)] disabled:opacity-45"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ImagePlus className="h-3.5 w-3.5" aria-hidden />}
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
        onChange={(e) => void onFileChange(e)}
        disabled={disabled || busy}
      />

      {disabled ? (
        <p className="text-[10px] text-amber-700 dark:text-amber-300">
          Melnraksta glabātuve izslēgta — fotogrāfijas nevar saglabāt serverī (Vercel: ADMIN_ORDER_DRAFT_BLOB_PREFIX +
          BLOB_READ_WRITE_TOKEN).
        </p>
      ) : null}

      {statusLine ? (
        <p className="flex items-center gap-1.5 text-[10px] text-[var(--color-provin-accent)]">
          {busy ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden /> : null}
          {statusLine}
        </p>
      ) : null}

      {error ? <p className="text-[10px] text-red-600 dark:text-red-400">{error}</p> : null}

      {pending.length > 0 ? (
        <ul className="space-y-1">
          {pending.map((p) => (
            <li key={p.key} className="flex items-center gap-2 text-[10px] text-[var(--color-provin-muted)]">
              {p.phase !== "error" && p.phase !== "done" ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
              ) : null}
              <span className={p.phase === "error" ? "text-red-600 dark:text-red-400" : undefined}>
                {p.error ?? phaseLabel(p.phase, p.fileName)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {photos.length === 0 && pending.length === 0 && !busy ? (
        <p className="text-[10px] text-[var(--color-provin-muted)]">
          Velc failus šeit vai izmanto „Pievienot” (JPG, PNG, WEBP u.c.) — attēli tiks saspiesti un iekļauti PDF zem
          komentāra. Kārtošanai — pavelc sīktēlu.
        </p>
      ) : null}

      {photos.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {photos.map((p, index) => (
            <li
              key={p.id}
              draggable={!disabled && !busy}
              onDragStart={() => onDragStart(index)}
              onDragOver={(e) => onDragOverItem(e, index)}
              onDrop={(e) => onDropItem(e, index)}
              onDragEnd={onDragEnd}
              className={`group relative flex h-[4.5rem] w-[4.5rem] shrink-0 cursor-grab flex-col overflow-hidden rounded-md border bg-black/[0.06] active:cursor-grabbing dark:bg-white/10 ${
                dragOverIndex === index
                  ? "border-[var(--color-provin-accent)] ring-2 ring-[var(--color-provin-accent)]/30"
                  : "border-[var(--admin-field-border)]"
              }`}
              title="Velc, lai mainītu secību PDF"
            >
              <span className="absolute left-0.5 top-0.5 z-10 rounded bg-black/45 p-0.5 text-white opacity-0 transition group-hover:opacity-100">
                <GripVertical className="h-3 w-3" aria-hidden />
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displaySrc(p.id)}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
                draggable={false}
              />
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => void removePhoto(p.id)}
                  disabled={busy}
                  className="absolute right-0.5 top-0.5 z-10 inline-flex h-5 w-5 items-center justify-center rounded bg-black/55 text-white opacity-0 transition group-hover:opacity-100 disabled:opacity-40"
                  aria-label="Noņemt fotogrāfiju"
                >
                  <Trash2 className="h-3 w-3" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
