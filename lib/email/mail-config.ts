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
  if (user) return `PROVIN.LV <${user}>`;
  return "PROVIN.LV <info@provin.lv>";
}

/** B2B sūtītājs: vārds PROVIN (bez .LV), tā pati SMTP adrese (vai SMTP_FROM_B2B). */
export function getB2bMailFromAddress(): string {
  const dedicated = process.env.SMTP_FROM_B2B?.trim();
  if (dedicated) return dedicated.replace(/^IRISS(\s|<)/, "PROVIN$1");
  const user = process.env.SMTP_USER?.trim();
  if (user) return `PROVIN <${user}>`;
  const from = getMailFromAddress();
  const addr = from.match(/<([^>]+)>/)?.[1] ?? from;
  return `PROVIN <${addr}>`;
}

/** Reply-To klientu atbildēm. */
export function getMailReplyTo(): string {
  const r = process.env.SMTP_REPLY_TO?.trim();
  if (r) return r;
  const c = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  if (c) return c;
  return "info@provin.lv";
}
