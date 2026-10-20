import { IrissStaffUsersClient } from "@/components/admin/IrissStaffUsersClient";
import { requireAdminPage } from "@/lib/admin-auth";

export const metadata = {
  title: "Lietotāji un pieeja | IRISS",
};

export const dynamic = "force-dynamic";

export default async function IrissStaffUsersPage() {
  await requireAdminPage();
  return <IrissStaffUsersClient />;
}
