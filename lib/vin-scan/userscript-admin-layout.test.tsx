import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { PROVIN_USERSCRIPT_GUARD_SNIPPET } from "@/lib/provin-userscript-presence";
import { renderHtml } from "@/lib/test-render";

/* next/script ārpus Next izpildvides neko nerenderē, tāpēc robežu aizstāj ar vienkāršu <script>, kas parāda saņemtos props. */
vi.mock("next/script", () => ({
  default: (props: { id?: string; strategy?: string; dangerouslySetInnerHTML?: { __html: string } }) => (
    <script id={props.id} data-strategy={props.strategy} dangerouslySetInnerHTML={props.dangerouslySetInnerHTML} />
  ),
}));
vi.mock("@/components/RootHtml", () => ({
  RootHtml: ({ children }: { children: ReactNode }) => <div data-root-html="">{children}</div>,
}));

describe("admin izkārtojums un PROVIN skripta aizsargs", () => {
  it("aizsargs tiek ielikts pirms lapas satura un izpildās pirms hidratācijas", async () => {
    const { default: AdminRootLayout } = await import("@/app/admin/layout");
    const html = renderHtml(
      <AdminRootLayout>
        <main>saturs</main>
      </AdminRootLayout>,
    );
    const script = /<script id="provin-userscript-guard" data-strategy="([^"]+)">([\s\S]*?)<\/script>/.exec(html);
    expect(script?.[1]).toBe("beforeInteractive");
    expect(script?.[2]).toBe(PROVIN_USERSCRIPT_GUARD_SNIPPET);
    expect(html.indexOf("<script")).toBeLessThan(html.indexOf("<main>"));
  });
});
