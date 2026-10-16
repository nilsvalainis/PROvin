import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminIrissHomePage() {
  await requireAdminPage();
  redirect("/admin/iriss/pasutijumi");
}
