"use client";

/**
 * Dīlera atskaites foto (Nils 27.11.2026): atsauces uz jebkuras pasūtījuma galerijas bildēm + augšupielāde.
 * Katrai: Blur / Titulbilde / Sūtīt klientam. Oriģināls galerijā paliek; «Noņemt» to neaiztiek.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ImagePlus, Images, Loader2, Trash2, X } from "lucide-react";

import { adminProBtn } from "@/lib/admin-pro-tones";
import { compressImageFileToJpegForConsultation } from "@/lib/consultation-photo-client-compress";
import {
  DEALER_PHOTOS_MAX,
  addDealerPhotos,
  dealerPhotoThumbUrl,
  emptyDealerPhotos,
  patchDealerPhoto,
  removeDealerPhoto,
  setAllDealerPhotosSend,
  toggleDealerCover,
  type DealerPhotoGallery,
  type DealerPhotosState,
} from "@/lib/dealer-photos";

export type DealerPhotosUpdater = (cur: DealerPhotosState) => DealerPhotosState;

type Props = {
  sessionId: string;
  state: DealerPhotosState | null | undefined;
  /** Visas pasūtījuma galerijas (aprēķina, atverot atlases logu). */
  getGalleries: () => DealerPhotoGallery[];
  /** `uploadedIds` - jaunas bildes dīlera augšupielāžu galerijā (pievieno arī tai). */
  onCommit: (update: DealerPhotosUpdater, uploadedIds?: string[]) => void | Promise<void>;
  /** Pašreizējais dīlera augšupielāžu skaits (servera limitam). */
  uploadedCount: number;
  disabled?: boolean;
};

const chip = (on: boolean) =>
  `inline-flex min-h-8 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors disabled:opacity-45 ${
    on
      ? "border-[var(--color-provin-accent)] bg-[var(--color-provin-accent-soft)] text-[var(--color-provin-accent)]"
      : "border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] text-[var(--admin-field-text)] hover:bg-black/[0.03]"
  }`;

