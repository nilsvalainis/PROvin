import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({ Barlow_Condensed: () => ({ className: "font", style: {} }) }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/iriss/pavadzimes",
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
}));

import { IrissPavadzimesListClient } from "@/components/admin/IrissPavadzimesListClient";
import { IrissVpnControl } from "@/components/admin/IrissVpnControl";
import { renderHtml, renderText } from "@/lib/test-render";

const rowBase = {
  number: "26A1",
  brandModel: "VW Golf",
  vin: "",
  plate: "B192-7",
  issuedAt: "2026-10-01T10:00:00.000Z",
  fileName: "x.pdf",
  validityTone: "expired" as const,
};

function page(isAdmin = true) {
  return (
    <IrissPavadzimesListClient
      isAdmin={isAdmin}
      initial={{
        rows: [
          { ...rowBase, id: "old1", validUntil: "2026-10-03T10:00:00.000Z" },
          { ...rowBase, id: "old2", validUntil: "2026-10-05T10:00:00.000Z" },
        ] as never,
        pendingParse: 0,
        dropboxConfigured: true,
        dropboxError: null,
      }}
    />
  );
}

describe("Pavadzīmju lapa v2", () => {
  it("nav 'Pievienot PDF' ne telefonā, ne datorā; nav PDF augšupielādes lauka", () => {
    const html = renderHtml(page());
    expect(renderText(page())).not.toContain("Pievienot PDF");
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain("Izvēlēties PDF");
  });

  it("telefona sākumā arhīvs ir tikai maza saite pašā apakšā aiz VPN pogas", () => {
    const text = renderText(page());
    const vpn = text.indexOf("Man vajag VPN");
    const archive = text.indexOf("Arhīvs (2) ›");
    expect(vpn).toBeGreaterThan(-1);
    expect(archive).toBeGreaterThan(vpn);
    // "Vēl" sadaļā vairs nav Arhīva un PDF, tikai Kalendārs.
    const more = text.slice(text.indexOf("Vēl"), vpn);
    expect(more).toContain("Kalendārs");
    expect(more).not.toContain("Arhīvs");
  });

  it("darbinieks neredz VPN / servera vadību un paziņojumu slēdzi, arhīva saite paliek", () => {
    const text = renderText(page(false));
    expect(text).not.toContain("Man vajag VPN");
    expect(text).not.toContain("VPN");
    expect(text).toContain("Arhīvs (2) ›");
  });
});

describe("Aktīvā karte: Pārtraukt", () => {
  it("shows PDF, Pagarināt, Pārtraukt and Vēsture on a live card", () => {
    const page = (
      <IrissPavadzimesListClient
        isAdmin
        initial={{
          rows: [
            {
              ...rowBase,
              id: "wb_p02819",
              number: "P02819",
              vin: "WVWZZZ3CZWE123456",
              validUntil: "2026-11-01T10:00:00.000Z",
              validityTone: "ok",
              lifecycle: "active",
            },
          ] as never,
          pendingParse: 0,
          dropboxConfigured: true,
          dropboxError: null,
        }}
      />
    );
    const text = renderText(page);
    expect(text).toContain("PDF");
    expect(text).toContain("Pagarināt");
    expect(text).toContain("Pārtraukt");
    expect(text).toContain("Vēsture");
    expect(text).not.toMatch(/anul/i);
    const html = renderHtml(page);
    expect(html).toContain("border-[#DC2626]");
    expect(html).toContain("min-h-11");
  });
});

describe("VPN kontrole", () => {
  it("telefona kartīte: liela poga 'Man vajag VPN'; datora variants paliek kompakts", () => {
    const card = renderHtml(<IrissVpnControl variant="card" />);
    expect(card).toContain('aria-label="VPN un serveris"');
    expect(card).toContain("h-[60px]");
    expect(renderText(<IrissVpnControl variant="card" />)).toContain("Man vajag VPN");
    const inline = renderHtml(<IrissVpnControl />);
    expect(inline).not.toContain("VPN un serveris");
    expect(renderText(<IrissVpnControl />)).toContain("Man vajag VPN");
  });
});
