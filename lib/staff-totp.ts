import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SEC = 30;
const DIGITS = 6;

export function generateTotpSecret(): string {
  const bytes = randomBytes(20);
  return encodeBase32(bytes);
}

export function totpAuthUrl(opts: { secret: string; account: string; issuer?: string }): string {
  const issuer = opts.issuer ?? "IRISS";
  const label = encodeURIComponent(`${issuer}:${opts.account}`);
  const q = new URLSearchParams({
    secret: opts.secret.replace(/\s+/g, ""),
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SEC),
  });
  return `otpauth://totp/${label}?${q.toString()}`;
}

export function generateTotpCode(secret: string, atMs: number = Date.now()): string {
  const key = decodeBase32(secret);
  const counter = Math.floor(atMs / 1000 / STEP_SEC);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const bin =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  const code = bin % 10 ** DIGITS;
  return String(code).padStart(DIGITS, "0");
}

export function verifyTotpCode(secret: string, code: string, atMs: number = Date.now(), window = 1): boolean {
  const expected = normalizeTotpCode(code);
  if (!expected) return false;
  for (let i = -window; i <= window; i++) {
    const candidate = generateTotpCode(secret, atMs + i * STEP_SEC * 1000);
    if (safeEqualDigits(expected, candidate)) return true;
  }
  return false;
}

export function normalizeTotpCode(code: string): string | null {
  const digits = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(digits)) return null;
  return digits;
}

function safeEqualDigits(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

function decodeBase32(secret: string): Buffer {
  const clean = secret.replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) throw new Error("nederigs_totp_secret");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
