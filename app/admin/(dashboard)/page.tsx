import { isDemoOrdersEnabled, listAdminOrders } from "@/lib/admin-orders";
import { serializeAdminOrderTableRows } from "@/lib/serialize-admin-order-table";
import { readOrderDraft } from "@/lib/admin-order-draft-store";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { AdminOrdersExportButton } from "@/components/admin/AdminOrdersExportButton";
import { AdminOrdersTable } from "@/components/admin/AdminOrdersTable";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const { rows: orders, stripeError } = await listAdminOrders(50);
  const ordersWithInvoice = await Promise.all(
    orders.map(async (o) => {
      const draft = await readOrderDraft(o.id);
      const draftEmail = draft?.orderEdits?.customerEmail?.trim();
      const draftName = draft?.orderEdits?.customerName?.trim();
      const draftPhone = draft?.orderEdits?.customerPhone?.trim();
      return {
        ...o,
        customerEmail: draftEmail ? draftEmail : o.customerEmail,
        customerName: draftName || null,
        customerPhone: draftPhone || null,
        invoicePdfUrl: draft?.invoicePdfUrl ?? null,
      };
    }),
  );
  const tableOrders = serializeAdminOrderTableRows(ordersWithInvoice);
  const demoPrefOn = isDemoOrdersEnabled();
  const onlyDemoShown = orders.length > 0 && orders.every((o) => o.isDemo);
  const hasStripeIssue = Boolean(stripeError);

  return (
    <div className="w-full max-w-none">
      <AdminDashboardHeaderWithMenu>
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
          Apstrādes telpa
        </p>
        <h1 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          Sākums
        </h1>
        {demoPrefOn ? (
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-provin-muted)]">
            Demo rindas pēc noklusējuma ir ieslēgtas. Paslēpt:{" "}
            <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-apple-text)]">
              ADMIN_DEMO_ORDERS=0
            </code>
            .
          </p>
        ) : null}
      </AdminDashboardHeaderWithMenu>

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

      {orders.length > 0 ? <AdminOrdersTable orders={tableOrders} /> : null}

      <div className="mt-8 flex flex-wrap items-start justify-end gap-3 border-t border-slate-100/80 pt-4">
        <AdminOrdersExportButton />
      </div>
    </div>
  );
}
