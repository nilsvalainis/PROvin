import "server-only";

import { GoogleGenerativeAI, type Schema } from "@google/generative-ai";

/** Admin ✨ ģenerēšana — vienmēr maksas režīms (2.5 Pro). Flash atstāts tikai atsaucēm / dokumentācijai. */
export const GEMINI_MODEL_PRO = "gemini-2.5-pro";
/** @deprecated Admin ģenerēšanai izmanto GEMINI_MODEL_PRO. */
export const GEMINI_MODEL_FLASH = "gemini-2.5-flash";
/** @deprecated Admin failover — tikai Pro (maksas). */
export const GEMINI_MODEL_FLASH_FALLBACK = "gemini-2.5-pro";

export function getGeminiApiKeyFromEnv(): string | null {
  const k = process.env.GEMINI_API_KEY?.trim();
  return k || null;
}

const LOG_PREFIX = "[admin-gemini]";
const FAILOVER_BACKOFF_MS = 1000;

function geminiErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message.trim();
  return String(e).trim();
}

/** Pagaidu kļūdas — modeļa failover + atkārtots mēģinājums (503, kvota, timeout). */
export function isGeminiTransientError(e: unknown): boolean {
  const msg = geminiErrorMessage(e);
  if (!msg) return false;
  return /503|429|500|502|504|UNAVAILABLE|RESOURCE_EXHAUSTED|SERVICE_UNAVAILABLE|rate\s*limit|quota|high\s+demand|experiencing\s+high\s+demand|overloaded|temporarily\s+unavailable|timeout|DEADLINE_EXCEEDED|ECONNRESET|ETIMEDOUT|fetch\s+failed|too\s+many\s+requests/i.test(
    msg,
  );
}

function isTransientHttpStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function alternateModel(primary: string): string {
  void primary;
  return GEMINI_MODEL_PRO;
}

/** Secība: pieprasītais Pro → atkārtots Pro mēģinājums transient kļūdām. */
export function geminiFailoverModels(primary: string): string[] {
  const pro = GEMINI_MODEL_PRO;
  const out: string[] = [];
  const add = (m: string) => {
    const t = m.trim();
    if (t && !out.includes(t)) out.push(t);
  };
  add(primary.includes("pro") ? primary : pro);
  add(pro);
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Izvelk lasāmu kļūdu no Google Generative AI SDK / fetch atbildes. */
export function formatGeminiSdkError(e: unknown): string {
  if (e instanceof Error) {
    const msg = e.message.trim();
    if (/404.*models\/gemini|is not found for API version/i.test(msg)) {
      return `Gemini modelis nav pieejams (${msg.match(/models\/[^\s:]+/)?.[0] ?? "model"}) — izmanto gemini-2.5-flash / gemini-2.5-pro`;
    }
    if (/429|quota|rate limit|RESOURCE_EXHAUSTED/i.test(msg)) {
      return "Gemini API kvota pārsniegta — uzgaidi vai pārbaudi Google AI Studio billing";
    }
    if (/503|high\s+demand|SERVICE_UNAVAILABLE/i.test(msg)) {
      return "Gemini īslaicīgi pārslogots — mēģini vēlreiz pēc brīža";
    }
    if (/API key not valid|API_KEY_INVALID|invalid.*api.?key/i.test(msg)) {
      return "Nederīga GEMINI_API_KEY";
    }
    return msg || "unknown";
  }
  return "unknown";
}

/**
 * Mēģina `run(model)` pa failover modeļiem; pagaidu kļūdās pārslēdzas bez lietotāja kļūdas.
 */
export async function runGeminiWithModelFailover<T>(opts: {
  primaryModel: string;
  logLabel?: string;
  run: (model: string) => Promise<T>;
}): Promise<T> {
  const key = getGeminiApiKeyFromEnv();
  if (!key) throw new Error("missing_gemini_key");

  const models = geminiFailoverModels(opts.primaryModel);
  let lastTransient: unknown = null;

  const tryAll = async (round: "initial" | "retry") => {
    for (const model of models) {
      try {
        const result = await opts.run(model);
        if (model !== opts.primaryModel) {
          console.info(`${LOG_PREFIX} failover_ok`, {
            label: opts.logLabel ?? "gemini",
            round,
            primary: opts.primaryModel,
            used: model,
          });
        }
        return result;
      } catch (e) {
        if (!isGeminiTransientError(e)) {
          throw new Error(formatGeminiSdkError(e));
        }
        lastTransient = e;
        console.warn(`${LOG_PREFIX} transient_error`, {
          label: opts.logLabel ?? "gemini",
          round,
          model,
          message: geminiErrorMessage(e).slice(0, 240),
        });
      }
    }
    return null;
  };

  const first = await tryAll("initial");
  if (first !== null) return first;

  console.warn(`${LOG_PREFIX} backoff_retry`, {
    label: opts.logLabel ?? "gemini",
    delayMs: FAILOVER_BACKOFF_MS,
    models,
  });
  await sleep(FAILOVER_BACKOFF_MS);

  const second = await tryAll("retry");
  if (second !== null) return second;

  throw new Error(formatGeminiSdkError(lastTransient ?? new Error("gemini_unavailable")));
}

export type GeminiUserPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

/** JSON Schema priekš Gemini Structured Outputs (responseSchema). */
export type GeminiJsonSchema = Schema;

async function geminiGenerateJsonFromPartsOnce(
  key: string,
  opts: {
    model: string;
    systemInstruction: string;
    parts: GeminiUserPart[];
    temperature?: number;
    responseSchema?: GeminiJsonSchema;
  },
): Promise<string> {
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: opts.model,
    systemInstruction: opts.systemInstruction,
  });
  const result = await model.generateContent({
    contents: [{ role: "user", parts: opts.parts }],
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      responseMimeType: "application/json",
      ...(opts.responseSchema ? { responseSchema: opts.responseSchema } : {}),
    },
  });
  const text = result.response.text()?.trim();
  if (!text) throw new Error("gemini_empty_content");
  return text;
}

