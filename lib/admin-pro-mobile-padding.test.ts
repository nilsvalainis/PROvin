import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = (name: string) =>
  readFileSync(new URL(`../app/admin/(dashboard)/${name}/page.tsx`, import.meta.url), "utf8");

describe("PRO admin telefonā nepieskaras ekrāna malai", () => {
  it.each(["statistika", "partneri", "blogs", "agregatu-zinasanas", "commission-invoice", "b2b-demo"])(
    "%s saknei ir max-md:px-4",
    (name) => {
      expect(page(name)).toMatch(/className=\{?[`"][^`"]*w-full[^`"]*max-md:px-4/);
    },
  );

  it("kopsavilkums, konsultācijas un eksports atkāpjas tikai tur, kur nebija atkāpes", () => {
    expect(page("kopsavilkums")).toContain('<div className="mt-5 max-md:px-4">');
    expect(page("konsultacijas")).toContain('<div className="max-md:px-4">');
    expect(page("konsultacijas")).toMatch(/border-dashed max-md:mx-4/);
    // Telefonā eksports ir galvenes izvēlnē "Darbības"; lapas apakšā tikai datorā.
    expect(page("dashboard")).toMatch(/border-slate-100\/80 pt-4 max-md:hidden/);
  });
});
