import { redirect } from "next/navigation";
import { IrissScanEditor } from "@/components/admin/IrissScanEditor";
import { isIrissScanStoreEnabled } from "@/lib/iriss-scan-store";
import { emptyIrissScanRecord } from "@/lib/iriss-scan-types";
import { irissScanVinFromQuery } from "@/lib/iriss-scan-vin";

export const dynamic = "force-dynamic";

export default async function IrissScanNewPage({
  searchParams,
}: {
  searchParams?: Promise<{ vin?: string }>;
}) {
  if (!isIrissScanStoreEnabled()) {
    redirect("/admin/iriss/scan");
  }
  const sp = (await searchParams) ?? {};
  const rec = emptyIrissScanRecord(crypto.randomUUID(), new Date().toISOString());
  rec.vin = irissScanVinFromQuery(sp.vin);
  return <IrissScanEditor initialRecord={rec} unsavedDraft />;
}
