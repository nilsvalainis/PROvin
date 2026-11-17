import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import kalendars from "@/data/termini-kalendars.json";
import {
  adminPushTerminsMessage,
  dueTerminiReminders,
  upcomingTermini,
  type TerminiKalendars,
} from "@/lib/termini/kalendars";

const CAL = kalendars as TerminiKalendars;
/** 06:00 UTC = 09:00 Rīgā (vasaras laiks). */
const at = (day: string) => Date.parse(`${day}T06:00:00Z`);

function simulate(cal: TerminiKalendars, fromDay: string, days: number) {
  const sent: Record<string, string> = {};
  const log: string[] = [];
  const start = at(fromDay);
  for (let i = 0; i < days; i++) {
    const now = start + i * 86_400_000;
    for (const r of dueTerminiReminders(cal, sent, now)) {
      sent[r.key] = new Date(now).toISOString();
      log.push(`${new Date(now).toISOString().slice(0, 10)} ${r.id} ${r.daysLeft}`);
    }
  }
  return log;
}

describe("PVN termiņu kalendārs", () => {
  it("PVN deklarācija katra mēneša 20. datumā", () => {
    const up = upcomingTermini(CAL, at("2026-11-14"));
    expect(up.find((t) => t.id === "pvn-deklaracija")?.date).toBe("2026-11-20");
  });

  it("push 7, 3 un 1 dienu pirms termiņa, katrs tikai vienreiz", () => {
    const only: TerminiKalendars = { monthly: [{ id: "pvn-deklaracija", kind: "pvn", day: 20, title: "PVN" }] };
    expect(simulate(only, "2026-11-01", 25)).toEqual([
      "2026-11-13 pvn-deklaracija 7",
      "2026-11-17 pvn-deklaracija 3",
      "2026-11-19 pvn-deklaracija 1",
    ]);
  });

  it("nokavēta cron diena - tuvākais slieksnis izsūtās nākamajā palaišanā", () => {
    const only: TerminiKalendars = { monthly: [{ id: "x", kind: "pvn", day: 20, title: "PVN" }] };
    const sent: Record<string, string> = { "x:2026-11-20:7": "2026-11-13T06:00:00Z" };
    const due = dueTerminiReminders(only, sent, at("2026-11-18"));
    expect(due.map((r) => [r.bucket, r.daysLeft])).toEqual([[3, 2]]);
  });

  it("pāreja uz nākamo mēnesi un gadu", () => {
    const only: TerminiKalendars = { monthly: [{ id: "x", kind: "pvn", day: 5, title: "PVN" }] };
    expect(upcomingTermini(only, at("2026-12-29")).map((t) => t.date)).toEqual(["2027-01-05"]);
  });

  it("CSDD vienreizējie un ikgadējie termiņi", () => {
    const cal: TerminiKalendars = {
      once: [{ id: "csdd-apskate", kind: "csdd", date: "2026-11-02", title: "Tehniskā apskate" }],
      yearly: [{ id: "csdd-gada", kind: "csdd", month: 11, day: 1, title: "Gada termiņš" }],
    };
    expect(simulate(cal, "2026-10-20", 20)).toEqual([
      "2026-10-25 csdd-gada 7",
      "2026-10-26 csdd-apskate 7",
      "2026-10-29 csdd-gada 3",
      "2026-10-30 csdd-apskate 3",
      "2026-10-31 csdd-gada 1",
      "2026-11-01 csdd-apskate 1",
    ]);
  });

  it("push teksts", () => {
    const [r] = dueTerminiReminders({ monthly: [{ id: "pvn-deklaracija", kind: "pvn", day: 20, title: "PVN deklarācija" }] }, {}, at("2026-11-19"));
    const m = adminPushTerminsMessage(r!);
    expect(m.title).toBe("PVN termiņš rīt");
    expect(m.body).toBe("PVN deklarācija - 20.11.2026");
    expect(m.audience).toBe("pro");
    expect(`${m.title} ${m.body}`).not.toMatch(/[—–]/);
  });

  it("vercel.json ieplāno dienas cron", () => {
    const vercel = JSON.parse(readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    expect(vercel.crons.find((c) => c.path === "/api/cron/termini-atgadinajumi")?.schedule).toBe("0 6 * * *");
  });
});
