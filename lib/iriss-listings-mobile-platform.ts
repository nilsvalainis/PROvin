export type IrissMobilePlatform = "ios" | "android";

/** iPhone/iPad/iPod, vai iPadOS (Macintosh + maxTouchPoints>1) → ios; Android → android. */
export function detectMobilePlatform(userAgent: string, maxTouchPoints = 0): IrissMobilePlatform | null {
  const ua = userAgent ?? "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(ua)) return "android";
  return null;
}
