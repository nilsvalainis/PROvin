import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import {
  CLAUDE_MODEL_HAIKU,
  CLAUDE_MODEL_OPUS,
  CLAUDE_MODEL_SONNET,
  aiErrorMessage,
  aiFailoverModels,
  shouldAiModelFailover,
} from "@/lib/ai-model-failover";
import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";
import { toClaudeJsonSchema, type AiJsonSchema } from "@/lib/ai-json-schema";
import { AI_LV_POLISH_SYSTEM } from "@/lib/admin-ai-prompts";
import { recordAiUsage } from "@/lib/ai-usage-meter";
import { PROVIN_AI_PROMPT_VERSION } from "@/lib/ai-prompt-version";
import {
  AiIncompleteCommentError,
  isAiIncompleteCommentError,
  throwIfBlankGeneratedComment,
  throwIncompleteOrEmptyComment,
} from "@/lib/admin-ai-incomplete";
import {
  applyProvinReportCopyVocabulary,
  normalizeProvinExpertAiComment,
} from "@/lib/source-summary-comment-format";
import { emitAiCommentDelta, flushAiCommentDelta } from "@/lib/admin-ai-text-sink";

export {
  CLAUDE_MODEL_HAIKU,
  CLAUDE_MODEL_OPUS,
  CLAUDE_MODEL_SONNET,
  aiFailoverModels,
  isAiTransientError,
} from "@/lib/ai-model-failover";
export type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";
export { parseAiModelTier } from "@/lib/ai-admin-model-tier";

/** Admin izvēlētais modelis: Opus / Sonnet / Haiku. */
export function resolveAiAdminModel(tier?: AiAdminModelTier | null): string {
  if (tier === "lite") return CLAUDE_MODEL_HAIKU;
  if (tier === "flash") return CLAUDE_MODEL_SONNET;
  return CLAUDE_MODEL_OPUS;
}

const LOG_PREFIX = "[admin-ai]";
/** Starp lētāku failover modeli — viena pauze, bez atkārtotas Opus raundas. */
const FAILOVER_STEP_MS = 800;
/**
 * Anthropic `max_tokens` ir kopējais limīts: thinking + redzamais teksts, un tas
 * ir tikai griesti — maksā par faktiski ģenerētajiem tokeniem. Šaurs limits
 * nozīmē, ka thinking to apēd un komentārs paliek tukšs, lai gan nauda jau ir
 * noņemta, tāpēc te vajag telpu, nevis ekonomiju.
 */
const MAX_TOKENS_TEXT = 32_000;
const MAX_TOKENS_JSON = 32_000;
/** Komentāru maršrutu `maxDuration` ir 90s — nogrist ar rezervi atbildes noformēšanai. */
const TEXT_REQUEST_TIMEOUT_MS = 88_000;
/** Web search aģenti (kopsavilkums, riski, pārdevējs) — maršruti ar `maxDuration = 120`. */
const WEB_SEARCH_REQUEST_TIMEOUT_MS = 105_000;
const JSON_REQUEST_TIMEOUT_MS = 150_000;
/** SDK noklusējums PDF/gariem izsaukumiem. */
const REQUEST_TIMEOUT_MS = 180_000;

/** Strukturētā PDF/CSDD ielase — Sonnet; failover iet uz Haiku, ne Opus. */
export const CLAUDE_MODEL_EXTRACT = CLAUDE_MODEL_SONNET;

function claudeSystemWithCache(text: string): Anthropic.TextBlockParam[] {
  return [
    {
      type: "text",
      text,
      cache_control: { type: "ephemeral" },
    },
  ];
}

function logClaudeUsage(label: string, model: string, message: Anthropic.Message): void {
  const u = message.usage;
  const inputTokens = u.input_tokens ?? 0;
  const outputTokens = u.output_tokens ?? 0;
  const cacheCreationInputTokens = u.cache_creation_input_tokens ?? 0;
  const cacheReadInputTokens = u.cache_read_input_tokens ?? 0;
  const thinkingTokens = u.output_tokens_details?.thinking_tokens ?? 0;
  recordAiUsage({
    provider: "anthropic",
    model,
    inputTokens,
    outputTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens,
  });
  console.info(`${LOG_PREFIX} usage`, {
    label,
    model,
    promptVersion: PROVIN_AI_PROMPT_VERSION,
    stopReason: message.stop_reason,
    contentTypes: message.content.map((b) => b.type),
    inputTokens,
    outputTokens,
    thinkingTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens,
  });
}

