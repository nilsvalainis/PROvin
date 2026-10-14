import {
  BLOCK_AUDITS_CTA_ID,
  BLOCK_EMAIL_FOOTER_ID,
  BLOCK_GOOGLE_REVIEW_ID,
  BLOCK_REFUND_NOTE_ID,
  BLOCK_SIGN_OFF_ID,
} from "@/lib/messages/shared-blocks";
import type { MessageTemplatesDoc, MessageTemplateOverride, RenderedMessage } from "@/lib/messages/types";
import {
  getMessageTemplateDef,
  templateAllowedVarKeys,
  templateRequiredVarKeys,
  templateSampleVars,
} from "@/lib/messages/registry";
import { renderTemplateString, renderTemplateSubject, validateTemplateDraft } from "@/lib/messages/render-template";
import { messageHtmlFromTemplate } from "@/lib/messages/email-html-from-template";

export type ResolveMessageOptions = {
  doc?: MessageTemplatesDoc | null;
  /** Structured HTML parametri (pielikumi, foto u.c.). */
  htmlContext?: Record<string, unknown>;
};

function blockText(id: string, doc?: MessageTemplatesDoc | null): string | undefined {
  const def = getMessageTemplateDef(id);
  if (!def) return undefined;
  const o = doc?.overrides[id];
  return o?.body ?? def.body;
}

/** Papildina mainīgos no kopīgajiem blokiem, ja nav padoti. */
export function enrichVarsWithSharedBlocks(vars: Record<string, string>, doc?: MessageTemplatesDoc | null): Record<string, string> {
  const out = { ...vars };
  const fill = (key: string, blockId: string) => {
    if (key in vars) return;
    out[key] = blockText(blockId, doc) ?? "";
  };
  fill("paraksts", BLOCK_SIGN_OFF_ID);
  fill("google_atsauksme", BLOCK_GOOGLE_REVIEW_ID);
  fill("audits_cta", BLOCK_AUDITS_CTA_ID);
  fill("refund_piezime", BLOCK_REFUND_NOTE_ID);
  fill("email_footer", BLOCK_EMAIL_FOOTER_ID);
  if (!out.paraksts?.trim()) out.paraksts = blockText(BLOCK_SIGN_OFF_ID, doc) ?? "";
  return out;
}

function effectiveTemplate(id: string, doc?: MessageTemplatesDoc | null): { subject?: string; body: string } | null {
  const def = getMessageTemplateDef(id);
  if (!def) return null;
  const o = doc?.overrides[id];
  return {
    subject: o?.subject ?? def.subject,
    body: o?.body ?? def.body,
  };
}

export function resolveMessageSync(
  id: string,
  vars: Record<string, string>,
  opts?: ResolveMessageOptions,
): RenderedMessage | null {
  const def = getMessageTemplateDef(id);
  const tpl = effectiveTemplate(id, opts?.doc);
  if (!def || !tpl) return null;
  const merged = enrichVarsWithSharedBlocks(vars, opts?.doc);
  const text = renderTemplateString(tpl.body, merged);
  const subject = tpl.subject ? renderTemplateSubject(tpl.subject, merged) : undefined;
  const html =
    def.channel === "email"
      ? messageHtmlFromTemplate(def, text, subject, merged, opts?.htmlContext)
      : undefined;
  return { subject, text, html };
}

export function validateMessageOverride(
  id: string,
  draft: { subject?: string; body: string },
): ReturnType<typeof validateTemplateDraft> {
  const def = getMessageTemplateDef(id);
  if (!def) return { ok: false, errors: ["Nezināms šablons."] };
  return validateTemplateDraft({
    subject: def.subject != null ? draft.subject : undefined,
    body: draft.body,
    allowedVars: templateAllowedVarKeys(def),
    requiredVars: templateRequiredVarKeys(def),
    maxSubjectLength: 180,
  });
}

export function previewMessage(id: string, partialVars?: Record<string, string>): RenderedMessage | null {
  const def = getMessageTemplateDef(id);
  if (!def) return null;
  const vars = { ...templateSampleVars(def), ...partialVars };
  return resolveMessageSync(id, vars);
}

export function isTemplateOverridden(id: string, doc: MessageTemplatesDoc): boolean {
  return Boolean(doc.overrides[id]?.body?.trim());
}

export function snapshotOverrideFromDraft(
  draft: { subject?: string; body: string },
  updatedBy: string,
): MessageTemplateOverride {
  return {
    subject: draft.subject,
    body: draft.body,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
}
