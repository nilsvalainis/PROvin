import Link from "next/link";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { requireAdminPage } from "@/lib/admin-auth";
import {
  B2B_ADMIN_STAT_PRODUCT_LABEL,
  accumulateB2bWalletStats,
  formatB2bAdminNoDataRate,
  formatB2bAdminRevenue,
} from "@/lib/b2b-admin-stats";
import { listB2bPartners } from "@/lib/b2b-partner-store";
import { readB2bWallet } from "@/lib/b2b-wallet-store";

export const metadata = { title: "B2B statistika" };
export const dynamic = "force-dynamic";

export default async function AdminB2bStatistikaPage() {
  await requireAdminPage();
  const partners = await listB2bPartners();
  const wallets = await Promise.all(
    partners.map(async (partner) => ({
      id: partner.id,
      companyName: partner.companyName,
      wallet: await readB2bWallet(partner.id),
    })),
  );
  const rows = accumulateB2bWalletStats(wallets);

  return (
    <div className="w-full max-w-none">
      <AdminDashboardHeaderWithMenu>
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">B2B</p>
        <h1 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          B2B statistika
        </h1>
        <p className="mt-2 text-[13px] text-[var(--color-provin-muted)]">
          Ieņēmumi, pasūtījumu skaits un datu-nav īpatsvars pa partneri, produktu un mēnesi.
        </p>
        <p className="mt-2 text-[13px]">
          <Link href="/admin/partneri" className="font-medium text-[var(--color-provin-accent)] hover:underline">
            Atpakaļ uz partneriem
          </Link>
        </p>
      </AdminDashboardHeaderWithMenu>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-[var(--color-provin-muted)]">Maka darījumu vēl nav.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200/70 bg-white">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/90 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-provin-muted)]">
                <th className="px-4 py-3.5">Mēnesis</th>
                <th className="px-4 py-3.5">Partneris</th>
                <th className="px-4 py-3.5">Produkts</th>
                <th className="px-4 py-3.5 text-right">Pasūtījumi</th>
                <th className="px-4 py-3.5 text-right">Ieņēmumi</th>
                <th className="px-4 py-3.5 text-right">Datu nav</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={`${row.month}-${row.partnerId}-${row.product}`}>
                  <td className="px-4 py-3.5 tabular-nums">{row.month}</td>
                  <td className="px-4 py-3.5">
                    <Link
                      href={`/admin/partneri/${encodeURIComponent(row.partnerId)}`}
                      className="font-medium text-[var(--color-provin-accent)] hover:underline"
                    >
                      {row.companyName}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">{B2B_ADMIN_STAT_PRODUCT_LABEL[row.product]}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums">{row.orderCount}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums">{formatB2bAdminRevenue(row.revenueCents)}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums">
                    {row.refundCount}/{row.orderCount} ({formatB2bAdminNoDataRate(row.noDataRate)})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
