import { AdminPushToggle } from "@/components/admin/AdminPushToggle";
import { IrissPasutijumiListClient } from "@/components/admin/IrissPasutijumiListClient";
import { AdminIrissOrdersExportButton } from "@/components/admin/AdminIrissOrdersExportButton";
import { loadIrissListingMatchState } from "@/lib/iriss-listing-match-store";
import { countIrissNewHitsByOrder } from "@/lib/iriss-pasutijumi-list-view";
import {
  getIrissPasutijumiStorageState,
  listIrissPasutijumi,
  readIrissListOrder,
} from "@/lib/iriss-pasutijumi-store";
import { requireIrissSectionPage } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export default async function IrissPasutijumiListPage() {
  const actor = await requireIrissSectionPage("pasutijumi");
  const isAdmin = actor.kind === "admin";
  const storage = getIrissPasutijumiStorageState();
  const storeEnabled = storage.enabled;
  let rows = [] as Awaited<ReturnType<typeof listIrissPasutijumi>>;
  let initialListOrder = null as Awaited<ReturnType<typeof readIrissListOrder>>;
  let loadError: string | null = null;
  let newHitsByOrder: Record<string, number> = {};
  if (storeEnabled) {
    try {
      const [listed, order, match] = await Promise.all([
        listIrissPasutijumi({ includeDeleted: true }),
        readIrissListOrder(),
        loadIrissListingMatchState().catch(() => null),
      ]);
      rows = listed;
      initialListOrder = order;
      if (match) newHitsByOrder = countIrissNewHitsByOrder(match.entries);
    } catch (e) {
      loadError = e instanceof Error ? e.message : "Neizdevās ielādēt pasūtījumus.";
      rows = [];
      initialListOrder = null;
    }
  }

  return (
    <div className="relative min-h-full w-full max-w-none pb-24 sm:pb-8">
      {!storeEnabled ? (
        <div className="mt-3 rounded-2xl border border-[var(--hair)] bg-[var(--s1)] px-4 py-3.5 text-sm text-[var(--ink)] shadow-[var(--sh)]">
          <p className="font-semibold">Melnraksts ir izslēgts</p>
          {storage.reason === "vercel_blob_token_missing" ? (
            <p className="mt-1.5 text-[var(--warn)]">
              Vercel vidē JSON tiek glabāti <span className="font-semibold">Vercel Blob</span>. Pievienojiet projektam
              mainīgo{" "}
              <code className="rounded bg-[var(--fill)] px-1.5 py-0.5 font-mono text-xs">BLOB_READ_WRITE_TOKEN</code>{" "}
              (Storage → Blob → savienot ar projektu) vai norādiet rakstāmu ceļu ar{" "}
              <code className="rounded bg-[var(--fill)] px-1.5 py-0.5 font-mono text-xs">ADMIN_IRISS_PASUTIJUMI_DIR</code>.
            </p>
          ) : (
            <p className="mt-1.5 text-[var(--warn)]">
              Iestatiet mapes ceļu vai noņemiet atspējošanu:{" "}
              <code className="rounded bg-[var(--fill)] px-1.5 py-0.5 font-mono text-xs">ADMIN_IRISS_PASUTIJUMI_DIR</code>{" "}
              (lokāli noklusējums: <span className="font-mono">.data/iriss-pasutijumi</span> projekta saknē).
            </p>
          )}
        </div>
      ) : null}

      {storeEnabled && loadError ? (
        <div className="mt-3 rounded-2xl border border-[var(--bad-soft)] bg-[var(--s1)] px-4 py-3.5 text-sm text-[var(--bad)] shadow-[var(--sh)]">
          <p className="font-semibold">Neizdevās ielādēt IRISS pasūtījumus</p>
          <p className="mt-1.5 break-words">{loadError}</p>
        </div>
      ) : null}

      {storeEnabled && !loadError ? (
        <IrissPasutijumiListClient rows={rows} initialListOrder={initialListOrder} newHitsByOrder={newHitsByOrder} />
      ) : null}

      {isAdmin ? (
        <div className="mx-auto mt-6 w-full max-w-xl px-3 sm:px-0">
          <AdminPushToggle hint="Paziņojums telefonā, kad klients apstiprina vai noraida piedāvājumu vai termiņš beidzas bez atbildes." />
        </div>
      ) : null}

      {storeEnabled && rows.length === 0 && !loadError ? (
        <div className="mt-4 hidden md:block">
          <AdminIrissOrdersExportButton compact />
        </div>
      ) : null}
    </div>
  );
}
