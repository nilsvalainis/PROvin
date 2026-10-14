import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * Agrāk — izvēles ekrāns ar divām lielām PRO/IRISS flīzēm. Tagad uzreiz atver pēdējo izmantoto
 * darba zonu (sīkdatne `admin_ws`, ko raksta sānjosla); noklusēti — PRO Pasūtījumi.
 */
export default async function AdminIndexPage() {
  const session = await getAdminSession();
  if (!session) {
    const h = await headers();
    const intended = h.get("x-admin-intended-path")?.trim() || "/admin";
    const safe =
      intended.startsWith("/admin") && !intended.startsWith("/admin/login")
        ? intended
        : "/admin";
    redirect(`/admin/login?next=${encodeURIComponent(safe)}`);
  }
  const ws = (await cookies()).get("admin_ws")?.value;
  redirect(ws === "iriss" ? "/admin/iriss/pasutijumi" : "/admin/dashboard");
}
