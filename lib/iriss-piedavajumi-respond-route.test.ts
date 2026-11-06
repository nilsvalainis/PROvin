/**
 * Klienta atbilde `/api/iriss-piedavajums/respond`: autorizācija (tikai tokens + izcelsme + limiti),
 * «Noraidīt» / «Uzdot jautājumu» / «Apstiprināt» statusu pārejas un tikai iekšēji paziņojumi adminam.
 * Krātuve, limiti un paziņojumi ir aizstāti - nekas netiek rakstīts un nekas netiek sūtīts.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyIrissPiedavajums, type IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWx";
const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const state = vi.hoisted(() => ({
  rec: null as IrissPiedavajums | null,
  writes: [] as IrissPiedavajums[],
  claim: null as null | "approve" | "decline",
  rateLimited: new Set<string>(),
  after: [] as Array<() => unknown>,
  notified: [] as string[],
}));

vi.mock("next/server", async (orig) => {
  const mod = await orig<typeof import("next/server")>();
  return { ...mod, after: (fn: () => unknown) => state.after.push(fn) };
});
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async (key: string) => ({ ok: ![...state.rateLimited].some((p) => key.startsWith(p)) }),
}));
vi.mock("@/lib/iriss-piedavajumi-store", () => ({
  hashIrissPdToken: (t: string) => `hash${t}`.padEnd(64, "0"),
  newIrissPdToken: () => "NewTokenNewTokenNewToken",
  readIrissPdByToken: async (t: string) => (state.rec && state.rec.linkToken === t ? state.rec : null),
  readIrissPdFresh: async () => state.rec,
  writeIrissPd: async (r: IrissPiedavajums) => {
    state.writes.push(r);
    state.rec = r;
    return true;
  },
  claimIrissPdDecision: async (_id: string, doc: { decision: "approve" | "decline" }) => {
    if (state.claim) return { won: false };
    state.claim = doc.decision;
    return { won: true };
  },
  readIrissPdDecisionClaim: async () => state.claim,
}));
vi.mock("@/lib/iriss-piedavajumi-approve", () => ({
  runIrissPdApprovalEffects: async (r: IrissPiedavajums) => r,
  notifyIrissPdApproved: async () => state.notified.push("approve"),
  notifyIrissPdClientDeclined: async () => state.notified.push("decline"),
  notifyIrissPdClientQuestion: async (_r: IrissPiedavajums, q: string) => state.notified.push(`question:${q}`),
}));

import { POST } from "@/app/api/iriss-piedavajums/respond/route";

const NOW_ISO = new Date().toISOString();
const FUTURE = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().slice(0, 10);

function sentRec(over: Partial<IrissPiedavajums> = {}): IrissPiedavajums {
  const r = emptyIrissPiedavajums(ID, NOW_ISO);
  return {
    ...r,
    number: 3,
    status: "sent",
    validUntil: FUTURE,
    linkToken: TOKEN,
    client: { ...r.client, name: "Jānis Bērziņš", phone: "+37120000000" },
    vehicle: { ...r.vehicle, title: "Audi A6" },
    ...over,
  };
}

function req(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://provin.lv/api/iriss-piedavajums/respond", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function call(body: unknown, headers?: Record<string, string>) {
  const res = await POST(req(body, headers));
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

async function flushAfter() {
  for (const fn of state.after.splice(0)) await fn();
}

beforeEach(() => {
  state.rec = sentRec();
  state.writes = [];
  state.claim = null;
  state.rateLimited = new Set();
  state.after = [];
  state.notified = [];
});

describe("autorizācija: tikai saites turētājs", () => {
  it("deny: svešs Origin, nederīgs/nezināms tokens, bojāts JSON, nezināma darbība -> 404 bez rakstīšanas", async () => {
    expect((await call({ token: TOKEN, action: "decline" }, { origin: "https://evil.example" })).status).toBe(404);
    expect((await call({ token: "short", action: "decline" })).status).toBe(404);
    expect((await call({ token: "ZzZzZzZzZzZzZzZzZzZzZzZz", action: "decline" })).status).toBe(404);
    expect((await call("{not json")).status).toBe(404);
    expect((await call({ token: TOKEN, action: "delete" })).status).toBe(404);
    expect(state.writes).toHaveLength(0);
    expect(state.rec?.status).toBe("sent");
  });

  it("deny: IP vai tokena ātruma limits -> 404; jautājumu limits -> 429", async () => {
    state.rateLimited.add("iriss-pd-respond:");
    expect((await call({ token: TOKEN, action: "decline" })).status).toBe(404);
    state.rateLimited = new Set(["iriss-pd-respond-t:"]);
    expect((await call({ token: TOKEN, action: "decline" })).status).toBe(404);
    state.rateLimited = new Set(["iriss-pd-question-t:"]);
    expect((await call({ token: TOKEN, action: "question", text: "Vai ir atslēgas?" })).status).toBe(429);
    expect(state.writes).toHaveLength(0);
  });

  it("allow: pareizs tokens no tās pašas izcelsmes (vai bez Origin)", async () => {
    const res = await call({ token: TOKEN, action: "question", text: "Vai ir atslēgas?" }, { origin: "https://provin.lv" });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ ok: true, question: "Vai ir atslēgas?" });
  });
});

describe("Noraidīt", () => {
  it("Nosūtīts -> Noraidīts, iemesls saglabāts, iekšējs paziņojums adminam pēc atbildes", async () => {
    const res = await call({ token: TOKEN, action: "decline", text: "Atradu citu" });
    expect(res).toEqual({ status: 200, json: { ok: true, state: "declined" } });
    expect(state.rec?.status).toBe("declined");
    expect(state.rec?.clientMessages).toEqual([expect.objectContaining({ kind: "decline", text: "Atradu citu" })]);
    expect(state.claim).toBe("decline");
    expect(state.notified).toEqual([]);
    await flushAfter();
    expect(state.notified).toEqual(["decline"]);
  });

  it("atkārtots noraidījums - tas pats atbildes stāvoklis, bez otra ieraksta un paziņojuma", async () => {
    await call({ token: TOKEN, action: "decline" });
    await flushAfter();
    const again = await call({ token: TOKEN, action: "decline" });
    expect(again.json).toEqual({ ok: true, state: "declined" });
    expect(state.writes).toHaveLength(1);
    await flushAfter();
    expect(state.notified).toEqual(["decline"]);
  });

  it("apstiprinātu nevar noraidīt (409); beigušos/melnrakstu - 410", async () => {
    state.rec = sentRec({ status: "approved" });
    expect((await call({ token: TOKEN, action: "decline" })).status).toBe(409);
    state.rec = sentRec({ status: "draft" });
    expect((await call({ token: TOKEN, action: "decline" })).status).toBe(410);
    expect(state.writes).toHaveLength(0);
  });

  it("pirmais lēmums uzvar: ja apstiprinājums jau ieņēma lēmumu, noraidījums netiek ierakstīts", async () => {
    state.claim = "approve";
    const res = await call({ token: TOKEN, action: "decline" });
    expect(res.status).toBe(409);
    expect(res.json).toMatchObject({ error: "approved" });
    expect(state.writes).toHaveLength(0);
  });

  it("pēc noraidījuma apstiprināt vairs nevar", async () => {
    await call({ token: TOKEN, action: "decline" });
    const res = await call({ token: TOKEN, action: "approve" });
    expect(res.status).toBe(409);
    expect(res.json).toMatchObject({ error: "declined" });
    expect(state.rec?.status).toBe("declined");
  });
});

describe("Uzdot jautājumu", () => {
  it("jautājums saglabāts, statuss nemainās, paziņojums adminam ar tekstu", async () => {
    const res = await call({ token: TOKEN, action: "question", text: "  Vai ir servisa grāmata?  " });
    expect(res.json).toMatchObject({ ok: true, state: "open", question: "Vai ir servisa grāmata?" });
    expect(state.rec?.status).toBe("sent");
    await flushAfter();
    expect(state.notified).toEqual(["question:Vai ir servisa grāmata?"]);
  });

  it("ievades validācija: tukšs vai pārāk īss -> 400, nekas netiek rakstīts", async () => {
    expect((await call({ token: TOKEN, action: "question", text: "" })).status).toBe(400);
    expect((await call({ token: TOKEN, action: "question", text: 42 })).status).toBe(400);
    expect(state.writes).toHaveLength(0);
  });

  it("noraidītam piedāvājumam jautājumu nepieņem (410)", async () => {
    await call({ token: TOKEN, action: "decline" });
    expect((await call({ token: TOKEN, action: "question", text: "Vai vēl var?" })).status).toBe(410);
  });
});

describe("Apstiprināt (esošā plūsma nemainās)", () => {
  it("bez action = apstiprināt; Rezervēts sekas + paziņojums pēc atbildes", async () => {
    const res = await call({ token: TOKEN });
    expect(res.json).toEqual({ ok: true, state: "approved" });
    expect(state.rec?.status).toBe("approved");
    await flushAfter();
    expect(state.notified).toEqual(["approve"]);
  });
});
