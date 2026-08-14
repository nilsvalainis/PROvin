/**
 * Aptuvenas AI izmaksas (USD / 1M tokenu). Orientējoši — rēķinam, ne rēķinam.
 * Cache: Anthropic read ≈ 0.1× input, 5 min write ≈ 1.25× input.
 */
export type AiUsageProvider = "anthropic" | "google";

export type AiUsageRecord = {
  provider: AiUsageProvider;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  usdEstimate: number;
};

export type AiUsageSummary = {
  usdEstimate: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  models: string[];
};

export const ADMIN_AI_USAGE_EVENT = "provin-admin-ai-usage";

type Rate = { input: number; output: number };

const MODEL_RATES: Array<{ test: RegExp; rate: Rate }> = [
  { test: /claude-opus/i, rate: { input: 15, output: 75 } },
  { test: /claude-sonnet/i, rate: { input: 3, output: 15 } },
  { test: /claude-haiku/i, rate: { input: 1, output: 5 } },
  { test: /gemini-3.*flash/i, rate: { input: 0.5, output: 3 } },
  { test: /gemini-2\.5-pro/i, rate: { input: 1.25, output: 10 } },
  { test: /gemini-2\.[05]-flash/i, rate: { input: 0.3, output: 2.5 } },
];

const DEFAULT_RATE: Rate = { input: 3, output: 15 };
const CACHE_WRITE_MULT = 1.25;
const CACHE_READ_MULT = 0.1;

export function rateForAiModel(model: string): Rate {
  for (const row of MODEL_RATES) {
    if (row.test.test(model)) return row.rate;
  }
  return DEFAULT_RATE;
}

export function estimateAiUsd(opts: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
}): number {
  const rate = rateForAiModel(opts.model);
  const cacheCreate = opts.cacheCreationInputTokens ?? 0;
  const cacheRead = opts.cacheReadInputTokens ?? 0;
  const usd =
    (opts.inputTokens * rate.input +
      cacheCreate * rate.input * CACHE_WRITE_MULT +
      cacheRead * rate.input * CACHE_READ_MULT +
      opts.outputTokens * rate.output) /
    1_000_000;
  return Math.round(usd * 10_000) / 10_000;
}

export function summarizeAiUsage(records: AiUsageRecord[]): AiUsageSummary {
  const models: string[] = [];
  let usdEstimate = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadInputTokens = 0;
  let cacheCreationInputTokens = 0;
  for (const r of records) {
    usdEstimate += r.usdEstimate;
    inputTokens += r.inputTokens;
    outputTokens += r.outputTokens;
    cacheReadInputTokens += r.cacheReadInputTokens;
    cacheCreationInputTokens += r.cacheCreationInputTokens;
    if (r.model && !models.includes(r.model)) models.push(r.model);
  }
  return {
    usdEstimate: Math.round(usdEstimate * 10_000) / 10_000,
    calls: records.length,
    inputTokens,
    outputTokens,
    cacheReadInputTokens,
    cacheCreationInputTokens,
    models,
  };
}

export function isAiUsageSummary(v: unknown): v is AiUsageSummary {
  if (!v || typeof v !== "object") return false;
  const o = v as AiUsageSummary;
  return typeof o.usdEstimate === "number" && typeof o.calls === "number";
}

export function formatAiUsd(usd: number): string {
  if (usd < 0.001) return "<0,001 $";
  if (usd < 0.01) return `${usd.toFixed(3).replace(".", ",")} $`;
  return `${usd.toFixed(2).replace(".", ",")} $`;
}

export function formatAiUsageLine(usage: AiUsageSummary): string {
  if (usage.calls <= 0) return "";
  const model = usage.models[0] ? usage.models[0].replace(/^models\//, "") : "";
  const cache =
    usage.cacheReadInputTokens > 0 ? ` · kešs ${usage.cacheReadInputTokens.toLocaleString("lv-LV")} tok.` : "";
  const who = model ? ` · ${model}` : "";
  return `≈ ${formatAiUsd(usage.usdEstimate)}${who}${cache}`;
}

export function emitAdminAiUsage(usage: AiUsageSummary): void {
  if (typeof window === "undefined") return;
  if (usage.calls <= 0) return;
  window.dispatchEvent(new CustomEvent(ADMIN_AI_USAGE_EVENT, { detail: usage }));
}
