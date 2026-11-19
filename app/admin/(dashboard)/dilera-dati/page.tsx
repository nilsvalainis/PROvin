import { AdminDealerCheckServerPage, type DealerCheckSearchParams } from "@/components/admin/AdminDealerCheckServerPage";

export const metadata = {
  title: "Dīlera datu pārbaude",
};

export const dynamic = "force-dynamic";

export default function AdminDealerCheckRoute({ searchParams }: { searchParams?: Promise<DealerCheckSearchParams> }) {
  return <AdminDealerCheckServerPage searchParams={searchParams} />;
}
