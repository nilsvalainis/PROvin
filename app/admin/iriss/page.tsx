import { redirect } from "next/navigation";
import { IrissMobileMenuHome } from "@/components/admin/IrissMobileMenuHome";
import { getAdminOrStaffActor } from "@/lib/staff-auth";
import { IRISS_SECTIONS } from "@/lib/staff-roles";

export const dynamic = "force-dynamic";

export default async function AdminIrissHomePage() {
  const actor = await getAdminOrStaffActor();
  if (!actor) {
    redirect("/admin/login?next=%2Fadmin%2Firiss");
  }
  const isAdmin = actor.kind === "admin";
  const sections = isAdmin ? [...IRISS_SECTIONS] : actor.user.sections;
  return <IrissMobileMenuHome sections={sections} isAdmin={isAdmin} />;
}
