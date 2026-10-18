import Link from "next/link";
import { AdminB2bInvitePanel } from "@/components/admin/AdminB2bInvitePanel";
import { AdminB2bPartnerCreateForm } from "@/components/admin/AdminB2bPartnerCreateForm";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { listB2bPartners } from "@/lib/b2b-partner-store";
import { loadCreditsForPartners, loadSpentCreditsForPartners } from "@/lib/b2b-partner-dashboard";
import { requireAdminPage } from "@/lib/admin-auth";
import { countUnhandledB2bPartnerLeads } from "@/lib/b2b-partner-lead-store";

export const metadata = {
  title: "Partneri",
};

export const dynamic = "force-dynamic";

export default async function AdminPartnersPage() {
  await requireAdminPage();
  const partners = await listB2bPartners();
  const [creditsById, spentById, unhandledLeads] = await Promise.all([
    loadCreditsForPartners(partners),
    loadSpentCreditsForPartners(partners),
    countUnhandledB2bPartnerLeads().catch(() => 0),
  ]);
  return (
    <div className="w-full max-w-none">
      <AdminDashboardHeaderWithMenu>
        <p className="hidden text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)] md:block">
          B2B
        </p>
        <h1 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          Partneri
        </h1>
        <p className="mt-2 w-full max-w-none text-[13px] leading-relaxed text-[var(--color-provin-muted)]">
          Reģistrē dīleri pats vai izveido unikālu ielūguma saiti, lai partneris reģistrētos pats. Publiska reģistrācija paliek slēgta.
        </p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          <Link href="/admin/partneri/statistika" className="font-medium text-[var(--color-provin-accent)] hover:underline">
            B2B statistika
          </Link>
          <Link
            href="/admin/partneri/pieteikumi"
            className="inline-flex items-center gap-2 font-medium text-[var(--color-provin-accent)] hover:underline"
          >
            Cenu piedāvājuma pieteikumi
            {unhandledLeads > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[11px] font-bold leading-none text-white">
                {unhandledLeads}
              </span>
            ) : null}
          </Link>
        </p>
      </AdminDashboardHeaderWithMenu>

      <AdminB2bInvitePanel />
      <AdminB2bPartnerCreateForm />

      {partners.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-200/90 bg-white px-6 py-12 text-center shadow-sm">
          <p className="font-medium text-[var(--color-apple-text)]">Vēl nav partneru</p>
          <p className="mt-2 text-sm text-[var(--color-provin-muted)]">
            Izveido pirmo ierakstu ar uzņēmuma rekvizītiem un paroli.
          </p>
        </div>
      ) : (
        <>
        <ul className="mt-6 overflow-hidden rounded-xl bg-white md:hidden">
          {partners.map((row) => (
            <li key={row.id} className="border-b border-[#e5e5ea] last:border-b-0">
              <Link
                href={`/admin/partneri/${encodeURIComponent(row.id)}`}
                className="flex min-h-[88px] items-center justify-between gap-3 px-4 py-3"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[17px] font-semibold text-[var(--color-apple-text)]">{row.companyName}</span>
                    {row.adminSeenAt == null ? (
                      <span className="inline-flex h-5 items-center rounded-full bg-rose-600 px-1.5 text-[11px] font-bold uppercase leading-none text-white">
                        Jauns
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-[#8e8e93]">{row.email}</span>
                  <span className="mt-0.5 block text-[13px] text-[#8e8e93]">
                    {row.status === "active" ? (row.emailVerifiedAt ? "Aktīvs" : "Gaida e-pastu") : "Bloķēts"}
                    {" · "}Business {creditsById[row.id]?.business ?? 0}
                  </span>
                </span>
                <span className="shrink-0 text-[15px] font-medium text-[var(--color-provin-accent)]">Atvērt</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-6 hidden overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_2px_24px_rgba(15,23,42,0.05)] md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/90 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-provin-muted)]">
                  <th className="px-4 py-3.5">Uzņēmums</th>
                  <th className="px-4 py-3.5">E-pasts</th>
                  <th className="px-4 py-3.5 text-right">Business</th>
                  <th className="px-4 py-3.5 text-right">Dīleris</th>
                  <th className="px-4 py-3.5">Statuss</th>
                  <th className="px-4 py-3.5">Iztērēti</th>
                  <th className="px-4 py-3.5 text-right">Darbība</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {partners.map((row) => (
                  <tr key={row.id} className="transition-colors hover:bg-slate-50/90">
                    <td className="max-w-[260px] truncate px-4 py-3.5 font-medium text-[var(--color-apple-text)]">
                      <span className="inline-flex items-center gap-2">
                        {row.companyName}
                        {row.adminSeenAt == null ? (
                          <span className="inline-flex h-[18px] items-center rounded-full bg-rose-600 px-1.5 text-[10px] font-bold uppercase leading-none text-white">
                            Jauns
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-[var(--color-apple-text)]">{row.email}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-[var(--color-apple-text)]">
                      {creditsById[row.id]?.business ?? 0}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums text-[var(--color-apple-text)]">
                      {row.dealerEnabled ? (creditsById[row.id]?.dealer ?? 0) : "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[var(--color-apple-text)]">
                      {row.status === "active"
                        ? row.emailVerifiedAt
                          ? "Aktīvs"
                          : "Gaida e-pastu"
                        : "Bloķēts"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-[12px] leading-snug text-[var(--color-apple-text)]">
                      <p>
                        PROVIN BUSINESS{" "}
                        <span className="tabular-nums font-semibold">{spentById[row.id]?.business ?? 0}</span>
                      </p>
                      <p className="mt-0.5 text-[var(--color-provin-muted)]">
                        Dīlera dati{" "}
                        <span className="tabular-nums font-semibold text-[var(--color-apple-text)]">
                          {spentById[row.id]?.dealer ?? 0}
                        </span>
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/admin/partneri/${encodeURIComponent(row.id)}`}
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
        </>
      )}
    </div>
  );
}
