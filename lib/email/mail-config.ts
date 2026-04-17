import "server-only";

/** Publiskā bāzes URL (saites e-pastos, bez slīpsvītras). */
export function getSiteOrigin(): string {
  const u = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (u) return u;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

/** From — Google SMTP parasti prasa sakrist ar autentificēto SMTP_USER (vai Workspace alias). */
export function getMailFromAddress(): string {
  const f = process.env.SMTP_FROM?.trim();
  if (f) return f;
  const user = process.env.SMTP_USER?.trim();
  if (user) return `PROVIN <${user}>`;
  return "PROVIN <info@provin.lv>";
}

/** Reply-To klientu atbildēm. */
export function getMailReplyTo(): string {
  const r = process.env.SMTP_REPLY_TO?.trim();
  if (r) return r;
  const c = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  if (c) return c;
  return "info@provin.lv";
}
