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
  const { report, previous, storeEnabled, loadError } = await loadIrissMonthlyReport(year, month);

  return (
    <div className="relative min-h-full w-full max-w-none pb-24 sm:pb-8">
      {!storeEnabled ? (
        <div className="mt-3 rounded-2xl border border-[var(--hair)] bg-[var(--s1)] px-4 py-3.5 text-sm text-[var(--ink)] shadow-[var(--sh)]">
          <p className="font-semibold">Melnraksts ir izslēgts</p>
          <p className="mt-1.5 text-[var(--warn)]">
            Iestatiet{" "}
            <code className="rounded bg-[var(--fill)] px-1.5 py-0.5 font-mono text-xs">BLOB_READ_WRITE_TOKEN</code> vai{" "}
            <code className="rounded bg-[var(--fill)] px-1.5 py-0.5 font-mono text-xs">ADMIN_IRISS_PASUTIJUMI_DIR</code>.
          </p>
        </div>
      ) : null}

      {storeEnabled && loadError ? (
        <div className="mt-3 rounded-2xl border border-[var(--bad-soft)] bg-[var(--s1)] px-4 py-3.5 text-sm text-[var(--bad)] shadow-[var(--sh)]">
          <p className="font-semibold">Neizdevās ielādēt atskaiti</p>
          <p className="mt-1.5 break-words">{loadError}</p>
        </div>
      ) : null}

      {storeEnabled && !loadError ? <IrissMonthlyReportView report={report} previous={previous} /> : null}
    </div>
  );
}
