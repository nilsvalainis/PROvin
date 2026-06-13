"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { FolderPlus, GripVertical, ImagePlus, Loader2, Trash2 } from "lucide-react";

import {
  countListingAnalysisPhotos,
  emptyListingAnalysisPhotoGroup,
  LISTING_ANALYSIS_MAX_PHOTOS,
  type ListingAnalysisPhotoGroup,
  type ListingAnalysisPhotoMeta,
} from "@/lib/listing-analysis-photo-types";
import { compressImageFileToJpegForConsultation } from "@/lib/consultation-photo-client-compress";

type UploadPhase = "compressing" | "uploading" | "saving" | "done" | "error";

type PendingUpload = {
  key: string;
  groupId: string;
  fileName: string;
  phase: UploadPhase;
  previewUrl: string;
  error?: string;
};

type Props = {
  sessionId: string;
  photoGroups: ListingAnalysisPhotoGroup[];
  disabled: boolean;
  onPhotoGroupsStructuralCommit: (next: ListingAnalysisPhotoGroup[]) => void | Promise<void>;
};

const IMAGE_FILE_RE = /\.(jpe?g|png|webp|gif|heic|heif)$/i;

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

function totalPhotos(groups: ListingAnalysisPhotoGroup[]): number {
  return countListingAnalysisPhotos(groups);
}

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return IMAGE_FILE_RE.test(file.name);
}

function collectImageFiles(list: FileList | File[] | null | undefined): File[] {
  if (!list?.length) return [];
  return Array.from(list).filter(isImageFile);
}

function collectImageFilesFromDataTransfer(dt: DataTransfer): File[] {
  const fromFiles = collectImageFiles(dt.files);
  if (fromFiles.length > 0) return fromFiles;
  const out: File[] = [];
  for (const item of Array.from(dt.items)) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (file && isImageFile(file)) out.push(file);
  }
  return out;
}

function newDefaultGroup(index: number): ListingAnalysisPhotoGroup {
  return { ...emptyListingAnalysisPhotoGroup(), title: `Grupa ${index}` };
}

function ensureGroupInList(
  groups: ListingAnalysisPhotoGroup[],
  targetGroupId: string,
): ListingAnalysisPhotoGroup[] {
  if (groups.some((g) => g.id === targetGroupId)) return groups;
  return [...groups, { ...newDefaultGroup(groups.length + 1), id: targetGroupId }];
}

