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
    <div className="relative min-h-full w-full max-w-none bg-[#F8F8F9] pb-24 sm:pb-8">
      <AdminDashboardHeaderWithMenu>
        <h1 className="text-[17px] font-semibold tracking-tight text-[var(--color-apple-text)]">VIN SCAN</h1>
        <p className="mt-0.5 max-w-2xl text-[11.5px] leading-snug text-[#8e8e93]">
          VIN un/vai numurs. Serveris nolasa visus bezmaksas avotus, saglabā rezultātu un atver avotus jau ar VIN.
        </p>
      </AdminDashboardHeaderWithMenu>
      <AdminVinScanPageClient initialVin={initialVin} />
    </div>
  );
}
