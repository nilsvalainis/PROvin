// Tīra VPN lease loģika (bez IO), lai to var testēt (lib/iriss-ttr-control.test.ts).
// Hold režīms (Nils 23.10, noklusējums): VPN tur pastāvīgi, lai sistēma vienmēr redz CSDD stāvokli. Atlaiž TIKAI, ja
// Nils atslēdz ar roku ("Man vajag VPN", vpnoff.sh, /stop) vai izmet serveri (pieslēdzas pats). Tad serveris pats
// NEPIESLĒDZAS (nekādas cilpas) - nākamais pavadzīmes pieprasījums pieslēdz un tur atkal.
// IRISS_VPN_HOLD=0: vecais režīms (lease = līdz kuram brīdim tur; katrs darbs pagarina; pēc tam idle autostop).

export const VPN_IDLE_MIN_DEFAULT = 20;
export const VPN_IDLE_MIN_MIN = 15;
export const VPN_IDLE_MIN_MAX = 30;

/** IRISS_VPN_HOLD: noklusējumā ieslēgts; "0" / "false" - vecais idle režīms. */
export function vpnHoldMode(raw) {
  const v = String(raw ?? "").trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "no");
}

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
 * - hold režīmā: nekas cits (VPN tur, kamēr Nils to neatslēdz/neizmet serveri);
 * - vecajā režīmā: VPN ieslēgts, bet lease beidzies -> idle stop;
 * - citādi nekas.
 */
export function decideVpnAction({ vpnUp, leaseUntilMs, nowMs, stopRequestedAt, handledStopAt, hold = false }) {
  const req = Date.parse(stopRequestedAt || "");
  const handled = Date.parse(handledStopAt || "");
  if (Number.isFinite(req) && (!Number.isFinite(handled) || req > handled)) {
    return { action: "stop", reason: "manual", handledStopAt: new Date(req).toISOString() };
  }
  if (hold) return { action: "none", reason: "", handledStopAt: handledStopAt || "" };
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

export function canStartVpn({ nowMs, lastManualStopMs, purpose = "", hold = false }) {
  // Hold režīmā pavadzīmes pieprasījums pieslēdz uzreiz (Nils 23.10: "nākamais pieprasījums pieslēdz un tur atkal").
  // Citi (piem. nakts reģistra keep-alive) pēc atslēgšanas/izmešanas gaida 30 min - lai nekad necīnītos ar Nilu.
  if (hold && purpose === "waybill") return true;
  if (!Number.isFinite(lastManualStopMs)) return true;
  return nowMs - lastManualStopMs >= BLOCK_AFTER_MANUAL_MIN * 60_000;
}

/**
 * VPN nokrita ne mūsu dēļ: kā to saukt žurnālā/UI. systemd Result "success" = kāds to apturēja (vpnoff.sh, Aivara
 * run.sh autostop, Nils ar roku); cits = openconnect izgāja ar kļūdu (visticamāk Nils pieslēdzās un izmeta serveri).
 * Abos gadījumos serveris pats NEPIESLĒDZAS.
 */
export function externalDropReason(systemdResult) {
  return String(systemdResult || "").trim() === "success" ? "external" : "kicked";
}

/** Pēc darba (POST /release) VPN tur vēl tik ilgi, lai nākamais darbs rindā to atkal neieslēgtu no nulles. */
export const RELEASE_GRACE_MS = 60_000;

/**
 * Darbs beidzies: lease saīsina līdz now + RELEASE_GRACE_MS (nekad nepagarina). Pēc tam tick to atslēdz kā "idle".
 * Ja lease nav (NaN), paliek NaN - ieslēgtu VPN bez lease tick atslēdz uzreiz.
 */
export function releaseLease(currentUntilMs, nowMs, hold = false) {
  // Hold režīmā darba beigas VPN neatlaiž (tur pastāvīgi).
  if (hold) return currentUntilMs;
  if (!Number.isFinite(currentUntilMs)) return NaN;
  return Math.min(currentUntilMs, nowMs + RELEASE_GRACE_MS);
}
