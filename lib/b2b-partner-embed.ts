/**
 * PROVIN Business poga partnera vietnē: iestatījumi, ko PRO adminā uztur katram partnerim.
 * Poga strādā tikai, ja `enabled` un klikšķis nāk no kāda no `domains`.
 */

export type B2bPartnerEmbedTone = "light" | "dark";

export type B2bPartnerEmbedSettings = {
  enabled: boolean;
  /** Atļautie domēni bez protokola un `www.`, piem. `percunbrauc.lv`. Apakšdomēni arī der. */
  domains: string[];
  /** Nosaukums galamērķa lapā, ja logo nav. */
  displayName: string;
  /** Logo tumšam fonam (parasti balts teksts). https URL. */
  logoOnDarkUrl: string;
  /** Logo gaišam fonam (parasti tumšs teksts). https URL. */
  logoOnLightUrl: string;
  /** Pogas tonis partnera vietnē. */
  buttonTone: B2bPartnerEmbedTone;
};

export const B2B_EMBED_MAX_DOMAINS = 5;

export function emptyB2bPartnerEmbed(): B2bPartnerEmbedSettings {
  return { enabled: false, domains: [], displayName: "", logoOnDarkUrl: "", logoOnLightUrl: "", buttonTone: "light" };
}

const HOST_RE = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** `https://www.Percunbrauc.lv/cars/` -> `percunbrauc.lv`; nederīgs -> "". */
export function normalizeEmbedDomain(raw: string): string {
  let s = raw.trim().toLowerCase();
  if (!s) return "";
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  s = s.split(/[/?#]/)[0] ?? "";
  s = s.replace(/:\d+$/, "").replace(/\.$/, "");
  if (s.startsWith("www.")) s = s.slice(4);
  return HOST_RE.test(s) ? s : "";
}

export function parseEmbedDomains(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(/[\s,;]+/) : [];
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const d = normalizeEmbedDomain(item);
    if (d && !out.includes(d)) out.push(d);
    if (out.length >= B2B_EMBED_MAX_DOMAINS) break;
  }
  return out;
}

/** Tikai https, bez lietotāja/paroles, līdz 500 zīmēm. */
export function normalizeEmbedLogoUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = raw.trim();
  if (!s || s.length > 500) return "";
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" || u.username || u.password) return "";
    return u.toString();
  } catch {
    return "";
  }
}

export function parseB2bPartnerEmbed(raw: unknown): B2bPartnerEmbedSettings {
  if (!raw || typeof raw !== "object") return emptyB2bPartnerEmbed();
  const o = raw as Record<string, unknown>;
  const domains = parseEmbedDomains(o.domains);
  return {
    enabled: o.enabled === true && domains.length > 0,
    domains,
    displayName: typeof o.displayName === "string" ? o.displayName.trim().slice(0, 80) : "",
    logoOnDarkUrl: normalizeEmbedLogoUrl(o.logoOnDarkUrl),
    logoOnLightUrl: normalizeEmbedLogoUrl(o.logoOnLightUrl),
    buttonTone: o.buttonTone === "dark" ? "dark" : "light",
  };
}

export type B2bPartnerEmbedInputError = "domains" | "logoOnDarkUrl" | "logoOnLightUrl";

/** Admina ievade: nederīgu domēnu vai logo saiti neklusējam, bet atgriežam kļūdu. */
export function validateB2bPartnerEmbedInput(
  raw: Record<string, unknown>,
): { ok: true; embed: B2bPartnerEmbedSettings } | { ok: false; error: B2bPartnerEmbedInputError } {
  const domainItems = (Array.isArray(raw.domains) ? raw.domains : typeof raw.domains === "string" ? raw.domains.split(/[\s,;]+/) : [])
    .filter((d): d is string => typeof d === "string" && d.trim() !== "");
  if (domainItems.some((d) => !normalizeEmbedDomain(d)) || domainItems.length > B2B_EMBED_MAX_DOMAINS) {
    return { ok: false, error: "domains" };
  }
  for (const key of ["logoOnDarkUrl", "logoOnLightUrl"] as const) {
    const v = raw[key];
    if (typeof v === "string" && v.trim() && !normalizeEmbedLogoUrl(v)) return { ok: false, error: key };
  }
  const embed = parseB2bPartnerEmbed(raw);
  if (raw.enabled === true && embed.domains.length === 0) return { ok: false, error: "domains" };
  return { ok: true, embed };
}

/** Vai saimnieks (no Referer/Origin) atbilst kādam partnera domēnam (ieskaitot apakšdomēnus). */
export function isEmbedHostAllowed(host: string, domains: readonly string[]): boolean {
  const h = normalizeEmbedDomain(host);
  if (!h) return false;
  return domains.some((d) => h === d || h.endsWith(`.${d}`));
}

/** Saimnieks no pilna URL (Referer). */
export function embedHostFromUrl(raw: string | null | undefined): string {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    return normalizeEmbedDomain(u.hostname);
  } catch {
    return "";
  }
}
