import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/checkthisreg-ingest", () => ({
  finalizeCtrIngest: vi.fn(async () => ({ status: "pending", vin: "VF1TEST0000000001" })),
  receiveCtrDocumentChunk: vi.fn(async () => ({ status: "document_saved", md5: "a".repeat(32) })),
  retryCtrPending: vi.fn(async () => ({ checked: 0, attached: 0 })),
}));

import { POST } from "@/app/api/ctr/ingest/route";

const TOKEN = "k".repeat(40);

function req(body: unknown, auth?: string): Request {
  return new Request("https://www.provin.lv/api/ctr/ingest", {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ctr/ingest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("bez CTR_INGEST_TOKEN - 401 (izslēgts)", async () => {
    vi.stubEnv("CTR_INGEST_TOKEN", "");
    const res = await POST(req({ action: "retry_pending" }, `Bearer ${TOKEN}`));
    expect(res.status).toBe(401);
  });

  it("nepareizs tokens - 401", async () => {
    vi.stubEnv("CTR_INGEST_TOKEN", TOKEN);
    expect((await POST(req({ action: "retry_pending" }, "Bearer nepareizs-tokens-xxxxxxxxxxxxxxxx"))).status).toBe(401);
    expect((await POST(req({ action: "retry_pending" }))).status).toBe(401);
  });

  it("pareizs tokens: darbības un validācija", async () => {
    vi.stubEnv("CTR_INGEST_TOKEN", TOKEN);
    const auth = `Bearer ${TOKEN}`;
    expect((await POST(req({ action: "retry_pending" }, auth))).status).toBe(200);
    const fin = await POST(req({ action: "finalize", ctrOrderId: "token_1_ABCDEF", vin: "VF1TEST0000000001", emailKind: "ready", documents: [] }, auth));
    expect(fin.status).toBe(200);
    expect(await fin.json()).toMatchObject({ status: "pending" });
    expect((await POST(req({ action: "finalize", ctrOrderId: "token_1_ABCDEF", vin: "x", emailKind: "ready" }, auth))).status).toBe(400);
    expect((await POST(req({ action: "purchase" }, auth))).status).toBe(400);
  });
});
