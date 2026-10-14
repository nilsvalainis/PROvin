import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { AdminVinScanPageClient } from "@/components/admin/AdminVinScanPageClient";
import { normalizeVin } from "@/lib/order-field-validation";
import { Suspense } from "react";
import { AdminSourceHealthCompact, type SourceHealthItem } from "@/components/admin/AdminSourceHealthStrip";
import { readSourceHealth } from "@/lib/source-health-store";
import { VIN_SCAN_CATALOG } from "@/lib/vin-scan/catalog";

/** Tāds pats avotu saraksts kā VIN SCAN flīzēm (32), nevis primārie + veselības filtrs. */

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
  return (
    <div className="w-full max-w-none">
      <AdminDashboardHeaderWithMenu>
        <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          VIN pārbaude
        </h1>
      </AdminDashboardHeaderWithMenu>
      <AdminVinScanPageClient
        initialVin={initialVin}
        footer={
          // Straumēts: lapa neatgaida Blob nolasīšanu pirms pirmā zīmējuma.
          <Suspense fallback={<p className="text-[11px] text-[#86868b]">Avotu stāvoklis…</p>}>
            <SourceHealthSection />
          </Suspense>
        }
      />
    </div>
  );
}

async function SourceHealthSection() {
  const health = await readSourceHealth();
  const items: SourceHealthItem[] = VIN_SCAN_CATALOG.map((c) => ({ id: c.id, label: c.label }));
  return <AdminSourceHealthCompact doc={health} items={items} />;
}
