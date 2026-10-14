import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { AdminVinScanPageClient } from "@/components/admin/AdminVinScanPageClient";
import { normalizeVin } from "@/lib/order-field-validation";
import { AdminSourceHealthStrip, type SourceHealthItem } from "@/components/admin/AdminSourceHealthStrip";
import { readSourceHealth } from "@/lib/source-health-store";
import { VIN_SCAN_CATALOG } from "@/lib/vin-scan/catalog";

/** Galvenie avoti vienmēr redzami; pārējie — ja par tiem ir ielādes dati. */
const PRIMARY_SOURCES: SourceHealthItem[] = [
  { id: "csdd", label: "CSDD" },
  { id: "stat_vin", label: "stat.vin" },
  { id: "mnt_ee", label: "MNT" },
  { id: "lkf_ee", label: "LKF" },
  { id: "autodna", label: "AutoDNA" },
  { id: "outvin", label: "OutVin" },
  { id: "carvertical", label: "CarVertical", manual: true },
  { id: "cc_vin", label: "CC-VIN", manual: true },
];

export const metadata = {
  title: "VIN pārbaude",
};

export const dynamic = "force-dynamic";

export default async function AdminVinScanPage({
  searchParams,
}: {
  searchParams?: Promise<{ vin?: string }>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  /** LIST kartīte: `/admin/vin-scan?vin=` aizpilda lauku; klients palaiž skenēšanu, ja VIN derīgs. */
  const initialVin = normalizeVin(sp?.vin ?? "");
  const health = await readSourceHealth();
  const primaryIds = new Set(PRIMARY_SOURCES.map((x) => x.id));
  const others: SourceHealthItem[] = VIN_SCAN_CATALOG.filter((c) => !primaryIds.has(c.id) && health.sources[c.id]).map((c) => ({
    id: c.id,
    label: c.label,
  }));

  return (
    <div className="w-full max-w-none">
      <AdminDashboardHeaderWithMenu>
        <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          VIN pārbaude
        </h1>
      </AdminDashboardHeaderWithMenu>
      <AdminSourceHealthStrip doc={health} items={[...PRIMARY_SOURCES, ...others]} />
      <AdminVinScanPageClient initialVin={initialVin} />
    </div>
  );
}
