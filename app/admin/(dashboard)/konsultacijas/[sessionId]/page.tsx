import { notFound } from "next/navigation";
import { MarkAdminStripeSessionOpened } from "@/components/admin/MarkAdminStripeSessionOpened";
import { AdminConsultationDetailView } from "@/components/admin/AdminConsultationDetailView";
import { getConsultationSessionDetail } from "@/lib/admin-orders";
import { isConsultationDraftStoreEnabled, readConsultationDraft } from "@/lib/admin-consultation-draft-store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ sessionId: string }> };

export default async function AdminConsultationDetailPage({ params }: Props) {
  const { sessionId } = await params;
  const order = await getConsultationSessionDetail(sessionId);
  if (!order) {
    notFound();
  }

  const consultationDraftPersistenceEnabled = isConsultationDraftStoreEnabled();
  const serverConsultationDraft = await readConsultationDraft(sessionId);
  const serverWorkspaceJson =
    serverConsultationDraft?.workspace != null
      ? JSON.stringify({
          slots: serverConsultationDraft.workspace.slots,
          irissApproved: serverConsultationDraft.workspace.irissApproved,
          previewConfirmed: serverConsultationDraft.workspace.previewConfirmed,
          pdfVisibility: serverConsultationDraft.workspace.pdfVisibility,
        })
      : null;

  return (
    <>
      <MarkAdminStripeSessionOpened sessionId={sessionId} />
      <AdminConsultationDetailView
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
          selectBrandModel: order.selectBrandModel,
          selectProductionYearsDpf: order.selectProductionYearsDpf,
          selectPlannedBudget: order.selectPlannedBudget,
          selectEngineType: order.selectEngineType,
          selectTransmission: order.selectTransmission,
          selectMaxMileage: order.selectMaxMileage,
          selectExteriorColor: order.selectExteriorColor,
          selectInteriorMaterial: order.selectInteriorMaterial,
          selectRequiredEquipment: order.selectRequiredEquipment,
          selectDesiredEquipment: order.selectDesiredEquipment,
        }}
        serverConsultationDraft={serverConsultationDraft}
        serverWorkspaceJson={serverWorkspaceJson}
        consultationDraftPersistenceEnabled={consultationDraftPersistenceEnabled}
      />
    </>
  );
}
