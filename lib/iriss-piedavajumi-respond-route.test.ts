/**
 * Nils 07.11: klienta «Noraidīt» / «Uzdot jautājumu» piedāvājuma saitē (`/api/iriss-piedavajums/respond`)
 * un admina «Atjaunot» / iekšējā piezīme. Krātuve - pagaidu mape; paziņojumi aizstāti (nekas netiek sūtīts).
 */
import { mkdtempSync, rmSync } from "node:fs";
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
const calls = vi.hoisted(() => ({ decision: [] as unknown[][], question: [] as unknown[][], after: [] as Array<() => unknown> }));
vi.mock("@/lib/iriss-offer-notify", () => ({
  notifyIrissOfferDecision: async (...args: unknown[]) => {
    calls.decision.push(args);
    return { email: true, push: 1 };
  },
  notifyIrissOfferQuestion: async (...args: unknown[]) => {
    calls.question.push(args);
    return { email: true, push: 1 };
  },
}));
vi.mock("next/server", async (orig) => {
  const mod = await orig<typeof import("next/server")>();
  return { ...mod, after: (fn: () => unknown) => void calls.after.push(fn) };
});
vi.mock("@/lib/staff-auth", () => ({
  requireAdminOnlyApi: async () => ({ ok: true, actor: { kind: "admin", name: "Nils" } }),
}));

