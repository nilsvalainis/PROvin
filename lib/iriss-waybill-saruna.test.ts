import { describe, expect, it } from "vitest";
import {
  buildWaybillSarunaFeed,
  countSarunaUnread,
  formatSarunaClock,
  formatSarunaDayLabel,
  formatSarunaUnreadBadge,
  isSarunaEscapeKey,
  readSarunaSeenAt,
  sarunaOverlayTitle,
  shouldCloseSarunaOverlay,
  writeSarunaSeenAt,
} from "@/lib/iriss-waybill-saruna";

const NOW = Date.parse("2026-10-26T12:00:00.000Z");

describe("Saruna badge", () => {
  it("hides zero and non-numbers, caps at 99+", () => {
    expect(formatSarunaUnreadBadge(0)).toBeNull();
    expect(formatSarunaUnreadBadge(-3)).toBeNull();
    expect(formatSarunaUnreadBadge(Number.NaN)).toBeNull();
    expect(formatSarunaUnreadBadge(2)).toBe("2");
    expect(formatSarunaUnreadBadge(99)).toBe("99");
    expect(formatSarunaUnreadBadge(100)).toBe("99+");
  });
});

describe("Saruna overlay close", () => {
  it("closes on Esc and X when open", () => {
    expect(shouldCloseSarunaOverlay({ open: true, reason: "escape" })).toBe(true);
    expect(shouldCloseSarunaOverlay({ open: true, reason: "button" })).toBe(true);
    expect(shouldCloseSarunaOverlay({ open: false, reason: "escape" })).toBe(false);
    expect(isSarunaEscapeKey("Escape")).toBe(true);
    expect(isSarunaEscapeKey("Esc")).toBe(false);
  });

  it("closes on outside click only when both down and up are on the backdrop", () => {
    expect(
      shouldCloseSarunaOverlay({
        open: true,
        reason: "outside",
        outside: { mouseDownOnBackdrop: true, mouseUpOnBackdrop: true },
      }),
    ).toBe(true);
    expect(
      shouldCloseSarunaOverlay({
        open: true,
        reason: "outside",
        outside: { mouseDownOnBackdrop: false, mouseUpOnBackdrop: true },
      }),
    ).toBe(false);
  });
});

describe("Saruna feed no pavadzīmēm", () => {
  it("builds day chip, status and PDF card in chronological order", () => {
    const items = buildWaybillSarunaFeed(
      [
        {
          id: "wb_new",
          number: "P02820",
          brandModel: "VW Trader",
          fileName: "PV-1042.pdf",
          issuedAt: "2026-10-26T09:00:00.000Z",
          lifecycle: "active",
        },
        {
          id: "wb_old",
          number: "P02819",
          brandModel: "VW Golf",
          fileName: "",
          issuedAt: "2026-10-25T10:00:00.000Z",
          lifecycle: "expired",
        },
      ],
      NOW,
    );
    expect(items.map((i) => i.kind)).toEqual(["day", "system", "message", "day", "system", "message"]);
    expect(items[0]).toMatchObject({ kind: "day", label: "Vakar" });
    expect(items[1]).toMatchObject({ kind: "system", text: "Statuss → Beigusies" });
    expect(items[2]).toMatchObject({
      kind: "message",
      from: "P02819 · VW Golf",
      attachments: [{ name: "P02819.pdf", href: "/api/admin/iriss-pavadzimes/wb_old/pdf" }],
    });
    expect(items[3]).toMatchObject({ kind: "day", label: "Šodien" });
    expect(items[5]).toMatchObject({
      kind: "message",
      attachments: [{ name: "PV-1042.pdf", href: "/api/admin/iriss-pavadzimes/wb_new/pdf" }],
    });
  });

  it("counts unread after last seen, or last 7 days on first visit", () => {
    const items = buildWaybillSarunaFeed(
      [
        {
          id: "old",
          number: "P1",
          brandModel: "A",
          fileName: "a.pdf",
          issuedAt: "2026-10-01T10:00:00.000Z",
          lifecycle: "expired",
        },
        {
          id: "fresh",
          number: "P2",
          brandModel: "B",
          fileName: "b.pdf",
          issuedAt: "2026-10-26T08:00:00.000Z",
          lifecycle: "active",
        },
      ],
      NOW,
    );
    expect(countSarunaUnread(items, null, NOW)).toBe(2);
    expect(countSarunaUnread(items, "2026-10-26T07:00:00.000Z", NOW)).toBe(2);
    expect(countSarunaUnread(items, "2026-10-26T11:00:00.000Z", NOW)).toBe(0);
  });

  it("formats Riga clock and title", () => {
    expect(formatSarunaClock("2026-10-26T08:42:00.000Z")).toBe("10:42");
    expect(formatSarunaDayLabel("2026-10-26T08:00:00.000Z", NOW)).toBe("Šodien");
    expect(sarunaOverlayTitle("P02819")).toBe("Saruna · P02819");
    expect(sarunaOverlayTitle("")).toBe("Saruna");
  });

  it("remembers last-seen in storage", () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
    };
    expect(readSarunaSeenAt(storage)).toBeNull();
    writeSarunaSeenAt("2026-10-26T12:00:00.000Z", storage);
    expect(readSarunaSeenAt(storage)).toBe("2026-10-26T12:00:00.000Z");
  });
});
