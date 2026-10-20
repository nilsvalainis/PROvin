import { notFound, redirect } from "next/navigation";
import { IrissScanEditor } from "@/components/admin/IrissScanEditor";
import { isIrissScanStoreEnabled, isSafeIrissScanId, readIrissScanWithRetry } from "@/lib/iriss-scan-store";
import { requireAdminPage } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function IrissScanDetailPage({ params }: Props) {
  await requireAdminPage();
  if (!isIrissScanStoreEnabled()) {
    redirect("/admin/iriss/scan");
  }
  const { id } = await params;
  if (!isSafeIrissScanId(id)) notFound();
  const rec = await readIrissScanWithRetry(id);
  if (!rec) notFound();
  return <IrissScanEditor initialRecord={rec} />;
}