/** Strukturēta JSON atbilde (responseMimeType application/json). */
export async function geminiGenerateJsonText(opts: {
  model: string;
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
  /** Papildus daļas (piem. inline PDF) pirms `userPrompt` teksta. */
  extraParts?: GeminiUserPart[];
}): Promise<string> {
  const parts: GeminiUserPart[] = [...(opts.extraParts ?? []), { text: opts.userPrompt }];
  return geminiGenerateJsonFromParts({
    model: opts.model,
    systemInstruction: opts.systemInstruction,
    parts,
    temperature: opts.temperature,
  });
}

/**
 * JSON ģenerēšana ar modeļu failover (2.5 flash ↔ pro ↔ 2.0 flash) un backoff.
 */
export async function geminiGenerateJsonFromParts(opts: {
  model: string;
  systemInstruction: string;
  parts: GeminiUserPart[];
  temperature?: number;
  responseSchema?: GeminiJsonSchema;
}): Promise<string> {
  const key = getGeminiApiKeyFromEnv();
  if (!key) throw new Error("missing_gemini_key");

  return runGeminiWithModelFailover({
    primaryModel: opts.model,
    logLabel: "json",
    run: (model) => geminiGenerateJsonFromPartsOnce(key, { ...opts, model }),
  });
}

/** Structured Outputs — obligāts JSON atbilstoši responseSchema. */
export async function geminiGenerateJsonWithSchema(opts: {
  model: string;
  systemInstruction: string;
  parts: GeminiUserPart[];
  responseSchema: GeminiJsonSchema;
  temperature?: number;
}): Promise<string> {
  return geminiGenerateJsonFromParts({
    ...opts,
    temperature: opts.temperature ?? 0,
  });
}

async function geminiGenerateTextOnce(
  key: string,
  opts: {
    model: string;
    systemInstruction: string;
    userPrompt: string;
    temperature?: number;
  },
): Promise<string> {
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: opts.model,
    systemInstruction: opts.systemInstruction,
  });
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: opts.userPrompt }] }],
    generationConfig: { temperature: opts.temperature ?? 0.35 },
  });
  const text = result.response.text()?.trim();
  if (!text) throw new Error("gemini_empty_content");
  return text;
}

/** Brīva teksta ģenerēšana ar automātisku modeļu failover (503 u.c.). */
export async function geminiGenerateText(opts: {
  model: string;
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
}): Promise<string> {
  const key = getGeminiApiKeyFromEnv();
  if (!key) throw new Error("missing_gemini_key");

  return runGeminiWithModelFailover({
    primaryModel: opts.model,
    logLabel: "text",
    run: (model) => geminiGenerateTextOnce(key, { ...opts, model }),
  });
}

type GenerateContentApiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
};

async function geminiGenerateTextWithGoogleSearchOnce(
  key: string,
  opts: {
    model: string;
    systemInstruction: string;
    userPrompt: string;
    temperature?: number;
  },
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent?key=${encodeURIComponent(key)}`;
  const toolVariants: Record<string, unknown>[][] = [[{ google_search: {} }], [{ googleSearch: {} }]];

  let lastErr = "gemini_grounding_failed";
  for (const tools of toolVariants) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: opts.userPrompt }] }],
        tools,
        generationConfig: { temperature: opts.temperature ?? 0.35 },
      }),
    });
    const raw = (await res.json()) as GenerateContentApiResponse;
    if (!res.ok) {
      lastErr = raw.error?.message?.trim() || `http_${res.status}`;
      if (isTransientHttpStatus(res.status)) {
        throw new Error(`[${res.status} Service Unavailable] ${lastErr}`);
      }
      continue;
    }
    const text = raw.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
    if (text) return text;
    lastErr = "gemini_empty_content";
  }
  throw new Error(lastErr);
}

/** Google Search Grounding — REST v1beta ar modeļu failover. */
export async function geminiGenerateTextWithGoogleSearch(opts: {
  model: string;
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
}): Promise<string> {
  const key = getGeminiApiKeyFromEnv();
  if (!key) throw new Error("missing_gemini_key");

  return runGeminiWithModelFailover({
    primaryModel: opts.model,
    logLabel: "grounding",
    run: (model) => geminiGenerateTextWithGoogleSearchOnce(key, { ...opts, model }),
  });
}
