import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { shouldIncludeIrissFromBlob } from "@/lib/admin-drafts-daily-backup";

describe("admin drafts daily backup", () => {
  it("includes IRISS Blob by default", () => {
    const prev = process.env.ADMIN_DRAFT_DAILY_BACKUP_INCLUDE_IRISS_BLOB;
    delete process.env.ADMIN_DRAFT_DAILY_BACKUP_INCLUDE_IRISS_BLOB;
    expect(shouldIncludeIrissFromBlob()).toBe(true);
    if (prev !== undefined) process.env.ADMIN_DRAFT_DAILY_BACKUP_INCLUDE_IRISS_BLOB = prev;
    else delete process.env.ADMIN_DRAFT_DAILY_BACKUP_INCLUDE_IRISS_BLOB;
  });

  it("runs the backup cron at least daily", () => {
    const vercel = JSON.parse(readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    const job = vercel.crons.find((c) => c.path === "/api/cron/admin-drafts-daily-backup");
    expect(job?.schedule).toBe("0 2 * * *");
  });

  it("backs up IRISS scan and pavadzīmes prefixes", () => {
    const src = readFileSync(path.join(process.cwd(), "lib/admin-drafts-daily-backup.ts"), "utf8");
    expect(src).toContain("iriss-scan-fs");
    expect(src).toContain("iriss-pavadzimes-fs");
    expect(src).toContain("iriss-scan-blob");
    expect(src).toContain("iriss-pavadzimes-blob");
  });
});
