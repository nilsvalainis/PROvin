import { describe, expect, it, vi } from "vitest";

const blobs = new Map<string, { body: string; uploadedAt: Date }>();
vi.mock("@vercel/blob", () => ({
  put: async (pathname: string, body: string) => {
    blobs.set(pathname, { body, uploadedAt: new Date() });
    return { pathname };
  },
  get: async (pathname: string) => {
    const b = blobs.get(pathname);
    return b ? { statusCode: 200, stream: new Response(b.body).body } : null;
  },
  list: async ({ prefix }: { prefix: string }) => ({
    blobs: [...blobs.entries()].filter(([k]) => k.startsWith(prefix)).map(([pathname, v]) => ({ pathname, uploadedAt: v.uploadedAt })),
    hasMore: false,
  }),
  del: async (paths: string[]) => {
    for (const p of paths) blobs.delete(p);
  },
}));
import {
  applyPresenceHeartbeat,
  isSafePresenceClientId,
  prunePresenceFiles,
  recordOrderPresence,
  resetPresenceMemoryForTests,
  sanitizePresenceLabel,
} from "@/lib/admin-order-presence-store";

describe("pasūtījuma klātbūtne", () => {
  it("rāda citu pārlūku pēdējās 60 s, sevi nerāda", () => {
    const t = 1_000_000;
    let r = applyPresenceHeartbeat(null, "aaaaaaaa1", "Safari iPhone", t);
    expect(r.others).toEqual([]);
    r = applyPresenceHeartbeat(r.doc, "bbbbbbbb2", "Chrome Mac", t + 15_000);
    expect(r.others).toEqual([{ clientId: "aaaaaaaa1", label: "Safari iPhone", secondsAgo: 15 }]);
    const late = applyPresenceHeartbeat(r.doc, "bbbbbbbb2", "Chrome Mac", t + 61_000);
    expect(late.others).toEqual([]);
  });

  it("izmet ļoti vecus ierakstus", () => {
    const r = applyPresenceHeartbeat({ clients: { old_client_1: { at: 0, label: "x" } } }, "aaaaaaaa1", "", 10 * 60_000);
    expect(Object.keys(r.doc.clients)).toEqual(["aaaaaaaa1"]);
  });

  it("bez Blob strādā atmiņā", async () => {
    resetPresenceMemoryForTests();
    await recordOrderPresence(null, "cs_x", "aaaaaaaa1", "A", 1000);
    const others = await recordOrderPresence(null, "cs_x", "bbbbbbbb2", "B", 2000);
    expect(others.map((o) => o.clientId)).toEqual(["aaaaaaaa1"]);
  });

  it("validācija", () => {
    expect(isSafePresenceClientId("abc")).toBe(false);
    expect(isSafePresenceClientId("abcdef12_-")).toBe(true);
    expect(sanitizePresenceLabel("<script>Chrome Mac</script>")).toBe("scriptChrome Mac/script");
    expect(sanitizePresenceLabel(42)).toBe("");
  });

  it("Blob: atsevišķa sakne, faili vecāki par 1 dienu tiek dzēsti", async () => {
    blobs.clear();
    const cfg = { token: "t", prefix: "admin-order-drafts/" };
    await recordOrderPresence(cfg, "cs_new", "aaaaaaaa1", "A");
    blobs.set("admin-order-presence/cs_old.json", { body: "{}", uploadedAt: new Date(Date.now() - 2 * 86_400_000) });
    expect([...blobs.keys()].sort()).toEqual(["admin-order-presence/cs_new.json", "admin-order-presence/cs_old.json"]);
    expect(await prunePresenceFiles(cfg)).toBe(1);
    expect([...blobs.keys()]).toEqual(["admin-order-presence/cs_new.json"]);
  });
});
