import "server-only";

import { adminGenerateJsonText } from "@/lib/admin-ai-dispatch";
import { AI_LISTING_PEEK_COMMENT_SYSTEM } from "@/lib/admin-ai-prompts";
import { appendAiOperatorNotesSection } from "@/lib/admin-ai-operator-notes";
import { AiIncompleteCommentError, isAiIncompleteCommentError } from "@/lib/admin-ai-incomplete";
import { extractPartialJsonBoolean, extractPartialJsonString } from "@/lib/admin-ai-json-live-text";
import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";
import {
  LISTING_PEEK_TOPICS,
  assembleListingPeekCustomerComment,
  parseListingPeekAiPayload,
  stripListingPeekMarkdown,
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
    next[id] = t ? applyProvinReportCopyVocabulary(stripListingPeekMarkdown(t)) : "";
  }
  return next;
}

function peekFromPartialJson(raw: string): {
  closer: boolean;
  lines: Record<ListingPeekTopicId, string>;
  letter?: string;
} | null {
  const parsed = parseListingPeekAiPayload(raw);
  if (parsed) return parsed;
  const lines = {
    odometer: extractPartialJsonString(raw, "odometer"),
    incidents: extractPartialJsonString(raw, "incidents"),
    technical: extractPartialJsonString(raw, "technical"),
    seller: extractPartialJsonString(raw, "seller"),
    photos: extractPartialJsonString(raw, "photos"),
  };
  const letter =
    extractPartialJsonString(raw, "letter").trim() || extractPartialJsonString(raw, "text").trim();
  if (!letter && !Object.values(lines).some((v) => v.trim())) return null;
  return {
    closer: extractPartialJsonBoolean(raw, "closer") ?? false,
    lines,
    ...(letter ? { letter } : {}),
  };
}

function finalizePeekPayload(parsed: {
  closer: boolean;
  lines: Record<ListingPeekTopicId, string>;
  letter?: string;
}): { closer: boolean; lines: Record<ListingPeekTopicId, string>; text: string } | null {
  const lines = polishPeekLines(parsed.lines);
  if (!Object.values(lines).some((v) => v.trim()) && !parsed.letter?.trim()) return null;
  const closer = parsed.closer;
  const text = stripListingPeekMarkdown(
    parsed.letter?.trim() || assembleListingPeekCustomerComment({ closer, lines }),
  ).trim();
  if (!text) return null;
  return { closer, lines, text };
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

  let raw: string;
  try {
    raw = await adminGenerateJsonText({
      modelTier: input.modelTier,
      systemInstruction: AI_LISTING_PEEK_COMMENT_SYSTEM,
      userPrompt,
      temperature: 0.25,
    });
  } catch (e) {
    if (isAiIncompleteCommentError(e)) {
      const parsed = peekFromPartialJson(e.partialText);
      const finalized = parsed ? finalizePeekPayload(parsed) : null;
      if (finalized) {
        throw new AiIncompleteCommentError(finalized.text, e.reason, {
          ...finalized.lines,
          closer: finalized.closer,
          text: finalized.text,
        });
      }
    }
    throw e;
  }

  const parsed = peekFromPartialJson(raw);
  const finalized = parsed ? finalizePeekPayload(parsed) : null;
  if (!finalized) throw new Error("ai_invalid_json");
  return finalized;
}
