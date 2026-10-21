import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const files = {
  logistika: "components/admin/iriss-logistika/IrissLogistikaClient.tsx",
  strip: "components/admin/IrissPavadzimesPlateStrip.tsx",
  mobileCss: "app/admin/admin-mobile.css",
  staffUsers: "components/admin/IrissStaffUsersClient.tsx",
} as const;

const src = Object.fromEntries(
  Object.entries(files).map(([key, file]) => [key, readFileSync(new URL(`../${file}`, import.meta.url), "utf8")]),
) as Record<keyof typeof files, string>;

describe("Loģistika iPhone platums", () => {
  it("telefonā režģis ir viena kolonna, kas nav platāka par ekrānu", () => {
    expect(src.logistika).toContain(
      "grid grid-cols-[minmax(0,1fr)] items-start gap-3 max-md:px-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,26rem)]",
    );
    expect(src.logistika).toContain("grid grid-cols-[minmax(0,1fr)] gap-3 max-md:px-4 lg:grid-cols-[minmax(16rem,22rem)_1fr]");
  });

  it("KARTE rīkjoslas pogas pārnesas, nevis iziet ārpus kartītes", () => {
    expect(src.logistika).toMatch(/iriss-log-map-toolbar flex flex-wrap/);
    expect(src.logistika).toContain('<div className="flex flex-wrap items-center justify-end gap-1.5">');
  });

  it("visas 3 pavadzīmju zīmes ietilpst rindā - statuss zem numurzīmes", () => {
    expect(src.strip).toMatch(/iriss-plate-strip-item inline-flex min-h-11 shrink-0 flex-col/);
    expect(src.mobileCss).toMatch(/\.iriss-plate-strip-item \.iriss-plate-status \{/);
  });

  it("Iestatījumi - Lietotāji saraksts nepaplašina lapu ar gariem e-pastiem", () => {
    expect(src.staffUsers).toContain("grid grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-[minmax(0,1fr)_320px]");
    expect(src.staffUsers).toContain('<span className="min-w-0 text-[#111827] [overflow-wrap:anywhere]">');
  });

  it("telefonā Auto kabinets pēc pieskāriena rindai tiek aizritināts redzamā zonā", () => {
    expect(src.logistika).toMatch(/matchMedia\("\(max-width: 1023px\)"\)/);
    expect(src.logistika).toMatch(/cabinetRef\.current\?\.scrollIntoView/);
    expect(src.logistika).toContain('ref={cabinetRef} className="iriss-log-cab-overlay scroll-mt-3');
  });
});
