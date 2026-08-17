import "server-only";

import { NextResponse } from "next/server";
import { isAiIncompleteCommentError } from "@/lib/admin-ai-incomplete";
import { withAiCommentDeltaSink, flushAiCommentDelta } from "@/lib/admin-ai-text-sink";
import { withAiUsageMeter } from "@/lib/ai-usage-meter";
import type { AiUsageSummary } from "@/lib/ai-usage";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

function sseData(obj: object): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

/**
 * Komentāru ģenerēšana: SSE, lai apmaksātais teksts parādās laukā uzreiz.
 * Ja Vercel/proxy nogriež savienojumu, klients jau ir saņēmis deltu.
 */
export async function nextJsonWithAiUsage(fn: () => Promise<string>): Promise<Response> {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let lastText = "";
      const send = (obj: object) => {
        controller.enqueue(encoder.encode(sseData(obj)));
      };
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          /* closed */
        }
      }, 8000);

      try {
        const { result, usage } = await withAiUsageMeter(async () => {
          try {
            const text = await withAiCommentDeltaSink((full) => {
              lastText = full;
              send({ text: full });
            }, fn);
            flushAiCommentDelta();
            return { ok: true as const, text: text.trim() };
          } catch (e) {
            flushAiCommentDelta();
            return { ok: false as const, error: e };
          }
        });
        finishSseComment(send, result, usage, lastText);
      } catch (e) {
        const salvaged = lastText.trim();
        if (salvaged) {
          send({
            error: "ai_incomplete_comment",
            text: salvaged,
            incomplete: true,
            done: true,
          });
        } else {
          send({
            error: "generation_failed",
            detail: e instanceof Error ? e.message : "unknown",
            done: true,
          });
        }
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

function finishSseComment(
  send: (obj: object) => void,
  result:
    | { ok: true; text: string }
    | { ok: false; error: unknown },
  usage: AiUsageSummary,
  lastText: string,
): void {
  const usageField = usage.calls > 0 ? { usage } : {};
  if (result.ok) {
    const text = result.text || lastText.trim();
    if (!text) {
      send({ error: "ai_empty_content", done: true, ...usageField });
      return;
    }
    send({ text, done: true, ...usageField });
    return;
  }
  const e = result.error;
  if (isAiIncompleteCommentError(e) && e.partialText) {
    send({
      error: "ai_incomplete_comment",
      text: e.partialText,
      incomplete: true,
      done: true,
      ...usageField,
    });
    return;
  }
  const salvaged = lastText.trim();
  if (salvaged) {
    send({
      error: "ai_incomplete_comment",
      text: salvaged,
      incomplete: true,
      done: true,
      ...usageField,
    });
    return;
  }
  const msg = e instanceof Error ? e.message : "unknown";
  if (msg === "ai_empty_content" || msg === "ai_empty_content_max_tokens" || msg === "gemini_empty_content") {
    send({ error: msg === "gemini_empty_content" ? "ai_empty_content" : msg, done: true, ...usageField });
    return;
  }
  send({ error: msg, detail: msg, done: true, ...usageField });
}

export async function nextJsonBodyWithAiUsage<T extends object>(
  fn: () => Promise<T>,
): Promise<NextResponse> {
  return withAiUsageOnJsonResponse(async () => {
    try {
      return NextResponse.json(await fn());
    } catch (e) {
      if (isAiIncompleteCommentError(e) && e.partialText) {
        return NextResponse.json(
          {
            error: "ai_incomplete_comment",
            text: e.partialText,
            incomplete: true,
          },
          { status: 422 },
        );
      }
      throw e;
    }
  });
}

/** Palaiž handleru meterā un pievieno `usage` JSON atbildei (arī kļūdām, ja AI jau tērēja tokenus). */
export async function withAiUsageOnJsonResponse(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  const { result, usage } = await withAiUsageMeter(fn);
  if (usage.calls <= 0) return result;
  const ct = result.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) return result;
  try {
    const body: unknown = await result.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return result;
    return NextResponse.json({ ...(body as Record<string, unknown>), usage }, { status: result.status });
  } catch {
    return result;
  }
}
