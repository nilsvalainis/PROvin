"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

/**
 * Mājas „Deep Focus” fons caur Canvas (nevis CSS blur + gradient slāņi).
 * Augstāks DPR + gluds alpha(t) + trokšņa pattern — parasti ievērojami mazāk joslu nekā CSS.
 */

const BASE = "#050505";

let noiseTile: HTMLCanvasElement | null = null;

function getNoiseTile(): HTMLCanvasElement {
  if (noiseTile) return noiseTile;
  const s = 128;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const n = c.getContext("2d");
  if (!n) return c;
  const img = n.createImageData(s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 38;
  }
  n.putImageData(img, 0, 0);
  noiseTile = c;
  return c;
}

function paintAtmosphere(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx || typeof window === "undefined") return;

  const cssW = Math.max(1, Math.floor(window.innerWidth));
  const cssH = Math.max(1, Math.floor(window.innerHeight));
  const dpr = Math.min(window.devicePixelRatio ?? 1, 2);

  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = BASE;
  ctx.fillRect(0, 0, cssW, cssH);

  const cx = cssW * 0.5;
  const cy = cssH * 0.43;
  const r = Math.max(cssW, cssH) * 0.92;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);

  const stops = 36;
  for (let i = 0; i <= stops; i++) {
    const t = i / stops;
    const a = 0.079 * Math.pow(1 - t, 2.35);
    g.addColorStop(t, `rgba(255,255,255,${a.toFixed(5)})`);
  }

  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cssW, cssH);

  const pat = ctx.createPattern(getNoiseTile(), "repeat");
  if (pat) {
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.05;
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
