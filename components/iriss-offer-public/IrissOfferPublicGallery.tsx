"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useModalBackdropClose } from "@/hooks/useModalBackdropClose";

type IrissOfferPublicPhoto = { id: string };

const SWIPE_THRESHOLD_PX = 40;
const SWIPE_MOVE_THRESHOLD_PX = 10;

function photoUrl(token: string, id: string): string {
  return `/p/${encodeURIComponent(token)}/photo/${encodeURIComponent(id)}`;
}

const navBtn =
  "absolute top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white transition hover:bg-black/50";
const lightboxNavBtn =
  "hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 sm:inline-flex";

/** Klikšķināmi sīktēli + bultas + swipe + pilnekrāna galerija piedāvājuma publiskajā saitē (/p/[token]). */
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
  const thumbs = useMemo(() => {
    const out: { photo: IrissOfferPublicPhoto; i: number }[] = [];
    for (let i = 0; i < photos.length && out.length < 6; i += 1) {
      if (i === index) continue;
      out.push({ photo: photos[i]!, i });
    }
    return out;
  }, [photos, index]);

  if (!hero) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#e4e4e7]">
      <div className="relative" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl(token, hero.id)}
          alt={title}
          className="aspect-[16/10] w-full cursor-zoom-in bg-[#e4e4e7] object-cover"
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

      {thumbs.length > 0 ? (
        <div className="grid grid-cols-3 gap-1.5 bg-white p-2 sm:grid-cols-6">
          {thumbs.map(({ photo, i }) => (
            <button key={photo.id} type="button" aria-label="Rādīt šo bildi" onClick={() => setIndex(i)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl(token, photo.id)}
                alt=""
                className="aspect-[4/3] w-full rounded-lg border border-[#e4e4e7] bg-[#f4f4f5] object-cover"
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl(token, hero.id)}
                  alt={title}
                  draggable={false}
                  className="max-h-full max-w-full flex-1 select-none object-contain"
                />
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
