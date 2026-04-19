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
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
          IRISS
        </p>
        <h1 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          PASŪTĪJUMI
        </h1>
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

      {storeEnabled && storage.persistence === "vercel_blob" ? (
        <div className="mt-4 rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-3 py-2 text-[11px] leading-relaxed text-emerald-950/90">
          <span className="font-semibold text-[var(--color-apple-text)]">Vercel Blob:</span> pasūtījumu JSON ir
          privāti Blob krātuvē; dati saglabājas arī pēc servera instance nomaiņas.
        </div>
      ) : null}

      {storeEnabled && process.env.VERCEL && storage.persistence === "filesystem" ? (
        <div className="mt-4 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-[11px] leading-relaxed text-amber-950/90">
          <span className="font-semibold text-[var(--color-apple-text)]">Vercel + disks:</span> ceļš{" "}
          <code className="rounded bg-white px-1 font-mono text-[10px]">ADMIN_IRISS_PASUTIJUMI_DIR</code> parasti ir
          pagaidu servera failsistēma — pārliecinieties, ka tas ir montēts pastāvīgs disks, vai pārslēdzieties uz Blob (
          <span className="font-mono">BLOB_READ_WRITE_TOKEN</span> bez šī mainīgā).
        </div>
      ) : null}

      {storeEnabled && rows.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200/90 bg-white px-6 py-12 text-center shadow-sm">
          <p className="font-medium text-[var(--color-apple-text)]">Nav pasūtījumu</p>
          <p className="mt-2 text-sm text-[var(--color-provin-muted)]">Spied „+”, lai izveidotu pirmo ierakstu.</p>
        </div>
      ) : null}

      {storeEnabled && rows.length > 0 ? (
        <ul className="mt-5 space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="touch-manipulation rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm active:bg-slate-50/80 sm:p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate text-[15px] font-semibold leading-snug text-[var(--color-apple-text)]">
                    {r.brandModel}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[var(--color-provin-muted)]">
                    <span>
                      <span className="font-medium text-[var(--color-apple-text)]">Budžets:</span> {r.totalBudget}
                    </span>
                    <span>
                      <span className="font-medium text-[var(--color-apple-text)]">Tālrunis:</span> {r.phone}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 sm:pl-3">
                  <Link
                    href={`/admin/iriss/pasutijumi/${encodeURIComponent(r.id)}`}
                    className="inline-flex min-h-[44px] min-w-[7.5rem] items-center justify-center rounded-full bg-[var(--color-provin-accent)] px-5 text-[14px] font-semibold text-white shadow-sm transition hover:opacity-95"
                  >
                    Atvērt
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {storeEnabled ? <IrissPasutijumiNewFab /> : null}
    </div>
  );
}
