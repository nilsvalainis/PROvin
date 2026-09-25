import { notFound, redirect } from "next/navigation";
import { MarkAdminStripeSessionOpened } from "@/components/admin/MarkAdminStripeSessionOpened";
import { AdminOrderDetailPageClient } from "@/components/admin/AdminOrderDetailPageClient";
import { AdminOrderDetailPageFallback } from "@/components/admin/AdminOrderDetailPageFallback";
import { loadAdminOrderDetailPageData } from "@/lib/admin-order-detail-page-load";
import { isB2bPackAdminOrder } from "@/lib/b2b-partner-orders";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ sessionId: string }> };

export default async function AdminOrderDetailPage({ params }: Props) {
  let sessionId = "";
  try {
    const resolved = await params;
    sessionId = typeof resolved.sessionId === "string" ? resolved.sessionId.trim() : "";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return (
      <AdminOrderDetailPageFallback
        sessionId=""
        phase="params"
        message="Neizdevās nolasīt maršruta parametrus"
        detail={msg.slice(0, 500)}
      />
    );
  }

  if (!sessionId) {
    notFound();
  }

  const loaded = await loadAdminOrderDetailPageData(sessionId);

  if (loaded.ok && isB2bPackAdminOrder(loaded.order)) {
    redirect("/admin/dashboard");
  }

  if (!loaded.ok) {
    if (loaded.code === "not_found") {
      notFound();
    }
    return (
      <AdminOrderDetailPageFallback
        sessionId={loaded.sessionId}
        phase={loaded.phase}
        message={loaded.message}
        detail={loaded.detail}
      />
    );
  }

  return (
    <>
      <MarkAdminStripeSessionOpened sessionId={loaded.sessionId} />
      <AdminOrderDetailPageClient
        sessionId={loaded.sessionId}
        order={loaded.order}
        serverOrderDraft={loaded.serverOrderDraft}
        serverWorkspaceJson={loaded.serverWorkspaceJson}
        orderDraftPersistenceEnabled={loaded.orderDraftPersistenceEnabled}
        aiAllowed={loaded.aiAllowed}
        customerHistory={loaded.customerHistory}
        auditResultColor={loaded.auditResultColor}
      />
    </>
  );
}
