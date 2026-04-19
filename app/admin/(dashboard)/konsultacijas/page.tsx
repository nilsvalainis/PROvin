import { listAdminConsultations } from "@/lib/admin-orders";
import { serializeAdminOrderTableRows } from "@/lib/serialize-admin-order-table";
import { readConsultationDraft } from "@/lib/admin-consultation-draft-store";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { AdminOrdersTable } from "@/components/admin/AdminOrdersTable";

export const dynamic = "force-dynamic";

export default async function AdminConsultationsPage() {
  const { rows: consultations, stripeError } = await listAdminConsultations(50);
  const rowsWithDraft = await Promise.all(
    consultations.map(async (o) => {
      const draft = await readConsultationDraft(o.id);
      const draftEmail = draft?.orderEdits?.customerEmail?.trim();
      const draftName = draft?.orderEdits?.customerName?.trim();
      const draftPhone = draft?.orderEdits?.customerPhone?.trim();
      return {
        ...o,
        customerEmail: draftEmail ? draftEmail : o.customerEmail,
        customerName: draftName || null,
        customerPhone: draftPhone || null,
        invoicePdfUrl: null,
      };
    }),
  );
  const tableRows = serializeAdminOrderTableRows(rowsWithDraft);
  const onlyDemoShown = consultations.length > 0 && consultations.every((o) => o.isDemo);
  const hasStripeIssue = Boolean(stripeError);

  return (
    <div className="w-full max-w-none">
      <AdminDashboardHeaderWithMenu>
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
          Apstrādes telpa
        </p>
        <h1 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          Konsultācijas
        </h1>
      </AdminDashboardHeaderWithMenu>

      {hasStripeIssue && consultations.length > 0 ? (
        <div
          className={`mt-6 rounded-2xl border px-4 py-3.5 text-sm shadow-sm ${
            onlyDemoShown
              ? "border-[var(--color-provin-accent)]/20 bg-[var(--color-provin-accent-soft)]/60 text-[var(--color-apple-text)]"
              : "border-amber-200/90 bg-amber-50/90 text-amber-950"
          }`}
        >
          <p className="font-semibold tracking-tight">
            {onlyDemoShown ? "Tikai parauga dati" : "Stripe nav pieejams"}
          </p>
          <p className={`mt-1.5 leading-relaxed ${onlyDemoShown ? "text-[var(--color-provin-muted)]" : "text-amber-900/90"}`}>
            {onlyDemoShown
              ? "Īstu konsultāciju sarakstu varēsi ielādēt, kad serverī būs STRIPE_SECRET_KEY."
              : stripeError}
          </p>
        </div>
      ) : null}

      {!hasStripeIssue && consultations.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200/90 bg-white px-6 py-12 text-center shadow-sm">
          <p className="font-medium text-[var(--color-apple-text)]">Nav konsultāciju</p>
          <p className="mt-2 text-sm text-[var(--color-provin-muted)]">
            Kad klienti apmaksās PROVIN SELECT formu, ieraksti parādīsies šeit.
          </p>
        </div>
      ) : null}

      {consultations.length > 0 ? (
        <AdminOrdersTable
          orders={tableRows}
          orderDetailHrefBase="/admin/konsultacijas"
          orderEditsLocalStorageKeyPrefix="provin-admin-consultation-edits-v1-"
          consultationList
        />
      ) : null}
    </div>
  );
}
