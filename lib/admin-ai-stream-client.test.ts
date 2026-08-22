import { afterEach, describe, expect, it, vi } from "vitest";
import { generateAdminAiText } from "@/lib/admin-ai-stream-client";
import { encodeAiStreamEvent } from "@/lib/ai-text-stream";

function sseResponse(events: string[], contentType = "text/event-stream"): Response {
  const body = events.join("");
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": contentType },
  });
}

describe("generateAdminAiText", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("streams deltas as a live preview and returns the finished text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          encodeAiStreamEvent({ type: "delta", text: "Eļļas " }),
          encodeAiStreamEvent({ type: "delta", text: "sūkņa ass" }),
          encodeAiStreamEvent({ type: "done", text: "Eļļas sūkņa ass\nPabeigts teksts." }),
        ]),
      ),
    );
    const previews: string[] = [];
    const result = await generateAdminAiText("/api/admin/ai/x", {}, "AI: neizdevās", {
      onPreview: (t) => previews.push(t),
    });
    expect(previews).toEqual(["Eļļas ", "Eļļas sūkņa ass"]);
    expect(result).toEqual({ ok: true, text: "Eļļas sūkņa ass\nPabeigts teksts." });
  });

  it("clears the preview when the model restarts a cheaper attempt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          encodeAiStreamEvent({ type: "delta", text: "Pusceļā" }),
          encodeAiStreamEvent({ type: "restart" }),
          encodeAiStreamEvent({ type: "delta", text: "No jauna" }),
          encodeAiStreamEvent({ type: "done", text: "No jauna, pabeigts." }),
        ]),
      ),
    );
    const previews: string[] = [];
    await generateAdminAiText("/api/admin/ai/x", {}, "AI: neizdevās", {
      onPreview: (t) => previews.push(t),
    });
    expect(previews).toEqual(["Pusceļā", "", "No jauna"]);
  });

  it("keeps paid incomplete text when the stream reports an unfinished comment", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        sseResponse([
          encodeAiStreamEvent({ type: "delta", text: "Sākums" }),
          encodeAiStreamEvent({
            type: "error",
            error: "ai_incomplete_comment",
            text: "Sākums un daļa",
            incomplete: true,
          }),
        ]),
      ),
    );
    const result = await generateAdminAiText("/api/admin/ai/x", {}, "AI: neizdevās", {
      onPreview: () => {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.text).toBe("Sākums un daļa");
      expect(result.error).toMatch(/nav pabeigts/i);
    }
  });

  it("falls back to JSON when the route is not streaming", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ text: "Vecais JSON ceļš" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const result = await generateAdminAiText("/api/admin/ai/x", {}, "AI: neizdevās", {
      onPreview: () => {},
    });
    expect(result).toEqual({ ok: true, text: "Vecais JSON ceļš" });
  });
});
