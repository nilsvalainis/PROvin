/**
 * Bakes the homepage charcoal→black canvas as a Floyd-Steinberg dithered PNG.
 * CSS linear-gradients are composited in 8-bit, so a 23-level ramp over 100vh
 * becomes ~40 px bands. Premium sites ship a raster with error-diffusion instead.
 *
 * Tones match `.homePageCanvas` in components/test-pricing-5/test-pricing-5.module.css.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "public", "textures");

const DESKTOP_LINEAR = [
  [0, 23],
  [3.3, 22],
  [6.8, 21],
  [10.1, 20],
  [13.2, 19],
  [16, 18],
  [18.4, 17],
  [20.6, 16],
  [22.7, 15],
  [24.6, 14],
  [26.6, 13],
  [28.6, 12],
  [30.6, 11],
  [32.8, 10],
  [35.2, 9],
  [38, 8],
  [41.6, 7],
  [46.6, 6],
  [53.7, 5],
  [62, 4],
  [70, 3],
  [79.5, 2],
  [89.9, 1],
  [100, 0],
];

const MOBILE_LINEAR = [
  [0, 12],
  [5.3, 11],
  [10.6, 10],
  [16, 9],
  [21.3, 8],
  [26.5, 7],
  [32, 6],
  [38, 5],
  [44.8, 4],
  [52.5, 3],
  [62, 2],
  [77.2, 1],
  [100, 0],
];

const DESKTOP_RADIAL = [
  [0, 0.048],
  [12, 0.0372],
  [22, 0.0288],
  [32, 0.0204],
  [40, 0.0132],
  [46, 0.0072],
  [50, 0.0031],
  [54, 0.0009],
  [60, 0],
];

const MOBILE_RADIAL = DESKTOP_RADIAL.map(([p, a]) => [p, a * 0.5]);

function lerpStops(stops, p) {
  if (p <= stops[0][0]) return stops[0][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, v0] = stops[i];
    const [p1, v1] = stops[i + 1];
    if (p <= p1) return v0 + ((v1 - v0) * (p - p0)) / (p1 - p0);
  }
  return stops[stops.length - 1][1];
}

function sample(x, y, w, h, linearStops, radialStops) {
  const gray = lerpStops(linearStops, (y / (h - 1)) * 100);
  const cx = 0.5 * w;
  const cy = -0.06 * h;
  const rx = 1.3 * w;
  const ry = 0.72 * h;
  const nx = (x + 0.5 - cx) / rx;
  const ny = (y + 0.5 - cy) / ry;
  const t = Math.sqrt(nx * nx + ny * ny) * 100;
  const a = Math.max(0, lerpStops(radialStops, t));
  return gray * (1 - a) + 255 * a;
}

function floydSteinberg(src, w, h) {
  const buf = Float64Array.from(src);
  const out = Buffer.alloc(w * h);
  for (let y = 0; y < h; y++) {
    const ltr = y % 2 === 0;
    for (let i = 0; i < w; i++) {
      const x = ltr ? i : w - 1 - i;
      const idx = y * w + x;
      const old = buf[idx];
      const next = old < 0 ? 0 : old > 255 ? 255 : Math.round(old);
      out[idx] = next;
      const err = old - next;
      const spread = (dx, dy, k) => {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || xx >= w || yy < 0 || yy >= h) return;
        buf[yy * w + xx] += err * k;
      };
      if (ltr) {
        spread(1, 0, 7 / 16);
        spread(-1, 1, 3 / 16);
        spread(0, 1, 5 / 16);
        spread(1, 1, 1 / 16);
      } else {
        spread(-1, 0, 7 / 16);
        spread(1, 1, 3 / 16);
        spread(0, 1, 5 / 16);
        spread(-1, 1, 1 / 16);
      }
    }
  }
  return out;
}

function quantizeNaive(src) {
  const out = Buffer.alloc(src.length);
  for (let i = 0; i < src.length; i++) {
    const v = src[i];
    out[i] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
  }
  return out;
}

async function writeGrayPng(file, pixels, w, h) {
  await sharp(pixels, { raw: { width: w, height: h, channels: 1 } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(file);
}

async function bake({ name, w, h, linearStops, radialStops }) {
  const src = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      src[y * w + x] = sample(x, y, w, h, linearStops, radialStops);
    }
  }
  const dithered = floydSteinberg(src, w, h);
  const file = path.join(OUT_DIR, `${name}.png`);
  await writeGrayPng(file, dithered, w, h);
  return { file, dithered, src, w, h };
}

async function writePreview(desktop) {
  const { src, dithered, w, h } = desktop;
  const naive = quantizeNaive(src);
  const strip = Math.floor(w / 2);
  const rgb = Buffer.alloc(w * h * 3);
  const boost = 9;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = x < strip ? naive[y * w + x] : dithered[y * w + x];
      const out = Math.max(0, Math.min(255, v * boost));
      const i = (y * w + x) * 3;
      rgb[i] = rgb[i + 1] = rgb[i + 2] = out;
    }
  }
  await sharp(rgb, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toFile("/tmp/home-canvas-dither-preview.png");
}

await mkdir(OUT_DIR, { recursive: true });

const desktop = await bake({
  name: "home-canvas-desktop",
  w: 1920,
  h: 1200,
  linearStops: DESKTOP_LINEAR,
  radialStops: DESKTOP_RADIAL,
});
const mobile = await bake({
  name: "home-canvas-mobile",
  w: 800,
  h: 1200,
  linearStops: MOBILE_LINEAR,
  radialStops: MOBILE_RADIAL,
});
await writePreview(desktop);

const { stat } = await import("node:fs/promises");
for (const file of [desktop.file, mobile.file]) {
  const { size } = await stat(file);
  console.log(`${path.basename(file)} ${(size / 1024).toFixed(0)} KB`);
}
console.log("preview /tmp/home-canvas-dither-preview.png");
