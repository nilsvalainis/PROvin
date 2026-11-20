/**
 * IRISS audits P1 (20.11): lomu simulācija bez prod lietotājiem.
 * Middleware matrica ir `lib/admin-access-matrix.test.ts`; šeit otrais slānis:
 * 1) KATRS `app/api/admin/iriss*` route handleris un KATRA `app/admin/iriss/**` lapa pati pārbauda tiesības
 *    (saraksts ģenerēts no failu sistēmas - jauns route bez aizsarga krīt);
 * 2) route aizsarga sadaļa sakrīt ar middleware karti (citādi darbinieks redz pogu, bet saņem 403);
 * 3) lapas/API ārpus kartes ir tikai administratoram arī pašā failā;
 * 4) kuras summas katra loma redz (Loģistikas kabinets, Autoparks v1/v2).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCabinetAccessView,
  cabinetActorCanWrite,
  cabinetActorHidesSums,
  cabinetActorSeesTransportCost,
  cabinetRolesFromSections,
} from "@/lib/iriss-logistics-cabinet-access";
import { autoparksV2CanCategory, autoparksV2CanOpen, autoparksV2PermsFor } from "@/lib/iriss-autoparks-v2-perms";
import {
  decideAdminApiAccess,
  decideAdminPageAccess,
  ENV_ADMIN_USER_ID,
  sectionForAdminApiPath,
  sectionForAdminPagePath,
  type IrissSection,
} from "@/lib/staff-roles";

const ROOT = path.resolve(__dirname, "..");
const APP = path.join(ROOT, "app");

function walk(dir: string, file: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full, file);
    return e.name === file ? [full] : [];
  });
}

function urlPath(file: string, suffix: string): string {
  const rel = path.relative(APP, file).replace(/\\/g, "/").replace(new RegExp(`/?${suffix}$`), "");
  const segs = rel
    .split("/")
    .filter((s) => s && !/^\(.+\)$/.test(s))
    .map((s) => (/^\[\[?\.\.\./.test(s) ? "a/b" : /^\[.+\]$/.test(s) ? "x1" : s));
  return `/${segs.join("/")}`;
}

const API_DIR = path.join(APP, "api/admin");
const IRISS_API_FILES = fs
  .readdirSync(API_DIR)
  .filter((n) => n === "iriss" || n.startsWith("iriss-"))
  .flatMap((n) => walk(path.join(API_DIR, n), "route.ts"))
  .sort();
const IRISS_PAGE_FILES = walk(path.join(APP, "admin/iriss"), "page.tsx").sort();

const API_GUARD_RE =
  /\b(requireIrissSectionApi|requireAdminOnlyApi|requireIrissLogisticsApi|requireLogisticsApi|requireAutoparksV2Api|getAdminSession)\s*\(/;
const PAGE_GUARD_RE =
  /\b(requireIrissSectionPage|requireLogisticsPage|requireAdminPage|getAutoparksV2PageActor|getAdminOrStaffActor)\s*\(/;
const HANDLER_RE = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g;

type Handler = { file: string; pathname: string; method: string; body: string };

const HANDLERS: Handler[] = IRISS_API_FILES.flatMap((file) => {
  const src = fs.readFileSync(file, "utf8");
  const ms = [...src.matchAll(HANDLER_RE)];
  return ms.map((m, i) => ({
    file: path.relative(ROOT, file),
    pathname: urlPath(file, "route.ts"),
    method: m[1]!,
    body: src.slice(m.index!, i + 1 < ms.length ? ms[i + 1]!.index : src.length),
  }));
});

const staff = (sections: IrissSection[]) => ({ kind: "staff" as const, sections });
/** Sadaļa kopā ar «atskaite» (bez API), lai tikai-Pavadzīmes partnera šaurākais režīms netraucē kartes pārbaudei. */
const staffFull = (section: IrissSection) => staff([section, "atskaite"]);

/**
 * Route, kas nav middleware kartē (darbinieks saņem 403 jau middleware), bet pats atļauj kādu sadaļu.
 * Apzināti izņēmumi - tikai administratoram līdz atsevišķam lēmumam.
 */
const OFF_CATALOG_STAFF_GUARD_OK = new Set([
  // Sarakstu UI vairs nesauc (pavadzīmju auto nāk caur /api/admin/iriss-pavadzimes); partnerim aizliegts (matricas tests).
  "/api/admin/iriss/autoparks/accepted-for-trade",
]);

