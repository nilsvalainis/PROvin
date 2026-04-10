import "server-only";

/** Publiskā bāzes URL (saites e-pastos, bez slīpsvītras). */
export function getSiteOrigin(): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (u) return u;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

/** Sūtītājs — provin.lv domēns pēc Resend DNS verifikācijas. */
export function getResendFromAddress(): string {
  const v = process.env.RESEND_FROM_EMAIL?.trim();
  if (v) return v;
  return "PROVIN <reports@provin.lv>";
}

/** Atbildes adrese — klientu un admin vēstules. */
export function getResendReplyTo(): string {
  const r = process.env.RESEND_REPLY_TO?.trim();
  if (r) return r;
  const c = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  if (c) return c;
  return "info@provin.lv";
}
