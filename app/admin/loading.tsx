import "./admin-route-loading.css";

/**
 * Admin lapas serverī ielādējas līdz vairākām sekundēm. Bez ielādes stāvokļa ekrāns pēc pieskāriena
 * "stāv", lietotājs spiež vēlreiz, un otrā navigācija pārraksta pirmo. Šis parādās uzreiz.
 */
export default function AdminLoading() {
  return (
    <div className="px-4 pt-[calc(env(safe-area-inset-top,0px)+14px)] md:px-4 md:pt-3" role="status" aria-live="polite">
      <span className="sr-only">Ielādē…</span>
      <div className="admin-route-loading-bar" aria-hidden />
      <div className="h-7 w-44 animate-pulse rounded-[8px] bg-black/[0.06]" aria-hidden />
      <div className="mt-4 h-10 animate-pulse rounded-[12px] bg-black/[0.05]" aria-hidden />
      <div className="mt-3 space-y-2" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-[14px] bg-black/[0.045]" />
        ))}
      </div>
    </div>
  );
}
