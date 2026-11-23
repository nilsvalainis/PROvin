import { AdminMessageTemplatesPage } from "@/components/admin/AdminMessageTemplatesPage";
import { requireAdminPage } from "@/lib/admin-auth";

export const metadata = {
  title: "Tekstu šabloni",
};

export const dynamic = "force-dynamic";

export default async function AdminTekstiPage() {
  await requireAdminPage();
  // Telefonā stikla stils (22.11 makets v2); datorā nekas nemainās.
  return (
    <div className="amx amx-pg amx-pg--teksti">
      <AdminMessageTemplatesPage />
    </div>
  );
}
