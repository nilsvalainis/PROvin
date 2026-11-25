import "server-only";

import { readOrderDraft } from "@/lib/admin-order-draft-store";
import {
  autodnaPurchaseGuardFromIndicator,
  autodnaPurchaseGuardFromRelay,
  pickFreshestAutodnaGuard,
  type AutodnaPrecheckGuard,
} from "@/lib/autodna-purchase-guard";
import { normalizeVin } from "@/lib/order-field-validation";
import { parseOrderVinScanRecord } from "@/lib/order-vin-scan";
import { probeAutodnaPrecheck } from "@/lib/vin-scan/probe-autodna-precheck";
import { emptyVinScanPlates } from "@/lib/vin-scan/plates";
import { readVinScanSnapshot } from "@/lib/vin-scan/store";

/**
 * AutoDNA priekšpārbaude pirms pirkuma (PROVIN otrais līmenis; Nila likums 25.11). Kārtība:
 *   1) svaiga (<= 24 h) VIN SCAN / Ātrās pārbaudes rinda `autodna_precheck` (pasūtījuma VIN SCAN vai kopīgais momentuzņēmums);
 *   2) ja tādas nav - svaiga ielase no AutoDNA publiskās lapas (tā pati kā VIN SCAN);
 *   3) ja arī tā nav nolasāma - relejam `POST /precheck` (ielogotais pārlūks);
 *   4) citādi `precheck_unavailable` - nepērk (nekad «uz labu laimi»).
 */
export type AutodnaPrecheckResolveOpts = {
  sessionId?: string;
  vin: string;
  /** false - tikai saglabātie VIN SCAN rezultāti (admin paneļa atkārtotai ielādei). */
  live?: boolean;
  /** Releja priekšpārbaude (ja relejs pieslēgts). */
  askRelay?: (vin: string) => Promise<unknown>;
  nowMs?: number;
};

async function cachedGuard(sessionId: string | undefined, vin: string, nowMs: number): Promise<AutodnaPrecheckGuard | null> {
  const fromOrder = async () => {
    if (!sessionId) return null;
    const draft = await readOrderDraft(sessionId).catch(() => null);
    const rec = parseOrderVinScanRecord(draft?.vinScan);
    if (!rec || normalizeVin(rec.vin) !== vin) return null;
    return autodnaPurchaseGuardFromIndicator(
      rec.indicators.find((i) => i.id === "autodna_precheck"),
      { fallbackAt: rec.at, nowMs },
    );
  };
  const fromSnapshot = async () => {
    const snap = await readVinScanSnapshot(vin).catch(() => null);
    if (!snap || normalizeVin(snap.vin) !== vin) return null;
    return autodnaPurchaseGuardFromIndicator(
      snap.indicators.find((i) => i.id === "autodna_precheck"),
      { fallbackAt: snap.scannedAt, nowMs },
    );
  };
  const [a, b] = await Promise.all([fromOrder(), fromSnapshot()]);
  return pickFreshestAutodnaGuard([a, b]);
}

export async function resolveAutodnaPurchaseGuard(opts: AutodnaPrecheckResolveOpts): Promise<AutodnaPrecheckGuard> {
  const vin = normalizeVin(opts.vin);
  const nowMs = opts.nowMs ?? Date.now();
  const cached = await cachedGuard(opts.sessionId, vin, nowMs);
  if (cached) return cached;
  const unavailable: AutodnaPrecheckGuard = { allowed: false, code: "precheck_unavailable", photos: null, history: null };
  if (opts.live === false) return unavailable;

  const at = new Date(nowMs).toISOString();
  try {
    const ind = await probeAutodnaPrecheck({ vin, plates: emptyVinScanPlates(), listingUrl: "" });
    const live = autodnaPurchaseGuardFromIndicator({ ...ind, scannedAt: at }, { nowMs });
    if (live) return { ...live, source: "live" };
  } catch {
    /* nākamais solis */
  }
  if (opts.askRelay) {
    try {
      const raw = await opts.askRelay(vin);
      const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
      if (o.status === "ok") return autodnaPurchaseGuardFromRelay(o, at);
    } catch {
      /* relejs nav sasniedzams */
    }
  }
  return unavailable;
}
