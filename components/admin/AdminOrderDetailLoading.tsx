/** Kamēr pasūtījuma detaļu UI ielādējas tikai klientā (ssr: false). */
export function AdminOrderDetailLoading() {
  return (
    <div className="admin-order-page mx-auto min-h-[40vh] max-w-[min(76.8rem,calc(100vw-1.25rem))] px-3 py-8 sm:px-5">
      <p className="text-sm text-[var(--color-provin-muted)]" role="status">
        Ielādē pasūtījuma darba zonu…
      </p>
      <div className="mt-4 h-2 max-w-xs animate-pulse rounded-full bg-slate-200/90" aria-hidden />
    </div>
  );
}
