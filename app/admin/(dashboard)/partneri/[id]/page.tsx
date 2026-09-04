import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminB2bPartnerEditForm } from "@/components/admin/AdminB2bPartnerEditForm";
import { AdminDashboardHeaderWithMenu } from "@/components/admin/AdminDashboardHeaderWithMenu";
import { isSafeB2bPartnerId, toPublicPartner } from "@/lib/b2b-partner-account";
import { getB2bPartnerById } from "@/lib/b2b-partner-store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const partner = isSafeB2bPartnerId(id) ? await getB2bPartnerById(id) : null;
  return { title: partner ? partner.companyName : "Partneris" };
}

export default async function AdminPartnerDetailPage({ params }: Props) {
  const { id } = await params;
  if (!isSafeB2bPartnerId(id)) notFound();
  const record = await getB2bPartnerById(id);
  if (!record) notFound();
  const partner = toPublicPartner(record);

  return (
    <div className="w-full max-w-none">
      <AdminDashboardHeaderWithMenu>
        <p className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--color-provin-muted)]">
          <Link href="/admin/partneri" className="hover:text-[var(--color-apple-text)]">
            Partneri
          </Link>
        </p>
        <h1 className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-tight text-[var(--color-apple-text)] sm:text-[1.5rem]">
          {partner.companyName}
        </h1>
        <p className="mt-2 w-full max-w-none text-[13px] leading-relaxed text-[var(--color-provin-muted)]">
          {partner.email}
          {" · "}
          {partner.status === "active" ? "Aktīvs" : "Bloķēts"}
        </p>
      </AdminDashboardHeaderWithMenu>
      <AdminB2bPartnerEditForm partner={partner} />
    </div>
  );
}
