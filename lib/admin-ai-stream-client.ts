/** ✨ pieprasījums: JSON (preview nav vajadzīgs). SSE paliek kā atkāpe, ja maršruts to joprojām sūta. */
import {
  parseAdminAiResponse,
  readGeneratedAdminAiText,
  type AdminAiApiErrorBody,
  type GeneratedAdminAiText,
} from "@/lib/admin-ai-client-errors";
import { AI_STREAM_CONTENT_TYPE, type AiStreamEvent } from "@/lib/ai-text-stream";
import { emitAdminAiUsage, isAiUsageSummary } from "@/lib/ai-usage";

export type AdminAiStreamOptions = {
  /** Dzīvais teksts, kamēr modelis raksta — tikai priekšskatījumam. */
  onPreview: (text: string) => void;
  signal?: AbortSignal;
};

function parseSseEvents(buffer: string, onEvent: (event: AiStreamEvent) => void): string {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const chunks = normalized.split("\n\n");
  const rest = chunks.pop() ?? "";
  for (const chunk of chunks) {
    for (const line of chunk.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const json = trimmed.slice(5).trim();
      if (!json) continue;
      try {
        onEvent(JSON.parse(json) as AiStreamEvent);
      } catch {
        // pusē pārrauts notikums — nākamais ienāks vesels
      }
    }
  }
  return rest;
}

export async function generateAdminAiText(
  url: string,
  body: unknown,
  httpFallback: string,
  opts?: Partial<AdminAiStreamOptions>,
): Promise<GeneratedAdminAiText> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: opts?.signal,
  });

  const isStream = (res.headers.get("content-type") ?? "").includes(AI_STREAM_CONTENT_TYPE);
  if (!isStream || !res.body) {
    const { data, parseFailed } = await parseAdminAiResponse(res);
    return readGeneratedAdminAiText(res, data, parseFailed, httpFallback);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let preview = "";
  let completed: AiStreamEvent | undefined;

  const handle = (incoming: AiStreamEvent) => {
    if (incoming.type === "delta") {
      preview += incoming.text;
      opts?.onPreview?.(preview);
      return;
    }
    if (incoming.type === "restart") {
      preview = "";
      opts?.onPreview?.("");
      return;
    }
    completed = incoming;
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = parseSseEvents(buffer, handle);
  }
  parseSseEvents(`${buffer}\n\n`, handle);

  if (completed === undefined) {
    // Straume nogriezta pusvārdā — apmaksātais priekšskatījums nedrīkst pazust.
    return preview.trim()
      ? { ok: false, error: "AI: savienojums pārtrūka — teksts nav pabeigts", text: preview.trim() }
      : { ok: false, error: httpFallback };
  }

  if (completed.type === "done") {
    if (isAiUsageSummary(completed.usage)) emitAdminAiUsage(completed.usage);
    return { ok: true, text: completed.text };
  }

  if (completed.type === "error") {
    if (isAiUsageSummary(completed.usage)) emitAdminAiUsage(completed.usage);
    const data: AdminAiApiErrorBody & { text?: string } = {
      error: completed.error,
      detail: completed.detail,
      text: completed.text,
      incomplete: completed.incomplete,
    };
    return readGeneratedAdminAiText({ ok: false, status: 502 }, data, false, httpFallback);
  }

  return preview.trim()
    ? { ok: false, error: "AI: savienojums pārtrūka — teksts nav pabeigts", text: preview.trim() }
    : { ok: false, error: httpFallback };
}
