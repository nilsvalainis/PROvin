export type CinematicHomeFrame = {
  silver01: number;
  docProgress: number;
  scrollY: number;
};

/**
 * Scroll → „silver wash” pēc Hero (aptuveni viena viewport).
 */
export function computeHomeCinematicFrame(
  scrollY: number,
  vh: number,
  docScrollHeight: number,
): CinematicHomeFrame {
  const maxScroll = Math.max(1, docScrollHeight - vh);
  const docProgress = Math.min(1, Math.max(0, scrollY / maxScroll));
  const silverStart = vh * 0.55;
  const silverEnd = vh * 1.2;
  const silver01 = Math.min(1, Math.max(0, (scrollY - silverStart) / Math.max(1, silverEnd - silverStart)));
  return { silver01, docProgress, scrollY };
}
