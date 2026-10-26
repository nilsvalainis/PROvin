import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const PAGE_ROOTS: ReadonlyArray<{ file: string; root: RegExp }> = [
  { file: "components/admin/IrissScanListClient.tsx", root: /className="iriss-radars-view[^"]*"/ },
  { file: "app/admin/iriss/iestatijumi/page.tsx", root: /className="iriss-iestatijumi-view[^"]*"/ },
  { file: "components/admin/IrissStaffUsersClient.tsx", root: /className="relative min-h-full w-full[^"]*"/ },
  { file: "app/admin/iriss/sludinajumi/page.tsx", root: /className="relative min-h-full w-full max-w-none[^"]*"/ },
  { file: "app/admin/iriss/pavadzimes/page.tsx", root: /className="relative min-h-full w-full max-w-none[^"]*"/ },
  { file: "components/admin/IrissOrderRoom.tsx", root: /className="iriss-parskats-view[^"]*"/ },
  { file: "components/admin/IrissLogisticsAppShell.tsx", root: /className="iriss-admin-scope min-h-dvh[^"]*"/ },
  { file: "components/admin/IrissStaffAppShell.tsx", root: /className="iriss-admin-scope iriss-staff-shell flex[^"]*"/ },
];

describe("IRISS page roots stay transparent over the shell gradient", () => {
  it("forbids page-level bg-[...] on listed roots", () => {
    for (const { file, root } of PAGE_ROOTS) {
      const src = readFileSync(file, "utf8");
      const match = src.match(root);
      expect(match, file).toBeTruthy();
      expect(match?.[0], file).not.toMatch(/bg-\[/);
    }
  });

  it("keeps drawer and modal surfaces painted", () => {
    const drawer = readFileSync("components/admin/IrissScanLinksDrawer.tsx", "utf8");
    expect(drawer).toContain('bg-[var(--bg-base)]');
    expect(drawer).toContain("Rediģēt saites");
    expect(drawer).toContain("Pievienot saiti");
  });
});
