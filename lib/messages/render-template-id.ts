import { getMessageTemplateDef } from "@/lib/messages/registry";
import { renderTemplateString, renderTemplateSubject } from "@/lib/messages/render-template";
import type { MessageTemplatesDoc } from "@/lib/messages/types";

/** Renderē šablona tekstu/tematu bez shared-block papildinājumiem (drošs klienta importiem). */
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
  return {
    subject: subjectTpl ? renderTemplateSubject(subjectTpl, vars) : undefined,
    text: renderTemplateString(body, vars),
  };
}
