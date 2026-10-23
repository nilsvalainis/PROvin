import { ProMobileMenuHome } from "@/components/admin/ProMobileMenuHome";
import { requireAdminPage } from "@/lib/admin-auth";
import { readMenuLayoutForPage } from "@/lib/admin-menu-layout-store";
import { getAdminOrStaffActor } from "@/lib/staff-auth";

export const metadata = {
  title: "PRO | Administrēšana",
};

/** PRO sākums telefonā: paziņojumi (Pasūtījumi, Dīleri, Ātrie) + sadaļas. Datorā uzreiz Pasūtījumi. */
export default async function ProHomePage() {
  await requireAdminPage();
  // Saglabātais izkārtojums jau HTML: režģis pēc ielādes nepārkārtojas zem pirksta (j23).
  const actor = await getAdminOrStaffActor();
  const initialLayout = actor ? await readMenuLayoutForPage(actor, "pro") : undefined;
  return <ProMobileMenuHome initialLayout={initialLayout} />;
}
