import Link from "next/link";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { IrissPasutijumiNewFab } from "@/components/admin/IrissPasutijumiNewFab";
import { getIrissPasutijumiStorageState, listIrissPasutijumi } from "@/lib/iriss-pasutijumi-store";

export const dynamic = "force-dynamic";

export default async function IrissPasutijumiListPage() {
  const storage = getIrissPasutijumiStorageState();
  const storeEnabled = storage.enabled;
  const rows = storeEnabled ? await listIrissPasutijumi() : [];

  return (
    <div className="relative w-full max-w-none pb-24 sm:pb-8">
      <AdminDashboardHeaderWithMenu>
        <div className="flex flex-row flex-wrap items-baseline gap-x-2 gap-y-0 sm:flex-col sm:gap-0">
          <p className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
            IRISS
          </p>
          <h1 className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-apple-text)] sm:mt-1 sm:text-[1.35rem] sm:leading-tight sm:tracking-tight md:text-[1.5rem]">
            Pasūtījumi
          </h1>
        </div>
      </AdminDashboardHeaderWithMenu>

      {!storeEnabled ? (
        <div className="mt-6 rounded-2xl border border-amber-200/90 bg-amber-50/95 px-4 py-3.5 text-sm text-amber-950 shadow-sm">
          <p className="font-semibold">Melnraksts ir izslēgts</p>
          {storage.reason === "vercel_blob_token_missing" ? (
            <p className="mt-1.5 text-amber-900/90">
              Vercel vidē JSON tiek glabāti <span className="font-semibold">Vercel Blob</span>. Pievienojiet projektam
              mainīgo{" "}
              <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs">BLOB_READ_WRITE_TOKEN</code>{" "}
              (Storage → Blob → savienot ar projektu) vai norādiet rakstāmu ceļu ar{" "}
              <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs">ADMIN_IRISS_PASUTIJUMI_DIR</code>.
            </p>
          ) : (
            <p className="mt-1.5 text-amber-900/90">
              Iestatiet mapes ceļu vai noņemiet atspējošanu:{" "}
              <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs">ADMIN_IRISS_PASUTIJUMI_DIR</code>{" "}
              (lokāli noklusējums: <span className="font-mono">.data/iriss-pasutijumi</span> projekta saknē).
            </p>
          )}
        </div>
      ) : null}

      {storeEnabled && rows.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200/90 bg-white px-6 py-12 text-center shadow-sm">
          <p className="font-medium text-[var(--color-apple-text)]">Nav pasūtījumu</p>
          <p className="mt-2 text-sm text-[var(--color-provin-muted)]">Spied „+”, lai izveidotu pirmo ierakstu.</p>
        </div>
      ) : null}

      {storeEnabled && rows.length > 0 ? (
        <ul className="mt-5 space-y-2.5 sm:space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/iriss/pasutijumi/${encodeURIComponent(r.id)}`}
                aria-label={`Atvērt pasūtījumu: ${r.brandModel}`}
                className="flex flex-row items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-sm outline-none ring-[var(--color-provin-accent)]/30 transition hover:border-slate-300/90 hover:bg-slate-50/50 active:bg-slate-100/60 focus-visible:ring-2 sm:gap-3 sm:p-4"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-[14px] font-semibold leading-snug text-[var(--color-apple-text)] sm:text-[15px]">
                    {r.brandModel}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-[var(--color-provin-muted)] sm:text-[13px]">
                    <span>
                      <span className="font-medium text-[var(--color-apple-text)]">Budžets:</span> {r.totalBudget}
                    </span>
                    <span>
                      <span className="font-medium text-[var(--color-apple-text)]">Tālrunis:</span> {r.phone}
                    </span>
                  </div>
                </div>
                <span className="shrink-0 self-center rounded-full bg-[var(--color-provin-accent)] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm sm:px-3 sm:py-1.5 sm:text-[12px]">
                  Atvērt
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {storeEnabled ? <IrissPasutijumiNewFab /> : null}
    </div>
  );
}
