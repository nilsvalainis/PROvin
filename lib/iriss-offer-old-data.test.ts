/**
 * F6: vecie piedāvājumi un dati netiek mainīti - jaunie lauki (sourceRef, dropboxId, validUntilAt) ir tikai aditīvi.
 */
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@vercel/blob", () => ({
  get: vi.fn(async () => {
    throw new Error("blob disabled in test");
  }),
  put: vi.fn(async () => {
    throw new Error("blob disabled in test");
  }),
  del: vi.fn(async () => undefined),
  list: vi.fn(async () => ({ blobs: [] })),
}));

import { parseIrissOfferFromBody } from "@/lib/iriss-pasutijumi-body";
import { emptyIrissOfferRecord, emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";

const ORDER_ID = "11111111-1111-4111-8111-111111111111";
const OFFER_ID = "22222222-2222-4222-8222-222222222222";

describe("vecie piedāvājumi", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("parsēšana nepievieno jaunus laukus vecam piedāvājumam", () => {
    const old = { ...emptyIrissOfferRecord(OFFER_ID, "2026-01-01T00:00:00.000Z", "Piedāvājums 1"), validUntil: "2026-02-01" };
    const parsed = parseIrissOfferFromBody(JSON.parse(JSON.stringify(old)), 0)!;
    expect(parsed).not.toHaveProperty("sourceRef");
    expect(parsed).not.toHaveProperty("validUntilAt");
    expect(parsed.validUntil).toBe("2026-02-01");
  });

  it("saglabājot vecu pasūtījumu, piedāvājumam nerodas sourceRef / validUntilAt / dropboxId, statuss nemainās", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "j24-f6-"));
    dirs.push(dir);
    vi.stubEnv("ADMIN_IRISS_PASUTIJUMI_DIR", dir);
    vi.stubEnv("VERCEL", "");
    vi.resetModules();
    const store = await import("@/lib/iriss-pasutijumi-store");
    const order = { ...emptyIrissPasutijums(ORDER_ID, "2026-01-01T00:00:00.000Z"), clientFirstName: "Vecs", listStatus: "active" as const };
    const offer = { ...emptyIrissOfferRecord(OFFER_ID, order.createdAt, "Piedāvājums 1"), brandModel: "Audi A6", validUntil: "2026-02-01" };
    const w = await store.writeIrissPasutijums({ ...order, offers: [offer] }, { expectedWorkspaceRevision: 0 });
    expect(w.ok).toBe(true);
    const raw = JSON.parse(readFileSync(path.join(dir, `${ORDER_ID}.json`), "utf8")) as { listStatus: string; offers: Record<string, unknown>[] };
    expect(raw.listStatus).toBe("active");
    expect(raw.offers[0]).not.toHaveProperty("sourceRef");
    expect(raw.offers[0]).not.toHaveProperty("validUntilAt");
    expect(JSON.stringify(raw.offers[0])).not.toContain("dropboxId");
    expect(raw.offers[0]?.validUntil).toBe("2026-02-01");
  });
});
