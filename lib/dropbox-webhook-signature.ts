import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyDropboxWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  const secret = appSecret.trim();
  if (!secret || !signatureHeader?.trim()) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  try {
    const a = Buffer.from(signatureHeader.trim(), "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
