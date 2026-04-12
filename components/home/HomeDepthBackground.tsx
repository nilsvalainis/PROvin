"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

/**
 * Mājas „Deep Focus” fons — Canvas. Platām / augstas DPR ekrāniem: augstāks
 * iekšējais izšķirtspējas mērogs, vairāk gradienta soļu, lielāka trokšņa flīze.
 */

const BASE = "#050505";
const DESKTOP_MIN_CSS_W = 1024;
const MAX_CANVAS_EDGE = 4096;

const noiseTiles: { s?: HTMLCanvasElement; l?: HTMLCanvasElement } = {};

function buildNoiseTile(size: 128 | 320): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const n = c.getContext("2d");
  if (!n) return c;
  const img = n.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = size >= 320 ? 34 : 38;
  }
  n.putImageData(img, 0, 0);
  return c;
}

function getNoiseTile(desktop: boolean): HTMLCanvasElement {
  if (desktop) {
    if (!noiseTiles.l) noiseTiles.l = buildNoiseTile(320);
    return noiseTiles.l;
  }
  if (!noiseTiles.s) noiseTiles.s = buildNoiseTile(128);
  return noiseTiles.s;
}

function resolveDpr(cssW: number, cssH: number, desktop: boolean): number {
  const raw = window.devicePixelRatio ?? 1;
  let dpr = desktop ? Math.min(raw, 3) : Math.min(raw, 2);
  const bw = () => Math.floor(cssW * dpr);
  const bh = () => Math.floor(cssH * dpr);
  while (bw() > MAX_CANVAS_EDGE || bh() > MAX_CANVAS_EDGE) {
    dpr *= 0.94;
    if (dpr < 1) return 1;
  }
  return dpr;
}

function paintAtmosphere(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx || typeof window === "undefined") return;

  const cssW = Math.max(1, Math.floor(window.innerWidth));
  const cssH = Math.max(1, Math.floor(window.innerHeight));
  const desktop = cssW >= DESKTOP_MIN_CSS_W;
  const dpr = resolveDpr(cssW, cssH, desktop);

  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = BASE;
  ctx.fillRect(0, 0, cssW, cssH);

  const cx = cssW * 0.5;
  const cy = cssH * 0.43;
  const r = Math.max(cssW, cssH) * (desktop ? 0.98 : 0.92);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);

  const nStops = desktop ? 72 : 40;
  for (let i = 0; i <= nStops; i++) {
    const t = i / nStops;
    const a = 0.079 * Math.pow(1 - t, desktop ? 2.5 : 2.35);
    const rgb = i % 2 === 0 ? "255,255,255" : "252,253,255";
    g.addColorStop(t, `rgba(${rgb},${a.toFixed(5)})`);
  }

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cssW, cssH);

  const pat = ctx.createPattern(getNoiseTile(desktop), "repeat");
  if (pat) {
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = desktop ? 0.36 : 0.32;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = desktop ? 0.065 : 0.05;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.restore();
  }
}

export function HomeDepthBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  const paint = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    paintAtmosphere(el);
  }, []);

  useLayoutEffect(() => {
    paint();
  }, [paint]);

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(paint);
    });
    ro.observe(document.documentElement);
    window.addEventListener("resize", paint, { passive: true });
    const vv = window.visualViewport;
    const onVv = () => requestAnimationFrame(paint);
    vv?.addEventListener("resize", onVv);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", paint);
      vv?.removeEventListener("resize", onVv);
    };
  }, [paint]);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none fixed inset-0 z-[1]"
      aria-hidden
    />
  );
}
