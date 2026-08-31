/**
 * Mobile Pakalpojumi page-1 previews (full page, no iOS PDF iframe crop):
 * 1) Poppler/Cairo @ 220 DPI
 * 2) Flatten gray soft-mask drop shadows (Safari-like, no harsh bands)
 * 3) Lanczos → 1400px PNG
 */
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const samples = [
  "provin-mini-piemers",
  "provin-audits-piemers",
  "provin-dilera-dati-piemers",
];
const TARGET_WIDTH = 1400;
const RENDER_DPI = 220;

function flattenGrayShadows(data, channels) {
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += channels) {
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max - min;
    const lum = (r + g + b) / 3;

    // Gray soft-shadow only — keep dark text and saturated UI (red/blue).
    if (sat > 30 || lum < 85 || lum > 253) continue;

    const amount = 0.88 + Math.min(1, (240 - lum) / 160) * 0.1;
    out[i] = Math.round(r + (255 - r) * amount);
    out[i + 1] = Math.round(g + (255 - g) * amount);
    out[i + 2] = Math.round(b + (255 - b) * amount);
  }
  return out;
}

function findRenderedPng(dir, name) {
  for (const c of [`${name}-1.png`, `${name}-01.png`, `${name}.png`]) {
    const p = path.join(dir, c);
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`Missing poppler output for ${name}`);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "provin-page1-"));

try {
  for (const name of samples) {
    const pdf = path.join(root, "public/samples", `${name}.pdf`);
    const prefix = path.join(tmp, name);
    execFileSync("pdftocairo", ["-png", "-r", String(RENDER_DPI), "-f", "1", "-l", "1", pdf, prefix], {
      stdio: "inherit",
    });

    const src = findRenderedPng(tmp, name);
    const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const flat = flattenGrayShadows(data, info.channels);

    const outPng = path.join(root, "public/samples", `${name}-page1.png`);
    await sharp(flat, {
      raw: { width: info.width, height: info.height, channels: info.channels },
    })
      .resize({ width: TARGET_WIDTH, kernel: sharp.kernel.lanczos3, withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: false })
      .toFile(outPng);

    const meta = await sharp(outPng).metadata();
    console.log("OK", name, meta.width, "x", meta.height, fs.statSync(outPng).size);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
