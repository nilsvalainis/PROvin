"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FolderPlus, GripVertical, ImagePlus, Loader2, Maximize2, Trash2 } from "lucide-react";

import {
  emptyListingAnalysisPhotoGroup,
  LISTING_ANALYSIS_MAX_PHOTOS,
} from "@/lib/listing-analysis-photo-types";
import { compressImageFileToJpegForConsultation } from "@/lib/consultation-photo-client-compress";
import { AdminPhotoLightbox, type AdminLightboxPhoto } from "@/components/admin/AdminPhotoLightbox";

type PhotoGroupLike = {
  id: string;
  title: string;
  photos: { id: string }[];
};

type Props = {
  sessionId: string;
  photoGroups: PhotoGroupLike[];
  disabled: boolean;
  onPhotoGroupsStructuralCommit: (next: PhotoGroupLike[]) => void | Promise<void>;
  /** Noklusējums: sludinājuma analīzes API. */
  apiBasePath?: string;
  maxPhotos?: number;
  emptyGroup?: () => PhotoGroupLike;
  sectionTitle?: string;
  /** Bez grupu virsrakstiem — viena foto josla (negadījumu kopsavilkums). */
  simple?: boolean;
};

const IMAGE_FILE_RE = /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp|tiff?)$/i;

/** Grupas konteinera droppable id — lai var iemest arī tukšā grupā. */
const GROUP_DROP_PREFIX = "group-drop:";

function uploadErrorMessage(error: string | undefined, maxPhotos: number, detail?: string): string {
  if (error === "photo_limit") return `Sasniegts limits (${maxPhotos} fotogrāfijas).`;
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

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!, i);
    }
  });
  await Promise.all(workers);
  return out;
}

function totalPhotos(groups: { photos?: { id: string }[] }[]): number {
  let n = 0;
  for (const g of groups) n += g.photos?.length ?? 0;
  return n;
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

function newDefaultGroup(index: number, emptyGroup: () => PhotoGroupLike): PhotoGroupLike {
  return { ...emptyGroup(), title: `Grupa ${index}` };
}

function ensureGroupInList(
  groups: PhotoGroupLike[],
  targetGroupId: string,
  emptyGroup: () => PhotoGroupLike,
): PhotoGroupLike[] {
  if (groups.some((g) => g.id === targetGroupId)) return groups;
  return [...groups, { ...newDefaultGroup(groups.length + 1, emptyGroup), id: targetGroupId }];
}

function findGroupIdOfPhoto(groups: PhotoGroupLike[], photoId: string): string | null {
  for (const g of groups) {
    if (g.photos.some((p) => p.id === photoId)) return g.id;
  }
  return null;
}

function samePhotoOrder(a: PhotoGroupLike[], b: PhotoGroupLike[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ga = a[i]!;
    const gb = b[i]!;
    if (ga.id !== gb.id || ga.photos.length !== gb.photos.length) return false;
    for (let j = 0; j < ga.photos.length; j++) {
      if (ga.photos[j]!.id !== gb.photos[j]!.id) return false;
    }
  }
  return true;
}

type SortablePhotoProps = {
  photoId: string;
  src: string;
  position: number;
  disabled: boolean;
  onRemove: () => void;
  onZoom: () => void;
};

function SortablePhoto({
  photoId,
  src,
  position,
  disabled,
  onRemove,
  onZoom,
}: SortablePhotoProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photoId,
    disabled,
  });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: "none",
        opacity: isDragging ? 0.35 : 1,
        zIndex: isDragging ? 1 : undefined,
      }}
      className={`group relative flex h-[5.5rem] w-[5.5rem] shrink-0 flex-col overflow-hidden rounded-md border bg-black/[0.06] dark:bg-white/10 ${
        isDragging
          ? "border-[var(--color-provin-accent)] ring-2 ring-[var(--color-provin-accent)]/40"
          : "border-[var(--admin-field-border)]"
      } ${disabled ? "" : "cursor-grab active:cursor-grabbing"}`}
      {...attributes}
      {...(disabled ? {} : listeners)}
      aria-label={`Fotogrāfija ${position}. Velc vai izmanto atstarpi un bultas, lai mainītu secību.`}
    >
      {/* Numurs = secība PDF; bez tā operators nezina, kas iznāks. */}
      <span className="pointer-events-none absolute left-0.5 top-0.5 z-10 inline-flex min-w-[1.05rem] justify-center rounded bg-black/60 px-1 py-px text-[9px] font-semibold leading-tight text-white">
        {position}
      </span>
      <span className="pointer-events-none absolute bottom-0.5 left-0.5 z-10 rounded bg-black/45 p-0.5 text-white opacity-0 transition group-hover:opacity-100">
        <GripVertical className="h-3 w-3" aria-hidden />
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        draggable={false}
      />
      <span className="absolute right-0.5 top-0.5 z-10 flex gap-0.5 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onZoom}
          className="inline-flex h-5 w-5 items-center justify-center rounded bg-black/55 text-white hover:bg-black/75"
          aria-label="Apskatīt lielu"
        >
          <Maximize2 className="h-3 w-3" aria-hidden />
        </button>
        {!disabled ? (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onRemove}
            className="inline-flex h-5 w-5 items-center justify-center rounded bg-black/55 text-white hover:bg-red-600"
            aria-label="Noņemt fotogrāfiju"
          >
            <Trash2 className="h-3 w-3" aria-hidden />
          </button>
        ) : null}
      </span>
    </li>
  );
}

