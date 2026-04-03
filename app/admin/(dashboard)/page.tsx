import Link from "next/link";
import { isDemoOrdersEnabled, listAdminOrders } from "@/lib/admin-orders";
import { formatMoneyEur } from "@/lib/format-money";

export const dynamic = "force-dynamic";

function PaymentStatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "paid") {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-200/80">
        Apmaksāts
      </span>
    );
  }
  if (s === "unpaid") {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900 ring-1 ring-amber-200/90">
        Pirms apmaksas
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-600 ring-1 ring-slate-200/80">
      {status}
    </span>
  );
}

export default async function AdminOrdersPage() {
  const { rows: orders, stripeError } = await listAdminOrders(50);
  const demoPrefOn = isDemoOrdersEnabled();
  const onlyDemoShown = orders.length > 0 && orders.every((o) => o.isDemo);
  const hasStripeIssue = Boolean(stripeError);

  const dateFmt = new Intl.DateTimeFormat("lv-LV", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto max-w-5xl">
      <header className="border-b border-slate-200/70 pb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
          Apstrādes telpa
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--color-apple-text)]">Pasūtījumi</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-provin-muted)]">
          Šeit apkopo ierakstus apstrādei: atver rindu, lai redzētu VIN, kontaktus, komentārus un darba zonu ar
          priekšskatījumu. Zemāk ir{" "}
          <span className="font-medium text-[var(--color-apple-text)]">parauga pasūtījumi</span> — vari tos brīvi
          slīpēt, kamēr neesi gatavs pieslēgt īstu maksājumu plūsmu.
        </p>
        {demoPrefOn ? (
          <p className="mt-2 text-xs leading-relaxed text-[var(--color-provin-muted)]">
            Demo rindas pēc noklusējuma ir ieslēgtas. Paslēpt:{" "}
            <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-[var(--color-apple-text)]">
              ADMIN_DEMO_ORDERS=0
            </code>
            .
          </p>
        ) : null}
      </header>

      {hasStripeIssue && orders.length > 0 ? (
        <div
          className={`mt-6 rounded-2xl border px-4 py-3.5 text-sm shadow-sm ${
            onlyDemoShown
              ? "border-[var(--color-provin-accent)]/20 bg-[var(--color-provin-accent-soft)]/60 text-[var(--color-apple-text)]"
              : "border-amber-200/90 bg-amber-50/90 text-amber-950"
          }`}
        >
          <p className="font-semibold tracking-tight">
            {onlyDemoShown ? "Tikai parauga dati" : "Papildu avots (Stripe) nav pieejams"}
          </p>
          <p className={`mt-1.5 leading-relaxed ${onlyDemoShown ? "text-[var(--color-provin-muted)]" : "text-amber-900/90"}`}>
            {onlyDemoShown
              ? "Īstu maksājumu sarakstu varēsi ielādēt vēlāk, kad serverī būs iestatīts STRIPE_SECRET_KEY. Kamēr turpini dizaina un darba plūsmas uzlabošanu ar demo ierakstiem."
              : stripeError}
          </p>
          {!onlyDemoShown && stripeError ? (
            <p className="mt-2 text-amber-900/85">Zemāk redzami arī parauga pasūtījumi (ja ieslēgti).</p>
          ) : null}
        </div>
      ) : null}

      {hasStripeIssue && orders.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-red-200/90 bg-red-50/95 px-4 py-3.5 text-sm text-red-950 shadow-sm">
          {stripeError}
        </div>
      ) : null}

      {!hasStripeIssue && orders.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200/90 bg-white px-6 py-12 text-center shadow-sm">
          <p className="font-medium text-[var(--color-apple-text)]">Nav rindu</p>
          <p className="mt-2 text-sm text-[var(--color-provin-muted)]">
            Kad būs apmaksāti pasūtījumi, tie parādīsies šeit.
          </p>
          {!demoPrefOn ? (
            <p className="mt-4 text-sm text-[var(--color-provin-muted)]">
              Lai redzētu paraugus, noņem{" "}
              <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs">ADMIN_DEMO_ORDERS=0</code> vai
              neiestati šo mainīgo.
            </p>
          ) : null}
        </div>
      ) : null}

      {orders.length > 0 ? (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_2px_24px_rgba(15,23,42,0.05)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/90 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-provin-muted)]">
                  <th className="px-4 py-3.5">Datums</th>
                  <th className="px-4 py-3.5">VIN</th>
                  <th className="px-4 py-3.5">Klients</th>
                  <th className="px-4 py-3.5">Statuss</th>
                  <th className="px-4 py-3.5 text-right">Summa</th>
                  <th className="px-4 py-3.5 text-right">Darbība</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className={
                      o.isDemo
                        ? "bg-[var(--color-provin-accent-soft)]/25 transition-colors hover:bg-[var(--color-provin-accent-soft)]/45"
                        : "transition-colors hover:bg-slate-50/90"
                    }
                  >
                    <td className="whitespace-nowrap px-4 py-3.5 text-[var(--color-apple-text)]">
                      <span className="flex flex-wrap items-center gap-2">
                        {dateFmt.format(new Date(o.created * 1000))}
                        {o.isDemo ? (
                          <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-provin-accent)] ring-1 ring-[var(--color-provin-accent)]/20">
                            Paraugs
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3.5 font-mono text-xs text-[var(--color-apple-text)]">
                      {o.vin ?? "—"}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3.5 text-[var(--color-apple-text)]">
                      {o.customerEmail ?? "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <PaymentStatusPill status={o.paymentStatus} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums font-medium text-[var(--color-apple-text)]">
                      {formatMoneyEur(o.amountTotal, o.currency)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/admin/orders/${encodeURIComponent(o.id)}`}
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
      ) : null}
    </div>
  );
}
