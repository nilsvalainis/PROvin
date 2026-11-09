import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { BlogPostBody } from "@/components/blog/BlogPostBody";
import { renderHtml, renderText } from "@/lib/test-render";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe("BlogPostBody VIN check link", () => {
  it("turns an existing VIN-check phrase into a crawlable href without changing copy", () => {
    const blocks = [
      {
        type: "p" as const,
        text: "Katra VIN koda pārbaude pie mums ir vesels detektīvs.",
      },
    ];
    const html = renderHtml(<BlogPostBody blocks={blocks} locale="lv" />);
    expect(html).toContain('href="/vin-koda-parbaude"');
    expect(html).toContain(">VIN koda pārbaude<");
    expect(
      renderText(<BlogPostBody blocks={blocks} locale="lv" />),
    ).toBe("Katra VIN koda pārbaude pie mums ir vesels detektīvs.");
  });
});
