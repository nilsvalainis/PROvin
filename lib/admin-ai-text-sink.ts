import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Live comment deltas for admin ✨ SSE. Generation helpers emit here without
 * threading callbacks through every field function.
 */
type Sink = {
  onDelta: (fullText: string) => void;
  lastEmitMs: number;
  pending?: string;
};

const storage = new AsyncLocalStorage<Sink>();

export function withAiCommentDeltaSink<T>(
  onDelta: (fullText: string) => void,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run({ onDelta, lastEmitMs: 0 }, fn);
}

export function emitAiCommentDelta(fullText: string, force = false): void {
  const sink = storage.getStore();
  if (!sink || !fullText) return;
  const now = Date.now();
  if (!force && sink.lastEmitMs > 0 && now - sink.lastEmitMs < 40) {
    sink.pending = fullText;
    return;
  }
  sink.lastEmitMs = now;
  sink.pending = undefined;
  sink.onDelta(fullText);
}

export function flushAiCommentDelta(): void {
  const sink = storage.getStore();
  if (!sink?.pending) return;
  sink.lastEmitMs = Date.now();
  const text = sink.pending;
  sink.pending = undefined;
  sink.onDelta(text);
}
