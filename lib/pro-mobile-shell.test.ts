import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRO_MOBILE_BACK_PATHS, proMobileNeedsBack } from "@/lib/admin-mobile-shell";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

describe("PRO mobile shell", () => {
  it("shows ‹ Atpakaļ on Vairāk list pages only, not on tabs or detail screens", () => {
    for (const p of ["/admin/statistika", "/admin/partneri/", "/admin/izmaksas", "/admin/blogs"]) {
      expect(proMobileNeedsBack(p)).toBe(true);
    }
    for (const p of ["/admin/dashboard", "/admin/vin-scan", "/admin/atras-vertesanas", "/admin/partneri/abc", "/admin/iriss/pasutijumi"]) {
      expect(proMobileNeedsBack(p)).toBe(false);
    }
    expect(PRO_MOBILE_BACK_PATHS).toContain("/admin/kopsavilkums");
  });

  it("renders the back row in the PRO shell and search in the dock", () => {
    const shell = read("components/admin/AdminShell.tsx");
    expect(shell).toContain("const showProBack = isProWorkspace && proMobileNeedsBack(pathname);");
    expect(shell).toContain("{showProBack ? <AdminMobileBackRow /> : null}");
    expect(shell).toContain("<AdminMobileSearchButton />");
    const chrome = read("components/admin/mobile/AdminMobileChrome.tsx");
    expect(chrome).toContain("export function AdminMobileBackRow");
    expect(chrome).toContain("router.back()");
  });
});
