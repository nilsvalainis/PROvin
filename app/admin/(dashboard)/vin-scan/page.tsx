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
        <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          VIN SCAN
        </h1>
      </AdminDashboardHeaderWithMenu>
      <AdminVinScanPageClient initialVin={initialVin} />
    </div>
  );
}
