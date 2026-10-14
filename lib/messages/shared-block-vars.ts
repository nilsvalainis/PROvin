import {
  BLOCK_AUDITS_CTA_ID,
  BLOCK_EMAIL_FOOTER_ID,
  BLOCK_GOOGLE_REVIEW_ID,
  BLOCK_REFUND_NOTE_ID,
  BLOCK_SIGN_OFF_ID,
} from "@/lib/messages/shared-blocks";
import { getMessageTemplateDef } from "@/lib/messages/registry";
import type { MessageTemplatesDoc } from "@/lib/messages/types";

/** Mainīgie, kas vienmēr tiek aizpildīti no kopīgajiem blokiem (Blob/kods). */
const ALWAYS_FROM_BLOCK: Record<string, string> = {
  paraksts: BLOCK_SIGN_OFF_ID,
  audits_cta: BLOCK_AUDITS_CTA_ID,
  refund_piezime: BLOCK_REFUND_NOTE_ID,
  email_footer: BLOCK_EMAIL_FOOTER_ID,
};

/** Google bloks: ja izsaucējs ir ielicis tukšu virkni, tas nozīmē „nesūtīt” (report_ready bez atsauksmes). */
const OPTIONAL_FROM_BLOCK: Record<string, string> = {
  google_atsauksme: BLOCK_GOOGLE_REVIEW_ID,
};

export function blockBodyText(id: string, doc?: MessageTemplatesDoc | null): string {
  const def = getMessageTemplateDef(id);
  if (!def) return "";
  const o = doc?.overrides[id];
  return o?.body ?? def.body;
}

/**
 * Aizpilda kopīgo bloku mainīgos no aktuālā doc (arī pārrakstot vecos paraugus).
 * Saglabātu šablonu {{paraksts}} u.c. vienmēr rāda jaunāko bloku tekstu.
 */
export function enrichVarsWithSharedBlocks(
  vars: Record<string, string>,
  doc?: MessageTemplatesDoc | null,
): Record<string, string> {
  const out = { ...vars };
  for (const [key, blockId] of Object.entries(ALWAYS_FROM_BLOCK)) {
    out[key] = blockBodyText(blockId, doc);
  }
  for (const [key, blockId] of Object.entries(OPTIONAL_FROM_BLOCK)) {
    if (key in vars && vars[key] === "") continue;
    out[key] = blockBodyText(blockId, doc);
  }
  return out;
}

export function messageTemplatesDocFromOverrides(
  overrides: Record<string, { subject?: string; body: string; updatedAt?: string; updatedBy?: string }>,
): MessageTemplatesDoc {
  const norm: MessageTemplatesDoc["overrides"] = {};
  for (const [id, o] of Object.entries(overrides)) {
    norm[id] = {
      body: o.body,
      subject: o.subject,
      updatedAt: o.updatedAt ?? "",
      updatedBy: o.updatedBy ?? "",
    };
  }
  return { version: 1, overrides: norm };
}
