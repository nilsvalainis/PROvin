import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const listClient = readFileSync("components/admin/IrissSludinajumiListClient.tsx", "utf8");
const notice = readFileSync("components/admin/IrissNewMatchNotice.tsx", "utf8");

describe("IRISS listings toolbar", () => {
  it("sticks only on the phone and stays in normal flow on web", () => {
    const header = listClient.match(/<header[\s\S]*?className="([^"]+)"/);
    expect(header?.[1]).toBeTruthy();
    const cls = header?.[1] ?? "";
    expect(cls).toContain("max-md:sticky");
    expect(cls).toContain("md:static");
    expect(cls).not.toMatch(/(^|\s)sticky(\s|$)/);
  });

  it("keeps the match notice inline with the same toggle labels", () => {
    expect(listClient).toContain("<IrissNewMatchNotice");
    expect(notice).toContain("jaunas atbilstības");
    expect(notice).toContain("Saraksts");
    expect(notice).toContain("Aizvērt");
    expect(notice).not.toContain("w-full");
    expect(notice).toContain("absolute left-0 top-full");
  });
});
