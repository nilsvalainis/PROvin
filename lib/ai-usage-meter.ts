import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import {
  estimateAiUsd,
  summarizeAiUsage,
  type AiUsageProvider,
  type AiUsageRecord,
  type AiUsageSummary,
} from "@/lib/ai-usage";

type Bag = { records: AiUsageRecord[] };

const storage = new AsyncLocalStorage<Bag>();

export function recordAiUsage(opts: {
  provider: AiUsageProvider;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
}): void {
  const inputTokens = Math.max(0, opts.inputTokens ?? 0);
  const outputTokens = Math.max(0, opts.outputTokens ?? 0);
  const cacheCreationInputTokens = Math.max(0, opts.cacheCreationInputTokens ?? 0);
  const cacheReadInputTokens = Math.max(0, opts.cacheReadInputTokens ?? 0);
  if (inputTokens + outputTokens + cacheCreationInputTokens + cacheReadInputTokens === 0) return;

  const rec: AiUsageRecord = {
    provider: opts.provider,
    model: opts.model,
    inputTokens,
    outputTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens,
    usdEstimate: estimateAiUsd({
      model: opts.model,
      inputTokens,
      outputTokens,
      cacheCreationInputTokens,
      cacheReadInputTokens,
    }),
  };
  storage.getStore()?.records.push(rec);
  console.info("[ai-usage]", {
    provider: rec.provider,
    model: rec.model,
    inputTokens: rec.inputTokens,
    outputTokens: rec.outputTokens,
    cacheReadInputTokens: rec.cacheReadInputTokens,
    cacheCreationInputTokens: rec.cacheCreationInputTokens,
    usdEstimate: rec.usdEstimate,
  });
}

export async function withAiUsageMeter<T>(fn: () => Promise<T>): Promise<{ result: T; usage: AiUsageSummary }> {
  const existing = storage.getStore();
  if (existing) {
    const from = existing.records.length;
    const result = await fn();
    return { result, usage: summarizeAiUsage(existing.records.slice(from)) };
  }
  const bag: Bag = { records: [] };
  return storage.run(bag, async () => {
    const result = await fn();
    return { result, usage: summarizeAiUsage(bag.records) };
  });
}
