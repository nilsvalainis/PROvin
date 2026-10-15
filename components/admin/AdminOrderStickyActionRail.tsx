"use client";

import { useCallback, useState } from "react";
import { AdminFlashMaxButton } from "@/components/admin/AdminFlashMaxButton";
import { AdminOrderCopilotTrigger } from "@/components/admin/AdminOrderCopilotPanel";
import {
  AdminStickyRailV1Button,
  AdminStickyRailV1Link,
  AdminStickyRailV1Slot,
} from "@/components/admin/AdminStickyRailV1Item";
import {
  RailCopilotGlyph,
  RailFlashGlyph,
  RailPlateLvGlyph,
  RailSsLvLogoGlyph,
  RailVinBarcodeGlyph,
  RailWhatsAppGlyph,
} from "@/components/admin/AdminStickyRailV1Glyphs";
import { copyTextToClipboard } from "@/components/admin/AdminClipboardButton";
import { normalizeWhatsAppPhoneDigits, openWhatsAppChat } from "@/lib/admin-whatsapp-phone";
import type { FlashMaxSelection } from "@/lib/admin-flash-max";
import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { ADMIN_RAIL_V1_ASIDE, ADMIN_RAIL_V1_BOX } from "@/lib/admin-sticky-rail-v1-styles";
import { isValidHttpUrl } from "@/lib/order-field-validation";

type Props = {
  vin: string;
  plate: string;
  listingUrl: string | null;
  aiAllowed: boolean;
  workspaceHydrated: boolean;
  prepareDraftBusy: boolean;
  flashMaxBusy: boolean;
  flashMaxPhase: string | null;
  flashMaxNotice: string | null;
  flashMaxErr: string | null;
  onFlashMax: (selection: FlashMaxSelection) => void;
  copilotOpen: boolean;
  copilotBusy: boolean;
  onOpenCopilot: () => void;
  onVinCopied: () => void;
  customerPhone?: string | null;
  whatsappPrefill?: string;
  sourceBlocks?: WorkspaceSourceBlocks | null;
};

/** Darbvirsmas labā mala (variants 1): ikona + īss uzraksts. Mobilajā — apakšējā josla. */
export function AdminOrderStickyActionRail({
  vin,
  plate,
  listingUrl,
  aiAllowed,
  workspaceHydrated,
  prepareDraftBusy,
  flashMaxBusy,
  flashMaxPhase,
  flashMaxNotice,
  flashMaxErr,
  onFlashMax,
  copilotOpen,
  copilotBusy,
  onOpenCopilot,
  onVinCopied,
  customerPhone,
  whatsappPrefill,
  sourceBlocks,
}: Props) {
  const listingHref = listingUrl?.trim() && isValidHttpUrl(listingUrl.trim()) ? listingUrl.trim() : null;
  const vinTrim = vin.trim();
  const plateTrim = plate.trim();
  const whatsappDigits = normalizeWhatsAppPhoneDigits(customerPhone ?? "");
  const waMessage = whatsappPrefill?.trim() ?? "";

  const [vinCopied, setVinCopied] = useState(false);
  const [plateCopied, setPlateCopied] = useState(false);

  const copyVin = useCallback(async () => {
    if (!vinTrim) return;
    const ok = await copyTextToClipboard(vinTrim);
    if (ok) {
      onVinCopied();
      setVinCopied(true);
      window.setTimeout(() => setVinCopied(false), 2000);
    }
  }, [vinTrim, onVinCopied]);

  const copyPlate = useCallback(async () => {
    if (!plateTrim) return;
    const ok = await copyTextToClipboard(plateTrim);
    if (ok) {
      setPlateCopied(true);
      window.setTimeout(() => setPlateCopied(false), 2000);
    }
  }, [plateTrim]);

  const openWhatsApp = useCallback(() => {
    if (!whatsappDigits) return;
    openWhatsAppChat(whatsappDigits, waMessage);
  }, [whatsappDigits, waMessage]);

  return (
    <aside className={ADMIN_RAIL_V1_ASIDE} aria-label="Ātrās darbības">
      <div className={ADMIN_RAIL_V1_BOX}>
        <AdminStickyRailV1Button
          label="VIN"
          title={vinCopied ? "Kopēts" : vinTrim || "Nav VIN"}
          disabled={!vinTrim}
          onClick={() => void copyVin()}
          aria-label={vinCopied ? "VIN nokopēts" : "Kopēt VIN"}
        >
          <RailVinBarcodeGlyph />
        </AdminStickyRailV1Button>

        <AdminStickyRailV1Button
          label="Reģ.nr."
          title={plateCopied ? "Kopēts" : plateTrim || "Nav reģ. nr."}
          disabled={!plateTrim}
          onClick={() => void copyPlate()}
          aria-label={plateCopied ? "Reģ. nr. nokopēts" : "Kopēt reģistrācijas numuru"}
        >
          <RailPlateLvGlyph />
        </AdminStickyRailV1Button>

        <AdminStickyRailV1Button
          label="WhatsApp"
          title={
            whatsappDigits
              ? `Atvērt WhatsApp: ${(customerPhone ?? "").trim()}`
              : "Nav derīga tālruņa numura WhatsApp atvēršanai"
          }
          disabled={!whatsappDigits}
          onClick={openWhatsApp}
        >
          <RailWhatsAppGlyph />
        </AdminStickyRailV1Button>

        {listingHref ? (
          <AdminStickyRailV1Link href={listingHref} title={listingHref}>
            <RailSsLvLogoGlyph />
          </AdminStickyRailV1Link>
        ) : (
          <AdminStickyRailV1Slot title="Nav sludinājuma saites">
            <span className="opacity-40">
              <RailSsLvLogoGlyph />
            </span>
          </AdminStickyRailV1Slot>
        )}

        <AdminStickyRailV1Slot label="Copilot">
          <AdminOrderCopilotTrigger
            rail
            open={copilotOpen}
            busy={copilotBusy}
            disabled={!aiAllowed}
            onOpen={onOpenCopilot}
          />
        </AdminStickyRailV1Slot>

        {aiAllowed ? (
          <AdminStickyRailV1Slot label="Flash">
            <AdminFlashMaxButton
              rail
              menuAlign="end"
              disabled={!workspaceHydrated || prepareDraftBusy}
              busy={flashMaxBusy}
              phase={flashMaxPhase}
              notice={flashMaxNotice}
              error={flashMaxErr}
              onRun={onFlashMax}
              sourceBlocks={sourceBlocks}
            />
          </AdminStickyRailV1Slot>
        ) : null}
      </div>
    </aside>
  );
}
