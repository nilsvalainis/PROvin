import { describe, expect, it } from "vitest";
import { renderHtml } from "@/lib/test-render";
import { isIosLike, PrintA4Button, printA4Mode, startIframePrint, withPrintParam } from "./PrintButton";

const MAC = { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/131", platform: "MacIntel", maxTouchPoints: 0 };
const IPHONE = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Safari/604.1", platform: "iPhone", maxTouchPoints: 5 };
const IPADOS = { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", platform: "MacIntel", maxTouchPoints: 5 };

describe("«Drukāt A4» (Nils 20.11)", () => {
  it("dators/Android - slēpta iframe (bez jaunas cilnes); iPhone/iPad - lapa ar autoprint", () => {
    expect(printA4Mode(MAC)).toBe("iframe");
    expect(printA4Mode({ userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/131", platform: "Linux armv8l", maxTouchPoints: 5 })).toBe("iframe");
    expect(printA4Mode(IPHONE)).toBe("open");
    expect(printA4Mode(IPADOS)).toBe("open");
    expect(isIosLike(undefined)).toBe(false);
  });

  it("parametri print / autoprint", () => {
    expect(withPrintParam("/admin/iriss/autoparks-v2/a1/cenu-lapa", "print")).toBe("/admin/iriss/autoparks-v2/a1/cenu-lapa?print=1");
    expect(withPrintParam("/x?y=2", "autoprint")).toBe("/x?y=2&autoprint=1");
  });

  it("poga: teksts «Drukāt A4», saite (bez JS / iPhone) uz ?autoprint=1", () => {
    const html = renderHtml(
      <PrintA4Button className="ap2-btn" href="/admin/iriss/autoparks-v2/a1/cenu-lapa">
        Drukāt A4
      </PrintA4Button>,
    );
    expect(html).toContain('href="/admin/iriss/autoparks-v2/a1/cenu-lapa?autoprint=1"');
    expect(html).toContain("Drukāt A4");
  });

  it("datorā iframe ielādē ?print=1 un pēc ielādes izsauc print() - jauna cilne netiek atvērta", async () => {
    const calls: string[] = [];
    const style: Record<string, string> = {};
    const frame = {
      style,
      tabIndex: 0,
      src: "",
      onload: null as null | (() => Promise<void>),
      setAttribute: () => {},
      contentWindow: { document: { images: [], fonts: { ready: Promise.resolve() } }, focus: () => calls.push("focus"), print: () => calls.push("print") },
    };
    const appended: unknown[] = [];
    const doc = { createElement: (tag: string) => (calls.push(`create:${tag}`), frame), body: { appendChild: (el: unknown) => appended.push(el) } };
    const out = startIframePrint(doc as unknown as Document, "/admin/iriss/autoparks-v2/a1/cenu-lapa");
    expect(out).toBe(frame);
    expect(frame.src).toBe("/admin/iriss/autoparks-v2/a1/cenu-lapa?print=1");
    expect(appended).toEqual([frame]);
    expect(style.position).toBe("fixed");
    expect(calls).toEqual(["create:iframe"]);
    await frame.onload!();
    expect(calls).toEqual(["create:iframe", "focus", "print"]);
  });
});
