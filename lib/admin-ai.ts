import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import {
  CLAUDE_MODEL_OPUS,
  CLAUDE_MODEL_SONNET,
  aiErrorMessage,
  aiFailoverModels,
  isAiTransientError,
} from "@/lib/ai-model-failover";
import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";
import { toClaudeJsonSchema, type AiJsonSchema } from "@/lib/ai-json-schema";
import { PROVIN_AI_PROMPT_VERSION } from "@/lib/ai-prompt-version";
import {
  applyProvinReportCopyVocabulary,
  normalizeProvinExpertAiComment,
} from "@/lib/source-summary-comment-format";

export {
  CLAUDE_MODEL_HAIKU,
  CLAUDE_MODEL_OPUS,
  CLAUDE_MODEL_SONNET,
  aiFailoverModels,
  isAiTransientError,
} from "@/lib/ai-model-failover";
export type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";
export { parseAiModelTier } from "@/lib/ai-admin-model-tier";

/** Admin izvēlētais modelis — Opus (dziļā analīze) vai Sonnet (ātrāks). */
export function resolveAiAdminModel(tier?: AiAdminModelTier | null): string {
  return tier === "flash" ? CLAUDE_MODEL_SONNET : CLAUDE_MODEL_OPUS;
}

const LOG_PREFIX = "[admin-ai]";
/** Pilna modeļu kārta katrā retry raundā; starp raundiem — exponential backoff. */
const FAILOVER_BACKOFF_MS = [0, 1_000, 2_500] as const;
/**
 * Anthropic prasa `max_tokens`. Rēķina tikai faktiski ģenerētos tokenus, tāpēc JSON
 * limits ir dāsns — nogriezta atbilde shēmas režīmā būtu nevalīds JSON (blīvas CSDD
 * atskaites ar daudzām apskatēm mēdz būt garas).
 */
const MAX_TOKENS_TEXT = 8_000;
const MAX_TOKENS_JSON = 32_000;
/** Serverless timeout — nokrist pirms platformas limita, lai kļūda ir lasāma. */
const REQUEST_TIMEOUT_MS = 180_000;

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
    if (status === 400 && /schema/i.test(msg)) {
      return `Claude noraidīja JSON shēmu: ${msg}`;
    }
    return msg || "unknown";
  }
  return "unknown";
}

/**
 * Mēģina `run(model)` pa failover modeļiem; pagaidu kļūdās pārslēdzas bez lietotāja kļūdas.
 * Līdz 3 raundi × 3 modeļi (Opus → Sonnet → Haiku) ar backoff.
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

  for (let round = 0; round < FAILOVER_BACKOFF_MS.length; round++) {
    const delayMs = FAILOVER_BACKOFF_MS[round];
    if (delayMs > 0) {
      console.warn(`${LOG_PREFIX} backoff_retry`, {
        label: opts.logLabel ?? "claude",
        promptVersion: PROVIN_AI_PROMPT_VERSION,
        round,
        delayMs,
        models,
      });
      await sleep(delayMs);
    }

    for (const model of models) {
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
        if (!isAiTransientError(e)) {
          throw new Error(formatAiSdkError(e));
        }
        lastTransient = e;
        console.warn(`${LOG_PREFIX} transient_error`, {
          label: opts.logLabel ?? "claude",
          promptVersion: PROVIN_AI_PROMPT_VERSION,
          round,
          model,
          message: aiErrorMessage(e).slice(0, 240),
        });
      }
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
  const message = await client.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? MAX_TOKENS_JSON,
    system: hasSchema
      ? `${opts.systemInstruction}${SCHEMA_MISSING_VALUES_SUFFIX}`
      : `${opts.systemInstruction}${JSON_ONLY_SUFFIX}`,
    messages: [{ role: "user", content: toContentBlocks(opts.parts) }],
    ...(opts.responseSchema
      ? {
          output_config: {
            format: { type: "json_schema" as const, schema: toClaudeJsonSchema(opts.responseSchema) },
          },
        }
      : {}),
  });

  const text = stripJsonFences(textFromMessage(message));
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
 * JSON ģenerēšana ar modeļu failover (Opus ↔ Sonnet ↔ Haiku) un backoff.
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
  const client = anthropicClient(key);
  const message = await client.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? MAX_TOKENS_TEXT,
    system: opts.systemInstruction,
    messages: [{ role: "user", content: opts.userPrompt }],
  });
  const text = textFromMessage(message);
  if (!text) throw new Error("ai_empty_content");
  return text;
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
    run: (model) => aiGenerateTextOnce(key, { ...opts, model }),
  });
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
  const raw = await aiGenerateText(opts);
  return normalizeProvinExpertAiComment(raw, opts.maxLen ?? 2400);
}

/** Vārdu krājums bez rindkopu pārformatēšanas — e-pasts, checklist u.c. */
export async function aiGenerateTextWithVocabulary(opts: {
  model: string;
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const raw = await aiGenerateText(opts);
  return applyProvinReportCopyVocabulary(raw);
}

/** Cik meklējumu drīkst vienā tirgus/cenas analīzē ($0,01 par meklējumu). */
const WEB_SEARCH_MAX_USES = 6;

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
  const client = anthropicClient(key);
  const message = await client.messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? MAX_TOKENS_TEXT,
    system: opts.systemInstruction,
    messages: [{ role: "user", content: opts.userPrompt }],
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: opts.maxSearches ?? WEB_SEARCH_MAX_USES,
        user_location: WEB_SEARCH_USER_LOCATION,
      },
    ],
  });

  const text = textFromMessage(message);
  if (!text) throw new Error("ai_empty_content");
  return text;
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
    run: (model) => aiGenerateTextWithWebSearchOnce(key, { ...opts, model }),
  });
}
