import Link from "next/link";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { CreatePkdInvoiceButton } from "@/components/admin/CreatePkdInvoiceButton";
import { listPkdCommissionInvoiceDrafts } from "@/lib/pkd-commission-invoice-store";

export const metadata = {
  title: "Rēķini",
};

export const dynamic = "force-dynamic";

export default async function CommissionInvoicePage() {
  const invoices = await listPkdCommissionInvoiceDrafts();
  return (
    <div className="w-full max-w-none">
      <AdminDashboardHeaderWithMenu>
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
          Apstrādes telpa
        </p>
        <h1 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          Rēķini
        </h1>
        <p className="mt-2 w-full max-w-none text-[13px] leading-relaxed text-[var(--color-provin-muted)]">
          Izveido jaunu rēķinu ar nākamo numuru un atver katru ierakstu atsevišķi rediģēšanai.
        </p>
      </AdminDashboardHeaderWithMenu>

      <div className="mt-6">
        <CreatePkdInvoiceButton />
      </div>

      {invoices.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200/90 bg-white px-6 py-12 text-center shadow-sm">
          <p className="font-medium text-[var(--color-apple-text)]">Vēl nav izveidotu rēķinu</p>
          <p className="mt-2 text-sm text-[var(--color-provin-muted)]">
            Spied uz “Izveidot jaunu rēķinu”, lai sāktu ar nākamo numuru.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_2px_24px_rgba(15,23,42,0.05)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/90 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-provin-muted)]">
                  <th className="px-4 py-3.5">Rēķina nr.</th>
                  <th className="px-4 py-3.5">Klients</th>
                  <th className="px-4 py-3.5 text-right">Summa</th>
                  <th className="px-4 py-3.5 text-right">Darbība</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="transition-colors hover:bg-slate-50/90">
                    <td className="whitespace-nowrap px-4 py-3.5 font-medium text-[var(--color-apple-text)]">
                      {inv.invoiceNumber}
                    </td>
                    <td className="max-w-[260px] truncate px-4 py-3.5 text-[var(--color-apple-text)]">
                      {inv.recipientCompany}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums font-medium text-[var(--color-apple-text)]">
                      {inv.amountEur} EUR
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/admin/commission-invoice/${encodeURIComponent(inv.id)}`}
                        className="inline-flex rounded-full bg-[var(--color-provin-accent)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--color-provin-accent-hover)] hover:shadow-md"
                      >
                        Atvērt
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
