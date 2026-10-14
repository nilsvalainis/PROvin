import "server-only";

import { readMessageTemplatesDoc } from "@/lib/messages/message-templates-store";
import type { MessageTemplatesDoc } from "@/lib/messages/types";

let warmed: MessageTemplatesDoc | null = null;
let warming: Promise<MessageTemplatesDoc> | null = null;

export async function warmMessageTemplatesCache(): Promise<MessageTemplatesDoc> {
  if (warmed) return warmed;
  if (!warming) {
    warming = readMessageTemplatesDoc().then((doc) => {
      warmed = doc;
      warming = null;
      return doc;
    });
  }
  return warming;
}

export function getCachedMessageTemplatesDoc(): MessageTemplatesDoc {
  return warmed ?? { version: 1, overrides: {} };
}

export function resetMessageTemplatesCacheForTests(): void {
  warmed = null;
  warming = null;
}
