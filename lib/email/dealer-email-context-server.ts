import "server-only";

import type { ClientReportLang } from "@/lib/client-report-i18n";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { readOrderDraft } from "@/lib/admin-order-draft-store";
import type { OrderDraftState } from "@/lib/admin-order-draft-types";
import { dealerEmailFacts, upsellExpiryForText } from "@/lib/email/dealer-email-context";
import type { ReportEmailExtras } from "@/lib/email/html-templates";
import type { ReportReadyProductKind } from "@/lib/email/report-ready-copy";
import { readSessionUpsellDoc } from "@/lib/order-upsell-store";

/**
 * Kartītes papildinājumi sūtīšanas brīdī: dīlera fakti no melnraksta + piemaksas saites termiņš.
 * Kļūda nekad neaptur sūtīšanu - tad bloki vienkārši netiek rādīti.
 */
export async function loadReportEmailExtras(args: {
  sessionId: string;
  productKind: ReportReadyProductKind;
  lang?: ClientReportLang;
  /** Operatora teksts (piemaksas saites meklēšanai). */
  text?: string | null;
  draft?: OrderDraftState | null;
}): Promise<ReportEmailExtras> {
  const out: ReportEmailExtras = {};
  if (args.productKind === "dealer") {
    try {
      const draft = args.draft === undefined ? await readOrderDraft(args.sessionId) : args.draft;
      const sb = draft?.workspace?.sourceBlocks;
      if (sb) {
        const facts = dealerEmailFacts(mergeSourceBlocksWithDefaults(sb).auto_records, args.lang ?? "lv");
        if (facts.length > 0) out.facts = facts;
      }
    } catch (e) {
      console.warn("[email] dealer facts skipped", e instanceof Error ? e.message.slice(0, 160) : e);
    }
  }
  const text = (args.text ?? "").trim();
  if (text.includes("/papildinajums/")) {
    try {
      const doc = await readSessionUpsellDoc(args.sessionId);
      const offers = Object.values(doc?.offers ?? {}).filter((o): o is NonNullable<typeof o> => Boolean(o));
      const exp = upsellExpiryForText(text, offers);
      if (exp) out.offerExpiresAt = exp;
    } catch (e) {
      console.warn("[email] upsell expiry skipped", e instanceof Error ? e.message.slice(0, 160) : e);
    }
  }
  return out;
}