describe("IRISS route aizsargi (otrais slānis pēc middleware)", () => {
  it("atrod visus IRISS API un lapas", () => {
    expect(IRISS_API_FILES.length).toBeGreaterThan(100);
    expect(HANDLERS.length).toBeGreaterThan(130);
    expect(IRISS_PAGE_FILES.length).toBeGreaterThan(20);
  });

  it.each(HANDLERS.map((h) => [`${h.method} ${h.pathname}`, h] as const))("%s pats pārbauda tiesības", (_n, h) => {
    expect(API_GUARD_RE.test(h.body), `${h.file} ${h.method} bez aizsarga`).toBe(true);
  });

  it.each(IRISS_PAGE_FILES.map((f) => [urlPath(f, "page.tsx"), f] as const))("lapa %s pati pārbauda tiesības", (_n, f) => {
    expect(PAGE_GUARD_RE.test(fs.readFileSync(f, "utf8")), path.relative(ROOT, f)).toBe(true);
  });

  it("route aizsarga sadaļa sakrīt ar middleware karti (requireIrissSectionApi)", () => {
    const bad: string[] = [];
    for (const h of HANDLERS) {
      for (const m of h.body.matchAll(/requireIrissSectionApi\("([a-z_]+)"\)/g)) {
        const section = m[1] as IrissSection;
        if (OFF_CATALOG_STAFF_GUARD_OK.has(h.pathname)) continue;
        if (decideAdminApiAccess(h.pathname, staffFull(section)) !== "allow") bad.push(`${h.method} ${h.pathname} <- ${section}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("Loģistikas aizsargs: middleware atļauj Loģistikai, Grāmatvedei un Servisam", () => {
    const bad: string[] = [];
    for (const h of HANDLERS) {
      if (!/\brequire(Iriss)?LogisticsApi\(/.test(h.body) || OFF_CATALOG_STAFF_GUARD_OK.has(h.pathname)) continue;
      for (const s of ["logistika", "gramatvede", "serviss"] as const) {
        if (decideAdminApiAccess(h.pathname, staff([s])) !== "allow") bad.push(`${h.method} ${h.pathname} <- ${s}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("Autoparks v2 aizsargs: kategorija = middleware ap_* ceļš; vēsture un saknes rīki tikai adminam", () => {
    const map: Record<string, IrissSection> = {
      pamatdati: "ap_pamatdati",
      iegade: "ap_iegade",
      serviss: "ap_serviss",
      izdevumi: "ap_izdevumi",
      cenu_lapa: "ap_cenu_lapa",
    };
    for (const h of HANDLERS) {
      for (const m of h.body.matchAll(/requireAutoparksV2Api\("([a-z_]+)"\)/g)) {
        const cat = m[1]!;
        const section = map[cat];
        const mw = section ? decideAdminApiAccess(h.pathname, staff([section])) : "forbidden";
        // Ja middleware atļauj kategoriju, tai jābūt tieši šī route kategorijai (nevis citai, piem. serviss -> pamatdati).
        if (mw === "allow") expect(sectionForAdminApiPath(h.pathname), `${h.method} ${h.pathname}`).toBe(section);
        else expect(sectionForAdminApiPath(h.pathname), `${h.method} ${h.pathname} (tikai admins)`).toBeNull();
      }
    }
  });

  it("API ārpus middleware kartes failā prasa administratoru (vai ir apzināts izņēmums)", () => {
    const bad: string[] = [];
    for (const h of HANDLERS) {
      if (sectionForAdminApiPath(h.pathname) || OFF_CATALOG_STAFF_GUARD_OK.has(h.pathname)) continue;
      const adminOnly = /\b(requireAdminOnlyApi|getAdminSession)\s*\(/.test(h.body);
      const v2 = /requireAutoparksV2Api\(/.test(h.body); // ārpus kartes v2 ceļš = middleware tikai adminam
      if (!adminOnly && !v2) bad.push(`${h.method} ${h.pathname}`);
    }
    expect(bad).toEqual([]);
  });

  it("lapas ārpus middleware kartes prasa administratoru (izņemot IRISS sākumu un PD ieeju)", () => {
    const bad: string[] = [];
    for (const f of IRISS_PAGE_FILES) {
      const p = urlPath(f, "page.tsx");
      if (p === "/admin/iriss" || sectionForAdminPagePath(p)) continue;
      if (!/\brequireAdminPage\s*\(/.test(fs.readFileSync(f, "utf8"))) bad.push(p);
    }
    expect(bad).toEqual([]);
  });

  it("requireIrissSectionPage sadaļa sakrīt ar middleware karti", () => {
    const bad: string[] = [];
    for (const f of IRISS_PAGE_FILES) {
      const p = urlPath(f, "page.tsx");
      for (const m of fs.readFileSync(f, "utf8").matchAll(/requireIrissSectionPage\("([a-z_]+)"\)/g)) {
        if (decideAdminPageAccess(p, staffFull(m[1] as IrissSection)) !== "allow") bad.push(`${p} <- ${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("PD veidotājs / Pasūtījumi", () => {
  const pd = staff(["pasutijumi"]);

  it("PD (piedāvājumi ar maržu) paliek tikai administratoram; ieeja «jauns» novirza uz veco formu", () => {
    for (const p of ["/admin/iriss/piedavajumi", "/admin/iriss/piedavajumi/x1", "/admin/iriss/piedavajumi/x1/pdf", "/admin/iriss/piedavajumi/x1/skats"]) {
      expect([p, decideAdminPageAccess(p, pd)]).toEqual([p, "forbidden"]);
    }
    for (const p of ["/api/admin/iriss-piedavajumi", "/api/admin/iriss-piedavajumi/x1", "/api/admin/iriss-piedavajumi/cars", "/api/admin/iriss-piedavajumi/x1/foto/1"]) {
      expect([p, decideAdminApiAccess(p, pd)]).toEqual([p, "forbidden"]);
    }
    expect(decideAdminPageAccess("/admin/iriss/piedavajumi/jauns", pd)).toBe("allow");
    const src = fs.readFileSync(path.join(APP, "admin/iriss/piedavajumi/jauns/page.tsx"), "utf8");
    // Darbiniekam redirect PIRMS requireAdminPage un datu ielādes.
    expect(src.indexOf("redirect(irissCreateOfferHrefLegacy")).toBeGreaterThan(0);
    expect(src.indexOf("redirect(irissCreateOfferHrefLegacy")).toBeLessThan(src.indexOf("await requireAdminPage()"));
  });

  it("vecās formas avoti (offer-seed) - Pasūtījumi + avota sadaļa route līmenī", () => {
    expect(decideAdminApiAccess("/api/admin/iriss-offer-seed/translate-damage", pd)).toBe("allow");
    for (const rel of ["route.ts", "cars/route.ts", "photo/route.ts"]) {
      const src = fs.readFileSync(path.join(API_DIR, "iriss-offer-seed", rel), "utf8");
      expect(src, rel).toContain('requireIrissSectionApi("pasutijumi")');
      expect(src, rel).toContain("requireIrissSectionApi(offerSourceSection(");
    }
    // Citām lomām offer-seed nav.
    for (const s of ["logistika", "gramatvede", "serviss", "pavadzimes", "ap_pamatdati"] as const) {
      expect([s, decideAdminApiAccess("/api/admin/iriss-offer-seed", staff([s]))]).toEqual([s, "forbidden"]);
    }
  });
});

describe("summu redzamība pa lomām", () => {
  type Row = { name: string; sections: IrissSection[]; hideSums: boolean; write: boolean; transport: boolean };
  const ROWS: Row[] = [
    { name: "tikai Loģistika (bez Autoparka v2)", sections: ["logistika"], hideSums: true, write: true, transport: false },
    { name: "tikai Serviss", sections: ["serviss"], hideSums: true, write: true, transport: false },
    { name: "tikai Grāmatvede", sections: ["gramatvede"], hideSums: false, write: false, transport: false },
    { name: "Loģistika + Grāmatvede", sections: ["logistika", "gramatvede"], hideSums: false, write: true, transport: false },
    { name: "tikai Pavadzīmes", sections: ["pavadzimes"], hideSums: false, write: false, transport: false },
    { name: "PD veidotājs (Pasūtījumi)", sections: ["pasutijumi"], hideSums: false, write: false, transport: false },
  ];

  it.each(ROWS)("Loģistikas kabinets: $name", (r) => {
    const q = { userId: "usr_x", roles: cabinetRolesFromSections(r.sections), carId: "c1" };
    expect(cabinetActorHidesSums(q)).toBe(r.hideSums);
    expect(cabinetActorCanWrite(q)).toBe(r.write);
    expect(cabinetActorSeesTransportCost(q)).toBe(r.transport);
  });

  it("bez kabineta lomas (Pavadzīmes / Pasūtījumi) Loģistikas API tāpat aizliegts middleware", () => {
    for (const s of [["pavadzimes"], ["pasutijumi"]] as IrissSection[][]) {
      expect(decideAdminApiAccess("/api/admin/iriss-logistics/orders", staff(s))).toBe("forbidden");
      expect(decideAdminApiAccess("/api/admin/iriss-logistics/autoparks", staff(s))).toBe("forbidden");
    }
  });

  it("transporta izmaksas redz tikai admins", () => {
    expect(cabinetActorSeesTransportCost({ userId: ENV_ADMIN_USER_ID, roles: [] })).toBe(true);
    expect(buildCabinetAccessView({ userId: ENV_ADMIN_USER_ID, roles: [], carId: "" }, []).hideSums).toBe(false);
  });

  it("Grāmatvede redz kabineta sadaļas A un C (ne B) tikai piešķirtiem auto", () => {
    const q = { userId: "usr_g", roles: cabinetRolesFromSections(["gramatvede"]), carId: "c1" };
    expect(buildCabinetAccessView(q, []).sections).toEqual([]);
    const rules = [{ id: "r1", userId: "usr_g", carId: "c1", allow: true }] as never;
    expect(buildCabinetAccessView(q, rules).sections).toEqual(["A", "C"]);
  });

  it("Loģistika neredz kabineta sadaļu A (pirkuma rēķini); Serviss redz C", () => {
    const lq = { userId: "u", roles: cabinetRolesFromSections(["logistika"]), carId: "c1" };
    expect(buildCabinetAccessView(lq, []).sections).not.toContain("A");
    const sq = { userId: "u", roles: cabinetRolesFromSections(["serviss"]), carId: "c1" };
    expect(buildCabinetAccessView(sq, []).sections).toContain("C");
    expect(buildCabinetAccessView(sq, []).sections).not.toContain("A");
  });

  describe("Autoparks v2: katra ap_* tiesība atsevišķi", () => {
    const CATS = ["pamatdati", "iegade", "serviss", "izdevumi", "cenu_lapa"] as const;
    const SINGLE: Array<[IrissSection, (typeof CATS)[number] | null]> = [
      ["ap_pamatdati", "pamatdati"],
      ["ap_iegade", "iegade"],
      ["ap_serviss", "serviss"],
      ["ap_izdevumi", "izdevumi"],
      ["ap_cenu_lapa", "cenu_lapa"],
      ["ap_summas", null],
    ];

    it.each(SINGLE)("%s", (section, cat) => {
      const perms = autoparksV2PermsFor({ kind: "staff", sections: [section] }, true);
      for (const c of CATS) expect([c, autoparksV2CanCategory(perms, c)]).toEqual([c, c === cat]);
      expect(autoparksV2CanOpen(perms)).toBe(cat !== null);
      expect(perms.summas).toBe(section === "ap_summas");
      expect(perms.pasizmaksa).toBe(false);
      expect(perms.vesture).toBe(false);
      expect(perms.admin).toBe(false);
    });

    it("pašizmaksa tikai ar ap_iegade + ap_summas; karogs izslēgts = nekā", () => {
      expect(autoparksV2PermsFor({ kind: "staff", sections: ["ap_iegade", "ap_summas"] }, true).pasizmaksa).toBe(true);
      const off = autoparksV2PermsFor({ kind: "staff", sections: ["ap_pamatdati", "ap_iegade", "ap_summas"] }, false);
      expect(autoparksV2CanOpen(off)).toBe(false);
      expect(off.summas).toBe(false);
    });

    it("v1 lomas (Loģistika/Grāmatvede/Serviss) nedod Autoparks v2", () => {
      for (const s of ["logistika", "gramatvede", "serviss", "pasutijumi", "pavadzimes"] as const) {
        expect(autoparksV2CanOpen(autoparksV2PermsFor({ kind: "staff", sections: [s] }, true))).toBe(false);
        expect(decideAdminPageAccess("/admin/iriss/autoparks-v2", staff([s]))).toBe("forbidden");
      }
    });
  });
});
