"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useModalBackdropClose } from "@/hooks/useModalBackdropClose";

type IrissOfferPublicPhoto = { id: string };

const SWIPE_THRESHOLD_PX = 40;
const SWIPE_MOVE_THRESHOLD_PX = 10;
const PREFETCH_NEIGHBOR_OFFSETS = [-2, -1, 1, 2];
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const DOUBLE_TAP_MS = 300;

/** Jāsaskan ar lib/iriss-offer-image-thumb.ts IRISS_OFFER_DISPLAY_WIDTHS - šis komponents ir "use client",
 * tāpēc tur nevar importēt (lib fails importē `sharp`, kas nedrīkst nokļūt klienta bundle). */
const DISPLAY_WIDTHS = [480, 800, 1280] as const;
const DISPLAY_DEFAULT_WIDTH = 800;

function photoUrl(token: string, id: string, variant: "full" | "thumb" | "display" = "full", width?: number): string {
  const base = `/p/${encodeURIComponent(token)}/photo/${encodeURIComponent(id)}`;
  if (variant === "thumb") return `${base}?v=thumb`;
  if (variant === "display") return `${base}?v=display&w=${width ?? DISPLAY_DEFAULT_WIDTH}`;
  return base;
}

function displaySrcSet(token: string, id: string): string {
  return DISPLAY_WIDTHS.map((w) => `${photoUrl(token, id, "display", w)} ${w}w`).join(", ");
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function touchDist(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

const navBtn =
  "absolute top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white transition hover:bg-black/50";
const lightboxNavBtn =
  "hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 sm:inline-flex";

type ZoomGesture = {
  mode: "idle" | "pinch" | "pan";
  scale: number;
  panX: number;
  panY: number;
  startScale: number;
  startDist: number;
  startPanX: number;
  startPanY: number;
  startTouchX: number;
  startTouchY: number;
  tapStartX: number | null;
  tapStartY: number | null;
  lastTapTs: number;
};

function freshZoomGesture(): ZoomGesture {
  return {
    mode: "idle",
    scale: 1,
    panX: 0,
    panY: 0,
    startScale: 1,
    startDist: 0,
    startPanX: 0,
    startPanY: 0,
    startTouchX: 0,
    startTouchY: 0,
    tapStartX: null,
    tapStartY: null,
    lastTapTs: 0,
  };
}

/** Klikšķināmi sīktēli (horizontāla josla) + bultas + swipe + pilnekrāna galerija ar pinch-zoom
 * piedāvājuma publiskajā saitē (/p/[token]). */
export function IrissOfferPublicGallery({
  token,
  title,
  photos,
}: {
  token: string;
  title: string;
  photos: IrissOfferPublicPhoto[];
}) {
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [loadedIds, setLoadedIds] = useState<Record<string, boolean>>({});
  const count = photos.length;

  const go = useCallback(
    (delta: number) => {
      if (count < 2) return;
      setIndex((i) => (i + delta + count) % count);
    },
    [count],
  );

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
    swiped.current = false;
  }, []);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const s = touchStart.current;
    const t = e.touches[0];
    if (!s || !t) return;
    if (Math.abs(t.clientX - s.x) > SWIPE_MOVE_THRESHOLD_PX) swiped.current = true;
  }, []);
  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const s = touchStart.current;
      touchStart.current = null;
      const t = e.changedTouches[0];
      if (!s || !t) return;
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return;
      go(dx > 0 ? -1 : 1);
    },
    [go],
  );

  useEffect(() => {
    if (!lightboxOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxOpen]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen, go]);

  const backdropClose = useModalBackdropClose(() => setLightboxOpen(false));

  const hero = photos[index];

  // Prefetch nākamo/iepriekšējo 2-3 bildes (hero izmēra renditions), lai swipe/bultas jūtas tūlītējas.
  useEffect(() => {
    if (count < 2 || typeof window === "undefined") return;
    const seen = new Set<number>([index]);
    for (const d of PREFETCH_NEIGHBOR_OFFSETS) {
      const i = ((index + d) % count + count) % count;
      if (seen.has(i)) continue;
      seen.add(i);
      const photo = photos[i];
      if (!photo) continue;
      const img = new window.Image();
      img.src = photoUrl(token, photo.id, "display", DISPLAY_DEFAULT_WIDTH);
    }
  }, [index, count, token, photos]);

  // Sīktēlu josla: aktīvais sīktēls vienmēr redzams, ritina sevi centrā.
  const thumbRefs = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    if (!hero) return;
    const el = thumbRefs.current.get(hero.id);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [hero]);

  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const stripDrag = useRef<{ startX: number; startScrollLeft: number; dragged: boolean; pointerId: number } | null>(
    null,
  );
  const onStripPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const el = stripRef.current;
    if (!el) return;
    // Netver pointeri šeit - to drīkst tikai pēc faktiskas vilkšanas (sk. onStripPointerMove), citādi
    // Chromium novirza sekojošo `click` uz šo konteineru, nevis sīktēla pogu, un klikšķis pazūd.
    stripDrag.current = { startX: e.clientX, startScrollLeft: el.scrollLeft, dragged: false, pointerId: e.pointerId };
  }, []);
  const onStripPointerMove = useCallback((e: React.PointerEvent) => {
    const d = stripDrag.current;
    const el = stripRef.current;
    if (!d || !el) return;
    const dx = e.clientX - d.startX;
    if (!d.dragged && Math.abs(dx) > 3) {
      d.dragged = true;
      try {
        el.setPointerCapture(d.pointerId);
      } catch {
        /* ignore */
      }
    }
    el.scrollLeft = d.startScrollLeft - dx;
  }, []);
  const onStripPointerUp = useCallback((e: React.PointerEvent) => {
    const el = stripRef.current;
    if (el && el.hasPointerCapture(e.pointerId)) {
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  }, []);

  // Pilnekrāna pinch-zoom + pan + dubultklikšķis/dubultskāriens.
  const zoomImgRef = useRef<HTMLImageElement>(null);
  const gestureRef = useRef<ZoomGesture>(freshZoomGesture());

  const applyZoomTransform = useCallback(() => {
    const g = gestureRef.current;
    if (zoomImgRef.current) {
      zoomImgRef.current.style.transform = `translate(${g.panX}px, ${g.panY}px) scale(${g.scale})`;
    }
  }, []);

  const toggleZoom = useCallback(() => {
    const g = gestureRef.current;
    g.scale = g.scale > 1 ? 1 : 2.5;
    g.panX = 0;
    g.panY = 0;
    applyZoomTransform();
  }, [applyZoomTransform]);

  useEffect(() => {
    gestureRef.current = freshZoomGesture();
    if (zoomImgRef.current) zoomImgRef.current.style.transform = "";
  }, [index, lightboxOpen]);

  const onZoomTouchStart = useCallback((e: React.TouchEvent) => {
    const g = gestureRef.current;
    if (e.touches.length === 2) {
      e.stopPropagation();
      g.mode = "pinch";
      g.startDist = touchDist(e.touches[0]!, e.touches[1]!);
      g.startScale = g.scale;
      return;
    }
    if (e.touches.length === 1) {
      const t = e.touches[0]!;
      g.tapStartX = t.clientX;
      g.tapStartY = t.clientY;
      if (g.scale > 1.02) {
        e.stopPropagation();
        g.mode = "pan";
        g.startPanX = g.panX;
        g.startPanY = g.panY;
        g.startTouchX = t.clientX;
        g.startTouchY = t.clientY;
      } else {
        g.mode = "idle";
      }
    }
  }, []);

  const onZoomTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const g = gestureRef.current;
      if (g.mode === "pinch" && e.touches.length === 2) {
        e.stopPropagation();
        const d = touchDist(e.touches[0]!, e.touches[1]!);
        g.scale = clamp(g.startScale * (d / (g.startDist || 1)), ZOOM_MIN, ZOOM_MAX);
        applyZoomTransform();
      } else if (g.mode === "pan" && e.touches.length === 1) {
        e.stopPropagation();
        const t = e.touches[0]!;
        g.panX = g.startPanX + (t.clientX - g.startTouchX);
        g.panY = g.startPanY + (t.clientY - g.startTouchY);
        applyZoomTransform();
      }
    },
    [applyZoomTransform],
  );

  const onZoomTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const g = gestureRef.current;
      if (g.mode === "pinch") {
        e.stopPropagation();
        if (g.scale <= 1.02) {
          g.scale = 1;
          g.panX = 0;
          g.panY = 0;
          applyZoomTransform();
        }
      } else if (g.mode === "pan") {
        e.stopPropagation();
      } else {
        const t = e.changedTouches[0];
        if (t && g.tapStartX !== null && g.tapStartY !== null) {
          const moved = touchDist(t, { clientX: g.tapStartX, clientY: g.tapStartY });
          if (moved < SWIPE_MOVE_THRESHOLD_PX) {
            const now = Date.now();
            if (now - g.lastTapTs < DOUBLE_TAP_MS) {
              e.stopPropagation();
              toggleZoom();
              g.lastTapTs = 0;
            } else {
              g.lastTapTs = now;
            }
          }
        }
      }
      g.mode = "idle";
    },
    [applyZoomTransform, toggleZoom],
  );

  if (!hero) return null;
  const heroLoaded = !!loadedIds[hero.id];

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#e4e4e7]">
      <div
        className="relative aspect-[16/10] w-full overflow-hidden bg-[#e4e4e7]"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl(token, hero.id, "thumb")}
          alt=""
          aria-hidden
          className={`absolute inset-0 h-full w-full scale-110 object-cover blur-xl transition-opacity duration-300 ${heroLoaded ? "opacity-0" : "opacity-100"}`}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl(token, hero.id, "display", DISPLAY_DEFAULT_WIDTH)}
          srcSet={displaySrcSet(token, hero.id)}
          sizes="(min-width: 640px) 688px, 100vw"
          alt={title}
          className={`absolute inset-0 h-full w-full cursor-zoom-in object-cover transition-opacity duration-300 ${heroLoaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoadedIds((m) => (m[hero.id] ? m : { ...m, [hero.id]: true }))}
          onClick={() => {
            if (swiped.current) return;
            setLightboxOpen(true);
          }}
        />
        {count > 1 ? (
          <>
            <button type="button" aria-label="Iepriekšējā bilde" onClick={() => go(-1)} className={`${navBtn} left-2`}>
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button type="button" aria-label="Nākamā bilde" onClick={() => go(1)} className={`${navBtn} right-2`}>
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <div
          ref={stripRef}
          onPointerDown={onStripPointerDown}
          onPointerMove={onStripPointerMove}
          onPointerUp={onStripPointerUp}
          onPointerCancel={onStripPointerUp}
          className="flex cursor-grab gap-1.5 overflow-x-auto bg-white p-2 [scrollbar-width:none] active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              ref={(el) => {
                if (el) thumbRefs.current.set(photo.id, el);
                else thumbRefs.current.delete(photo.id);
              }}
              type="button"
              aria-label="Rādīt šo bildi"
              aria-current={i === index}
              onClick={() => {
                if (stripDrag.current?.dragged) {
                  stripDrag.current.dragged = false;
                  return;
                }
                setIndex(i);
              }}
              className={`h-[54px] w-[72px] shrink-0 overflow-hidden rounded-lg border-2 transition ${
                i === index ? "border-[#F26522]" : "border-[#e4e4e7]"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl(token, photo.id, "thumb")}
                alt=""
                draggable={false}
                className="h-full w-full bg-[#f4f4f5] object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}

      {lightboxOpen
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Bilžu pilnekrāna skats"
              className="fixed inset-0 z-[160] flex flex-col bg-black/90"
              {...backdropClose}
            >
              <div className="flex shrink-0 items-center justify-between gap-3 p-3">
                <p className="text-[13px] font-semibold text-white/90 tabular-nums">
                  {index + 1} / {count}
                </p>
                <button
                  type="button"
                  aria-label="Aizvērt"
                  onClick={() => setLightboxOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
              <div
                className="flex min-h-0 flex-1 items-center gap-2 px-2 pb-3"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              >
                {count > 1 ? (
                  <button type="button" aria-label="Iepriekšējā bilde" onClick={() => go(-1)} className={lightboxNavBtn}>
                    <ChevronLeft className="h-5 w-5" aria-hidden />
                  </button>
                ) : null}
                <div
                  className="relative min-h-0 flex-1 touch-none overflow-hidden"
                  onTouchStart={onZoomTouchStart}
                  onTouchMove={onZoomTouchMove}
                  onTouchEnd={onZoomTouchEnd}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={zoomImgRef}
                    src={photoUrl(token, hero.id, "full")}
                    alt={title}
                    draggable={false}
                    onDoubleClick={toggleZoom}
                    className="mx-auto block max-h-full max-w-full select-none object-contain"
                  />
                </div>
                {count > 1 ? (
                  <button type="button" aria-label="Nākamā bilde" onClick={() => go(1)} className={lightboxNavBtn}>
                    <ChevronRight className="h-5 w-5" aria-hidden />
                  </button>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
