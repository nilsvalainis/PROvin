import { enrichVarsWithSharedBlocks } from "@/lib/messages/shared-block-vars";
import type { MessageTemplatesDoc, MessageTemplateOverride, RenderedMessage } from "@/lib/messages/types";
import {
  getMessageTemplateDef,
  templateAllowedVarKeys,
  templateRequiredVarKeys,
  templateSampleVars,
} from "@/lib/messages/registry";
import { renderTemplateString, renderTemplateSubject, validateTemplateDraft } from "@/lib/messages/render-template";
import { messageHtmlFromTemplate } from "@/lib/messages/email-html-from-template";
import { canonicalTemplateId, templateOverrideBody } from "@/lib/messages/template-aliases";

export type ResolveMessageOptions = {
  doc?: MessageTemplatesDoc | null;
  /** Structured HTML parametri (pielikumi, foto u.c.). */
  htmlContext?: Record<string, unknown>;
};

export { enrichVarsWithSharedBlocks } from "@/lib/messages/shared-block-vars";

function effectiveTemplate(id: string, doc?: MessageTemplatesDoc | null): { subject?: string; body: string } | null {
  const canonical = canonicalTemplateId(id);
  const def = getMessageTemplateDef(canonical);
  if (!def) return null;
  const o = templateOverrideBody(id, doc);
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
  const canonical = canonicalTemplateId(id);
  const def = getMessageTemplateDef(canonical);
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

export function previewMessage(
  id: string,
  partialVars?: Record<string, string>,
  doc?: MessageTemplatesDoc | null,
): RenderedMessage | null {
  const def = getMessageTemplateDef(id);
  if (!def) return null;
  const vars = { ...templateSampleVars(def), ...partialVars };
  return resolveMessageSync(id, vars, { doc });
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
