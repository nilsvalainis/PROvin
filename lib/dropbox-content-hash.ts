import { createHash } from "node:crypto";

const BLOCK = 4 * 1024 * 1024;

/** Dropbox `content_hash`: SHA-256 no 4 MB bloku SHA-256 summām (sk. Dropbox "Content hash"). */
export function dropboxContentHash(bytes: Uint8Array): string {
  const outer = createHash("sha256");
  for (let i = 0; i < bytes.length; i += BLOCK) {
    outer.update(createHash("sha256").update(bytes.subarray(i, i + BLOCK)).digest());
  }
  return outer.digest("hex");
}
