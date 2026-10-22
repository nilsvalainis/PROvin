// Tīra VPN lease loģika (bez IO), lai to var testēt (lib/iriss-ttr-scripts.test.ts).
// Lease = līdz kuram brīdim serveris tur VPN. Katrs darbs pagarina; pēc tam idle autostop.

export const VPN_IDLE_MIN_DEFAULT = 20;
export const VPN_IDLE_MIN_MIN = 15;
export const VPN_IDLE_MIN_MAX = 30;

/** IRISS_VPN_IDLE_MIN -> minūtes 15-30 (noklusējums 20). */
export function vpnIdleMinutes(raw) {
  const n = Number.parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(n)) return VPN_IDLE_MIN_DEFAULT;
  return Math.min(VPN_IDLE_MIN_MAX, Math.max(VPN_IDLE_MIN_MIN, n));
}

/** Jauns darbs pagarina lease līdz now + idle (nekad nesaīsina). */
export function extendLease(currentUntilMs, nowMs, idleMin) {
  const next = nowMs + idleMin * 60_000;
  return Number.isFinite(currentUntilMs) && currentUntilMs > next ? currentUntilMs : next;
}

/**
 * Ko darīt šajā tick:
 * - admin "Man vajag VPN" (jauns stopRequestedAt) -> stop uzreiz, lease nodzēsts;
 * - VPN ieslēgts, bet lease beidzies -> idle stop;
 * - citādi nekas.
 */
export function decideVpnAction({ vpnUp, leaseUntilMs, nowMs, stopRequestedAt, handledStopAt }) {
  const req = Date.parse(stopRequestedAt || "");
  const handled = Date.parse(handledStopAt || "");
  if (Number.isFinite(req) && (!Number.isFinite(handled) || req > handled)) {
    return { action: "stop", reason: "manual", handledStopAt: new Date(req).toISOString() };
  }
  if (vpnUp && (!Number.isFinite(leaseUntilMs) || nowMs >= leaseUntilMs)) {
    return { action: "stop", reason: "idle", handledStopAt: handledStopAt || "" };
  }
  return { action: "none", reason: "", handledStopAt: handledStopAt || "" };
}

/**
 * Vai drīkst ieslēgt VPN darbam. Pēc manuāla stop (Nils lieto VPN) serveris to neieslēdz
 * BLOCK_AFTER_MANUAL_MIN minūtes, lai neizmestu Nilu.
 */
export const BLOCK_AFTER_MANUAL_MIN = 30;

export function canStartVpn({ nowMs, lastManualStopMs }) {
  if (!Number.isFinite(lastManualStopMs)) return true;
  return nowMs - lastManualStopMs >= BLOCK_AFTER_MANUAL_MIN * 60_000;
}
