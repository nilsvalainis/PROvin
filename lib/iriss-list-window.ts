/** Pirmā pasūtījumu saraksta porcija. Kartīšu izskats nemainās, DOM aug ritinot. */
export const IRISS_ORDERS_LIST_PAGE = 24;

/** LIST mobilajā: pirmā un nākamās porcijas. */
export const IRISS_LISTINGS_MOBILE_PAGE = 16;

export function irissWindowSlice<T>(items: readonly T[], limit: number, enabled: boolean): { items: T[]; hasMore: boolean } {
  if (!enabled) return { items: [...items], hasMore: false };
  const cap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  const end = Math.min(items.length, cap);
  return { items: items.slice(0, end), hasMore: end < items.length };
}

export function irissNextWindowLimit(current: number, total: number, page: number): number {
  const step = Math.max(1, Math.floor(page));
  const next = Math.max(step, current) + step;
  return Math.min(total, next);
}
