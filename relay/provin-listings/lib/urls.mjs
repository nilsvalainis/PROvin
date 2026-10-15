import { createHash } from "node:crypto";

/** Tas pats meklējums: bez iriss_ / start / hash, parametru secība sakārtota. */
export function listingsFetchUrl(raw) {
  try {
    const u = new URL(raw);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
    const pairs = [...u.searchParams.entries()]
      .filter(([k]) => !k.startsWith("iriss_") && k !== "start" && k !== "perpage" && k !== "page")
      .sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
    u.search = "";
    for (const [k, v] of pairs) u.searchParams.append(k, v);
    return u.toString();
  } catch {
    return String(raw ?? "").trim();
  }
}

export function listingsFetchKey(platform, sourceUrl) {
  return `${platform}|${listingsFetchUrl(sourceUrl)}`;
}

/** Pilns URL + īsais hash (ne nogriezts līdz 100). */
export function listingsUrlLog(raw) {
  const url = String(raw ?? "");
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 10);
  return `${url} #${hash}`;
}
