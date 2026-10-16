import { AdminMessageTemplatesPage } from "@/components/admin/AdminMessageTemplatesPage";
import { requireAdminPage } from "@/lib/admin-auth";

export const metadata = {
  title: "Tekstu šabloni",
};

export const dynamic = "force-dynamic";

export default async function AdminTekstiPage() {
  await requireAdminPage();
  return <AdminMessageTemplatesPage />;
}
