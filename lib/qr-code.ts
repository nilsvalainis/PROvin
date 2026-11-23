/**
 * Mazs QR koda ģenerators (baitu režīms, kļūdu labošana L/M, versijas 1-10) bez ārējām atkarībām.
 * Pēc Project Nayuki "QR Code generator" algoritma (MIT). Pietiek īsām saitēm (sms:, https:) līdz ~200 baitiem.
 */

export type QrEcc = "L" | "M";

const ECC_FORMAT_BITS: Record<QrEcc, number> = { L: 1, M: 0 };
// Indekss = versija (0 neizmanto).
const ECC_CODEWORDS_PER_BLOCK: Record<QrEcc, number[]> = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
};
const NUM_ERROR_CORRECTION_BLOCKS: Record<QrEcc, number[]> = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
};
const MAX_VERSION = 10;

function numRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function numDataCodewords(ver: number, ecc: QrEcc): number {
  return Math.floor(numRawDataModules(ver) / 8) - ECC_CODEWORDS_PER_BLOCK[ecc][ver] * NUM_ERROR_CORRECTION_BLOCKS[ecc][ver];
}

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] ^= gfMul(coef, factor);
    });
  }
  return result;
}

function alignmentPositions(ver: number, size: number): number[] {
  if (ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const step = Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0;

/** QR matrica: `modules[y][x]` true = tumšs. `mask` -1 = labākā pēc soda punktiem. */
export function encodeQr(text: string, opts: { ecc?: QrEcc; mask?: number; minVersion?: number } = {}): { size: number; modules: boolean[][]; version: number; mask: number } {
  const ecc = opts.ecc ?? "M";
  const bytes = [...new TextEncoder().encode(text)];
  let version = 0;
  for (let v = Math.max(1, opts.minVersion ?? 1); v <= MAX_VERSION; v++) {
    const ccBits = v <= 9 ? 8 : 16;
    if (4 + ccBits + bytes.length * 8 <= numDataCodewords(v, ecc) * 8) {
      version = v;
      break;
    }
  }
  if (!version) throw new Error("QR: teksts par garu");

  // Datu biti
  const bits: number[] = [];
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  const capacity = numDataCodewords(version, ecc) * 8;
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  // Kļūdu labošana + bloku sajaukšana
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecc][version];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecc][version];
  const rawCodewords = Math.floor(numRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const divisor = rsDivisor(blockEccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
    k += dat.length;
    const e = rsRemainder(dat, divisor);
    if (i < numShortBlocks) dat.push(0);
    blocks.push(dat.concat(e));
  }
  const codewords: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) codewords.push(block[i]);
    });
  }

  const size = version * 4 + 17;
  const base: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const isFn: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const setFn = (x: number, y: number, dark: boolean) => {
    base[y][x] = dark;
    isFn[y][x] = true;
  };

  for (let i = 0; i < size; i++) {
    setFn(6, i, i % 2 === 0);
    setFn(i, 6, i % 2 === 0);
  }
  const finder = (x: number, y: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) setFn(xx, yy, dist !== 2 && dist !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  const align = alignmentPositions(version, size);
  for (let i = 0; i < align.length; i++) {
    for (let j = 0; j < align.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(align[i] + dx, align[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }

  const drawFormat = (m: boolean[][], mask: number, mark: boolean) => {
    const dataBits = (ECC_FORMAT_BITS[ecc] << 3) | mask;
    let rem = dataBits;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const fb = ((dataBits << 10) | rem) ^ 0x5412;
    const set = (x: number, y: number, d: boolean) => {
      m[y][x] = d;
      if (mark) isFn[y][x] = true;
    };
    for (let i = 0; i <= 5; i++) set(8, i, bit(fb, i));
    set(8, 7, bit(fb, 6));
    set(8, 8, bit(fb, 7));
    set(7, 8, bit(fb, 8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(fb, i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(fb, i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(fb, i));
    set(8, size - 8, true);
  };
  drawFormat(base, 0, true);

  if (version >= 7) {
    let rem = version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const vb = (version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFn(a, b, bit(vb, i));
      setFn(b, a, bit(vb, i));
    }
  }

  // Datu moduļi zigzagā
  let idx = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFn[y][x] && idx < codewords.length * 8) {
          base[y][x] = bit(codewords[idx >>> 3], 7 - (idx & 7));
          idx++;
        }
      }
    }
  }

  const applyMask = (mask: number): boolean[][] => {
    const m = base.map((row) => [...row]);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (isFn[y][x]) continue;
        let inv: boolean;
        switch (mask) {
          case 0: inv = (x + y) % 2 === 0; break;
          case 1: inv = y % 2 === 0; break;
          case 2: inv = x % 3 === 0; break;
          case 3: inv = (x + y) % 3 === 0; break;
          case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: inv = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: inv = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: inv = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
        }
        if (inv) m[y][x] = !m[y][x];
      }
    }
    drawFormat(m, mask, false);
    return m;
  };

  if (opts.mask !== undefined && opts.mask >= 0 && opts.mask <= 7) {
    return { size, modules: applyMask(opts.mask), version, mask: opts.mask };
  }
  let best = { score: Infinity, mask: 0, modules: base };
  for (let mask = 0; mask < 8; mask++) {
    const m = applyMask(mask);
    const score = penalty(m);
    if (score < best.score) best = { score, mask, modules: m };
  }
  return { size, modules: best.modules, version, mask: best.mask };
}

/** Soda punkti maskas izvēlei (QR standarta 4 noteikumi, vienkāršoti 3. noteikumam). */
function penalty(m: boolean[][]): number {
  const n = m.length;
  let score = 0;
  const lines = (get: (a: number, b: number) => boolean) => {
    for (let a = 0; a < n; a++) {
      let run = 1;
      for (let b = 1; b <= n; b++) {
        if (b < n && get(a, b) === get(a, b - 1)) run++;
        else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
      for (let b = 0; b + 6 < n; b++) {
        const p = [1, 0, 1, 1, 1, 0, 1].every((v, k) => get(a, b + k) === Boolean(v));
        if (!p) continue;
        const lightBefore = b >= 4 && [1, 2, 3, 4].every((k) => !get(a, b - k));
        const lightAfter = b + 10 < n && [7, 8, 9, 10].every((k) => !get(a, b + k));
        if (lightBefore || lightAfter) score += 40;
      }
    }
  };
  lines((y, x) => m[y][x]);
  lines((x, y) => m[y][x]);
  for (let y = 0; y + 1 < n; y++) for (let x = 0; x + 1 < n; x++) {
    const c = m[y][x];
    if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3;
  }
  const dark = m.reduce((s, row) => s + row.filter(Boolean).length, 0);
  const k = Math.ceil(Math.abs(dark * 20 - n * n * 10) / (n * n)) - 1;
  score += Math.max(0, k) * 10;
  return score;
}

/** SVG `path` (viens modulis = 1 vienība) ar `border` kluso zonu. */
export function qrSvgPath(modules: boolean[][], border = 4): { d: string; viewBox: number } {
  const parts: string[] = [];
  modules.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) parts.push(`M${x + border},${y + border}h1v1h-1z`);
    }),
  );
  return { d: parts.join(""), viewBox: modules.length + border * 2 };
}
