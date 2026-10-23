"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAdminScrollLock } from "@/lib/admin-scroll-lock";
import { ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import {
  PHOTO_ZOOM_RESET,
  clampPhotoPan,
  photoZoomPercent,
  pinchPhotoZoom,
  stepPhotoZoom,
  togglePhotoZoom,
  type PhotoZoomState,
} from "@/lib/photo-zoom";

export type AdminLightboxPhoto = {
  id: string;
  src: string;
  /** Virsraksts virs attēla — piem. grupas nosaukums vai komentārs. */
  caption?: string;
  /** Mazs attēls sīktēlu joslai (ja nav - src). */
  thumbSrc?: string;
};

type Props = {
  photos: AdminLightboxPhoto[];
  /** Aktīvā attēla indekss; `null` — aizvērts. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Sīktēlu josla apakšā. */
  thumbnails?: boolean;
  /** Pogas apakšā (piem. "Vāks", "Dzēst") aktīvajam attēlam. */
  actions?: (index: number) => ReactNode;
};

const ctrlBtn =
  "inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-white/15 px-2 text-[13px] font-semibold text-white transition hover:bg-white/25 disabled:opacity-40";

type Pointer = { x: number; y: number };

/** Pilnekrāna priekšskatījums ar tālummaiņu — režģa sīktēli ir par maziem, lai novērtētu bildi. */
export function AdminPhotoLightbox({ photos, index, onIndexChange, onClose, thumbnails = false, actions }: Props) {
  const open = index !== null && index >= 0 && index < photos.length;
  const [zoom, setZoom] = useState<PhotoZoomState>(PHOTO_ZOOM_RESET);
  const boxRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Pointer>());
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const panLast = useRef<Pointer | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  const moved = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setZoom(PHOTO_ZOOM_RESET);
  }, [index]);

  const box = useCallback(() => {
    const r = boxRef.current?.getBoundingClientRect();
    return { width: r?.width ?? 0, height: r?.height ?? 0 };
  }, []);

  const setScale = useCallback(
    (scale: number) => setZoom((z) => clampPhotoPan({ ...z, scale }, box())),
    [box],
  );

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
        return;
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom((z) => clampPhotoPan({ ...z, scale: stepPhotoZoom(z.scale, 1) }, box()));
        return;
      }
      if (e.key === "-") {
        e.preventDefault();
        setZoom((z) => clampPhotoPan({ ...z, scale: stepPhotoZoom(z.scale, -1) }, box()));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [box, onClose, open, step]);

  useAdminScrollLock(open);

  if (!open || !mounted) return null;
  const photo = photos[index]!;

  const distance = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    if (pointers.current.size === 2) {
      pinchStart.current = { distance: distance(), scale: zoom.scale };
      panLast.current = null;
    } else {
      panLast.current = { x: e.clientX, y: e.clientY };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinchStart.current) {
      moved.current = true;
      const scale = pinchPhotoZoom(pinchStart.current.scale, pinchStart.current.distance, distance());
      setZoom((z) => clampPhotoPan({ ...z, scale }, box()));
      return;
    }
    const last = panLast.current;
    if (!last) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
    panLast.current = { x: e.clientX, y: e.clientY };
    if (zoom.scale > 1) setZoom((z) => clampPhotoPan({ ...z, x: z.x + dx, y: z.y + dy }, box()));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()];
      panLast.current = p ?? null;
      return;
    }
    panLast.current = null;
    if (e.pointerType === "mouse" || moved.current) return;
    // Dubultpieskāriens (telefonā): 1x <-> 2x.
    const now = Date.now();
    const prev = lastTap.current;
    if (prev && now - prev.t < 320 && Math.hypot(prev.x - e.clientX, prev.y - e.clientY) < 30) {
      lastTap.current = null;
      setScale(togglePhotoZoom(zoom.scale));
      return;
    }
    lastTap.current = { t: now, x: e.clientX, y: e.clientY };
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fotogrāfijas priekšskatījums"
      className="fixed inset-0 z-[160] flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 p-3" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white/90 tabular-nums">
            {index + 1} / {photos.length}
          </p>
          {photo.caption?.trim() ? (
            <p className="mt-0.5 max-w-[60vw] truncate text-[11px] text-white/70">{photo.caption}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            aria-label="Attālināt"
            disabled={zoom.scale <= 1}
            onClick={() => setScale(stepPhotoZoom(zoom.scale, -1))}
            className={`${ctrlBtn.replace("inline-flex ", "")} hidden sm:inline-flex`}
          >
            <Minus className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Tālummaiņa"
            onClick={() => setScale(togglePhotoZoom(zoom.scale))}
            className={`${ctrlBtn} tabular-nums`}
          >
            <span className="sm:hidden">{`${Math.round(zoom.scale * 10) / 10}×`}</span>
            <span className="hidden sm:inline">{photoZoomPercent(zoom.scale)}</span>
          </button>
          <button
            type="button"
            aria-label="Pietuvināt"
            disabled={zoom.scale >= 4}
            onClick={() => setScale(stepPhotoZoom(zoom.scale, 1))}
            className={`${ctrlBtn.replace("inline-flex ", "")} hidden sm:inline-flex`}
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" onClick={onClose} aria-label="Aizvērt priekšskatījumu" className={ctrlBtn}>
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center gap-2 px-2 pb-3">
        {photos.length > 1 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
            aria-label="Iepriekšējā fotogrāfija"
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 sm:inline-flex"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
        <div
          ref={boxRef}
          className="relative flex h-full min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden"
          style={{ touchAction: "none", cursor: zoom.scale > 1 ? "grab" : "zoom-in" }}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setScale(togglePhotoZoom(zoom.scale));
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.src}
            alt={photo.caption ?? ""}
            draggable={false}
            className="max-h-full max-w-full select-none object-contain"
            style={{
              transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
              transition: pointers.current.size ? "none" : "transform 120ms ease-out",
            }}
            decoding="async"
          />
        </div>
        {photos.length > 1 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
            aria-label="Nākamā fotogrāfija"
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 sm:inline-flex"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </button>
        ) : null}
      </div>

      {thumbnails && photos.length > 1 ? (
        <div className="shrink-0 overflow-x-auto px-3 pb-2" onClick={(e) => e.stopPropagation()}>
          <div className="mx-auto flex w-max gap-2">
            {photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                aria-label={`Fotogrāfija ${i + 1}`}
                aria-current={i === index}
                onClick={() => onIndexChange(i)}
                className={`h-12 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${i === index ? "border-white" : "border-transparent opacity-70"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumbSrc || p.src} alt="" className="h-full w-full object-cover" draggable={false} />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {actions ? (
        <div
          className="flex shrink-0 justify-center gap-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          onClick={(e) => e.stopPropagation()}
        >
          {actions(index)}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
