/**
 * Tālummaiņa pilnekrāna bilžu skatā (Lightbox): +/-, dubultklikšķis, pinch, pārvietošana.
 * Tīras funkcijas - komponente tikai glabā stāvokli.
 */

export const PHOTO_ZOOM_MIN = 1;
export const PHOTO_ZOOM_MAX = 4;
export const PHOTO_ZOOM_STEPS = [1, 1.5, 2, 3, 4] as const;

export type PhotoZoomState = { scale: number; x: number; y: number };

export const PHOTO_ZOOM_RESET: PhotoZoomState = { scale: 1, x: 0, y: 0 };

export function clampPhotoZoom(scale: number): number {
  if (!Number.isFinite(scale)) return PHOTO_ZOOM_MIN;
  return Math.min(PHOTO_ZOOM_MAX, Math.max(PHOTO_ZOOM_MIN, scale));
}

/** Nākamais solis ar "+" (dir 1) vai "-" (dir -1). */
export function stepPhotoZoom(scale: number, dir: 1 | -1): number {
  const steps = PHOTO_ZOOM_STEPS as readonly number[];
  if (dir > 0) return steps.find((s) => s > scale + 1e-6) ?? PHOTO_ZOOM_MAX;
  return [...steps].reverse().find((s) => s < scale - 1e-6) ?? PHOTO_ZOOM_MIN;
}

/** Dubultklikšķis / dubultpieskāriens: 1x <-> 2x. */
export function togglePhotoZoom(scale: number): number {
  return scale > 1.01 ? 1 : 2;
}

export function photoZoomPercent(scale: number): string {
  return `${Math.round(clampPhotoZoom(scale) * 100)}%`;
}

/** Pinch: jaunais mērogs no sākuma mēroga un pirkstu attāluma attiecības. */
export function pinchPhotoZoom(startScale: number, startDistance: number, distance: number): number {
  if (!(startDistance > 0) || !(distance > 0)) return clampPhotoZoom(startScale);
  return clampPhotoZoom(startScale * (distance / startDistance));
}

/**
 * Pārvietojumu ierobežo, lai attēls neaiziet ārpus skata.
 * box - redzamā laukuma izmērs; attēls aizpilda to pie scale 1.
 */
export function clampPhotoPan(
  state: PhotoZoomState,
  box: { width: number; height: number },
): PhotoZoomState {
  const scale = clampPhotoZoom(state.scale);
  if (scale <= 1) return PHOTO_ZOOM_RESET;
  const maxX = ((scale - 1) * box.width) / 2;
  const maxY = ((scale - 1) * box.height) / 2;
  return {
    scale,
    x: Math.min(maxX, Math.max(-maxX, state.x)),
    y: Math.min(maxY, Math.max(-maxY, state.y)),
  };
}

/**
 * Telefonā bilžu priekšskatījumā 1x mērogā horizontāls vilciens pāršķir bildi (-1 iepriekšējā,
 * 1 nākamā, 0 nekas). Pietuvinātā bildē vilciens paliek pārvietošana.
 */
export function photoSwipeStep(
  start: { x: number; y: number },
  end: { x: number; y: number },
  scale: number,
): -1 | 0 | 1 {
  if (scale > 1.01) return 0;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}
