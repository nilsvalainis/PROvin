import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-auth";
import { atraHrefFromDealerParams, type AtraSearchParams } from "@/lib/atra-parbaude";

export const dynamic = "force-dynamic";

/** «Dīlera dati» tagad ir «Ātrā pārbaude» daļa: pāradresē ar tiem pašiem parametriem (vin, vn, no, id). */
export default async function AdminDealerCheckRoute({ searchParams }: { searchParams?: Promise<AtraSearchParams> }) {
  await requireAdminPage();
  const sp = searchParams ? await searchParams : undefined;
  redirect(atraHrefFromDealerParams(sp));
}
