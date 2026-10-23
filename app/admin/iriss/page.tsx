import { redirect } from "next/navigation";
import { IrissMobileMenuHome } from "@/components/admin/IrissMobileMenuHome";
import { readMenuLayoutForPage } from "@/lib/admin-menu-layout-store";
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
  // Saglabātais izkārtojums jau HTML: režģis pēc ielādes nepārkārtojas zem pirksta (j23).
  const initialLayout = await readMenuLayoutForPage(actor, "iriss");
  return <IrissMobileMenuHome sections={sections} isAdmin={isAdmin} initialLayout={initialLayout} />;
}
