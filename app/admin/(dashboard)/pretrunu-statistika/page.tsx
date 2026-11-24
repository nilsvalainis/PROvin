import Link from "next/link";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { requireAdminPage } from "@/lib/admin-auth";
import { ruleAdviceLv } from "@/lib/contradiction-feedback";
import { loadContradictionFeedbackSummary } from "@/lib/contradiction-feedback-store";

export const metadata = {
  title: "Pretrunu statistika",
};

export const dynamic = "force-dynamic";

const PERIODS = [7, 30, 90] as const;

export default async function AdminPretrunuStatistikaPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireAdminPage();
  const sp = await searchParams;
  const daysNum = Number(sp?.days);
  const days = (PERIODS as readonly number[]).includes(daysNum) ? daysNum : 30;
  const summary = await loadContradictionFeedbackSummary(days);
  const rows = summary.stats;

  return (
    <div className="amx amx-pg mx-auto w-full max-w-4xl max-md:px-4">
      <AdminDashboardHeaderWithMenu>
        <h1 className="text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          Pretrunu statistika
        </h1>
      </AdminDashboardHeaderWithMenu>

      <div className="mt-5 flex flex-wrap gap-2 text-[12px]">
        {PERIODS.map((d) => (
          <Link
            key={d}
            href={`/admin/pretrunu-statistika?days=${d}`}
            className={`rounded-lg px-2.5 py-1 font-medium ${
              d === days ? "bg-[var(--color-apple-text)] text-white" : "bg-slate-100 text-[var(--color-apple-text)] hover:bg-slate-200"
            }`}
          >
            {d} d.
          </Link>
        ))}
      </div>

      {summary.downgraded.length > 0 ? (
        <section className="mt-5 rounded-2xl border border-amber-200/90 bg-amber-50 p-4 text-[13px] text-amber-950">
          <p className="font-semibold">Automātiski pazemināti (30 d., ≥5 lēmumi, ≥80 % «Nav pretruna»)</p>
          <ul className="mt-1.5 space-y-0.5">
            {summary.downgraded.map((k) => (
              <li key={k} className="break-words">
                {k}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-5 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white">
        {rows.length === 0 ? (
          <p className="p-5 text-[13px] text-[var(--color-provin-muted)]">Lēmumu vēl nav.</p>
        ) : (
          <table className="w-full min-w-[36rem] text-left text-[12px]">
            <thead className="border-b border-slate-200/80 text-[10px] uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
              <tr>
                <th className="px-3 py-2 font-semibold">Noteikums</th>
                <th className="px-3 py-2 font-semibold">Avoti</th>
                <th className="px-3 py-2 text-right font-semibold">Nav pretruna</th>
                <th className="px-3 py-2 text-right font-semibold">Pareizi</th>
                <th className="px-3 py-2 text-right font-semibold">%</th>
                <th className="px-3 py-2 font-semibold">Piemēri</th>
                <th className="px-3 py-2 font-semibold">Ieteikums</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={`${s.rule}|${s.pair}`} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-2 font-medium text-[var(--color-apple-text)]">{s.rule}</td>
                  <td className="px-3 py-2 text-[var(--color-provin-muted)]">{s.pair || "-"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.dismiss}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.confirm}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{Math.round(s.dismissRatio * 100)}</td>
                  <td className="px-3 py-2 text-[var(--color-provin-muted)]">{s.examples.map((e) => e.vin).filter(Boolean).join(", ") || "-"}</td>
                  <td className={`px-3 py-2 ${s.autoDowngrade ? "font-semibold text-[#a35f00]" : ""}`}>{ruleAdviceLv(s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="mt-8 text-[12px] max-md:hidden">
        <Link href="/admin/statistika" className="font-medium text-[var(--color-provin-accent)] hover:underline">
          Atpakaļ uz statistiku
        </Link>
      </p>
    </div>
  );
}
