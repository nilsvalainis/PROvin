/**
 * CheckCar.vin ūdenszīmes slēpšana pirms admin foto saglabāšanas.
 * Noklusējums: ieslēgts (kā līdz šim CC.VIN lasīšanā).
 */

export const HIDE_PHOTO_WATERMARKS_DEFAULT = true;

export function parseHidePhotoWatermarks(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return HIDE_PHOTO_WATERMARKS_DEFAULT;
  const v = (raw as { hidePhotoWatermarks?: unknown }).hidePhotoWatermarks;
  if (v === false || v === 0 || v === "0" || v === "false" || v === "off") return false;
  if (v === true || v === 1 || v === "1" || v === "true" || v === "on") return true;
  return HIDE_PHOTO_WATERMARKS_DEFAULT;
}

export function formRequestsWatermarkCover(form: FormData): boolean {
  const raw = String(form.get("hideWatermarks") ?? "").trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  if (raw === "1" || raw === "true" || raw === "on") return true;
  return HIDE_PHOTO_WATERMARKS_DEFAULT;
}

/** CC.VIN lasīšana (priekšskatījums / PDF) - slēdzis no saglabātā bloka. */
export function hidePhotoWatermarksFromCcVinWorkspace(workspace: unknown): boolean {
  if (!workspace || typeof workspace !== "object") return HIDE_PHOTO_WATERMARKS_DEFAULT;
  const blocks = (workspace as { sourceBlocks?: unknown }).sourceBlocks;
  if (!blocks || typeof blocks !== "object") return HIDE_PHOTO_WATERMARKS_DEFAULT;
  return parseHidePhotoWatermarks((blocks as { cc_vin?: unknown }).cc_vin);
}