import { emptyIrissPiedavajums, type IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";

const AT = "2026-11-07T01:00:00.000Z";
let ipSeq = 0;

describe("PD saite: noraidīt, jautājums, atjaunot", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
    dirs.length = 0;
    calls.decision.length = 0;
    calls.question.length = 0;
    calls.after.length = 0;
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  async function setup(over: Partial<IrissPiedavajums> = {}) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(AT));
    const dir = mkdtempSync(path.join(os.tmpdir(), "iriss-pd-respond-"));
    dirs.push(dir);
    vi.stubEnv("ADMIN_IRISS_PASUTIJUMI_DIR", dir);
    vi.stubEnv("VERCEL", "");
    vi.resetModules();
    const store = await import("@/lib/iriss-piedavajumi-store");
    const lib = await import("@/lib/iriss-piedavajumi");
    const { POST } = await import("@/app/api/iriss-piedavajums/respond/route");
    const admin = await import("@/app/api/admin/iriss-piedavajumi/[id]/route");
    const token = store.newIrissPdToken();
    const created = await store.createIrissPd((n) => {
      const r = emptyIrissPiedavajums(crypto.randomUUID(), AT);
      return {
        ...r,
        number: n,
        status: "sent",
        validUntil: "2026-11-20",
        linkToken: token,
        price: "12750",
        vehicle: { ...r.vehicle, title: "TESTS Škoda Octavia", vin: "TMBJJ7NE0K0123456" },
        client: { name: "TESTS Gustavs Ansons", phone: "+37120000000", email: "gustavs.ansons@gmail.com", orderId: "" },
        ...over,
      };
    });
    if (!created.ok) throw new Error("create");
    const id = created.record.id;
    const ip = `10.0.0.${++ipSeq}`;
    const send = async (body: unknown, raw?: string) => {
      const res = await POST(
        new Request("http://localhost/api/iriss-piedavajums/respond", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": ip },
          body: raw ?? JSON.stringify(body),
        }),
      );
      return { status: res.status, data: (await res.json()) as Record<string, unknown> };
    };
    const adminPost = async (body: unknown) => {
      const res = await admin.POST(
        new Request(`http://localhost/api/admin/iriss-piedavajumi/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
        { params: Promise.resolve({ id }) },
      );
      return { status: res.status, data: (await res.json()) as { ok?: boolean; record?: IrissPiedavajums; message?: string } };
    };
    const read = async () => (await store.readIrissPd(id))!;
    const runAfter = async () => {
      for (const fn of calls.after.splice(0)) await fn();
    };
    return { store, lib, token, id, send, adminPost, read, runAfter };
  }

  it("noraidīt ar iemeslu: «Noraidīts», iemesls saglabāts, Nilam paziņojums ar saiti uz piedāvājumu; apstiprināt vairs nevar", async () => {
    const t = await setup();
    const res = await t.send({ token: t.token, action: "decline", text: "  Par dārgu.\r\nPaldies  " });
    expect(res).toEqual({ status: 200, data: { ok: true, state: "declined" } });
    const rec = await t.read();
    expect(rec.status).toBe("declined");
    expect(rec.declinedByClient).toBe(true);
    expect(rec.messages).toMatchObject([{ from: "client", kind: "decline", text: "Par dārgu.\nPaldies" }]);
    expect(rec.history.at(-1)?.text).toBe("Klients noraidīja: Par dārgu. Paldies");
    expect((await t.store.listIrissPdRows())[0]?.status).toBe("declined");

    // Paziņojums tikai pēc atbildes klientam (after).
    expect(calls.decision).toHaveLength(0);
    await t.runAfter();
    expect(calls.decision).toHaveLength(1);
    const [facts, decision] = calls.decision[0] as [Record<string, string>, string];
    expect(decision).toBe("decline");
    expect(facts.reason).toBe("Par dārgu.\nPaldies");
    expect(facts.adminPath).toBe(`/admin/iriss/piedavajumi/${t.id}`);

    const again = await t.send({ token: t.token, action: "approve" });
    expect(again.status).toBe(409);
    expect(again.data).toMatchObject({ ok: false, state: "declined" });
    expect((await t.read()).status).toBe("declined");
    expect(t.lib.buildIrissPdPublicView(await t.read(), "link", Date.parse(AT)).state).toBe("declined");
  });

  it("noraidīt bez iemesla un dubultklikšķis: viens lēmums, viens paziņojums", async () => {
    const t = await setup();
    const [a, b] = await Promise.all([t.send({ token: t.token, action: "decline" }), t.send({ token: t.token, action: "decline", text: "" })]);
    expect([a.data.state, b.data.state]).toEqual(["declined", "declined"]);
    await t.runAfter();
    expect(calls.decision).toHaveLength(1);
    expect((await t.read()).history.filter((h) => h.text.startsWith("Klients noraidīja"))).toHaveLength(1);
  });

  it("jautājums: saglabājas kā klienta ziņa, statuss nemainās, Nilam paziņojums; dublikāts un tukšs - noraidīti", async () => {
    const t = await setup();
    const q = "Vai ir otrs riteņu komplekts? <script>alert(1)</script>";
    const res = await t.send({ token: t.token, action: "question", text: q });
    expect(res.status).toBe(200);
    expect(res.data).toMatchObject({ ok: true, state: "open", questions: [{ text: q }] });
    const rec = await t.read();
    expect(rec.status).toBe("sent");
    expect(rec.messages).toMatchObject([{ from: "client", kind: "question", text: q }]);
    expect((await t.store.listIrissPdRows())[0]?.openQuestions).toBe(1);
    await t.runAfter();
    expect(calls.question).toHaveLength(1);
    expect((calls.question[0] as unknown[])[1]).toBe(q);

    expect((await t.send({ token: t.token, action: "question", text: ` ${q} ` })).status).toBe(409);
    expect((await t.send({ token: t.token, action: "question", text: "  " })).status).toBe(400);
    await t.runAfter();
    expect(calls.question).toHaveLength(1);
    expect((await t.read()).messages).toHaveLength(1);
  });

  it("jautājuma garums nogriezts; pārāk liels pieprasījums - 413; nederīgs tokens - 404", async () => {
    const t = await setup();
    const long = "a".repeat(3000);
    const res = await t.send({ token: t.token, action: "question", text: long });
    expect(res.status).toBe(200);
    expect((await t.read()).messages[0]?.text).toHaveLength(1000);
    expect((await t.send(null, JSON.stringify({ token: t.token, action: "question", text: "b".repeat(9000) }))).status).toBe(413);
    expect((await t.send({ token: "ZZZZZZZZZZZZZZZZZZZZZZZZ", action: "question", text: "Sveiki" })).status).toBe(404);
    expect((await t.send({ token: t.token, action: "hack" })).status).toBe(404);
  });

  it("jautājumu ātruma ierobežojums: ne vairāk kā 5 stundā vienai saitei", async () => {
    const t = await setup();
    for (let i = 0; i < 5; i += 1) expect((await t.send({ token: t.token, action: "question", text: `Jautājums nr. ${i}` })).status).toBe(200);
    const sixth = await t.send({ token: t.token, action: "question", text: "Jautājums nr. 6" });
    expect(sixth.status).toBe(429);
    expect((await t.read()).messages).toHaveLength(5);
  });

  it("melnraksts nav pieejams: jautājums un noraidījums - 410, nekas netiek ierakstīts", async () => {
    const t = await setup({ status: "draft" });
    expect((await t.send({ token: t.token, action: "question", text: "Sveiki, vai pieejams?" })).status).toBe(410);
    expect((await t.send({ token: t.token, action: "decline" })).status).toBe(410);
    expect((await t.read()).messages).toEqual([]);
  });

  it("admina piezīme: tikai iekšēja (nav klienta skatā, nav paziņojuma), noņem «neatbildēts»", async () => {
    const t = await setup();
    await t.send({ token: t.token, action: "question", text: "Kad var apskatīt?" });
    await t.runAfter();
    const note = await t.adminPost({ action: "note", text: "Atbildēju pa WhatsApp: pirmdien" });
    expect(note.status).toBe(200);
    const rec = await t.read();
    expect(rec.messages.map((m) => m.from)).toEqual(["client", "admin"]);
    expect((await t.store.listIrissPdRows())[0]?.openQuestions).toBe(0);
    const view = t.lib.buildIrissPdPublicView(rec, "link", Date.parse(AT));
    expect(JSON.stringify(view)).not.toContain("WhatsApp");
    expect(view.questions.map((q) => q.text)).toEqual(["Kad var apskatīt?"]);
    await t.runAfter();
    expect(calls.question).toHaveLength(1);
    expect(calls.decision).toHaveLength(0);
    expect((await t.adminPost({ action: "note", text: "   " })).status).toBe(400);
  });

  it("admins atjauno noraidīto: klients atkal var apstiprināt (lēmuma fails noņemts)", async () => {
    const t = await setup();
    await t.send({ token: t.token, action: "decline", text: "Pārdomāšu" });
    const reopened = await t.adminPost({ action: "reopen" });
    expect(reopened.status).toBe(200);
    expect(reopened.data.record).toMatchObject({ status: "sent", declinedByClient: false, linkToken: t.token });
    expect(t.lib.buildIrissPdPublicView(await t.read(), "link", Date.parse(AT)).state).toBe("open");
    const ok = await t.send({ token: t.token });
    expect(ok).toEqual({ status: 200, data: { ok: true, state: "approved" } });
    expect((await t.read()).status).toBe("approved");
  });

  it("admina «Atzīmēt noraidītu»: saite paliek nepieejama (nevis klienta noraidījuma skats)", async () => {
    const t = await setup();
    await t.adminPost({ action: "decline" });
    const rec = await t.read();
    expect(rec.declinedByClient).toBe(false);
    expect(t.lib.buildIrissPdPublicView(rec, "link", Date.parse(AT)).state).toBe("closed");
    expect((await t.send({ token: t.token, action: "question", text: "Vai vēl pieejams?" })).status).toBe(410);
  });
});
