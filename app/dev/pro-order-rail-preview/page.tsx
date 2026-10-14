"use client";

import { AdminOrderStickyActionRail } from "@/components/admin/AdminOrderStickyActionRail";

/** Playwright / PR artefakts: īstais AdminOrderStickyActionRail (lg+). Nav produkcijas izvēlnē. */
export default function ProOrderRailPreviewPage() {
  return (
    <div className="admin-ios-theme provin-pro provin-pro-order relative min-h-[720px] bg-[#eef2f7]">
      <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
        <div className="h-full w-full bg-[repeating-linear-gradient(0deg,#f8fafc,#f8fafc_14px,#f1f5f9_14px,#f1f5f9_28px)]" />
      </div>
      <AdminOrderStickyActionRail
        vin="WAUZZZF44LA062962"
        plate="AB-1234"
        listingUrl="https://www.ss.lv/msg/lv/transport/cars/example.html"
        aiAllowed
        workspaceHydrated
        prepareDraftBusy={false}
        flashMaxBusy={false}
        flashMaxPhase={null}
        flashMaxNotice={null}
        flashMaxErr={null}
        onFlashMax={() => {}}
        copilotOpen={false}
        copilotBusy={false}
        onOpenCopilot={() => {}}
        onVinCopied={() => {}}
        customerPhone="+371 20000000"
        whatsappPrefill="PROVIN audits — testa ziņa"
      />
    </div>
  );
}
