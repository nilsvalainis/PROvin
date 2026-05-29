import Link from "next/link";

/** Servera fallback, ja pasūtījuma lapu nevar ielādēt — rāda precīzu kļūdu (nevis generic client crash). */
export function AdminOrderDetailPageFallback({
  sessionId,
  phase,
  message,
  detail,
}: {
  sessionId: string;
  phase: string;
  message: string;
  detail?: string;
}) {
  return (
    <div className="admin-order-page mx-auto min-h-[50vh] max-w-2xl px-4 py-8">
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-950 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-red-800/90">
          Admin pasūtījums — servera kļūda
        </p>
        <h1 className="mt-2 text-base font-semibold">Neizdevās ielādēt pasūtījuma lapu</h1>
        <p className="mt-2 leading-relaxed text-red-900/95">{message}</p>
        <dl className="mt-4 space-y-2 text-[12px]">
          <div>
            <dt className="font-medium text-red-800/80">Session ID</dt>
            <dd className="mt-0.5 break-all font-mono text-[11px]">{sessionId || "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-red-800/80">Fāze</dt>
            <dd className="mt-0.5 font-mono text-[11px]">{phase}</dd>
          </div>
          {detail ? (
            <div>
              <dt className="font-medium text-red-800/80">Detaļa</dt>
              <dd className="mt-0.5 whitespace-pre-wrap break-words font-mono text-[10px] leading-snug text-red-900/85">
                {detail}
              </dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/admin/dashboard"
            className="inline-flex rounded-lg border border-red-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-900 hover:bg-red-100"
          >
            ← Atpakaļ uz sarakstu
          </Link>
          <a
            href={`/admin/orders/${encodeURIComponent(sessionId)}`}
            className="inline-flex rounded-lg border border-red-200 px-3 py-1.5 text-[11px] font-medium text-red-900 hover:bg-red-100/60"
          >
            Mēģināt vēlreiz
          </a>
        </div>
      </div>
    </div>
  );
}
