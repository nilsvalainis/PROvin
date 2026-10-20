import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { IrissMonthlyReportView } from "@/components/admin/IrissMonthlyReportView";
import { resolveIrissReportMonth } from "@/lib/iriss-monthly-report";
import { loadIrissMonthlyReport } from "@/lib/iriss-monthly-report-load";
import { requireIrissSectionPage } from "@/lib/staff-auth";

export const metadata = {
  title: "Mēneša atskaite | IRISS",
};

export const dynamic = "force-dynamic";

export default async function IrissMonthlyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireIrissSectionPage("atskaite");
  const sp = await searchParams;
  const { year, month } = resolveIrissReportMonth(sp.month);
  const { report, storeEnabled, loadError } = await loadIrissMonthlyReport(year, month);

  return (
    <div className="relative min-h-full w-full max-w-none bg-[#F8F8F9] px-3 pb-24 pt-3 sm:px-4 sm:pb-8">
      <AdminDashboardHeaderWithMenu mobileTitle="Mēneša atskaite">
        <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          Mēneša atskaite
        </h1>
        <p className="mt-1.5 text-[13px] text-[var(--color-provin-muted)]">
          IRISS pasūtījumi un piedāvājumi. Bez PROVIN auditu metriku.
        </p>
      </AdminDashboardHeaderWithMenu>

      {!storeEnabled ? (
        <div className="mt-4 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3.5 text-sm text-black shadow-sm">
          <p className="font-semibold">Melnraksts ir izslēgts</p>
          <p className="mt-1.5 text-amber-900/90">
            Iestatiet{" "}
            <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs">BLOB_READ_WRITE_TOKEN</code> vai{" "}
            <code className="rounded bg-white/80 px-1.5 py-0.5 font-mono text-xs">ADMIN_IRISS_PASUTIJUMI_DIR</code>.
          </p>
        </div>
      ) : null}

      {storeEnabled && loadError ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-900 shadow-sm">
          <p className="font-semibold">Neizdevās ielādēt atskaiti</p>
          <p className="mt-1.5 break-words">{loadError}</p>
        </div>
      ) : null}

      {storeEnabled && !loadError ? (
        <div className="mt-5">
          <IrissMonthlyReportView report={report} />
        </div>
      ) : null}
    </div>
  );
}
