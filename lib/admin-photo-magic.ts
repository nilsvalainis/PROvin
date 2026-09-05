/** Attēla formāts pēc pirmajiem baitiem, ne pēc paplašinājuma vai MIME. */

export type SniffedImageKind = "jpeg" | "png" | "gif" | "webp" | "bmp" | "avif" | "heic" | "tiff";

export const SNIFFED_IMAGE_MIME: Record<SniffedImageKind, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  avif: "image/avif",
  heic: "image/heic",
  tiff: "image/tiff",
};

export const SNIFFED_IMAGE_EXT: Record<SniffedImageKind, string> = {
  jpeg: "jpg",
  png: "png",
  gif: "gif",
  webp: "webp",
  bmp: "bmp",
  avif: "avif",
  heic: "heic",
  tiff: "tiff",
};

const HEIC_BRANDS = new Set(["heic", "heix", "heif", "hevc", "heim", "heis", "mif1", "msf1"]);

function ascii(bytes: Uint8Array, start: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += String.fromCharCode(bytes[start + i] ?? 0);
  return s;
}

export function sniffImageKind(bytes: Uint8Array): SniffedImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "png";
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "gif";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "webp";
  if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) return "bmp";
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4).toLowerCase();
    if (brand === "avif" || brand === "avis") return "avif";
    if (HEIC_BRANDS.has(brand)) return "heic";
  }
  if (
    bytes.length >= 4 &&
    ((bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
      (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a))
  ) {
    return "tiff";
  }
  return null;
}

export function isHeicMagicBytes(bytes: Uint8Array): boolean {
  return sniffImageKind(bytes) === "heic";
}
