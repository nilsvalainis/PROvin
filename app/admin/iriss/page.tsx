import { redirect } from "next/navigation";
import { getAdminOrStaffActor, staffActorHomePath } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export default async function AdminIrissHomePage() {
  const actor = await getAdminOrStaffActor();
  if (!actor) {
    redirect("/admin/login?next=%2Fadmin%2Firiss");
  }
  redirect(staffActorHomePath(actor));
}
