import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildMorningSummary } from "@/lib/admin-morning-summary";
import {
  authorizeMorningSummaryCron,
  buildMorningSummaryEmail,
  getMorningSummaryRecipients,
  isMorningSummarySendSlot,
  morningSummaryAdminUrl,
  MORNING_SUMMARY_CRON_UTC_SCHEDULE,
  parseMorningSummaryRecipients,
} from "@/lib/admin-morning-summary-email";

const NOW = Date.parse("2026-10-13T08:00:00.000+03:00");
const PAGE = "https://provin.lv/admin/kopsavilkums";

function expectCleanCopy(text: string) {
  expect(text).not.toContain("\u2014");
  expect(text).not.toContain("\u2013");
  expect(text.toLowerCase()).not.toContain("eksperts");
  expect(text.toLowerCase()).not.toContain("whatsapp");
}

describe("admin-morning-summary-email", () => {
  it("vercel.json fires the morning summary at the DST-safe UTC hours", () => {
    const vercel = JSON.parse(readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    const job = vercel.crons.filter((c) => c.path === "/api/cron/morning-summary");
    expect(job).toHaveLength(1);
    expect(job[0]!.schedule).toBe(MORNING_SUMMARY_CRON_UTC_SCHEDULE);
    expect(job[0]!.schedule).toBe("0 5,6 * * *");
    expect(vercel.crons.length).toBeLessThanOrEqual(100);
  });

  it("sends only at 08:00 Europe/Riga in both DST offsets", () => {
    expect(isMorningSummarySendSlot(Date.parse("2026-10-13T05:00:00.000Z"))).toBe(true);
    expect(isMorningSummarySendSlot(Date.parse("2026-10-13T06:00:00.000Z"))).toBe(false);
    expect(isMorningSummarySendSlot(Date.parse("2026-01-15T06:00:00.000Z"))).toBe(true);
    expect(isMorningSummarySendSlot(Date.parse("2026-01-15T05:00:00.000Z"))).toBe(false);
  });

  it("reads recipients only from MORNING_SUMMARY_TO", () => {
    expect(parseMorningSummaryRecipients("")).toEqual([]);
    expect(parseMorningSummaryRecipients("not-an-email")).toEqual([]);
    expect(parseMorningSummaryRecipients("nils@example.lv, extra@provin.lv")).toEqual([
      "nils@example.lv",
      "extra@provin.lv",
    ]);
    expect(getMorningSummaryRecipients("")).toEqual([]);
    expect(getMorningSummaryRecipients("  ops@example.lv ")).toEqual(["ops@example.lv"]);
  });

  it("protects the cron with CRON_SECRET Bearer", () => {
    expect(authorizeMorningSummaryCron("Bearer secret", undefined)).toEqual({
      ok: false,
      status: 503,
      error: "missing_cron_secret",
    });
    expect(authorizeMorningSummaryCron(null, "secret")).toEqual({
      ok: false,
      status: 401,
      error: "missing_authorization",
    });
    expect(authorizeMorningSummaryCron("Bearer nope", "secret")).toEqual({
      ok: false,
      status: 403,
      error: "forbidden",
    });
    expect(authorizeMorningSummaryCron("Bearer secret", "secret")).toEqual({ ok: true });
  });

  it("builds a short Latvian HTML email with the admin page link", () => {
    const created = Math.floor((NOW - 50 * 3600_000) / 1000);
    const due = Math.floor((NOW - 47 * 3600_000) / 1000);
    const summary = buildMorningSummary(
      [
        { id: "overdue", created, makeModel: "Audi A4" },
        { id: "due", created: due, vin: "VINURGENT" },
      ],
      [
        {
          id: "peek-new",
          createdAt: new Date(NOW - 3 * 3600_000).toISOString(),
          status: "new",
          email: "peek@ok.lv",
          listingUrl: "https://ss.com/msg/1",
        },
      ],
      NOW,
    );
    const mail = buildMorningSummaryEmail(summary, { pageUrl: PAGE, nowMs: NOW });

    expect(mail.subject).toBe("PROVIN: rīta kopsavilkums, 13. oktobris, 1 kavēti");
    expect(mail.text).toContain("Atvērti: 3");
    expect(mail.text).toContain("Kavētie auditi (48 h)");
    expect(mail.text).toContain("Audi A4");
    expect(mail.text).toContain("Šodienas termiņi");
    expect(mail.text).toContain("VINURGENT");
    expect(mail.text).toContain("Jauni ātrie vērtējumi (24 h)");
    expect(mail.text).toContain("ss.com");
    expect(mail.text).toContain(PAGE);
    expect(mail.html).toContain("Rīta kopsavilkums");
    expect(mail.html).toContain("Atvērti");
    expect(mail.html).toContain("Steidzami");
    expect(mail.html).toContain("Kavēti");
    expect(mail.html).toContain("Audi A4");
    expect(mail.html).toContain("VINURGENT");
    expect(mail.html).toContain("ss.com");
    expect(mail.html).toContain(`href="${PAGE}"`);
    expect(mail.html).toContain("Atvērt kopsavilkumu");
    expect(morningSummaryAdminUrl("https://provin.lv/")).toBe(PAGE);
    expectCleanCopy(mail.subject);
    expectCleanCopy(mail.text);
    expectCleanCopy(mail.html);
  });

  it("says the queue is quiet when nothing is due", () => {
    const created = Math.floor((NOW - 8 * 3600_000) / 1000);
    const summary = buildMorningSummary([{ id: "ok", created, customerName: "Jānis" }], [], NOW);
    const mail = buildMorningSummaryEmail(summary, { pageUrl: PAGE, nowMs: NOW });
    expect(mail.subject).toBe("PROVIN: rīta kopsavilkums, 13. oktobris");
    expect(mail.text).toContain("Kavētu auditu nav, un pēdējās 24 h nav jaunu vērtējumu.");
    expect(mail.html).toContain("Kavētu auditu nav, un pēdējās 24 h nav jaunu vērtējumu.");
    expect(mail.html).toContain(PAGE);
    expectCleanCopy(mail.subject);
    expectCleanCopy(mail.text);
    expectCleanCopy(mail.html);
  });

  it("includes izmaksu sliekšņus in the morning mail", () => {
    const summary = buildMorningSummary([{ id: "ok", created: Math.floor((NOW - 8 * 3600_000) / 1000) }], [], NOW);
    summary.costAlerts = [
      {
        source: "apify",
        label: "Apify (mobile.de, AutoScout24)",
        level: 80,
        percent: 80,
        usd: 3.6,
        limitUsd: 4.5,
        units: 14,
        limitUnits: null,
        hard: true,
      },
    ];
    const mail = buildMorningSummaryEmail(summary, { pageUrl: PAGE, nowMs: NOW });
    expect(mail.text).toContain("Izmaksas");
    expect(mail.text).toContain("Apify: 80 %, 3,60 $ / 4,50 $");
    expect(mail.html).toContain("Izmaksas");
    expect(mail.html).toContain("Apify");
    expectCleanCopy(mail.text);
    expectCleanCopy(mail.html);
  });
});
