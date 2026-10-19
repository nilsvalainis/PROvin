import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const listClient = readFileSync("components/admin/IrissSludinajumiListClient.tsx", "utf8");
const notice = readFileSync("components/admin/IrissNewMatchNotice.tsx", "utf8");

describe("IRISS listings toolbar", () => {
  it("uses collapsing TopBar on the phone and a static toolbar on web", () => {
    expect(listClient).toContain("AdminMobileTopBar");
    const header = listClient.match(/data-iriss-listings-toolbar[\s\S]*?className="([^"]+)"/);
    expect(header?.[1]).toBeTruthy();
    const cls = header?.[1] ?? "";
    expect(cls).toContain("hidden");
    expect(cls).toContain("md:block");
    expect(cls).toContain("md:static");
    expect(cls).not.toContain("max-md:sticky");
  });

  it("keeps the match notice as a toolbar badge and the same list action", () => {
    const toolsAt = listClient.indexOf('aria-label="Vairāk"');
    const noticeAt = listClient.indexOf("<IrissNewMatchNotice");
    expect(toolsAt).toBeGreaterThan(0);
    expect(noticeAt).toBeGreaterThan(toolsAt);
    expect(notice).toContain("jaunas atbilstības");
    expect(notice).toContain("Saraksts");
    expect(notice).toContain("Aizvērt");
    expect(notice).toContain("rounded-full");
    expect(notice).not.toContain("w-full");
    expect(notice).toContain("absolute right-0 top-full");
  });
});
