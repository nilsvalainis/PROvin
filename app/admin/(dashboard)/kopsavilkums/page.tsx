import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { AdminMorningSummaryView } from "@/components/admin/AdminMorningSummaryView";
import { loadMorningSummary } from "@/lib/admin-morning-summary-load";

export const metadata = {
  title: "Rīta kopsavilkums",
};

export const dynamic = "force-dynamic";

export default async function AdminMorningSummaryPage() {
  const { summary, stripeError } = await loadMorningSummary();

  return (
    <div className="w-full max-w-none">
      <AdminDashboardHeaderWithMenu>
        <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          Rīta kopsavilkums
        </h1>
        <p className="mt-1.5 text-[13px] text-[var(--color-provin-muted)]">
          48 h audita SLA un neatbildētie ātrie vērtējumi.
        </p>
      </AdminDashboardHeaderWithMenu>
      <div className="mt-5">
        <AdminMorningSummaryView summary={summary} stripeError={stripeError} />
      </div>
    </div>
  );
}
