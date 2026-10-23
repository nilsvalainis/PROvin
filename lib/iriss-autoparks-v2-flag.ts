/**
 * Autoparks v2 karogs. Administrators (Nils) v2 redz vienmēr; darbinieki - tikai, kad Nils Vercel iestata
 * `IRISS_AUTOPARKS_V2_STAFF=1` (pārslēgšana, F9). Līdz tam darbinieka `ap_*` tiesības neko neatver.
 */
export function autoparksV2StaffEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.IRISS_AUTOPARKS_V2_STAFF ?? "").trim() === "1";
}

/**
 * F9 pārslēgšana: kad karogs ieslēgts, esošā saite "Autoparks" (/admin/iriss/autoparks) ved uz v2 tiem, kam ir
 * v2 Pamatdatu tiesība. v1 paliek kā rezerve ar `?v1=1` (2 nedēļas); lietotāji bez v2 tiesībām paliek v1.
 */
export function shouldRedirectToAutoparksV2(input: { staffEnabled: boolean; canOpenV2List: boolean; v1Param: string | null | undefined }): boolean {
  return input.staffEnabled && input.canOpenV2List && input.v1Param !== "1";
}
