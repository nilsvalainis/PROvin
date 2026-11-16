/** `rel` publiskām saitēm, kas ved uz apzināti noindex URL. Uzvedība paliek, Google tās neredz kā atklājamas. */

function withToken(rel: string | null | undefined, token: string): string {
  const parts = (rel ?? "").split(/\s+/).filter(Boolean);
  if (!parts.includes(token)) parts.push(token);
  return parts.join(" ");
}

/** `?plan=` priekšizvēlas hero paketi. Parametrs vajadzīgs, bet URL ir noindex. */
export function hrefSelectsPlan(href: string): boolean {
  const withoutHash = href.split("#")[0] ?? href;
  return /[?&]plan=/.test(withoutHash);
}

/** `/samples/*.pdf` atbild ar `X-Robots-Tag: noindex`. */
export function isNoindexSamplePdfHref(href: string): boolean {
  const path = (href.split(/[?#]/)[0] ?? href).toLowerCase();
  return path.startsWith("/samples/") && path.endsWith(".pdf");
}

/**
 * Pievieno `nofollow`, ja saite reklamē noindex URL.
 * Pārējām saitēm atgriež esošo `rel` (vai `undefined`, ja tā nav).
 */
export function publicAnchorRel(href: string, rel?: string | null): string | undefined {
  const base = rel?.trim() ? rel.trim() : undefined;
  if (!hrefSelectsPlan(href) && !isNoindexSamplePdfHref(href)) return base;
  return withToken(base, "nofollow");
}
