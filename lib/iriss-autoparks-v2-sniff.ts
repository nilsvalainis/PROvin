/** Satura tips pēc pirmajiem baitiem (krātuve bieži dod application/octet-stream - pārlūks tad PDF neatver logā). */
export function sniffContentType(bytes: Uint8Array, fallback: string): string {
  const head = (n: number) => Array.from(bytes.subarray(0, n));
  if (bytes.length >= 4 && String.fromCharCode(...head(4)) === "%PDF") return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  return fallback && fallback !== "application/octet-stream" ? fallback : "application/octet-stream";
}
