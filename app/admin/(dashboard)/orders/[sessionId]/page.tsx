import { notFound } from "next/navigation";
import { MarkAdminStripeSessionOpened } from "@/components/admin/MarkAdminStripeSessionOpened";
import { AdminOrderDetailView } from "@/components/admin/AdminOrderDetailView";
import { getCheckoutSessionDetail } from "@/lib/admin-orders";
import { geminiAllowsOrder } from "@/lib/admin-gemini-access";
import { isOrderDraftStoreEnabled, readOrderDraft } from "@/lib/admin-order-draft-store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ sessionId: string }> };

export default async function AdminOrderDetailPage({ params }: Props) {
  const { sessionId } = await params;
  const order = await getCheckoutSessionDetail(sessionId);
  if (!order) {
    notFound();
  }

  const orderDraftPersistenceEnabled = isOrderDraftStoreEnabled();
  const serverOrderDraft = await readOrderDraft(sessionId);
  const serverWorkspaceJson =
    serverOrderDraft?.workspace != null
      ? JSON.stringify({
          sourceBlocks: serverOrderDraft.workspace.sourceBlocks,
          iriss: serverOrderDraft.workspace.iriss,
          apskatesPlāns: serverOrderDraft.workspace.apskatesPlāns,
          cenasAtbilstiba: serverOrderDraft.workspace.cenasAtbilstiba,
          previewConfirmed: serverOrderDraft.workspace.previewConfirmed,
          pdfVisibility: serverOrderDraft.workspace.pdfVisibility,
          pdfBannerInclude: serverOrderDraft.workspace.pdfBannerInclude,
          vehicleAiExtraction: serverOrderDraft.workspace.vehicleAiExtraction,
          vehicleAiExtractionMeta: serverOrderDraft.workspace.vehicleAiExtractionMeta,
          savedAt: serverOrderDraft.updatedAt,
        })
      : null;

  return (
    <>
      <MarkAdminStripeSessionOpened sessionId={sessionId} />
      <AdminOrderDetailView
        key={sessionId}
        order={{
          id: order.id,
          created: order.created,
          amountTotal: order.amountTotal,
          currency: order.currency,
          paymentStatus: order.paymentStatus,
          customerEmail: order.customerEmail,
          customerDetailsEmail: order.customerDetailsEmail,
          phone: order.phone,
          customerDetailsPhone: order.customerDetailsPhone,
          customerName: order.customerName,
          contactMethod: order.contactMethod,
          vin: order.vin,
          listingUrl: order.listingUrl,
          notes: order.notes,
          internalComment: order.internalComment,
          attachments: order.attachments,
          isDemo: order.isDemo,
        }}
        serverOrderDraft={serverOrderDraft}
        serverWorkspaceJson={serverWorkspaceJson}
        orderDraftPersistenceEnabled={orderDraftPersistenceEnabled}
        geminiAllowed={geminiAllowsOrder(Boolean(order.isDemo))}
      />
    </>
  );
}