/**
 * Opus 5 / Sonnet 5: `effort: low` + `thinking: disabled` — adaptive thinking
 * pēc noklusējuma var minūtēm „domāt”, iekasēt tokenus un neatgriezt komentāru,
 * pirms Vercel nogriež maršrutu. Haiku effort/thinking noraida.
 */
function claudeOutputControls(
  model: string,
  schema?: AiJsonSchema,
): {
  output_config?: {
    effort?: "low";
    format?: { type: "json_schema"; schema: Record<string, unknown> };
  };
} {
  const format = schema
    ? { type: "json_schema" as const, schema: toClaudeJsonSchema(schema) }
    : undefined;
  if (model.includes("haiku")) {
    return format ? { output_config: { format } } : {};
  }
  return {
    output_config: {
      effort: "low",
      ...(format ? { format } : {}),
    },
  };
}

function claudeCommentThinking(model: string): { thinking?: { type: "disabled" } } {
  if (model.includes("haiku")) return {};
  return { thinking: { type: "disabled" } };
}

function isThinkingDisabledRejected(e: unknown): boolean {
  return /thinking|effort/i.test(aiErrorMessage(e)) && /disabled|invalid_request|400/i.test(aiErrorMessage(e));
}

export function getAnthropicApiKeyFromEnv(): string | null {
  const k = process.env.ANTHROPIC_API_KEY?.trim();
  return k || null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let cachedClient: { key: string; client: Anthropic } | null = null;

function anthropicClient(key: string): Anthropic {
  if (cachedClient?.key === key) return cachedClient.client;
  const client = new Anthropic({
    apiKey: key,
    // Modeļu failover dara pats; SDK atkārto tikai vienu reizi, lai nesummējas gaidīšana.
    maxRetries: 1,
    timeout: REQUEST_TIMEOUT_MS,
  });
  cachedClient = { key, client };
  return client;
}

/** Izvelk lasāmu kļūdu no Anthropic SDK / fetch atbildes. */
export function formatAiSdkError(e: unknown): string {
  if (e instanceof Error) {
    const msg = e.message.trim();
    const status = (e as { status?: unknown }).status;
    if (status === 401 || /authentication_error|invalid x-api-key/i.test(msg)) {
      return "Nederīga ANTHROPIC_API_KEY";
    }
    if (status === 403 || /permission_error/i.test(msg)) {
      return "ANTHROPIC_API_KEY nav tiesību uz šo modeli — pārbaudi Anthropic Console";
    }
    if (status === 404 || /model.*not.*found|unknown model/i.test(msg)) {
      return `Claude modelis nav pieejams (${msg.match(/claude-[\w.-]+/)?.[0] ?? "model"}) — izmanto ${CLAUDE_MODEL_OPUS} / ${CLAUDE_MODEL_SONNET}`;
    }
    if (status === 429 || /rate_limit_error|rate limit/i.test(msg)) {
      return "Anthropic API limits pārsniegts — uzgaidi vai pārbaudi Anthropic Console billing";
    }
    if (status === 529 || /overloaded/i.test(msg)) {
      return "Claude īslaicīgi pārslogots — mēģini vēlreiz pēc brīža";
    }
    if (/credit balance is too low|billing/i.test(msg)) {
      return "Anthropic kontā nepietiek kredīta — papildini Anthropic Console → Billing";
    }
    if (/ai_incomplete_comment/i.test(msg)) {
      return "Claude komentārs nav pabeigts — tokeni ir apmaksāti. Mēģini vēlreiz, lai pabeigtu.";
    }
    if (/ai_empty_content_max_tokens/i.test(msg)) {
      return "Claude iztērēja tokenu limitu thinking posmā un neatgrieza tekstu — mēģini vēlreiz";
    }
    if (/ai_empty_content/i.test(msg)) {
      return "Claude atgrieza tukšu atbildi — mēģini vēlreiz";
    }
    if (status === 400 && /schema/i.test(msg)) {
      return `Claude noraidīja JSON shēmu: ${msg}`;
    }
    return msg || "unknown";
  }
  return "unknown";
}

/**
 * Mēģina `run(model)` pa failover ķēdi vienu reizi (Opus → Sonnet → Haiku).
 * Vecais 3 raundu cikls pēc timeout vēlreiz palaida Opus — tas iekasēja naudu
 * arī tad, kad lietotājs komentāru neredzēja.
 */
export async function runAiWithModelFailover<T>(opts: {
  primaryModel: string;
  logLabel?: string;
  run: (model: string) => Promise<T>;
}): Promise<T> {
  const key = getAnthropicApiKeyFromEnv();
  if (!key) throw new Error("missing_ai_key");

  const models = aiFailoverModels(opts.primaryModel);
  let lastTransient: unknown = null;
  const startedAt = Date.now();

  for (let i = 0; i < models.length; i++) {
    const model = models[i]!;
    if (i > 0) await sleep(FAILOVER_STEP_MS);
    try {
      const result = await opts.run(model);
      console.info(`${LOG_PREFIX} ok`, {
        label: opts.logLabel ?? "claude",
        promptVersion: PROVIN_AI_PROMPT_VERSION,
        primary: opts.primaryModel,
        used: model,
        failover: model !== opts.primaryModel,
        latencyMs: Date.now() - startedAt,
      });
      return result;
    } catch (e) {
      if (!shouldAiModelFailover(e)) {
        if (isAiIncompleteCommentError(e)) throw e;
        throw new Error(formatAiSdkError(e));
      }
      lastTransient = e;
      console.warn(`${LOG_PREFIX} transient_error`, {
        label: opts.logLabel ?? "claude",
        promptVersion: PROVIN_AI_PROMPT_VERSION,
        model,
        message: aiErrorMessage(e).slice(0, 240),
      });
    }
  }

  throw new Error(formatAiSdkError(lastTransient ?? new Error("ai_unavailable")));
}

export type AiUserPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export { toClaudeJsonSchema } from "@/lib/ai-json-schema";
export type { AiJsonSchema } from "@/lib/ai-json-schema";

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

/** Vienotās `AiUserPart` daļas → Anthropic satura bloki (PDF → document, attēls → image). */
function toContentBlocks(parts: AiUserPart[]): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const part of parts) {
    if ("text" in part) {
      const text = part.text;
      if (text.trim()) blocks.push({ type: "text", text });
      continue;
    }
    const { mimeType, data } = part.inlineData;
    if (mimeType === "application/pdf") {
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data },
      });
      continue;
    }
    if (IMAGE_MIME_TYPES.has(mimeType)) {
      blocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mimeType as Anthropic.Base64ImageSource["media_type"],
          data,
        },
      });
      continue;
    }
    // Pārējais (piem. text/plain) — kā teksta dokuments, lai nezaudē saturu.
    blocks.push({
      type: "document",
      source: { type: "text", media_type: "text/plain", data },
    });
  }
  return blocks;
}

