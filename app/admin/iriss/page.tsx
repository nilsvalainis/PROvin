import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AdminIrissHomePage() {
  redirect("/admin/iriss/pasutijumi");
}
