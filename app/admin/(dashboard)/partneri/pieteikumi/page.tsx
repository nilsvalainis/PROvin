import Link from "next/link";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { AdminB2bPartnerLeadsList } from "@/components/admin/AdminB2bPartnerLeadsList";
import { requireAdminPage } from "@/lib/admin-auth";
import { listB2bPartnerLeads } from "@/lib/b2b-partner-lead-store";

export const metadata = {
  title: "Cenu piedāvājuma pieteikumi",
};

export const dynamic = "force-dynamic";

export default async function AdminPartnerLeadsPage() {
  await requireAdminPage();
  const leads = await listB2bPartnerLeads();
  return (
    <div className="w-full max-w-none">
      <AdminDashboardHeaderWithMenu>
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
          <Link href="/admin/partneri" className="hover:text-[var(--color-apple-text)]">
            Partneri
          </Link>
        </p>
        <h1 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          Cenu piedāvājuma pieteikumi
        </h1>
        <p className="mt-2 w-full max-w-none text-[13px] leading-relaxed text-[var(--color-provin-muted)]">
          Pieteikumi no partneru lapas („Saņemt cenu piedāvājumu”). Katrs jauns pieteikums tiek nosūtīts arī uz
          info@provin.lv.
        </p>
      </AdminDashboardHeaderWithMenu>
      <AdminB2bPartnerLeadsList initialLeads={leads} />
    </div>
  );
}
