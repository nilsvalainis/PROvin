import Link from "next/link";
import { redirect } from "next/navigation";
import { IrissScanListClient } from "@/components/admin/IrissScanListClient";
import { loadIrissScanPageData } from "@/lib/iriss-scan-page-data";
import { getIrissScanStorageState } from "@/lib/iriss-scan-store";
import { irissScanVinFromQuery } from "@/lib/iriss-scan-vin";
import { requireIrissSectionPage } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export default async function IrissScanListPage({
  searchParams,
}: {
  searchParams?: Promise<{ vin?: string }>;
}) {
  await requireIrissSectionPage("radars");
  const sp = (await searchParams) ?? {};
  const vin = irissScanVinFromQuery(sp.vin);
  if (vin) {
    redirect(`/admin/iriss/scan/new?vin=${encodeURIComponent(vin)}`);
  }
  const storage = getIrissScanStorageState();
  const storeEnabled = storage.enabled;
  const data = storeEnabled
    ? await loadIrissScanPageData()
    : { rows: [], initialListOrder: null, newHitsByScan: {}, finds: [] };

  return (
    <div className="relative min-h-full w-full max-w-none pb-24 sm:pb-8">
      {storeEnabled ? (
        <IrissScanListClient
          rows={data.rows}
          initialListOrder={data.initialListOrder}
          newHitsByScan={data.newHitsByScan}
          finds={data.finds}
          mode="list"
        />
      ) : null}
      {storeEnabled && data.rows.length === 0 ? (
        <div className="mx-auto mt-10 max-w-sm px-6 text-center">
          <p className="text-[17px] font-semibold text-[var(--ink)]">Nav radara ierakstu</p>
          <p className="mt-1 text-[13px] text-[var(--ink3)]">Spied „+” vai Jauns ieraksts, lai izveidotu pirmo ierakstu.</p>
          <Link
            href="/admin/iriss/scan/new"
            className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-[var(--chip-active-bg)] px-4 text-[14px] font-semibold text-[var(--chip-active-fg)]"
          >
            Jauns ieraksts
          </Link>
        </div>
      ) : null}
      {!storeEnabled ? (
        <div className="mt-3 rounded-2xl border border-[var(--hair)] bg-[var(--s1)] px-4 py-3.5 text-sm text-[var(--ink)] shadow-[var(--sh)]">
          <p className="font-semibold">Radara melnraksts ir izslēgts</p>
          {storage.reason === "vercel_blob_token_missing" ? (
            <p className="mt-1.5 text-[var(--warn)]">
              Vercel vidē JSON tiek glabāti <span className="font-semibold">Vercel Blob</span>. Pievienojiet projektam mainīgo{" "}
              <code className="rounded bg-[var(--fill)] px-1.5 py-0.5 font-mono text-xs">BLOB_READ_WRITE_TOKEN</code> (Storage → Blob → savienot ar
              projektu) vai norādiet rakstāmu ceļu ar{" "}
              <code className="rounded bg-[var(--fill)] px-1.5 py-0.5 font-mono text-xs">ADMIN_IRISS_SCAN_DIR</code>{" "}
              <span className="text-[var(--ink2)]">(tikai ceļš zem `os.tmpdir()` deploy vidē, ja nav Blob).</span>
            </p>
          ) : (
            <p className="mt-1.5 text-[var(--warn)]">
              Iestatiet <code className="rounded bg-[var(--fill)] px-1.5 py-0.5 font-mono text-xs">ADMIN_IRISS_SCAN_DIR</code> vai noņemiet atspējošanu
              (vērtība <span className="font-mono">0</span> / <span className="font-mono">off</span>).
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
