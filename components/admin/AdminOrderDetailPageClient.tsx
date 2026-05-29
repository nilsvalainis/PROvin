"use client";

import dynamic from "next/dynamic";
import type { AdminOrderDetailClientModel } from "@/components/admin/AdminOrderDetailView";
import { AdminOrderWorkspaceErrorBoundary } from "@/components/admin/AdminOrderWorkspaceErrorBoundary";
import { AdminOrderDetailLoading } from "@/components/admin/AdminOrderDetailLoading";
import type { OrderDraftState } from "@/lib/admin-order-draft-types";

const AdminOrderDetailView = dynamic(
  () => import("@/components/admin/AdminOrderDetailView").then((m) => m.AdminOrderDetailView),
  { ssr: false, loading: () => <AdminOrderDetailLoading /> },
);

export function AdminOrderDetailPageClient({
  sessionId,
  order,
  serverOrderDraft,
  serverWorkspaceJson,
  orderDraftPersistenceEnabled,
  geminiAllowed,
}: {
  sessionId: string;
  order: AdminOrderDetailClientModel;
  serverOrderDraft: Pick<OrderDraftState, "orderEdits"> | null;
  serverWorkspaceJson: string | null;
  orderDraftPersistenceEnabled: boolean;
  geminiAllowed: boolean;
}) {
  return (
    <AdminOrderWorkspaceErrorBoundary sessionId={sessionId}>
      <AdminOrderDetailView
        key={sessionId}
        order={order}
        serverOrderDraft={serverOrderDraft}
        serverWorkspaceJson={serverWorkspaceJson}
        orderDraftPersistenceEnabled={orderDraftPersistenceEnabled}
        geminiAllowed={geminiAllowed}
      />
    </AdminOrderWorkspaceErrorBoundary>
  );
}
