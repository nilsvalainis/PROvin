/**
 * Nakts audits 07.11 (8. punkts): lomu matrica allow/deny pret VISIEM reālajiem /api/admin maršrutiem.
 * Tieša API piekļuve iet caur middleware -> decideAdminApiGate -> decideAdminApiAccess (sk. middleware.ts).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  IRISS_SECTIONS,
  decideAdminApiAccess,
  irissSectionMeta,
  isSharedStaffHistoryApiPath,
  isStaffPublicApiPath,
  isStaffSessionApiPath,
  type IrissSection,
} from "@/lib/staff-roles";

function listAdminApiRoutes(): string[] {
  const root = path.join(process.cwd(), "app", "api", "admin");
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (/^route\.(ts|tsx)$/.test(ent.name)) {
        const rel = path.relative(path.join(process.cwd(), "app"), dir).split(path.sep).join("/");
        out.push(`/${rel}`.replace(/\[\.\.\.[^\]]+\]/g, "a/b").replace(/\[[^\]]+\]/g, "x1"));
      }
    }
  };
  walk(root);
  return out.sort();
}

const ROUTES = listAdminApiRoutes();
const staff = (sections: IrissSection[]) => ({ kind: "staff" as const, sections });

/** Maršruti, kas nekad nedrīkst būt pieejami darbiniekam (tikai Nilam). */
const ADMIN_ONLY_PREFIXES = [
  "/api/admin/staff/users",
  "/api/admin/message-templates",
  "/api/admin/manual-orders",
  "/api/admin/order-draft",
  "/api/admin/order-upsell",
  "/api/admin/client-links",
  "/api/admin/vin-history",
];

describe("API lomu matrica (visi maršruti)", () => {
  it("maršruti atrasti", () => {
    expect(ROUTES.length).toBeGreaterThan(100);
  });

  it("anonīms: neviens maršruts nav atļauts, izņemot publiskos (login/uzaicinājums)", () => {
    const leaked = ROUTES.filter((r) => !isStaffPublicApiPath(r) && decideAdminApiAccess(r, { kind: "none" }) === "allow");
    expect(leaked).toEqual([]);
  });

  it("administrators: visi maršruti atļauti", () => {
    expect(ROUTES.filter((r) => decideAdminApiAccess(r, { kind: "admin" }) !== "allow")).toEqual([]);
  });

  it("darbinieks bez sadaļām: tikai sesija un publiskie", () => {
    const allowed = ROUTES.filter((r) => decideAdminApiAccess(r, staff([])) === "allow");
    expect(allowed.filter((r) => !isStaffSessionApiPath(r) && !isStaffPublicApiPath(r))).toEqual([]);
  });

  it("tiesību eskalācija: neviena sadaļu kombinācija neatver darbinieku pārvaldību un PRO API", () => {
    const all = staff([...IRISS_SECTIONS]);
    const leaked = ROUTES.filter(
      (r) => ADMIN_ONLY_PREFIXES.some((p) => r === p || r.startsWith(`${p}/`)) && decideAdminApiAccess(r, all) === "allow",
    );
    expect(leaked).toEqual([]);
  });

  it.each([...IRISS_SECTIONS])("sadaļa %s: atļauts tikai savs prefikss (+ sesija, kopīgā vēsture)", (section) => {
    const own = irissSectionMeta(section).apiPrefixes;
    const allowed = ROUTES.filter((r) => decideAdminApiAccess(r, staff([section])) === "allow");
    const unexpected = allowed.filter(
      (r) =>
        !isStaffSessionApiPath(r) &&
        !isStaffPublicApiPath(r) &&
        !isSharedStaffHistoryApiPath(r) &&
        !own.some((p) => r === p || r.startsWith(p.endsWith("/") ? p : `${p}/`) || r.startsWith(p)),
    );
    expect(unexpected).toEqual([]);
  });
});
