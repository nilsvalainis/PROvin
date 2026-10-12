import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { AdminVinScanPageClient } from "@/components/admin/AdminVinScanPageClient";
import { normalizeVin } from "@/lib/order-field-validation";

export const metadata = {
  title: "VIN SCAN",
};

export const dynamic = "force-dynamic";

export default async function AdminVinScanPage({
  searchParams,
}: {
  searchParams?: Promise<{ vin?: string }>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const initialVin = normalizeVin(sp?.vin ?? "");

  return (
    <div className="w-full max-w-none">
      <AdminDashboardHeaderWithMenu>
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
          Avoti
        </p>
        <h1 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          VIN SCAN
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-snug text-[var(--color-provin-muted)]">
          VIN un/vai numurs. Serveris nolasa visus bezmaksas avotus, saglabā rezultātu un atver avotus jau ar VIN.
        </p>
      </AdminDashboardHeaderWithMenu>
      <AdminVinScanPageClient initialVin={initialVin} />
    </div>
  );
}
