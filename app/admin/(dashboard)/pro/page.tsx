import { ProMobileMenuHome } from "@/components/admin/ProMobileMenuHome";
import { requireAdminPage } from "@/lib/admin-auth";

export const metadata = {
  title: "PRO | Administrēšana",
};

/** PRO sākums telefonā: paziņojumi (Pasūtījumi, Dīleri, Ātrie) + sadaļas. Datorā uzreiz Pasūtījumi. */
export default async function ProHomePage() {
  await requireAdminPage();
  return <ProMobileMenuHome />;
}
