import { getMessageTemplateDef } from "@/lib/messages/registry";
import { enrichVarsWithSharedBlocks } from "@/lib/messages/shared-block-vars";
import { renderTemplateString, renderTemplateSubject } from "@/lib/messages/render-template";
import type { MessageTemplatesDoc } from "@/lib/messages/types";

/** Renderē šablona tekstu/tematu (kopīgie bloki tiek ielikti no doc vai noklusējuma). */
export function renderTemplateById(
  id: string,
  vars: Record<string, string>,
  doc?: MessageTemplatesDoc | null,
): { subject?: string; text: string } | null {
  const def = getMessageTemplateDef(id);
  if (!def) return null;
  const override = doc?.overrides[id];
  const body = override?.body ?? def.body;
  const subjectTpl = override?.subject ?? def.subject;
  const merged = enrichVarsWithSharedBlocks(vars, doc);
  return {
    subject: subjectTpl ? renderTemplateSubject(subjectTpl, merged) : undefined,
    text: renderTemplateString(body, merged),
  };
}
