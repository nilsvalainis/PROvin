import "server-only";

import { adminGenerateJsonText } from "@/lib/admin-ai-dispatch";
import { AI_LISTING_PEEK_COMMENT_SYSTEM } from "@/lib/admin-ai-prompts";
import { appendAiOperatorNotesSection } from "@/lib/admin-ai-operator-notes";
import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";
import {
  LISTING_PEEK_TOPICS,
  assembleListingPeekCustomerComment,
  parseListingPeekAiPayload,
  type ListingPeekTopicId,
} from "@/lib/listing-peek-comment-presets";
import { fetchListingAiSnapshot, formatListingAiSnapshotForAi } from "@/lib/listing-scrape";
import { applyProvinReportCopyVocabulary } from "@/lib/source-summary-comment-format";

function listingPeekPhraseBank(): string {
  return LISTING_PEEK_TOPICS.map((topic) => {
    const phrases = topic.phrases.map((p) => `- ${p.tone} (${p.label}): ${p.text}`).join("\n");
    return `${topic.title} (${topic.id}):\n${phrases}`;
  }).join("\n\n");
}

function polishPeekLines(lines: Record<ListingPeekTopicId, string>): Record<ListingPeekTopicId, string> {
  const next = { ...lines };
  for (const id of Object.keys(next) as ListingPeekTopicId[]) {
    const t = next[id]?.trim();
    next[id] = t ? applyProvinReportCopyVocabulary(t) : "";
  }
  return next;
}

export async function generateListingPeekCommentWithAi(input: {
  listingUrl: string;
  operatorNotes?: string;
  existingDraftPlain?: string;
  modelTier?: AiAdminModelTier | null;
}): Promise<{
  closer: boolean;
  lines: Record<ListingPeekTopicId, string>;
  text: string;
}> {
  const listingUrl = input.listingUrl.trim();
  if (!listingUrl) throw new Error("empty_order_context");

  const snapshot = await fetchListingAiSnapshot(listingUrl);
  const listingBlock = formatListingAiSnapshotForAi(snapshot);

  const userPrompt = appendAiOperatorNotesSection(
    [
      `Sludinājuma saite: ${listingUrl}`,
      "",
      listingBlock,
      "",
      "Sagatavju frāzes (drīksti izmantot vārds vārdā, ja der):",
      listingPeekPhraseBank(),
      "",
      "Atbildi tikai ar JSON (odometer, incidents, technical, seller, photos, closer, letter).",
      "letter ir pilnā klienta vēstule — saglabā operatora specifiskos teikumus no melnraksta.",
    ].join("\n"),
    {
      operatorNotes: input.operatorNotes,
      existingDraftPlain: input.existingDraftPlain,
    },
  );

  const raw = await adminGenerateJsonText({
    modelTier: input.modelTier,
    systemInstruction: AI_LISTING_PEEK_COMMENT_SYSTEM,
    userPrompt,
    temperature: 0.25,
  });

  const parsed = parseListingPeekAiPayload(raw);
  if (!parsed) throw new Error("ai_invalid_json");
  const lines = polishPeekLines(parsed.lines);
  if (!Object.values(lines).some((v) => v.trim()) && !parsed.letter?.trim()) {
    throw new Error("ai_invalid_json");
  }

  const closer = parsed.closer;
  const text = (parsed.letter?.trim() || assembleListingPeekCustomerComment({ closer, lines })).trim();
  if (!text) throw new Error("ai_invalid_json");
  return {
    closer,
    lines,
    text,
  };
}
