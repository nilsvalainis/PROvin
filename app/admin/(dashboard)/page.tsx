import Link from "next/link";
import { isDemoOrdersEnabled, listAdminOrders } from "@/lib/admin-orders";
import { formatMoneyEur } from "@/lib/format-money";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const { rows: orders, stripeError } = await listAdminOrders(50);
  const demoOn = isDemoOrdersEnabled();

  const dateFmt = new Intl.DateTimeFormat("lv-LV", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--color-apple-text)]">
          Pasūtījumi
        </h1>
        <p className="mt-0.5 text-sm leading-snug text-[var(--color-provin-muted)]">
          Apmaksātie pasūtījumi no Stripe Checkout. Izvēlies rindu, lai atvērtu detaļas un turpinātu
          apstrādi.
          {demoOn ? (
            <>
              {" "}
              <span className="font-medium text-[var(--color-provin-accent)]">Demo pasūtījumi</span> ir redzami (noklusējums;
              izslēgt: <code className="rounded bg-slate-100 px-1 text-xs">ADMIN_DEMO_ORDERS=0</code>) — tajā skaitā paraugs{" "}
              <span className="font-medium text-[var(--color-apple-text)]">pirms apmaksas</span> (summa „—”, statuss{" "}
              <span className="font-mono text-xs">unpaid</span>).
            </>
          ) : null}
        </p>
      </header>

      {stripeError && orders.length > 0 ? (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
          <p className="font-medium">Stripe nav pieejams</p>
          <p className="mt-1 text-amber-900/90">{stripeError}</p>
          {demoOn ? (
            <p className="mt-2 text-amber-900/90">
              Zemāk redzami tikai demonstrācijas pasūtījumi, līdz iestatīsi STRIPE_SECRET_KEY.
            </p>
          ) : null}
        </div>
      ) : null}

      {stripeError && orders.length === 0 ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
          {stripeError}
        </div>
      ) : null}

      {!stripeError && orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
          <p className="font-medium text-[var(--color-apple-text)]">Vēl nav apmaksātu pasūtījumu</p>
          <p className="mt-2 text-sm text-[var(--color-provin-muted)]">
            Kad klients pabeigs maksājumu Stripe, tas parādīsies šī saraksta augšā.
          </p>
          {!demoOn ? (
            <p className="mt-4 text-sm text-[var(--color-provin-muted)]">
              Demo pasūtījumi ir izslēgti — noņem <code className="rounded bg-slate-100 px-1 text-xs">ADMIN_DEMO_ORDERS=0</code> vai
              neiestati mainīgo, lai tos atkal rādītu (noklusējums).
            </p>
          ) : null}
        </div>
      ) : null}

      {orders.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
                  <th className="px-3 py-2">Datums</th>
                  <th className="px-3 py-2">VIN</th>
                  <th className="px-3 py-2">Klients</th>
                  <th className="px-3 py-2 text-right">Summa</th>
                  <th className="px-3 py-2 text-right">Darbība</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className={
                      o.isDemo ? "bg-[var(--color-provin-accent-soft)]/35 hover:bg-[var(--color-provin-accent-soft)]/50" : "hover:bg-slate-50/80"
                    }
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-[var(--color-apple-text)]">
                      <span className="flex flex-wrap items-center gap-2">
                        {dateFmt.format(new Date(o.created * 1000))}
                        {o.isDemo ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                            Demo
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-[var(--color-apple-text)]">
                      {o.vin ?? "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-[var(--color-apple-text)]">
                      {o.customerEmail ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-[var(--color-apple-text)]">
                      {formatMoneyEur(o.amountTotal, o.currency)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/admin/orders/${encodeURIComponent(o.id)}`}
                        className="inline-flex rounded-full bg-[var(--color-provin-accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--color-provin-accent)] hover:bg-[#d4e8fb]"
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
      ) : null}
    </div>
  );
}
