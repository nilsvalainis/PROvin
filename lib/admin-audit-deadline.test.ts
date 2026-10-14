import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUDIT_PREPARATION_DEADLINE_MS,
  AUDIT_PREPARATION_URGENT_MS,
  collectAuditSlaWarningCandidates,
  formatAuditDeadlineRemaining,
  shouldSendAuditSlaWarning,
} from "@/lib/admin-audit-deadline";

describe("formatAuditDeadlineRemaining", () => {
  const created = 1_700_000_000;

  it("is ok when more than 3 h remain", () => {
    const now = created * 1000 + AUDIT_PREPARATION_DEADLINE_MS - 4 * 60 * 60 * 1000;
    expect(formatAuditDeadlineRemaining(created, now).status).toBe("ok");
  });

  it("is urgent at the 3 h threshold, not 6 h", () => {
    const at3h = created * 1000 + AUDIT_PREPARATION_DEADLINE_MS - AUDIT_PREPARATION_URGENT_MS;
    const at5h = created * 1000 + AUDIT_PREPARATION_DEADLINE_MS - 5 * 60 * 60 * 1000;
    expect(formatAuditDeadlineRemaining(created, at3h).status).toBe("urgent");
    expect(formatAuditDeadlineRemaining(created, at5h).status).toBe("ok");
    expect(AUDIT_PREPARATION_URGENT_MS).toBe(3 * 60 * 60 * 1000);
  });

  it("is overdue after 48 h", () => {
    const now = created * 1000 + AUDIT_PREPARATION_DEADLINE_MS + 60_000;
    expect(formatAuditDeadlineRemaining(created, now).status).toBe("overdue");
  });
});

describe("shouldSendAuditSlaWarning", () => {
  it("sends once per deadline unix", () => {
    expect(shouldSendAuditSlaWarning(undefined, 100)).toBe(true);
    expect(shouldSendAuditSlaWarning(100, 100)).toBe(false);
    expect(shouldSendAuditSlaWarning(100, 200)).toBe(true);
  });
});

describe("vercel cron", () => {
  it("registers the audit SLA warning path and stays under the cron cap", () => {
    const vercel = JSON.parse(readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    const sla = vercel.crons.filter((c) => c.path === "/api/cron/admin-audit-sla-warning");
    expect(sla).toHaveLength(1);
    expect(sla[0]!.schedule).toBe("*/15 * * * *");
    expect(vercel.crons.length).toBeLessThanOrEqual(100);
  });
});

describe("collectAuditSlaWarningCandidates", () => {
  it("picks only incomplete non-pack orders inside the 3 h window", () => {
    const nowSec = 10_000;
    const nowMs = nowSec * 1000;
    const urgentCreated = nowSec - (48 * 3600 - 2 * 3600);
    const okCreated = nowSec - 3600;
    const overdueCreated = nowSec - 50 * 3600;
    const rows = [
      { id: "urgent", created: urgentCreated },
      { id: "ok", created: okCreated },
      { id: "overdue", created: overdueCreated },
      { id: "done", created: urgentCreated, auditComplete: true },
      { id: "pack", created: urgentCreated, isB2bPack: true },
    ];
    expect(collectAuditSlaWarningCandidates(rows, nowMs).map((r) => r.id)).toEqual(["urgent"]);
  });
});
