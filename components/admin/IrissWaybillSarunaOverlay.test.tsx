import { describe, expect, it } from "vitest";
import {
  IrissWaybillSarunaButton,
  IrissWaybillSarunaFeed,
  IrissWaybillSarunaOverlay,
} from "@/components/admin/IrissWaybillSarunaOverlay";
import { buildWaybillSarunaFeed } from "@/lib/iriss-waybill-saruna";
import { renderHtml, renderText } from "@/lib/test-render";

const NOW = Date.parse("2026-10-26T12:00:00.000Z");

const feed = buildWaybillSarunaFeed(
  [
    {
      id: "wb_1042",
      number: "P02819",
      brandModel: "VW Trader",
      fileName: "PV-1042.pdf",
      issuedAt: "2026-10-26T08:00:00.000Z",
      lifecycle: "active",
    },
  ],
  NOW,
);

describe("Saruna ikona un badge", () => {
  it("closed: icon button, red badge, no dialog", () => {
    const html = renderHtml(<IrissWaybillSarunaButton open={false} unreadCount={2} onClick={() => undefined} />);
    expect(html).toContain('aria-label="Saruna"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('data-saruna-badge="2"');
    expect(html).toContain("#FF3B30");
    expect(html).toContain(">2<");
    expect(html).not.toContain('role="dialog"');
  });

  it("hides badge when unread is 0", () => {
    const html = renderHtml(<IrissWaybillSarunaButton open={false} unreadCount={0} onClick={() => undefined} />);
    expect(html).toContain('aria-label="Saruna"');
    expect(html).not.toContain("data-saruna-badge");
    expect(html).not.toContain("#FF3B30");
  });

  it("open icon is filled, still no badge after read", () => {
    const html = renderHtml(<IrissWaybillSarunaButton open unreadCount={0} onClick={() => undefined} />);
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("bg-[#1d1d1f]");
    expect(html).not.toContain("data-saruna-badge");
  });
});

describe("Saruna overlay open/close", () => {
  it("closed overlay renders nothing", () => {
    const html = renderHtml(
      <IrissWaybillSarunaOverlay open={false} onClose={() => undefined} title="Saruna" items={feed} />,
    );
    expect(html).toBe("");
    expect(html).not.toContain("data-saruna-overlay");
  });

  it("open: floating dialog, X, outside backdrop, PDF cards, composer", () => {
    const html = renderHtml(
      <IrissWaybillSarunaOverlay
        open
        onClose={() => undefined}
        title="Saruna · P02819"
        subtitle="Pavadzīmju vēsture"
        items={feed}
      />,
    );
    const text = renderText(
      <IrissWaybillSarunaOverlay
        open
        onClose={() => undefined}
        title="Saruna · P02819"
        subtitle="Pavadzīmju vēsture"
        items={feed}
      />,
    );
    expect(html).toContain('data-saruna-overlay="open"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-label="Saruna · P02819"');
    expect(html).toContain('aria-label="Aizvērt"');
    expect(html).toContain('aria-label="Aizvērt sarunu"');
    expect(html).toContain("bg-black/20");
    expect(html).toContain("PV-1042.pdf");
    expect(html).toContain("/api/admin/iriss-pavadzimes/wb_1042/pdf");
    expect(html).toContain("Raksti ziņu");
    expect(text).toContain("Statuss → Derīga");
    expect(text).toContain("Šodien");
    expect(text).not.toMatch(/\u2014|\u2013/);
  });
});

describe("Saruna feed kartītes", () => {
  it("renders attachment as a card, not a raw filename line", () => {
    const html = renderHtml(<IrissWaybillSarunaFeed items={feed} />);
    expect(html).toContain("data-saruna-feed");
    expect(html).toContain("PV-1042.pdf");
    expect(html).toContain("rounded-[10px] border border-[#e5e5ea]");
    expect(html).toContain("text-[#FF3B30]");
  });
});