/** Konteiners, kas pieņem arī iemešanu tukšā grupā. */
function GroupPhotoList({
  groupId,
  isEmpty,
  children,
}: {
  groupId: string;
  isEmpty: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${GROUP_DROP_PREFIX}${groupId}` });
  if (isEmpty) {
    return (
      <div
        ref={setNodeRef}
        className={`rounded-md border border-dashed px-2 py-3 text-center text-[10px] transition-colors ${
          isOver
            ? "border-[var(--color-provin-accent)] bg-[var(--color-provin-accent-soft)]/40 text-[var(--color-provin-accent)]"
            : "border-transparent text-transparent"
        }`}
      >
        Ievelc šeit
      </div>
    );
  }
  return (
    <ul
      ref={setNodeRef}
      className={`flex flex-wrap gap-2 rounded-md transition-colors ${
        isOver ? "bg-[var(--color-provin-accent-soft)]/30" : ""
      }`}
    >
      {children}
    </ul>
  );
}

export function AdminListingAnalysisPhotos({
  sessionId,
  photoGroups,
  disabled,
  onPhotoGroupsStructuralCommit,
  apiBasePath = "/api/admin/listing-analysis-photo",
  maxPhotos = LISTING_ANALYSIS_MAX_PHOTOS,
  emptyGroup = emptyListingAnalysisPhotoGroup,
  sectionTitle = "Fotogrāfijas (PDF režģis)",
  simple = false,
}: Props) {
  const baseInputId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const defaultGroupIdRef = useRef(emptyGroup().id);
  const previewUrlsRef = useRef<Map<string, string>>(new Map());
  const dropDepthRef = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const [dropActiveGroupId, setDropActiveGroupId] = useState<string | null>(null);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  /** Kārtošanas melnraksts — serverī saglabā tikai vienu reizi, kad vilkšana beidzas. */
  const [dragDraft, setDragDraft] = useState<PhotoGroupLike[] | null>(null);
  const [lightboxId, setLightboxId] = useState<string | null>(null);

  const groups = dragDraft ?? photoGroups;

  const serverImgSrc = useCallback(
    (photoId: string) =>
      `${apiBasePath}?sessionId=${encodeURIComponent(sessionId)}&photoId=${encodeURIComponent(photoId)}&v=${encodeURIComponent(photoId.slice(-8))}`,
    [apiBasePath, sessionId],
  );

  const displaySrc = useCallback(
    (photoId: string) => previewUrlsRef.current.get(photoId) ?? serverImgSrc(photoId),
    [serverImgSrc],
  );

  useEffect(() => {
    const previewUrls = previewUrlsRef.current;
    return () => {
      for (const url of previewUrls.values()) URL.revokeObjectURL(url);
      previewUrls.clear();
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
    async (next: PhotoGroupLike[], status?: string) => {
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
    void commitGroups([...photoGroups, newDefaultGroup(n, emptyGroup)], "Pievienota jauna grupa");
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
        await fetch(apiBasePath, {
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

    const nextGroupList = ensureGroupInList(photoGroups, targetGroupId, emptyGroup);
    const currentTotal = totalPhotos(nextGroupList);

    setBusy(true);
    setError(null);
    setStatusLine(null);
    const files = imageFiles.slice(0, Math.max(0, maxPhotos - currentTotal));
    if (files.length === 0) {
      setError(`Sasniegts limits (${maxPhotos} fotogrāfijas).`);
      setBusy(false);
      return;
    }

    const steps = files.length * 2 + 1;
    let done = 0;
    const tick = () => {
      done += 1;
      setUploadPercent(Math.min(99, Math.round((100 * done) / steps)));
    };
    setUploadPercent(2);

    try {
      const compressed = (
        await mapPool(files, 4, async (file) => {
          try {
            const jpeg = await compressImageFileToJpegForConsultation(file);
            tick();
            return jpeg;
          } catch {
            tick();
            return null;
          }
        })
      ).filter((f): f is File => f !== null);

      if (compressed.length === 0) {
        setError("Neizdevās apstrādāt attēlus. Mēģini vēlreiz vai eksportē JPG no Foto lietotnes.");
        return;
      }

      const uploaded: { id: string }[] = [];
      for (const jpeg of compressed) {
        const fd = new FormData();
        fd.set("sessionId", sessionId);
        fd.set("currentCount", String(currentTotal + uploaded.length));
        fd.set("file", jpeg);
        let data: { ok?: boolean; id?: string; error?: string; detail?: string } = {};
        let httpOk = false;
        try {
          const res = await fetch(apiBasePath, { method: "POST", body: fd, credentials: "include" });
          httpOk = res.ok;
          data = (await res.json().catch(() => ({}))) as typeof data;
        } catch {
          data = { error: "write_failed" };
        }
        tick();
        if (!httpOk || !data.id) {
          setError(uploadErrorMessage(data.error, maxPhotos, data.detail));
          continue;
        }
        uploaded.push({ id: data.id });
      }

      if (uploaded.length > 0) {
        const nextGroups = nextGroupList.map((g) =>
          g.id === targetGroupId ? { ...g, photos: [...g.photos, ...uploaded] } : g,
        );
        await commitGroups(nextGroups);
        tick();
      }
    } finally {
      setBusy(false);
      setUploadPercent(null);
    }
  };

  const onFileChange = async (groupId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    /**
     * `input.files` ir dzīvs saraksts: `value = ""` to iztukšo. Tāpēc failus vispirms
     * nokopē masīvā — citādi izvēle caur failu pārlūku klusi neizdarīja neko.
     */
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    await processFiles(files, groupId);
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
      await fetch(apiBasePath, {
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
      await fetch(apiBasePath, {
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

  const sensors = useSensors(
    /** 5px slieksnis — klikšķis uz bildes joprojām atver priekšskatījumu. */
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** Vispirms rādītājs, tad pārklāšanās — stabilāk gan blīvā režģī, gan pie tukšām grupām. */
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointer = pointerWithin(args);
    if (pointer.length > 0) return pointer;
    const intersections = rectIntersection(args);
    return intersections.length > 0 ? intersections : closestCenter(args);
  }, []);

  const resolveDropTarget = useCallback(
    (current: PhotoGroupLike[], overId: string): { groupId: string; index: number } | null => {
      if (overId.startsWith(GROUP_DROP_PREFIX)) {
        const groupId = overId.slice(GROUP_DROP_PREFIX.length);
        const group = current.find((g) => g.id === groupId);
        if (!group) return null;
        return { groupId, index: group.photos.length };
      }
      const groupId = findGroupIdOfPhoto(current, overId);
      if (!groupId) return null;
      const group = current.find((g) => g.id === groupId)!;
      return { groupId, index: group.photos.findIndex((p) => p.id === overId) };
    },
    [],
  );

  const movePhoto = useCallback(
    (current: PhotoGroupLike[], photoId: string, target: { groupId: string; index: number }) => {
      const fromGroupId = findGroupIdOfPhoto(current, photoId);
      if (!fromGroupId) return current;
      const photo = current
        .find((g) => g.id === fromGroupId)!
        .photos.find((p) => p.id === photoId)!;

      const stripped = current.map((g) =>
        g.id === fromGroupId ? { ...g, photos: g.photos.filter((p) => p.id !== photoId) } : g,
      );
      return stripped.map((g) => {
        if (g.id !== target.groupId) return g;
        const photos = [...g.photos];
        const index = Math.max(0, Math.min(target.index, photos.length));
        photos.splice(index, 0, photo);
        return { ...g, photos };
      });
    },
    [],
  );

  const onSortStart = useCallback((event: DragStartEvent) => {
    setActivePhotoId(String(event.active.id));
    setDragDraft(null);
  }, []);

  const onSortOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;
      const photoId = String(active.id);
      const overId = String(over.id);
      if (photoId === overId) return;
      setDragDraft((draft) => {
        const current = draft ?? photoGroups;
        const target = resolveDropTarget(current, overId);
        if (!target) return draft;
        const fromGroupId = findGroupIdOfPhoto(current, photoId);
        /** Tajā pašā grupā secību nokārto `onDragEnd`, lai animācija nelēkā. */
        if (fromGroupId === target.groupId) return draft;
        return movePhoto(current, photoId, target);
      });
    },
    [movePhoto, photoGroups, resolveDropTarget],
  );

  const onSortEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const photoId = String(active.id);
      setActivePhotoId(null);
      const draft = dragDraft;
      setDragDraft(null);
      if (!over) return;
      const base = draft ?? photoGroups;
      const target = resolveDropTarget(base, String(over.id));
      if (!target) return;
      const next = movePhoto(base, photoId, target);
      if (samePhotoOrder(next, photoGroups)) return;
      void commitGroups(next, "Saglabā secību…");
    },
    [commitGroups, dragDraft, movePhoto, photoGroups, resolveDropTarget],
  );

  const onSortCancel = useCallback(() => {
    setActivePhotoId(null);
    setDragDraft(null);
  }, []);

  const photoCount = totalPhotos(photoGroups);
  const atLimit = photoCount >= maxPhotos;
  const defaultGroupId = defaultGroupIdRef.current;

  /** Lightbox strādā pāri visām grupām — ērtāk pārskatīt visu sēriju. */
  const lightboxPhotos = useMemo<AdminLightboxPhoto[]>(
    () =>
      groups.flatMap((g) =>
        g.photos.map((p) => ({ id: p.id, src: displaySrc(p.id), caption: g.title.trim() || undefined })),
      ),
    [displaySrc, groups],
  );
  const lightboxIndex = lightboxId ? lightboxPhotos.findIndex((p) => p.id === lightboxId) : -1;

  const renderFileInput = (groupId: string) => (
    <input
      id={`${baseInputId}-${groupId}`}
      type="file"
      accept="image/*,.heic,.heif,.avif,.bmp,.tif,.tiff"
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
      } ${disabled ? "pointer-events-none opacity-45" : ""}`}
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
          {sectionTitle} · {photoCount}/{maxPhotos}
        </p>
        {!disabled ? (
          <div className="flex flex-wrap items-center gap-2">
            {simple ? null : (
              <button
                type="button"
                onClick={addGroup}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1 text-[10px] font-medium text-[var(--admin-field-text)] hover:bg-black/[0.03] disabled:opacity-45"
              >
                <FolderPlus className="h-3.5 w-3.5" aria-hidden />
                Pievienot grupu
              </button>
            )}
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

      {uploadPercent !== null ? (
        <div className="flex items-center gap-2">
          <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-[var(--color-provin-accent)] transition-[width] duration-150"
              style={{ width: `${uploadPercent}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-[var(--color-provin-muted)]">
            {uploadPercent}%
          </span>
        </div>
      ) : statusLine ? (
        <p className="flex items-center gap-1.5 text-[10px] text-[var(--color-provin-accent)]">
          {busy ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden /> : null}
          {statusLine}
        </p>
      ) : null}

      {error ? <p className="text-[10px] text-red-600 dark:text-red-400">{error}</p> : null}

      {photoGroups.length === 0 && !disabled
        ? renderDropZone(
            defaultGroupId,
            simple
              ? "Velc negadījuma fotogrāfijas šeit vai izmanto „Atvērt no datora…”."
              : "Velc attēlus šeit vai izmanto „Atvērt no datora…” — tiks izveidota pirmā grupa. Pēc tam vari pievienot virsrakstu (datums, avots).",
          )
        : null}

      {photoCount > 1 ? (
        <p className="text-[10px] text-[var(--color-provin-muted)]">
          Secību maini velkot; numurs uz bildes = vieta PDF. Var pārvilkt arī uz citu grupu. Ar tastatūru: Tab līdz bildei,
          atstarpe, bultas, atstarpe.
        </p>
      ) : null}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={onSortStart}
        onDragOver={onSortOver}
        onDragEnd={onSortEnd}
        onDragCancel={onSortCancel}
      >
        {groups.map((group, groupIndex) => {
          const photoIds = group.photos.map((p) => p.id);
          return (
            <section
              key={group.id}
              className="space-y-2 rounded-md border border-[var(--admin-field-border)]/70 bg-[var(--admin-field-bg)]/40 p-2"
            >
              {simple ? null : (
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
              )}

              {renderDropZone(
                group.id,
                group.photos.length === 0 && uploadPercent === null
                  ? "Velc attēlus šeit vai izmanto „Atvērt no datora…”."
                  : "Velc jaunus attēlus šeit, lai pievienotu grupai.",
              )}

              <SortableContext items={photoIds} strategy={rectSortingStrategy}>
                <GroupPhotoList groupId={group.id} isEmpty={photoIds.length === 0}>
                  {group.photos.map((p, index) => (
                    <SortablePhoto
                      key={p.id}
                      photoId={p.id}
                      src={displaySrc(p.id)}
                      position={index + 1}
                      disabled={disabled || busy}
                      onRemove={() => void removePhoto(group.id, p.id)}
                      onZoom={() => setLightboxId(p.id)}
                    />
                  ))}
                </GroupPhotoList>
              </SortableContext>
            </section>
          );
        })}

        <DragOverlay>
          {activePhotoId ? (
            <div className="overflow-hidden rounded-md border-2 border-[var(--color-provin-accent)] shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displaySrc(activePhotoId)}
                alt=""
                className="h-[5.5rem] w-[5.5rem] object-cover"
                draggable={false}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <AdminPhotoLightbox
        photos={lightboxPhotos}
        index={lightboxIndex >= 0 ? lightboxIndex : null}
        onIndexChange={(i) => setLightboxId(lightboxPhotos[i]?.id ?? null)}
        onClose={() => setLightboxId(null)}
      />
    </div>
  );
}
