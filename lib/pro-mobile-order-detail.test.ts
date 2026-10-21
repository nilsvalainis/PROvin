import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { auditDeadlineMs, formatAuditDeadlineRemaining } from "@/lib/admin-audit-deadline";

const HOUR = 60 * 60 * 1000;
const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

describe("PRO order detail deadline banner", () => {
  const created = 1_760_000_000;
  const due = auditDeadlineMs(created);

  it("shows long delays in days, short ones in hours", () => {
    expect(formatAuditDeadlineRemaining(created, due + 3629 * HOUR).label).toBe("Kavējas 151 d");
    expect(formatAuditDeadlineRemaining(created, due + 5 * HOUR).label).toBe("Kavējas 5 h");
    expect(formatAuditDeadlineRemaining(created, due + 10 * 60_000).label).toBe("Termiņš beidzies");
  });

  it("does not repeat 'kavējas' twice in the banner", () => {
    const banner = read("components/admin/AdminAuditSlaWarningBanner.tsx");
    expect(banner).not.toContain("48 h termiņš kavējas (${label})");
    expect(banner).toContain("`48 h termiņš: ${label.charAt(0).toLowerCase()}${label.slice(1)}.`");
  });
});

describe("PRO order detail on phones", () => {
  it("has one back button (mobile top bar) and no duplicated title", () => {
    const view = read("components/admin/AdminOrderDetailView.tsx");
    expect(view).toContain('<div className="mb-2 flex flex-wrap items-center gap-2 max-md:hidden">');
    expect(view).toContain("<span aria-hidden>←</span> Atpakaļ");
    expect(view).not.toContain("</span> Back");
    expect(view).toContain('<span className="max-md:sr-only">Pasūtījums</span>');
  });

  it("uses a normal-case title, names the menu Darbības and drops the stray hint line", () => {
    const ws = read("components/admin/OrderDetailWorkspace.tsx");
    expect(ws).toContain('title={payload.customerName?.trim() || "Pasūtījums"}');
    expect(ws).not.toContain('(payload.customerName || "Pasūtījums").toUpperCase()');
    expect(ws).toContain('<AdminMobileRoundBtn name="vairak" label="Darbības" onClick={() => setMobileMore(true)} />');
    expect(ws).not.toContain('<p className="px-4 pb-2 text-[13px] text-[var(--am-ink2)]">3 maksas avoti ir izvēlnē ⋯</p>');
    expect(ws).toContain('${alertsEmpty ? "max-md:hidden" : ""}');
  });

  it("keeps source titles readable: actions move under the header on phones", () => {
    const shell = read("components/admin/AdminCollapsibleShell.tsx");
    expect(shell).toContain("{phone ? null : (");
    expect(shell).toContain("{phone && (!collapsed || fullscreen) ? (");
    expect(shell).toContain("max-md:h-11 max-md:min-w-11");
  });

  it("makes empty rich text editors shorter on phones", () => {
    expect(read("components/admin/AdminInternalRichCommentEditor.tsx")).toContain("max-md:min-h-[120px]");
  });
});
