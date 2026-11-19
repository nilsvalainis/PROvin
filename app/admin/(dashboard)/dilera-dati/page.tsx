import { requireAdminPage } from "@/lib/admin-auth";
import { AdminDealerCheckServerPage, type DealerCheckSearchParams } from "@/components/admin/AdminDealerCheckServerPage";

export const metadata = {
  title: "Dīlera datu pārbaude",
};

export const dynamic = "force-dynamic";

export default async function AdminDealerCheckRoute({ searchParams }: { searchParams?: Promise<DealerCheckSearchParams> }) {
  await requireAdminPage();
  return <AdminDealerCheckServerPage searchParams={searchParams} />;
}
