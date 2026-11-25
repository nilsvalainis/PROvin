import { describe, expect, it } from "vitest";
import {
  applyPresenceHeartbeat,
  isSafePresenceClientId,
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
});