function textFromMessage(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

function requireAssistantText(message: Anthropic.Message): string {
  const text = textFromMessage(message);
  if (message.stop_reason === "max_tokens") {
    throwIncompleteOrEmptyComment(text, "max_tokens");
  }
  if (text) return text;
  throw new Error("ai_empty_content");
}

/** Noņem ```json fences, ja modelis tos pievieno bez shēmas režīmā. */
function stripJsonFences(raw: string): string {
  const t = raw.trim();
  if (!t.startsWith("```")) return t;
  return t
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

const JSON_ONLY_SUFFIX =
  "\n\nATBILDES FORMĀTS: atbildi TIKAI ar vienu validu JSON dokumentu. Bez ```json blokiem, bez paskaidrojumiem pirms vai pēc JSON.";

/**
 * `toClaudeJsonSchema` padara visus laukus obligātus (Anthropic limits neobligātajiem
 * laukiem), tāpēc modelim jāpasaka, ka tukša vērtība — nevis izdomāta — ir pareizā
 * atbilde, kad dati avotā nav atrodami.
 */
const SCHEMA_MISSING_VALUES_SUFFIX =
  "\n\nSHĒMA: visi shēmas lauki ir obligāti. Ja vērtība dokumentā NAV atrodama, atgriez tukšu virkni (\"\"), tukšu masīvu ([]) vai 0 — NEIZDOMĀ un nepārnes vērtības no citiem laukiem vai gadiem.";

async function aiGenerateJsonFromPartsOnce(
  key: string,
  opts: {
    model: string;
    systemInstruction: string;
    parts: AiUserPart[];
    temperature?: number;
    responseSchema?: AiJsonSchema;
    maxTokens?: number;
  },
): Promise<string> {
  const client = anthropicClient(key);
  const hasSchema = Boolean(opts.responseSchema);
  /** Opus 5 / Sonnet 5 noraida `temperature` — 400 invalid_request_error. */
  const message = await client.messages.create(
    {
      model: opts.model,
      max_tokens: opts.maxTokens ?? MAX_TOKENS_JSON,
      system: claudeSystemWithCache(
        hasSchema
          ? `${opts.systemInstruction}${SCHEMA_MISSING_VALUES_SUFFIX}`
          : `${opts.systemInstruction}${JSON_ONLY_SUFFIX}`,
      ),
      messages: [{ role: "user", content: toContentBlocks(opts.parts) }],
      ...claudeOutputControls(opts.model, opts.responseSchema),
    },
    { timeout: JSON_REQUEST_TIMEOUT_MS },
  );

  logClaudeUsage("json", opts.model, message);
  const text = stripJsonFences(requireAssistantText(message));
  if (!text) throw new Error("ai_empty_content");
  return text;
}

/** Strukturēta JSON atbilde. */
export async function aiGenerateJsonText(opts: {
  model: string;
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
  /** Papildus daļas (piem. inline PDF) pirms `userPrompt` teksta. */
  extraParts?: AiUserPart[];
  maxTokens?: number;
}): Promise<string> {
  const parts: AiUserPart[] = [...(opts.extraParts ?? []), { text: opts.userPrompt }];
  return aiGenerateJsonFromParts({
    model: opts.model,
    systemInstruction: opts.systemInstruction,
    parts,
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
  });
}

/**
 * JSON ģenerēšana ar modeļu failover (Opus → Sonnet → Haiku), vienu reizi.
 * Ja Claude noraida shēmu (pārāk sarežģīta), atkāpjas uz prompt bāzētu JSON.
 */
export async function aiGenerateJsonFromParts(opts: {
  model: string;
  systemInstruction: string;
  parts: AiUserPart[];
  temperature?: number;
  responseSchema?: AiJsonSchema;
  maxTokens?: number;
}): Promise<string> {
  const key = getAnthropicApiKeyFromEnv();
  if (!key) throw new Error("missing_ai_key");

  try {
    return await runAiWithModelFailover({
      primaryModel: opts.model,
      logLabel: "json",
      run: (model) => aiGenerateJsonFromPartsOnce(key, { ...opts, model }),
    });
  } catch (e) {
    if (!opts.responseSchema || !/shēmu|schema/i.test(aiErrorMessage(e))) throw e;
    console.warn(`${LOG_PREFIX} schema_fallback`, {
      promptVersion: PROVIN_AI_PROMPT_VERSION,
      message: aiErrorMessage(e).slice(0, 240),
    });
    return runAiWithModelFailover({
      primaryModel: opts.model,
      logLabel: "json_no_schema",
      run: (model) =>
        aiGenerateJsonFromPartsOnce(key, { ...opts, model, responseSchema: undefined }),
    });
  }
}

/** Structured Outputs — obligāts JSON atbilstoši responseSchema. */
export async function aiGenerateJsonWithSchema(opts: {
  model: string;
  systemInstruction: string;
  parts: AiUserPart[];
  responseSchema: AiJsonSchema;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  return aiGenerateJsonFromParts({
    ...opts,
    temperature: opts.temperature ?? 0,
  });
}

/**
 * Straumē tekstu, nevis gaida vienu atbildi. Ja pieprasījums nogriežas (timeout,
 * savienojums), jau ģenerētais teksts ir apmaksāts — to atgriež, nevis izmet.
 * Komentāriem thinking ir izslēgts: citādi Opus 5 iekasē par „domāšanu” un
 * lauks paliek tukšs.
 */
async function claudeStreamText(
  client: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming,
  opts: { label: string; timeoutMs: number },
): Promise<string> {
  const withThinkingOff: Anthropic.MessageCreateParamsNonStreaming = {
    ...params,
    ...claudeCommentThinking(params.model),
  };
  try {
    return await claudeStreamTextOnce(client, withThinkingOff, opts);
  } catch (e) {
    if (isAiIncompleteCommentError(e) || !isThinkingDisabledRejected(e)) throw e;
    console.warn(`${LOG_PREFIX} thinking_disabled_rejected`, {
      label: opts.label,
      model: params.model,
      promptVersion: PROVIN_AI_PROMPT_VERSION,
      message: aiErrorMessage(e).slice(0, 240),
    });
    return claudeStreamTextOnce(client, params, opts);
  }
}

async function claudeStreamTextOnce(
  client: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming,
  opts: { label: string; timeoutMs: number },
): Promise<string> {
  const stream = client.messages.stream(params, { timeout: opts.timeoutMs });
  let partial = "";
  stream.on("text", (delta) => {
    partial += delta;
    emitAiCommentDelta(partial);
  });
  // Bez šī klausītāja straumes kļūda kļūst par neapstrādātu notikumu; `finalMessage()` to tāpat noraida.
  stream.on("error", () => {});

  const abortTimer = setTimeout(() => {
    try {
      stream.abort();
    } catch {
      /* already closed */
    }
  }, opts.timeoutMs);

  try {
    const message = await stream.finalMessage();
    logClaudeUsage(opts.label, params.model, message);
    const text = requireAssistantText(message);
    emitAiCommentDelta(text, true);
    flushAiCommentDelta();
    return text;
  } catch (e) {
    flushAiCommentDelta();
    const salvaged = partial.trim();
    if (!salvaged) throw e;
    emitAiCommentDelta(salvaged, true);
    console.warn(`${LOG_PREFIX} partial_text_salvaged`, {
      label: opts.label,
      model: params.model,
      promptVersion: PROVIN_AI_PROMPT_VERSION,
      chars: salvaged.length,
      message: aiErrorMessage(e).slice(0, 240),
    });
    throw new AiIncompleteCommentError(salvaged, "timeout");
  } finally {
    clearTimeout(abortTimer);
  }
}

async function aiGenerateTextOnce(
  key: string,
  opts: {
    model: string;
    systemInstruction: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
  },
): Promise<string> {
  return claudeStreamText(
    anthropicClient(key),
    {
      model: opts.model,
      max_tokens: opts.maxTokens ?? MAX_TOKENS_TEXT,
      system: claudeSystemWithCache(opts.systemInstruction),
      messages: [{ role: "user", content: opts.userPrompt }],
      ...claudeOutputControls(opts.model),
    },
    { label: "text", timeoutMs: TEXT_REQUEST_TIMEOUT_MS },
  );
}

/** Brīva teksta ģenerēšana ar automātisku modeļu failover (529 u.c.). */
export async function aiGenerateText(opts: {
  model: string;
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const key = getAnthropicApiKeyFromEnv();
  if (!key) throw new Error("missing_ai_key");

  return runAiWithModelFailover({
    primaryModel: opts.model,
    logLabel: "text",
    run: async (model) =>
      polishHaikuLatvianProse(model, await aiGenerateTextOnce(key, { ...opts, model })),
  });
}

/**
 * Haiku neder latviešu eksperta prozai (gramatika/stils). Ģenerē lēti, tad Sonnet
 * slīpē tikai īso izejas tekstu — nevis visu pasūtījuma kontekstu.
 */
async function polishHaikuLatvianProse(model: string, text: string): Promise<string> {
  const t = text.trim();
  if (!t || model !== CLAUDE_MODEL_HAIKU) return text;
  try {
    const key = getAnthropicApiKeyFromEnv();
    if (!key) return text;
    const polished = await aiGenerateTextOnce(key, {
      model: CLAUDE_MODEL_SONNET,
      systemInstruction: AI_LV_POLISH_SYSTEM,
      userPrompt: t,
    });
    return polished.trim() || text;
  } catch (e) {
    console.warn(`${LOG_PREFIX} haiku_lv_polish_failed`, {
      promptVersion: PROVIN_AI_PROMPT_VERSION,
      message: aiErrorMessage(e).slice(0, 240),
    });
    return text;
  }
}

/** Eksperta PDF komentāri — pēc ģenerēšanas normalizē vārdu krājumu un rindkopu formātu. */
export async function aiGenerateExpertText(opts: {
  model: string;
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
  maxLen?: number;
  maxTokens?: number;
}): Promise<string> {
  try {
    const raw = await aiGenerateText(opts);
    return throwIfBlankGeneratedComment(normalizeProvinExpertAiComment(raw));
  } catch (e) {
    if (isAiIncompleteCommentError(e)) {
      throw new AiIncompleteCommentError(
        throwIfBlankGeneratedComment(normalizeProvinExpertAiComment(e.partialText)),
        e.reason,
      );
    }
    throw e;
  }
}

/** Vārdu krājums bez rindkopu pārformatēšanas — e-pasts, checklist u.c. */
export async function aiGenerateTextWithVocabulary(opts: {
  model: string;
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  try {
    const raw = await aiGenerateText(opts);
    return throwIfBlankGeneratedComment(applyProvinReportCopyVocabulary(raw));
  } catch (e) {
    if (isAiIncompleteCommentError(e)) {
      throw new AiIncompleteCommentError(
        throwIfBlankGeneratedComment(applyProvinReportCopyVocabulary(e.partialText)),
        e.reason,
      );
    }
    throw e;
  }
}

/**
 * Cik meklējumu drīkst vienā tirgus/cenas analīzē ($0,01 par meklējumu). Katrs
 * meklējums arī pagarina izsaukumu, tāpēc seši mēdza neiekļauties maršruta laikā —
 * teksts nepienāca, bet meklējumi un tokeni jau bija apmaksāti.
 */
const WEB_SEARCH_MAX_USES = 4;

/**
 * Claude `web_search` noraida ISO kodu `LV` (400: Country code LV is not supported).
 * Pilsēta + laika josla lokalizē rezultātus bez valsts koda.
 */
const WEB_SEARCH_USER_LOCATION = {
  type: "approximate" as const,
  city: "Riga",
  timezone: "Europe/Riga",
};

async function aiGenerateTextWithWebSearchOnce(
  key: string,
  opts: {
    model: string;
    systemInstruction: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
    maxSearches?: number;
  },
): Promise<string> {
  return claudeStreamText(
    anthropicClient(key),
    {
      model: opts.model,
      max_tokens: opts.maxTokens ?? MAX_TOKENS_TEXT,
      system: claudeSystemWithCache(opts.systemInstruction),
      messages: [{ role: "user", content: opts.userPrompt }],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: opts.maxSearches ?? WEB_SEARCH_MAX_USES,
          user_location: WEB_SEARCH_USER_LOCATION,
        },
      ],
      ...claudeOutputControls(opts.model),
    },
    { label: "web_search", timeoutMs: WEB_SEARCH_REQUEST_TIMEOUT_MS },
  );
}

/** Web meklēšana (Claude server-side tool) — tirgus un cenu analīzei ar modeļu failover. */
export async function aiGenerateTextWithWebSearch(opts: {
  model: string;
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  maxSearches?: number;
}): Promise<string> {
  const key = getAnthropicApiKeyFromEnv();
  if (!key) throw new Error("missing_ai_key");

  return runAiWithModelFailover({
    primaryModel: opts.model,
    logLabel: "web_search",
    run: async (model) =>
      polishHaikuLatvianProse(
        model,
        await aiGenerateTextWithWebSearchOnce(key, { ...opts, model }),
      ),
  });
}
