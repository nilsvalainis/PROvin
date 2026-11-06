import { describe, expect, it } from "vitest";
import {
  applyIrissPdClientDecline,
  applyIrissPdClientQuestion,
  buildIrissPdPublicView,
  cleanIrissPdClientText,
  IRISS_PD_CLIENT_ACTOR,
  irissPdLastClientQuestion,
  irissPdToListRow,
  normalizeIrissPdListRow,
  normalizeIrissPiedavajums,
  rebaseIrissPd,
} from "@/lib/iriss-piedavajumi";
import { emptyIrissPiedavajums, IRISS_PD_MAX_CLIENT_QUESTIONS, type IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";
import { irissPdClientCommunicationEvents, timelineFromPasutijums } from "@/lib/iriss-communication-timeline";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";

const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = Date.parse("2026-10-26T10:00:00.000Z");
const AT = new Date(NOW).toISOString();
const AFTER_DEADLINE = Date.parse("2026-11-05T00:00:00.000Z");

function sent(over: Partial<IrissPiedavajums> = {}): IrissPiedavajums {
  const r = emptyIrissPiedavajums(ID, AT);
  return { ...r, number: 7, status: "sent", validUntil: "2026-11-02", linkToken: "AbCdEfGhIjKlMnOpQrStUvWx", vehicle: { ...r.vehicle, title: "Škoda Octavia" }, ...over };
}

describe("Klienta «Noraidīt» saitē: statusu pārejas", () => {
  it("Nosūtīts -> Noraidīts ar iemeslu; vēsturē klients; saite rāda 'declined'", () => {
    const res = applyIrissPdClientDecline(sent(), { at: AT, nowMs: NOW, reason: "  Par dārgu  " });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.record.status).toBe("declined");
    expect(res.record.decidedAt).toBe(AT);
    expect(res.record.clientMessages).toEqual([{ at: AT, kind: "decline", text: "Par dārgu" }]);
    expect(res.record.history.at(-1)).toMatchObject({ by: IRISS_PD_CLIENT_ACTOR, text: "Klients noraidīja piedāvājumu. Iemesls: Par dārgu" });
    expect(buildIrissPdPublicView(res.record, "link", NOW).state).toBe("declined");
  });

  it("atkārtots noraidījums neko nemaina", () => {
    const first = applyIrissPdClientDecline(sent(), { at: AT, nowMs: NOW });
    if (!first.ok) throw new Error("x");
    const again = applyIrissPdClientDecline(first.record, { at: "2026-10-26T11:00:00.000Z", nowMs: NOW });
    expect(again).toEqual({ ok: true, record: first.record, changed: false });
  });

  it("apstiprinātu, melnrakstu vai beigušos nevar noraidīt", () => {
    expect(applyIrissPdClientDecline(sent({ status: "approved" }), { at: AT, nowMs: NOW })).toEqual({ ok: false, error: "approved" });
    expect(applyIrissPdClientDecline(sent({ status: "draft" }), { at: AT, nowMs: NOW })).toEqual({ ok: false, error: "closed" });
    expect(applyIrissPdClientDecline(sent(), { at: AT, nowMs: AFTER_DEADLINE })).toEqual({ ok: false, error: "closed" });
  });

  it("admina «Atzīmēt noraidītu» klientam paliek 'nav pieejams' (ne 'klients noraidīja')", () => {
    expect(buildIrissPdPublicView(sent({ status: "declined" }), "link", NOW).state).toBe("closed");
  });
});

