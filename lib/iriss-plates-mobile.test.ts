import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const chat = readFileSync(new URL("../components/admin/IrissKomandaAivaramChat.tsx", import.meta.url), "utf8");
const desktop = readFileSync(new URL("../components/admin/IrissWaybillDesktopCreateForm.tsx", import.meta.url), "utf8");

describe("CSDD pavadzīmes numura izvēle", () => {
  it("telefonā rāda kompaktās pilles (pirms #382), nevis zīmētās numurzīmes", () => {
    expect(desktop).toContain('<div className="mb-2 flex gap-1.5 md:hidden">');
    expect(desktop).toMatch(/row\.busy \? "aizņemts" : "brīvs"/);
    expect(desktop).toMatch(/aria-pressed=\{on\}/);
  });

  it("no md un uz datora paliek LvDealerPlate v2", () => {
    expect(desktop).toContain('<div className="mb-2 hidden md:flex md:flex-row md:items-start md:gap-3.5">');
    expect(desktop).toMatch(/<LvDealerPlate/);
    expect(chat).toContain("IrissWaybillDesktopCreateForm");
  });
});