export function AdminListingAnalysisPhotos({
  sessionId,
  photoGroups,
  disabled,
  onPhotoGroupsStructuralCommit,
}: Props) {
  const baseInputId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const defaultGroupIdRef = useRef(emptyListingAnalysisPhotoGroup().id);
  const previewUrlsRef = useRef<Map<string, string>>(new Map());
  const dragRef = useRef<{ groupId: string; index: number } | null>(null);
  const dropDepthRef = useRef(0);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<{ groupId: string; index: number } | null>(null);
  const [dropActiveGroupId, setDropActiveGroupId] = useState<string | null>(null);

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

  /** Novērš pārlūka noklusējumu — atvērt attēlu jauns tabs, nevis importēt. */
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const blockWindowDrop = (e: DragEvent) => {
      if (!el.contains(e.target as Node)) return;
      e.preventDefault();
    };
    window.addEventListener("dragover", blockWindowDrop);
    window.addEventListener("drop", blockWindowDrop);
    return () => {
      window.removeEventListener("dragover", blockWindowDrop);
      window.removeEventListener("drop", blockWindowDrop);
    };
  }, []);

  const commitGroups = useCallback(
    async (next: ListingAnalysisPhotoGroup[], status?: string) => {
      if (status) setStatusLine(status);
      try {
        await onPhotoGroupsStructuralCommit(next);
      } finally {
        if (status) window.setTimeout(() => setStatusLine(null), 1500);
      }
    },
    [onPhotoGroupsStructuralCommit],
  );

  const updateGroupTitleOnBlur = (groupId: string, raw: string) => {
    const title = raw.trim().slice(0, 120);
    const group = photoGroups.find((g) => g.id === groupId);
    if (!group || group.title === title) return;
    void commitGroups(photoGroups.map((g) => (g.id === groupId ? { ...g, title } : g)));
  };

  const addGroup = () => {
    const n = photoGroups.length + 1;
    void commitGroups([...photoGroups, newDefaultGroup(n)], "Pievienota jauna grupa");
  };

  const removeGroup = async (groupId: string) => {
    const group = photoGroups.find((g) => g.id === groupId);
    if (!group || disabled || busy) return;
    if (group.photos.length > 0) {
      const ok = window.confirm(
        `Dzēst grupu „${group.title.trim() || "bez nosaukuma"}” ar ${group.photos.length} fotogrāfijām?`,
      );
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    setStatusLine("Dzēš grupu…");
    try {
      if (group.photos.length > 0) {
        await fetch("/api/admin/listing-analysis-photo", {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, photoIds: group.photos.map((p) => p.id) }),
        });
        for (const p of group.photos) {
          const cached = previewUrlsRef.current.get(p.id);
          if (cached) {
            URL.revokeObjectURL(cached);
            previewUrlsRef.current.delete(p.id);
          }
        }
      }
      await commitGroups(photoGroups.filter((g) => g.id !== groupId));
    } finally {
      setBusy(false);
      setStatusLine(null);
    }
  };

  const processFiles = async (list: FileList | File[] | null | undefined, targetGroupId: string) => {
    const imageFiles = collectImageFiles(list);
    if (!imageFiles.length || disabled) return;

    let groups = ensureGroupInList(photoGroups, targetGroupId);
    const group = groups.find((g) => g.id === targetGroupId)!;
    const currentTotal = totalPhotos(groups);

    setBusy(true);
    setError(null);
    setStatusLine(null);
    const files = imageFiles.slice(0, Math.max(0, LISTING_ANALYSIS_MAX_PHOTOS - currentTotal));
    if (files.length === 0) {
      setError(`Sasniegts limits (${LISTING_ANALYSIS_MAX_PHOTOS} fotogrāfijas).`);
      setBusy(false);
      return;
    }

    const pendingEntries: PendingUpload[] = files.map((file, i) => ({
      key: `pending_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}`,
      groupId: targetGroupId,
      fileName: file.name,
      phase: "compressing" as const,
      previewUrl: URL.createObjectURL(file),
    }));
    setPending((p) => [...p, ...pendingEntries]);
    setStatusLine(`Apstrādā ${files.length} fotogrāfijas…`);

    try {
      const compressed: { key: string; jpeg: File; previewUrl: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        const key = pendingEntries[i]!.key;
        try {
          const jpeg = await compressImageFileToJpegForConsultation(file);
          compressed.push({ key, jpeg, previewUrl: pendingEntries[i]!.previewUrl });
          setPending((p) => p.map((x) => (x.key === key ? { ...x, phase: "uploading" } : x)));
        } catch {
          URL.revokeObjectURL(pendingEntries[i]!.previewUrl);
          setPending((p) =>
            p.map((x) =>
              x.key === key ? { ...x, phase: "error" as const, error: "Neizdevās apstrādāt attēlu" } : x,
            ),
          );
        }
      }

      if (compressed.length === 0) {
        setError("Neizdevās apstrādāt attēlus (piem. HEIF/HEIC). Mēģini Safari vai eksportē JPG.");
        return;
      }

      setStatusLine(`Augšupielādē ${compressed.length} fotogrāfijas…`);
      const uploaded: ListingAnalysisPhotoMeta[] = [];
      const groupPhotoCount = group.photos.length;

      await Promise.all(
        compressed.map(async ({ key, jpeg, previewUrl }, uploadIndex) => {
          const fd = new FormData();
          fd.set("sessionId", sessionId);
          fd.set("currentCount", String(currentTotal + uploadIndex));
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
            return;
          }
          previewUrlsRef.current.set(data.id, previewUrl);
          uploaded.push({ id: data.id });
          setPending((p) => p.filter((x) => x.key !== key));
        }),
      );

      if (uploaded.length > 0) {
        const nextGroups = groups.map((g) =>
          g.id === targetGroupId ? { ...g, photos: [...g.photos, ...uploaded] } : g,
        );
        setStatusLine(`Saglabā ${uploaded.length} fotogrāfijas…`);
        await commitGroups(nextGroups);
        setStatusLine(`Pievienotas ${uploaded.length} fotogrāfijas (${groupPhotoCount + uploaded.length} šajā grupā).`);
      }
    } finally {
      setBusy(false);
      window.setTimeout(() => setStatusLine(null), 3500);
      setPending((p) => p.filter((x) => x.phase === "error"));
    }
  };

  const onFileChange = async (groupId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    e.target.value = "";
    if (!list?.length) return;
    await processFiles(list, groupId);
  };

  const onDragEnterZone = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    e.stopPropagation();
    dropDepthRef.current += 1;
    setDropActiveGroupId(groupId);
  };

  const onDragOverZone = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const onDragLeaveZone = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropDepthRef.current = Math.max(0, dropDepthRef.current - 1);
    if (dropDepthRef.current === 0) setDropActiveGroupId(null);
  };

  const onDropZone = async (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    e.stopPropagation();
    dropDepthRef.current = 0;
    setDropActiveGroupId(null);
    if (disabled || busy) return;
    const files = collectImageFilesFromDataTransfer(e.dataTransfer);
    if (!files.length) return;
    await processFiles(files, groupId);
  };

  const removeAllPhotos = async () => {
    const count = totalPhotos(photoGroups);
    if (disabled || busy || count === 0) return;
    if (!window.confirm(`Dzēst visas ${count} fotogrāfijas?`)) return;
    setBusy(true);
    setError(null);
    setStatusLine("Dzēš visas fotogrāfijas…");
    try {
      await fetch("/api/admin/listing-analysis-photo", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, deleteAll: true }),
      });
      for (const g of photoGroups) {
        for (const p of g.photos) {
          const cached = previewUrlsRef.current.get(p.id);
          if (cached) {
            URL.revokeObjectURL(cached);
            previewUrlsRef.current.delete(p.id);
          }
        }
      }
      await commitGroups([]);
    } finally {
      setBusy(false);
      setStatusLine(null);
    }
  };

  const removePhoto = async (groupId: string, photoId: string) => {
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
      const next = photoGroups.map((g) =>
        g.id === groupId ? { ...g, photos: g.photos.filter((p) => p.id !== photoId) } : g,
      );
      await commitGroups(next);
    } finally {
      setBusy(false);
      setStatusLine(null);
    }
  };

  const commitReorder = async (groupId: string, nextPhotos: ListingAnalysisPhotoMeta[]) => {
    const next = photoGroups.map((g) => (g.id === groupId ? { ...g, photos: nextPhotos } : g));
    await commitGroups(next, "Saglabā secību…");
  };

  const onDragStart = (groupId: string, index: number) => {
    if (disabled || busy) return;
    dragRef.current = { groupId, index };
  };

  const onDragOverItem = (e: React.DragEvent, groupId: string, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || busy) return;
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy";
      return;
    }
    setDragOver({ groupId, index });
  };

  const onDropItem = (e: React.DragEvent, groupId: string, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
    const files = collectImageFilesFromDataTransfer(e.dataTransfer);
    if (files.length) {
      void processFiles(files, groupId);
      return;
    }
    const from = dragRef.current;
    dragRef.current = null;
    if (!from || from.groupId !== groupId || from.index === dropIndex || disabled || busy) return;
    const group = photoGroups.find((g) => g.id === groupId);
    if (!group) return;
    const next = [...group.photos];
    const [moved] = next.splice(from.index, 1);
    if (!moved) return;
    next.splice(dropIndex, 0, moved);
    void commitReorder(groupId, next);
  };

  const onDragEnd = () => {
    dragRef.current = null;
    setDragOver(null);
  };

  const photoCount = totalPhotos(photoGroups);
  const atLimit = photoCount >= LISTING_ANALYSIS_MAX_PHOTOS;
  const defaultGroupId = defaultGroupIdRef.current;

  const renderFileInput = (groupId: string) => (
    <input
      id={`${baseInputId}-${groupId}`}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
      multiple
      className="sr-only"
      onChange={(e) => void onFileChange(groupId, e)}
      disabled={disabled || busy || atLimit}
    />
  );

  const renderOpenLabel = (groupId: string, compact = false) => (
    <label
      htmlFor={`${baseInputId}-${groupId}`}
      className={`inline-flex cursor-pointer items-center gap-1 rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1 text-[10px] font-medium text-[var(--admin-field-text)] ${
        disabled || busy || atLimit ? "pointer-events-none opacity-45" : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
      } ${compact ? "" : "shadow-sm"}`}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ImagePlus className="h-3.5 w-3.5" aria-hidden />}
      Atvērt no datora…
    </label>
  );

  const renderDropZone = (groupId: string, hint: string) => (
    <div
      onDragEnter={(e) => onDragEnterZone(e, groupId)}
      onDragOver={onDragOverZone}
      onDragLeave={onDragLeaveZone}
      onDrop={(e) => void onDropZone(e, groupId)}
      className={`rounded-md border border-dashed px-3 py-3 transition-colors ${
        dropActiveGroupId === groupId
          ? "border-[var(--color-provin-accent)] bg-[var(--color-provin-accent-soft)]/40"
          : "border-[var(--admin-field-border)] bg-black/[0.02] dark:bg-white/[0.02]"
      } ${disabled || busy ? "pointer-events-none opacity-45" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] leading-snug text-[var(--color-provin-muted)]">{hint}</p>
        {!disabled ? renderOpenLabel(groupId, true) : null}
      </div>
      {renderFileInput(groupId)}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className="mt-2 min-w-0 space-y-3 rounded-lg border border-[var(--admin-border-subtle)] bg-black/[0.02] p-2 dark:bg-white/[0.03]"
      onDragOver={onDragOverZone}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-medium uppercase tracking-wide text-[var(--color-provin-muted)]">
          Fotogrāfijas (PDF režģis) · {photoCount}/{LISTING_ANALYSIS_MAX_PHOTOS}
        </p>
        {!disabled ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addGroup}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1 text-[10px] font-medium text-[var(--admin-field-text)] hover:bg-black/[0.03] disabled:opacity-45"
            >
              <FolderPlus className="h-3.5 w-3.5" aria-hidden />
              Pievienot grupu
            </button>
            {photoCount > 0 ? (
              <button
                type="button"
                onClick={() => void removeAllPhotos()}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-md border border-red-200/80 bg-red-50/80 px-2 py-1 text-[10px] font-medium text-red-700 hover:bg-red-100/80 disabled:opacity-45 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Dzēst visas
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

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

      {photoGroups.length === 0 && !disabled
        ? renderDropZone(
            defaultGroupId,
            "Velc attēlus šeit vai izmanto „Atvērt no datora…” — tiks izveidota pirmā grupa. Pēc tam vari pievienot virsrakstu (datums, avots).",
          )
        : null}

      {photoGroups.map((group, groupIndex) => (
        <section key={group.id} className="space-y-2 rounded-md border border-[var(--admin-field-border)]/70 bg-[var(--admin-field-bg)]/40 p-2">
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">
              <label className="mb-0.5 block text-[9px] font-medium uppercase tracking-wide text-[var(--color-provin-muted)]">
                Grupas virsraksts {photoGroups.length > 1 ? `#${groupIndex + 1}` : ""}
              </label>
              <input
                type="text"
                key={`${group.id}:${group.title}`}
                defaultValue={group.title}
                onBlur={(e) => updateGroupTitleOnBlur(group.id, e.target.value)}
                disabled={disabled || busy}
                placeholder="piem. 2024-06-12 — ss.com sludinājums"
                className="w-full rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1 text-[11px] text-[var(--admin-field-text)] placeholder:text-[var(--admin-field-placeholder)] focus:border-[var(--color-provin-accent)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/20 disabled:opacity-45"
              />
            </div>
            {!disabled ? (
              <div className="flex shrink-0 flex-wrap items-center gap-1.5 pt-4">
                {renderOpenLabel(group.id)}
                <button
                  type="button"
                  onClick={() => void removeGroup(group.id)}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md border border-red-200/80 px-2 py-1 text-[10px] font-medium text-red-700 hover:bg-red-50/80 disabled:opacity-45 dark:border-red-900/50 dark:text-red-300"
                  title="Dzēst grupu"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            ) : null}
          </div>

          {renderDropZone(
            group.id,
            group.photos.length === 0 && pending.every((p) => p.groupId !== group.id)
              ? "Velc attēlus šeit vai izmanto „Atvērt no datora…”."
              : "Velc jaunus attēlus šeit, lai pievienotu grupai.",
          )}

          {group.photos.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {group.photos.map((p, index) => (
                <li
                  key={p.id}
                  draggable={!disabled && !busy}
                  onDragStart={() => onDragStart(group.id, index)}
                  onDragOver={(e) => onDragOverItem(e, group.id, index)}
                  onDrop={(e) => onDropItem(e, group.id, index)}
                  onDragEnd={onDragEnd}
                  className={`group relative flex h-[4.5rem] w-[4.5rem] shrink-0 cursor-grab flex-col overflow-hidden rounded-md border bg-black/[0.06] active:cursor-grabbing dark:bg-white/10 ${
                    dragOver?.groupId === group.id && dragOver.index === index
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
                      onClick={() => void removePhoto(group.id, p.id)}
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
        </section>
      ))}
    </div>
  );
}
