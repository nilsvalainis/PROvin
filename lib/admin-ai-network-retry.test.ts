import { describe, expect, it, vi } from "vitest";
import { generateAdminAiTextWithNetworkRetry, isTransientNetworkError } from "@/lib/admin-ai-stream-client";

const ok = { ok: true as const, text: "Teksts" };

describe("FLASH MAX tīkla kļūdas atkārtojums", () => {
  it("tīkla kļūdai (TypeError) atkārto tieši 1x", async () => {
    const generate = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockResolvedValueOnce(ok);
    const out = await generateAdminAiTextWithNetworkRetry("/x", {}, "f", { generate: generate as never, retryDelayMs: 0 });
    expect(out).toBe(ok);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("otrā tīkla kļūda tiek izmesta (ne bezgalīgi)", async () => {
    const generate = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(
      generateAdminAiTextWithNetworkRetry("/x", {}, "f", { generate: generate as never, retryDelayMs: 0 }),
    ).rejects.toThrow("Failed to fetch");
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("atcelšanu un citas kļūdas neatkārto", async () => {
    expect(isTransientNetworkError(new DOMException("x", "AbortError"))).toBe(false);
    expect(isTransientNetworkError(new Error("parse"))).toBe(false);
    const generate = vi.fn().mockRejectedValue(new Error("parse"));
    await expect(
      generateAdminAiTextWithNetworkRetry("/x", {}, "f", { generate: generate as never, retryDelayMs: 0 }),
    ).rejects.toThrow("parse");
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("HTTP kļūdas atbilde (ok:false) netiek atkārtota", async () => {
    const generate = vi.fn().mockResolvedValue({ ok: false, error: "AI: 500" });
    await generateAdminAiTextWithNetworkRetry("/x", {}, "f", { generate: generate as never, retryDelayMs: 0 });
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
