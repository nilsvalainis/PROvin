/**
 * AutoDNA pirkuma aizsargs PROVIN pusē (Nila likums 25.11.2026, KATEGORISKS):
 * AutoDNA atskaiti drīkst pirkt TIKAI, ja bezmaksas priekšpārbaude (https://www.autodna.lv/vin/<VIN>) rāda
 * «Auto arhīva fotogrāfijas» VAI «Transportlīdzekļa vēsture» ar >0 ierakstiem. Ja neviena - pirkums aizliegts.
 * Ja priekšpārbaudi nevar nolasīt (Turnstile, kļūda, nezināms formāts) - arī nepērk.
 *
 * Tīra loģika (bez tīkla), lieto arī admin panelis. Tas pats lēmums relejā: relay/provin-autodna/lib/dna-precheck.mjs.
 */
import {
  AUTODNA_KEY_SECTIONS,
  autodnaSectionCount,
  parseAutodnaPrecheckDetail,
  type AutodnaPrecheck,
  type AutodnaPrecheckPage,
} from "@/lib/vin-scan/autodna-precheck";

export type AutodnaPrecheckBlockCode = "precheck_no_records" | "precheck_unavailable";

export type AutodnaPrecheckGuard = {
  allowed: boolean;
  code?: AutodnaPrecheckBlockCode;
  /** «Auto arhīva fotogrāfijas» ierakstu skaits; null - nav zināms. */
  photos: number | null;
  /** «Transportlīdzekļa vēsture» ierakstu skaits; null - nav zināms. */
  history: number | null;
  /** Kad priekšpārbaude nolasīta (ISO). */
  checkedAt?: string;
  source?: "vin_scan" | "live" | "relay";
};

/** Cik vecu VIN SCAN priekšpārbaudi drīkst izmantot (tāds pats kā avota TTL). */
export const AUTODNA_PRECHECK_MAX_AGE_MS = 24 * 3600_000;

export const AUTODNA_PRECHECK_BLOCK_LV: Record<AutodnaPrecheckBlockCode, string> = {
  precheck_no_records: "Pirkt nedrīkst - AutoDNA nav foto un vēstures ierakstu",
  precheck_unavailable: "Priekšpārbaude nav pieejama",
};

const UNAVAILABLE: AutodnaPrecheckGuard = { allowed: false, code: "precheck_unavailable", photos: null, history: null };

export function autodnaPurchaseGuardFromData(data: AutodnaPrecheck | null | undefined): AutodnaPrecheckGuard {
  if (!data) return { ...UNAVAILABLE };
  const history = autodnaSectionCount(data, AUTODNA_KEY_SECTIONS[0]);
  const photos = autodnaSectionCount(data, AUTODNA_KEY_SECTIONS[1]);
  if (history == null && photos == null) return { allowed: false, code: "precheck_unavailable", photos, history };
  if ((history ?? 0) > 0 || (photos ?? 0) > 0) return { allowed: true, photos, history };
  return { allowed: false, code: "precheck_no_records", photos, history };
}

export function autodnaPurchaseGuardFromPage(page: AutodnaPrecheckPage | null | undefined): AutodnaPrecheckGuard {
  return page?.state === "ready" ? autodnaPurchaseGuardFromData(page.data) : { ...UNAVAILABLE };
}

/**
 * VIN SCAN rinda `autodna_precheck` -> aizsargs. null - rindas nav, tā nav nolasīta (pending / bloķēta / kļūda)
 * vai ir vecāka par `maxAgeMs`: tad jāielasa svaigi.
 */
export function autodnaPurchaseGuardFromIndicator(
  ind: { status?: string; detail?: string; scannedAt?: string } | null | undefined,
  opts: { fallbackAt?: string; nowMs?: number; maxAgeMs?: number } = {},
): AutodnaPrecheckGuard | null {
  if (!ind || (ind.status !== "found" && ind.status !== "none")) return null;
  const at = ind.scannedAt || opts.fallbackAt || "";
  const atMs = Date.parse(at);
  if (!Number.isFinite(atMs)) return null;
  if ((opts.nowMs ?? Date.now()) - atMs > (opts.maxAgeMs ?? AUTODNA_PRECHECK_MAX_AGE_MS)) return null;
  const data = parseAutodnaPrecheckDetail(ind.detail);
  if (!data) return null;
  return { ...autodnaPurchaseGuardFromData(data), checkedAt: new Date(atMs).toISOString(), source: "vin_scan" };
}

/** Releja `/precheck` atbilde vai notikuma `precheck` -> aizsargs (jebkas neskaidrs = nepērk). */
export function autodnaPurchaseGuardFromRelay(raw: unknown, checkedAt?: string): AutodnaPrecheckGuard {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);
  const photos = num(o.photos);
  const history = num(o.history);
  const base = { photos, history, ...(checkedAt ? { checkedAt } : {}), source: "relay" as const };
  if (o.allowed === true && ((photos ?? 0) > 0 || (history ?? 0) > 0)) return { allowed: true, ...base };
  const code: AutodnaPrecheckBlockCode = o.code === "precheck_no_records" && (photos != null || history != null) ? "precheck_no_records" : "precheck_unavailable";
  return { allowed: false, code, ...base };
}

/** «Arhīva foto: N · Vēstures ieraksti: N» (nezināms skaits -> «?»). */
export function autodnaPrecheckCountsLabel(g: Pick<AutodnaPrecheckGuard, "photos" | "history">): string {
  const n = (v: number | null) => (v == null ? "?" : String(v));
  return `Arhīva foto: ${n(g.photos)} · Vēstures ieraksti: ${n(g.history)}`;
}

/** Jaunākais no vairākiem VIN SCAN rezultātiem (pasūtījuma VIN SCAN, kopīgais momentuzņēmums). */
export function pickFreshestAutodnaGuard(list: (AutodnaPrecheckGuard | null | undefined)[]): AutodnaPrecheckGuard | null {
  let best: AutodnaPrecheckGuard | null = null;
  for (const g of list) {
    if (!g) continue;
    if (!best || (Date.parse(g.checkedAt ?? "") || 0) > (Date.parse(best.checkedAt ?? "") || 0)) best = g;
  }
  return best;
}
