/**
 * Autoparks v2 karogs. Administrators (Nils) v2 redz vienmēr; darbinieki - tikai, kad Nils Vercel iestata
 * `IRISS_AUTOPARKS_V2_STAFF=1` (pārslēgšana, F9). Līdz tam darbinieka `ap_*` tiesības neko neatver.
 */
export function autoparksV2StaffEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.IRISS_AUTOPARKS_V2_STAFF ?? "").trim() === "1";
}
