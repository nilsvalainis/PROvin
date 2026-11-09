import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { LinkedVinCheckText } from "@/components/seo/VinCheckTextLink";
import { renderHtml, renderText } from "@/lib/test-render";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe("LinkedVinCheckText", () => {
  it("renders a crawlable locale-safe href around the existing phrase", () => {
    const html = renderHtml(
      <LinkedVinCheckText text="Katra VIN koda pārbaude pie mums ir vesels detektīvs" locale="lv" />,
    );
    expect(html).toContain('href="/vin-koda-parbaude"');
    expect(html).toContain(">VIN koda pārbaude<");
    expect(html).not.toContain("/vin-koda-parbaude/");
    expect(renderText(<LinkedVinCheckText text="Katra VIN koda pārbaude pie mums ir vesels detektīvs" locale="lv" />)).toBe(
      "Katra VIN koda pārbaude pie mums ir vesels detektīvs",
    );
  });

  it("leaves copy unchanged when there is no VIN-check phrase", () => {
    const html = renderHtml(<LinkedVinCheckText text="Kas ir PROVIN audits?" locale="lv" />);
    expect(html).toBe("Kas ir PROVIN audits?");
    expect(html).not.toContain("href");
  });
});
