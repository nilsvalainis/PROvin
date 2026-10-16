import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * Agrāk — izvēles ekrāns ar divām lielām PRO/IRISS flīzēm. Tagad uzreiz atver pēdējo izmantoto
 * darba zonu (sīkdatne `admin_ws`, ko raksta sānjosla); noklusēti — PRO Pasūtījumi.
 */
export default async function AdminIndexPage() {
  await requireAdminPage();
  const ws = (await cookies()).get("admin_ws")?.value;
  redirect(ws === "iriss" ? "/admin/iriss/pasutijumi" : "/admin/dashboard");
}
