/**
 * CheckCar.vin ūdenszīmes slēpšana pirms admin foto saglabāšanas.
 * CC.VIN: noklusējums ieslēgts. Pārējās sadaļas: noklusējums izslēgts.
 */

export const HIDE_PHOTO_WATERMARKS_DEFAULT = false;
export const HIDE_CC_VIN_PHOTO_WATERMARKS_DEFAULT = true;

function parseHidePhotoWatermarksFlag(raw: unknown, fallback: boolean): boolean {
  if (!raw || typeof raw !== "object") return fallback;
  const v = (raw as { hidePhotoWatermarks?: unknown }).hidePhotoWatermarks;
  if (v === false || v === 0 || v === "0" || v === "false" || v === "off") return false;
  if (v === true || v === 1 || v === "1" || v === "true" || v === "on") return true;
  return fallback;
}

export function parseHidePhotoWatermarks(raw: unknown): boolean {
  return parseHidePhotoWatermarksFlag(raw, HIDE_PHOTO_WATERMARKS_DEFAULT);
}

export function parseCcVinHidePhotoWatermarks(raw: unknown): boolean {
  return parseHidePhotoWatermarksFlag(raw, HIDE_CC_VIN_PHOTO_WATERMARKS_DEFAULT);
}

export function formRequestsWatermarkCover(form: FormData): boolean {
  const raw = String(form.get("hideWatermarks") ?? "").trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "off") return false;
  if (raw === "1" || raw === "true" || raw === "on") return true;
  return HIDE_PHOTO_WATERMARKS_DEFAULT;
}

/** CC.VIN lasīšana (priekšskatījums / PDF) - slēdzis no saglabātā bloka. */
export function hidePhotoWatermarksFromCcVinWorkspace(workspace: unknown): boolean {
  if (!workspace || typeof workspace !== "object") return HIDE_CC_VIN_PHOTO_WATERMARKS_DEFAULT;
  const blocks = (workspace as { sourceBlocks?: unknown }).sourceBlocks;
  if (!blocks || typeof blocks !== "object") return HIDE_CC_VIN_PHOTO_WATERMARKS_DEFAULT;
  return parseCcVinHidePhotoWatermarks((blocks as { cc_vin?: unknown }).cc_vin);
}
