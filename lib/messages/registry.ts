import { MESSAGE_TEMPLATE_DEFS, MESSAGE_TEMPLATE_IDS } from "@/lib/messages/registry-data";
import { canonicalTemplateId } from "@/lib/messages/template-aliases";
import type { MessageChannel, MessageTemplateDef } from "@/lib/messages/types";

const BY_ID = new Map<string, MessageTemplateDef>(MESSAGE_TEMPLATE_DEFS.map((d) => [d.id, d]));

export { MESSAGE_TEMPLATE_DEFS, MESSAGE_TEMPLATE_IDS };

export function getMessageTemplateDef(id: string): MessageTemplateDef | undefined {
  return BY_ID.get(canonicalTemplateId(id));
}

export function listMessageTemplates(channel?: MessageChannel): MessageTemplateDef[] {
  if (!channel) return MESSAGE_TEMPLATE_DEFS;
  return MESSAGE_TEMPLATE_DEFS.filter((d) => d.channel === channel);
}

export function templateSampleVars(def: MessageTemplateDef): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of def.vars) out[v.key] = v.sample;
  return out;
}

export function templateAllowedVarKeys(def: MessageTemplateDef): string[] {
  return def.vars.map((v) => v.key);
}

export function templateRequiredVarKeys(def: MessageTemplateDef): string[] {
  return def.vars.filter((v) => v.required).map((v) => v.key);
}
