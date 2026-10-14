import "server-only";

import { renderTemplateById } from "@/lib/messages/render-template-id";
import { enrichVarsWithSharedBlocks, resolveMessageSync } from "@/lib/messages/resolve-message";
import { buildWaReportReadyVars, waReportReadyTemplateId } from "@/lib/messages/template-vars";
import type { MessageTemplatesDoc } from "@/lib/messages/types";
import type { ReportReadyProductKind } from "@/lib/email/report-ready-copy";

const ALLOWED_TEMPLATE_IDS = new Set([
  "wa.report_ready.audits",
  "wa.report_ready.mini",
  "wa.report_ready.dealer",
  "wa.select_consultation",
  "wa.listing_peek",
  "wa.dealer.no_data_refunded",
  "wa.dealer.cancelled",
  "wa.upsell.mini_to_dealer",
  "wa.upsell.dealer_to_audit",
  "wa.upsell.mini_to_audit",
]);

export function isAllowedWhatsappPrefillTemplateId(id: string): boolean {
  return ALLOWED_TEMPLATE_IDS.has(id);
}

export type WhatsappPrefillQuery = {
  templateId: string;
  vin?: string;
  kind?: ReportReadyProductKind;
  summa?: string;
};

export function renderWhatsappPrefillText(query: WhatsappPrefillQuery, doc?: MessageTemplatesDoc | null): string | null {
  const { templateId } = query;
  if (!isAllowedWhatsappPrefillTemplateId(templateId)) return null;

  if (templateId === "wa.select_consultation") {
    return resolveMessageSync(templateId, {}, { doc })?.text ?? renderTemplateById(templateId, {}, doc)?.text ?? null;
  }

  if (templateId === "wa.listing_peek") {
    const vars = enrichVarsWithSharedBlocks(
      {
        vin_phrase: "",
        jautajumu_rinda:
          "Ja Jums rodas kādi jautājumi vai nepieciešama papildu konsultācija, droši rakstiet šeit vai uz info@provin.lv, labprāt palīdzēsim!",
      },
      doc,
    );
    return resolveMessageSync(templateId, vars, { doc })?.text ?? null;
  }

  if (templateId.startsWith("wa.report_ready.")) {
    const kind = (query.kind ??
      (templateId.endsWith(".mini") ? "mini" : templateId.endsWith(".dealer") ? "dealer" : "audits")) as ReportReadyProductKind;
    const vars = buildWaReportReadyVars({ kind, vin: query.vin });
    const id = waReportReadyTemplateId(kind);
    return resolveMessageSync(id, vars, { doc })?.text ?? null;
  }

  if (templateId === "wa.dealer.no_data_refunded") {
    const vin = (query.vin ?? "").trim().toUpperCase();
    const vinLine = vin ? ` (VIN ${vin})` : "";
    const vars = enrichVarsWithSharedBlocks(
      {
        vin_line: vinLine,
        summa: (query.summa ?? "").trim() || "24,99 €",
      },
      doc,
    );
    return resolveMessageSync(templateId, vars, { doc })?.text ?? null;
  }

  if (templateId === "wa.dealer.cancelled") {
    const vin = (query.vin ?? "").trim().toUpperCase();
    const vinLine = vin ? ` (VIN ${vin})` : "";
    const vars = enrichVarsWithSharedBlocks({ vin_line: vinLine }, doc);
    return resolveMessageSync(templateId, vars, { doc })?.text ?? null;
  }

  return resolveMessageSync(templateId, enrichVarsWithSharedBlocks({}, doc), { doc })?.text ?? null;
}
