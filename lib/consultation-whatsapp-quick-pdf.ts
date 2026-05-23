import type { ConsultationDraftWorkspaceBody } from "@/lib/admin-consultation-draft-types";
import {
  csddFormToPlainText,
  ltabBlockToPlainText,
  mergeSourceBlocksWithDefaults,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { buildWinAnsiQuickPdfFile } from "@/lib/admin-whatsapp-quick-pdf";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { buildProvinSelectConsultationPdfFilename } from "@/lib/audit-report-pdf-filename";

export async function buildConsultationQuickPdfForWhatsApp(
  ws: ConsultationDraftWorkspaceBody,
  order: {
    sessionId: string;
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
  },
): Promise<File> {
  const sections: { title: string; text: string }[] = [];

  ws.slots.forEach((slot, idx) => {
    const blocks = mergeSourceBlocksWithDefaults(slot.sourceBlocks as WorkspaceSourceBlocks);
    const parts: string[] = [];
    if (slot.listingUrl.trim()) parts.push(`Sludinājums: ${slot.listingUrl.trim()}`);
    if (slot.salePrice.trim()) parts.push(`Pardosanas cena: ${slot.salePrice.trim()}`);
    const csdd = csddFormToPlainText(blocks.csdd).trim();
    if (csdd) parts.push(csdd);
    const ltab = ltabBlockToPlainText(blocks.ltab).trim();
    if (ltab) parts.push(ltab);
    const iet = adminRichHtmlToPlainText(slot.ieteikumiApskatei).trim();
    if (iet) parts.push(`Ieteikumi klatienei apskatei:\n${iet}`);
    const cena = adminRichHtmlToPlainText(slot.cenasAtbilstiba).trim();
    if (cena) parts.push(`Cenas atbilstiba:\n${cena}`);
    const kop = adminRichHtmlToPlainText(slot.kopsavilkums).trim();
    if (kop) parts.push(`Kopsavilkums:\n${kop}`);
    const body = parts.join("\n\n");
    if (body) sections.push({ title: `Nr. ${idx + 1}`, text: body });
  });

  const iriss = adminRichHtmlToPlainText(ws.irissApproved).trim();
  if (iriss) sections.push({ title: "APPROVED BY IRISS", text: iriss });

  return buildWinAnsiQuickPdfFile({
    docHeading: "PROVIN SELECT KONSULTACIJA",
    metaLines: [
      `Klients: ${(order.customerName ?? "—").trim() || "—"}`,
      `Talrunis: ${(order.customerPhone ?? "—").trim() || "—"}`,
      `E-pasts: ${(order.customerEmail ?? "—").trim() || "—"}`,
      `Izveidots: ${new Date().toLocaleString("lv-LV")}`,
    ],
    sections,
    filename: buildProvinSelectConsultationPdfFilename(order.sessionId),
  });
}
