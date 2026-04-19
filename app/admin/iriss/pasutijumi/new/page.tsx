import { redirect } from "next/navigation";
import { createIrissPasutijums, isIrissPasutijumiStoreEnabled } from "@/lib/iriss-pasutijumi-store";

export const dynamic = "force-dynamic";

/** Katrs apmeklējums izveido jaunu ierakstu un atver redaktoru (poga „+”). */
export default async function IrissNewPasutijumsPage() {
  if (!isIrissPasutijumiStoreEnabled()) {
    redirect("/admin/iriss/pasutijumi");
  }
  const r = await createIrissPasutijums();
  if (!r.ok) {
    redirect("/admin/iriss/pasutijumi");
  }
  redirect(`/admin/iriss/pasutijumi/${encodeURIComponent(r.id)}`);
}
