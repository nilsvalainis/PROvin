import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AdminWorkspaceSwitch } from "@/components/admin/mobile/AdminWorkspaceSwitch";
import { renderHtml } from "@/lib/test-render";

describe("IRISS|PRO slēdzis", () => {
  it("CSS ir neitrāls: balts segments, zaļš nav slēdzim", () => {
    const css = readFileSync(new URL("../app/admin/mobile/workspace-switch.css", import.meta.url), "utf8");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("background: #ffffff");
    expect(css).not.toContain("#34c759");
    expect(css).not.toContain("#ff3b30");
  });

  it("bez čaulas neder (darbiniekiem PRO nav)", () => {
    expect(renderHtml(<AdminWorkspaceSwitch />)).toBe("");
  });
});