export function AdminDealerPhotos({ sessionId, state, getGalleries, onCommit, uploadedCount, disabled }: Props) {
  const s = state ?? emptyDealerPhotos();
  const [picker, setPicker] = useState<DealerPhotoGallery[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sendCount = s.items.filter((i) => i.send).length;
  const full = s.items.length >= DEALER_PHOTOS_MAX;

  const upload = async (files: File[]) => {
    if (files.length === 0 || busy) return;
    setBusy(true);
    setErr(null);
    const ids: string[] = [];
    try {
      for (const f of files.slice(0, DEALER_PHOTOS_MAX - s.items.length)) {
        let jpeg: File;
        try {
          jpeg = await compressImageFileToJpegForConsultation(f);
        } catch {
          setErr(`Neizdevās apstrādāt «${f.name}».`);
          continue;
        }
        const fd = new FormData();
        fd.set("sessionId", sessionId);
        fd.set("currentCount", String(uploadedCount + ids.length));
        fd.set("hideWatermarks", "0");
        fd.set("file", jpeg);
        const res = await fetch("/api/admin/auto-records-photo", { method: "POST", body: fd, credentials: "include" }).catch(() => null);
        const data = (await res?.json().catch(() => ({}))) as { id?: string; error?: string } | undefined;
        if (!res?.ok || !data?.id) {
          setErr(data?.error === "photo_limit" ? "Sasniegts bilžu limits." : "Augšupielāde neizdevās.");
          continue;
        }
        ids.push(data.id);
      }
      if (ids.length > 0) await onCommit((cur) => addDealerPhotos(cur, ids), ids);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-dealer-photos
      className="mt-2 min-w-0 space-y-2 rounded-lg border border-[var(--admin-border-subtle)] bg-black/[0.02] p-2 dark:bg-white/[0.03]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-medium uppercase tracking-wide text-[var(--color-provin-muted)]">
          Foto klientam · {sendCount}/{s.items.length}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={adminProBtn("neutral")}
            disabled={disabled || busy || full}
            onClick={() => setPicker(getGalleries())}
          >
            <Images className="h-3.5 w-3.5" aria-hidden />
            No galerijām
          </button>
          <button
            type="button"
            className={adminProBtn("neutral")}
            disabled={disabled || busy || full}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <ImagePlus className="h-3.5 w-3.5" aria-hidden />}
            Augšupielādēt
          </button>
          {s.items.length > 0 ? (
            <button
              type="button"
              className={adminProBtn("neutral")}
              disabled={disabled}
              onClick={() => void onCommit((cur) => setAllDealerPhotosSend(cur, sendCount < cur.items.length))}
            >
              {sendCount < s.items.length ? "Visas klientam" : "Nevienu"}
            </button>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              void upload(files);
            }}
          />
        </div>
      </div>

      {err ? <p className="text-[11px] text-red-700 dark:text-red-300">{err}</p> : null}

      {s.items.length > 0 ? (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {s.items.map((it) => {
            const cover = s.coverId === it.id;
            return (
              <li
                key={it.id}
                className="flex min-w-0 items-center gap-2 rounded-md border border-[var(--admin-border-subtle)] bg-[var(--admin-field-bg)] p-1.5"
              >
                <span className="relative h-16 w-20 shrink-0 overflow-hidden rounded bg-black/[0.04]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={dealerPhotoThumbUrl(sessionId, it.id)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                    style={it.blur ? { filter: "blur(6px)" } : undefined}
                  />
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                  <button
                    type="button"
                    className={chip(it.blur === true)}
                    disabled={disabled}
                    aria-pressed={it.blur === true}
                    onClick={() => void onCommit((cur) => patchDealerPhoto(cur, it.id, { blur: !it.blur }))}
                  >
                    Blur
                  </button>
                  <button
                    type="button"
                    className={chip(cover)}
                    disabled={disabled}
                    aria-pressed={cover}
                    onClick={() => void onCommit((cur) => toggleDealerCover(cur, it.id))}
                  >
                    Titulbilde
                  </button>
                  <button
                    type="button"
                    className={chip(it.send === true)}
                    disabled={disabled}
                    aria-pressed={it.send === true}
                    onClick={() => void onCommit((cur) => patchDealerPhoto(cur, it.id, { send: !it.send }))}
                  >
                    {it.send ? <Check className="h-3 w-3" aria-hidden /> : null}
                    Sūtīt klientam
                  </button>
                  <button
                    type="button"
                    className="ml-auto inline-flex min-h-8 items-center rounded-md px-1.5 text-red-700 hover:bg-red-50/80 disabled:opacity-45 dark:text-red-300"
                    disabled={disabled}
                    aria-label="Noņemt"
                    onClick={() => void onCommit((cur) => removeDealerPhoto(cur, it.id))}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {picker ? (
        <AdminDealerPhotoPicker
          sessionId={sessionId}
          galleries={picker}
          have={new Set(s.items.map((i) => i.id))}
          room={DEALER_PHOTOS_MAX - s.items.length}
          onClose={() => setPicker(null)}
          onAdd={(ids) => {
            setPicker(null);
            if (ids.length > 0) void onCommit((cur) => addDealerPhotos(cur, ids));
          }}
        />
      ) : null}
    </div>
  );
}

/** Atlases logs: galerijas pa sadaļām, «Visas» katrai grupai, pievieno kā atsauces. */
export function AdminDealerPhotoPicker({
  sessionId,
  galleries,
  have,
  room,
  onClose,
  onAdd,
}: {
  sessionId: string;
  galleries: DealerPhotoGallery[];
  have: ReadonlySet<string>;
  room: number;
  onClose: () => void;
  onAdd: (ids: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const pickedSet = useMemo(() => new Set(picked), [picked]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (id: string) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < room ? [...cur, id] : cur));
  const toggleGroup = (g: DealerPhotoGallery) => {
    const free = g.ids.filter((id) => !have.has(id));
    const allOn = free.length > 0 && free.every((id) => pickedSet.has(id));
    setPicked((cur) => {
      if (allOn) return cur.filter((id) => !free.includes(id));
      const next = [...cur];
      for (const id of free) if (!next.includes(id) && next.length < room) next.push(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-modal="true" aria-label="Foto no galerijām">
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-t-xl bg-[var(--admin-field-bg,#fff)] sm:rounded-xl">
        <div className="flex items-center justify-between gap-2 border-b border-[var(--admin-border-subtle)] px-3 py-2">
          <p className="text-[13px] font-semibold text-[var(--admin-field-text)]">No galerijām</p>
          <button type="button" className="inline-flex min-h-9 items-center rounded-md px-2" aria-label="Aizvērt" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-2">
          {galleries.length === 0 ? <p className="py-6 text-center text-[12px] text-red-700">Nav bilžu</p> : null}
          {galleries.map((g) => {
            const free = g.ids.filter((id) => !have.has(id));
            const allOn = free.length > 0 && free.every((id) => pickedSet.has(id));
            return (
              <section key={g.key} className="min-w-0">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[11px] font-medium text-[var(--admin-field-text)]">
                    {g.section}
                    {g.title ? <span className="text-[var(--color-provin-muted)]"> · {g.title}</span> : null}
                    <span className="text-[var(--color-provin-muted)]"> · {g.ids.length}</span>
                  </p>
                  {free.length > 0 ? (
                    <button type="button" className={chip(allOn)} onClick={() => toggleGroup(g)}>
                      Visas
                    </button>
                  ) : null}
                </div>
                <div className="grid grid-cols-4 gap-1 sm:grid-cols-6">
                  {g.ids.map((id) => {
                    const added = have.has(id);
                    const on = added || pickedSet.has(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={added}
                        aria-pressed={on}
                        onClick={() => toggle(id)}
                        className={`relative aspect-[4/3] overflow-hidden rounded border-2 ${
                          on ? "border-[var(--color-provin-accent)]" : "border-transparent"
                        } ${added ? "opacity-50" : ""}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={dealerPhotoThumbUrl(sessionId, id)} alt="" loading="lazy" className="h-full w-full object-cover" />
                        {on ? (
                          <span className="absolute right-0.5 top-0.5 rounded-full bg-[var(--color-provin-accent)] p-0.5 text-white">
                            <Check className="h-3 w-3" aria-hidden />
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[var(--admin-border-subtle)] px-3 py-2">
          <button type="button" className={adminProBtn("neutral")} onClick={onClose}>
            Atcelt
          </button>
          <button type="button" className={adminProBtn("primary")} disabled={picked.length === 0} onClick={() => onAdd(picked)}>
            Pievienot ({picked.length})
          </button>
        </div>
      </div>
    </div>
  );
}
