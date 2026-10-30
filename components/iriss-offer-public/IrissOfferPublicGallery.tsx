"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useModalBackdropClose } from "@/hooks/useModalBackdropClose";
import {
  IRISS_OFFER_HERO_SIZES,
  beginIrissOfferStripDrag,
  endIrissOfferStripDrag,
  irissOfferPublicHeroSrcSet,
  irissOfferPublicPhotoUrl,
  irissOfferThumbLoadingMode,
  isOfferHeroImageReady,
  moveIrissOfferStripDrag,
  type IrissOfferStripDrag,
} from "@/lib/iriss-offer-public-photo";

type IrissOfferPublicPhoto = { id: string };

const SWIPE_THRESHOLD_PX = 40;
const SWIPE_MOVE_THRESHOLD_PX = 10;
const PREFETCH_NEIGHBOR_OFFSETS = [-1, 1];
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const DOUBLE_TAP_MS = 300;

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

export type IrissOfferPublicGalleryUrls = {
  thumb: (id: string) => string;
  full: (id: string) => string;
  heroSrcSet?: (id: string) => string;
};

/**
 * Gatavi foto URL pa foto id. Tikai virknes - to drīkst nodot no servera komponentes
 * (funkcijas pāri servera/klienta robežai produkcijā met kļūdu un lapa krīt ar 500).
 */
export type IrissOfferPublicGalleryUrlMap = {
  thumb: Record<string, string>;
  full: Record<string, string>;
};

function defaultGalleryUrls(token: string): IrissOfferPublicGalleryUrls {
  return {
    thumb: (id) => irissOfferPublicPhotoUrl(token, id, "thumb"),
    full: (id) => irissOfferPublicPhotoUrl(token, id, "full"),
    heroSrcSet: (id) => irissOfferPublicHeroSrcSet(token, id),
  };
}

function galleryUrlsFromMap(map: IrissOfferPublicGalleryUrlMap): IrissOfferPublicGalleryUrls {
  return {
    thumb: (id) => map.thumb[id] ?? "",
    full: (id) => map.full[id] ?? map.thumb[id] ?? "",
  };
}

/** Klikšķināmi sīktēli (horizontāla josla) + bultas + swipe + pilnekrāna galerija ar pinch-zoom
 * piedāvājuma publiskajā saitē (/p/[token] un /p/d/[token]). */
export function IrissOfferPublicGallery({
  token,
  title,
  photos,
  urlMap,
}: {
  token: string;
  title: string;
  photos: IrissOfferPublicPhoto[];
  /** Cits foto ceļš (Piedāvājumi `/p/d/`). Bez tā - `/p/<token>/photo/<id>`. */
  urlMap?: IrissOfferPublicGalleryUrlMap;
}) {
  const photoUrls = urlMap ? galleryUrlsFromMap(urlMap) : defaultGalleryUrls(token);
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
  const heroImgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const el = heroImgRef.current;
    if (!hero || !el || !isOfferHeroImageReady(el)) return;
    setLoadedIds((m) => (m[hero.id] ? m : { ...m, [hero.id]: true }));
  }, [hero]);

  // Tikai kaimiņu pilnās bildes un tikai pēc hero ielādes - citādi 4× display AVIF apēd pirmo kadru.
  useEffect(() => {
    if (!loadedIds[hero?.id ?? ""] || count < 2 || typeof window === "undefined") return;
    const seen = new Set<number>([index]);
    for (const d of PREFETCH_NEIGHBOR_OFFSETS) {
      const i = ((index + d) % count + count) % count;
      if (seen.has(i)) continue;
      seen.add(i);
      const photo = photos[i];
      if (!photo) continue;
      const img = new window.Image();
      img.src = photoUrls.full(photo.id);
    }
  }, [index, count, photos, loadedIds, hero?.id, photoUrls]);

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

  const stripDrag = useRef<IrissOfferStripDrag | null>(null);
  const suppressStripClick = useRef(false);
  const stripWinCleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => stripWinCleanup.current?.(), []);
  const endStripDragSession = useCallback((pointerId?: number) => {
    const el = stripRef.current;
    const d = stripDrag.current;
    if (pointerId != null && d && d.pointerId !== pointerId) return;
    const ended = endIrissOfferStripDrag(d);
    suppressStripClick.current = ended.suppressClick;
    stripDrag.current = null;
    if (el && pointerId != null && el.hasPointerCapture(pointerId)) {
      try {
        el.releasePointerCapture(pointerId);
      } catch {
        /* ignore */
      }
    }
  }, []);
  const onStripPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = stripRef.current;
      if (!el) return;
      // Netver pointeri šeit - tikai pēc sliekšņa (sk. move), citādi Chromium noēd klikšķi uz sīktēla.
      stripDrag.current = beginIrissOfferStripDrag({
        pointerId: e.pointerId,
        startX: e.clientX,
        startScrollLeft: el.scrollLeft,
      });
      const pointerId = e.pointerId;
      stripWinCleanup.current?.();
      const onWinUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        stripWinCleanup.current?.();
        endStripDragSession(pointerId);
      };
      stripWinCleanup.current = () => {
        window.removeEventListener("pointerup", onWinUp, true);
        window.removeEventListener("pointercancel", onWinUp, true);
        stripWinCleanup.current = null;
      };
      window.addEventListener("pointerup", onWinUp, true);
      window.addEventListener("pointercancel", onWinUp, true);
    },
    [endStripDragSession],
  );
  const onStripPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = stripDrag.current;
      const el = stripRef.current;
      if (!d || !el) return;
      const next = moveIrissOfferStripDrag(d, {
        pointerId: e.pointerId,
        clientX: e.clientX,
        buttons: e.buttons,
        pointerType: e.pointerType,
      });
      if (next.action === "ignore" || next.action === "hold") return;
      if (next.action === "end") {
        endStripDragSession(e.pointerId);
        return;
      }
      stripDrag.current = next.drag;
      el.scrollLeft = next.scrollLeft;
      if (next.capture) {
        try {
          el.setPointerCapture(next.drag.pointerId);
        } catch {
          /* ignore */
        }
      }
    },
    [endStripDragSession],
  );
  const onStripPointerUp = useCallback(
    (e: React.PointerEvent) => {
      endStripDragSession(e.pointerId);
    },
    [endStripDragSession],
  );

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
          src={photoUrls.thumb(hero.id)}
          alt=""
          aria-hidden
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-200 ${heroLoaded ? "opacity-0" : "opacity-100"}`}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrls.full(hero.id)}
          srcSet={photoUrls.heroSrcSet?.(hero.id)}
          sizes={photoUrls.heroSrcSet ? IRISS_OFFER_HERO_SIZES : undefined}
          alt={title}
          fetchPriority="high"
          decoding="async"
          className={`absolute inset-0 h-full w-full cursor-zoom-in object-cover transition-opacity duration-200 ${heroLoaded ? "opacity-100" : "opacity-0"}`}
          ref={heroImgRef}
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
          onLostPointerCapture={onStripPointerUp}
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
                if (suppressStripClick.current || stripDrag.current?.dragged) {
                  suppressStripClick.current = false;
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
                src={photoUrls.thumb(photo.id)}
                alt=""
                draggable={false}
                loading={irissOfferThumbLoadingMode(i, index)}
                decoding="async"
                fetchPriority="low"
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
                    src={photoUrls.full(hero.id)}
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
