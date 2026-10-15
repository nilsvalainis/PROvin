import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyDropboxWebhookSignature } from "@/lib/dropbox-webhook-signature";

describe("verifyDropboxWebhookSignature", () => {
  it("validates HMAC-SHA256 hex signature", () => {
    const secret = "dropbox-app-secret";
    const body = '{"list_folder":{"accounts":["dbid:AAA"]}}';
    const sig = createHmac("sha256", secret).update(body, "utf8").digest("hex");
    expect(verifyDropboxWebhookSignature(body, sig, secret)).toBe(true);
    expect(verifyDropboxWebhookSignature(body, "deadbeef", secret)).toBe(false);
    expect(verifyDropboxWebhookSignature(body, sig, "other-secret")).toBe(false);
  });
});
