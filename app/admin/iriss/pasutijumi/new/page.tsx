import { redirect } from "next/navigation";
import { IrissPasutijumsEditor } from "@/components/admin/IrissPasutijumsEditor";
import { isIrissPasutijumiStoreEnabled } from "@/lib/iriss-pasutijumi-store";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import { requireAdminPage } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function IrissPasutijumsNewPage({
  searchParams,
}: {
  searchParams?: Promise<{ newOffer?: string; noClientPdf?: string }>;
}) {
  await requireAdminPage();
  if (!isIrissPasutijumiStoreEnabled()) {
    redirect("/admin/iriss/pasutijumi");
  }
  const sp = (await searchParams) ?? {};
  const rec = emptyIrissPasutijums(crypto.randomUUID(), new Date().toISOString());
  return (
    <IrissPasutijumsEditor
      initialRecord={rec}
      unsavedDraft
      autoOpenNewOffer={sp.newOffer === "1"}
      forceNoClientPdf={sp.noClientPdf === "1"}
    />
  );
}
