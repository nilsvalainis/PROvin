import "server-only";

import { isAiIncompleteCommentError } from "@/lib/admin-ai-incomplete";
import { withAiUsageMeter } from "@/lib/ai-usage-meter";
import {
  AI_STREAM_CONTENT_TYPE,
  encodeAiStreamEvent,
  type AiStreamEvent,
  type AiTextStream,
} from "@/lib/ai-text-stream";

/**
 * ✨ maršruts kā SSE straume.
 *
 * Operators redz tekstu, kamēr modelis to raksta, nevis tukšu ekrānu minūti.
 * Deltas ir priekšskatījums; laukā tiek ielikts tikai `done.text` (vai nepabeigtā
 * gadījumā `error.text`), kas jau izgājis vārdu krājuma un € pēcapstrādi.
 */
export function aiStreamResponse(
  run: (stream: AiTextStream) => Promise<string>,
  onError: (e: unknown) => { error: string; detail?: string },
): Response {
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: AiStreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeAiStreamEvent(event)));
        } catch {
          closed = true;
        }
      };

      const { result, usage } = await withAiUsageMeter(async (): Promise<AiStreamEvent> => {
        try {
          const text = (await run({
            onDelta: (chunk) => send({ type: "delta", text: chunk }),
            onRestart: () => send({ type: "restart" }),
          })).trim();
          if (!text) return { type: "error", error: "ai_empty_content" };
          return { type: "done", text };
        } catch (e) {
          if (isAiIncompleteCommentError(e) && e.partialText) {
            return {
              type: "error",
              error: "ai_incomplete_comment",
              text: e.partialText,
              incomplete: true,
            };
          }
          return { type: "error", ...onError(e) };
        }
      });

      if (usage.calls > 0 && (result.type === "done" || result.type === "error")) {
        send({ ...result, usage });
      } else {
        send(result);
      }
      closed = true;
      controller.close();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": `${AI_STREAM_CONTENT_TYPE}; charset=utf-8`,
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Vercel/nginx buferizācija noslauka straumēšanas jēgu.
      "X-Accel-Buffering": "no",
    },
  });
}

/** Vai klients gaida SSE straumi (jaunais admin UI) vai veco JSON atbildi. */
export function wantsAiStream(req: Request): boolean {
  return (req.headers.get("accept") ?? "").includes(AI_STREAM_CONTENT_TYPE);
}