describe("Klienta «Uzdot jautājumu» saitē", () => {
  it("jautājums tiek pieņemts atvērtam un apstiprinātam; statuss nemainās", () => {
    const open = applyIrissPdClientQuestion(sent(), { at: AT, nowMs: NOW, text: "Vai ir 2 atslēgas?" });
    expect(open.ok).toBe(true);
    if (!open.ok) return;
    expect(open.record.status).toBe("sent");
    expect(open.record.clientMessages.at(-1)).toEqual({ at: AT, kind: "question", text: "Vai ir 2 atslēgas?" });
    expect(open.record.history.at(-1)?.text).toBe("Klienta jautājums: Vai ir 2 atslēgas?");
    expect(buildIrissPdPublicView(open.record, "link", NOW).questions).toEqual([{ at: AT, text: "Vai ir 2 atslēgas?" }]);
    const approved = applyIrissPdClientQuestion(sent({ status: "approved" }), { at: AT, nowMs: NOW, text: "Kad piegāde?" });
    expect(approved.ok && approved.record.status).toBe("approved");
  });

  it("ievades validācija: tukšs/īss/ne-teksts noraidīts, garš apgriezts līdz 400, vadības simboli izņemti", () => {
    expect(applyIrissPdClientQuestion(sent(), { at: AT, nowMs: NOW, text: "  " })).toEqual({ ok: false, error: "text" });
    expect(applyIrissPdClientQuestion(sent(), { at: AT, nowMs: NOW, text: "ok" })).toEqual({ ok: false, error: "text" });
    expect(applyIrissPdClientQuestion(sent(), { at: AT, nowMs: NOW, text: { x: 1 } })).toEqual({ ok: false, error: "text" });
    const long = applyIrissPdClientQuestion(sent(), { at: AT, nowMs: NOW, text: "a".repeat(900) });
    expect(long.ok && long.record.clientMessages.at(-1)?.text.length).toBe(400);
    expect(cleanIrissPdClientText("Sveiki\u0000\u202e!\r\n\r\n\r\nLabdien")).toBe("Sveiki!\n\nLabdien");
  });

  it("slēgtam (melnraksts, noraidīts, beidzies) jautājumu nepieņem", () => {
    expect(applyIrissPdClientQuestion(sent({ status: "draft" }), { at: AT, nowMs: NOW, text: "Vai ir?" })).toEqual({ ok: false, error: "closed" });
    expect(applyIrissPdClientQuestion(sent({ status: "declined" }), { at: AT, nowMs: NOW, text: "Vai ir?" })).toEqual({ ok: false, error: "closed" });
    expect(applyIrissPdClientQuestion(sent(), { at: AT, nowMs: AFTER_DEADLINE, text: "Vai ir?" })).toEqual({ ok: false, error: "closed" });
  });

  it("jautājumu skaits ierobežots vienam piedāvājumam", () => {
    let rec = sent();
    for (let i = 0; i < IRISS_PD_MAX_CLIENT_QUESTIONS; i += 1) {
      const r = applyIrissPdClientQuestion(rec, { at: AT, nowMs: NOW, text: `Jautājums ${i}` });
      if (!r.ok) throw new Error(r.error);
      rec = r.record;
    }
    expect(applyIrissPdClientQuestion(rec, { at: AT, nowMs: NOW, text: "Vēl viens" })).toEqual({ ok: false, error: "limit" });
  });
});

describe("Vecie dati un admin skati", () => {
  it("vecs JSON bez clientMessages -> []; nederīgas ziņas izmestas", () => {
    const old = JSON.parse(JSON.stringify(sent())) as Record<string, unknown>;
    delete old.clientMessages;
    expect(normalizeIrissPiedavajums(old)?.clientMessages).toEqual([]);
    const junk = { ...old, clientMessages: [{ at: AT, kind: "spam", text: "x" }, { at: "", kind: "question", text: "y" }, { at: AT, kind: "question", text: "Labs?" }] };
    expect(normalizeIrissPiedavajums(junk)?.clientMessages).toEqual([{ at: AT, kind: "question", text: "Labs?" }]);
    const oldRow = JSON.parse(JSON.stringify(irissPdToListRow(sent()))) as Record<string, unknown>;
    delete oldRow.clientMessages;
    expect(normalizeIrissPdListRow(oldRow)?.clientMessages).toEqual([]);
  });

  it("jauns piedāvājums uz bāzes nepārņem klienta ziņas", () => {
    const declined = applyIrissPdClientDecline(sent(), { at: AT, nowMs: NOW, reason: "Nē" });
    if (!declined.ok) throw new Error("x");
    const next = rebaseIrissPd(declined.record, { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", number: 8, at: AT, by: "Admins" });
    expect(next.clientMessages).toEqual([]);
  });

  it("saraksta rinda un pasūtījuma laika josla rāda klienta jautājumu un noraidījumu", () => {
    const q = applyIrissPdClientQuestion(sent(), { at: AT, nowMs: NOW, text: "Vai ir servisa grāmata?" });
    if (!q.ok) throw new Error("x");
    const d = applyIrissPdClientDecline(q.record, { at: "2026-10-26T12:00:00.000Z", nowMs: NOW });
    if (!d.ok) throw new Error("x");
    const row = irissPdToListRow(d.record);
    expect(irissPdLastClientQuestion(row)?.text).toBe("Vai ir servisa grāmata?");
    const events = irissPdClientCommunicationEvents([row]);
    expect(events.map((e) => e.title)).toEqual(["Klienta jautājums (PD-0007 · Škoda Octavia)", "Klients noraidīja piedāvājumu (PD-0007 · Škoda Octavia)"]);
    const order = emptyIrissPasutijums("cccccccc-cccc-4ccc-8ccc-cccccccccccc", AT);
    const timeline = timelineFromPasutijums(order, [], events);
    expect(timeline.some((t) => t.body === "Vai ir servisa grāmata?" && t.derived)).toBe(true);
    // Pasūtījuma ieraksts netiek mainīts (tikai atvasinājums).
    expect(order.communicationEvents ?? []).toEqual([]);
  });
});
