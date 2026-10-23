/**
 * Piekļuves matrica: KATRS `app/api/admin/**` route (katra metode) un KATRA `/admin` lapa x lomas.
 * Darbiniekam atļauts tikai tas, kas zemāk ir viņa sadaļu allowlist; viss pārējais - 401/403 (API) vai
 * redirect uz sākumu (lapas). Jauns route, kas nav allowlist, automātiski tiek sagaidīts kā aizliegts.
 * Allowlist šeit ir apzināti atsevišķa kopija (nevis `IRISS_SECTION_CATALOG`), lai kartes paplašināšana
 * bez šī testa labošanas uzreiz krīt.
 */
import { createHmac } from "crypto";
import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import middleware from "../middleware";
import { ADMIN_SESSION_TOKEN_TYP } from "@/lib/admin-session-token";
import { STAFF_SESSION_TOKEN_TYP } from "@/lib/staff-session-token";
import { IRISS_SECTIONS, type IrissSection } from "@/lib/staff-roles";

vi.mock("next-intl/middleware", () => ({ default: () => () => NextResponse.next() }));

const SECRET = "test-admin-secret-0123456789";
const SITE = "https://www.provin.lv";
const APP_DIR = path.resolve(__dirname, "../app");

/** Sadaļa -> atļautie API prefiksi (neatkarīga kopija no lib/staff-roles.ts). */
const API_ALLOW: Record<IrissSection, readonly string[]> = {
  pasutijumi: ["/api/admin/iriss-pasutijumi", "/api/admin/change-history"],
  sludinajumi: ["/api/admin/iriss-listings", "/api/admin/change-history"],
  radars: ["/api/admin/iriss-scan", "/api/admin/iriss-marketplace"],
  logistika: ["/api/admin/iriss/logistika", "/api/admin/iriss-logistics"],
  gramatvede: ["/api/admin/iriss/logistika", "/api/admin/iriss-logistics"],
  serviss: ["/api/admin/iriss/logistika", "/api/admin/iriss-logistics"],
  pavadzimes: ["/api/admin/iriss-pavadzimes", "/api/admin/iriss/waybill-requests", "/api/admin/change-history"],
  vin: ["/api/admin/vin-scan", "/api/admin/vin-sources", "/api/admin/outvin", "/api/admin/csdd-tech-data"],
  atskaite: [],
  ap_pamatdati: ["/api/admin/iriss-autoparks-v2/pamatdati"],
  ap_iegade: ["/api/admin/iriss-autoparks-v2/iegade"],
  ap_serviss: ["/api/admin/iriss-autoparks-v2/serviss"],
  ap_izdevumi: ["/api/admin/iriss-autoparks-v2/izdevumi"],
  ap_cenu_lapa: ["/api/admin/iriss-autoparks-v2/cenu-lapa"],
  ap_summas: [],
};

/** Sadaļa -> atļautās lapas. */
const PAGE_ALLOW: Record<IrissSection, readonly string[]> = {
  pasutijumi: ["/admin/iriss/pasutijumi"],
  sludinajumi: ["/admin/iriss/sludinajumi"],
  radars: ["/admin/iriss/scan"],
  logistika: ["/admin/iriss/logistika", "/admin/iriss/autoparks"],
  gramatvede: ["/admin/iriss/logistika", "/admin/iriss/autoparks"],
  serviss: ["/admin/iriss/logistika", "/admin/iriss/autoparks"],
  pavadzimes: ["/admin/iriss/pavadzimes"],
  vin: ["/admin/vin-scan"],
  atskaite: ["/admin/iriss/atskaite"],
  ap_pamatdati: ["/admin/iriss/autoparks-v2"],
  ap_iegade: ["/admin/iriss/autoparks-v2"],
  ap_serviss: ["/admin/iriss/autoparks-v2"],
  ap_izdevumi: ["/admin/iriss/autoparks-v2"],
  ap_cenu_lapa: ["/admin/iriss/autoparks-v2"],
  ap_summas: [],
};

/** Bez sesijas (login, uzaicinājums) un jebkuram aktīvam darbiniekam (iziet, 2FA). */
const API_PUBLIC = ["/api/admin/login", "/api/admin/staff/accept-invite"];
const API_ANY_STAFF = ["/api/admin/logout", "/api/admin/iriss/logistika/totp"];
/** Partnerim (tikai Pavadzīmes) papildus aizliegts arī Pavadzīmju sadaļā: augšupielāde un izmaiņu vēsture. */
const API_WAYBILL_ONLY_DENY = ["/api/admin/iriss-pavadzimes/upload", "/api/admin/change-history"];
const PAGE_PUBLIC = ["/admin/login", "/admin/uzaicinajums"];

type Role = { name: string; kind: "admin" } | { name: string; kind: "staff"; sections: IrissSection[] };

/** Pirmais gadījums: partneris tikai ar Pavadzīmēm. */
const ROLES: Role[] = [
  { name: "tikai Pavadzīmes (partneris)", kind: "staff", sections: ["pavadzimes"] },
  { name: "tikai Autoparks (Serviss)", kind: "staff", sections: ["serviss"] },
  { name: "tikai Loģistika", kind: "staff", sections: ["logistika"] },
  { name: "visa IRISS bez PRO", kind: "staff", sections: [...IRISS_SECTIONS] },
  // Autoparks v2 (IETEIKUMI 6. sadaļa): B, C, D, E.
  { name: "Autoparks B - tikai pamatdati", kind: "staff", sections: ["ap_pamatdati"] },
  { name: "Autoparks C - pamatdati + serviss", kind: "staff", sections: ["ap_pamatdati", "ap_serviss"] },
  { name: "Autoparks D - pamatdati + serviss + summas", kind: "staff", sections: ["ap_pamatdati", "ap_serviss", "ap_summas"] },
  { name: "Autoparks E - grāmatvede", kind: "staff", sections: ["ap_pamatdati", "ap_iegade", "ap_izdevumi", "ap_summas"] },
  { name: "tikai Summas (bez kategorijas)", kind: "staff", sections: ["ap_summas"] },
  { name: "admin", kind: "admin" },
];

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function sign(payload: object): string {
  const b = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${b}.${createHmac("sha256", SECRET).update(b).digest("hex")}`;
}

function cookieFor(role: Role | null): string | undefined {
  if (!role) return undefined;
  const exp = Date.now() + 60_000;
  if (role.kind === "admin") return `provin_admin_session=${sign({ typ: ADMIN_SESSION_TOKEN_TYP, exp })}`;
  return `provin_staff_session=${sign({
    typ: STAFF_SESSION_TOKEN_TYP,
    sid: "ses_abcdefgh",
    uid: "usr_abcdefgh",
    role: "logistics",
    sections: role.sections,
    exp,
  })}`;
}

function walk(dir: string, file: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return walk(full, file);
    return e.name === file ? [full] : [];
  });
}

/** `app/api/admin/a/[id]/b/route.ts` -> `/api/admin/a/x1/b`; `(grupa)` segmenti izmesti. */
function urlPath(file: string, suffix: string): string {
  const rel = path.relative(APP_DIR, file).replace(/\\/g, "/").replace(new RegExp(`/?${suffix}$`), "");
  const segs = rel
    .split("/")
    .filter((s) => s && !/^\(.+\)$/.test(s))
    .map((s) => (/^\[\[?\.\.\./.test(s) ? "a/b" : /^\[.+\]$/.test(s) ? "x1" : s));
  return `/${segs.join("/")}`;
}

const METHOD_RE = /export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g;

const API_ROUTES = walk(path.join(APP_DIR, "api/admin"), "route.ts").flatMap((file) => {
  const pathname = urlPath(file, "route.ts");
  const methods = [...new Set([...fs.readFileSync(file, "utf8").matchAll(METHOD_RE)].map((m) => m[1]!))];
  return methods.map((method) => ({ pathname, method }));
});

const PAGES = walk(path.join(APP_DIR, "admin"), "page.tsx").map((file) => urlPath(file, "page.tsx"));

function expectedApi(role: Role, pathname: string): "allow" | "deny" {
  if (API_PUBLIC.some((p) => under(pathname, p))) return "allow";
  if (role.kind === "admin") return "allow";
  if (API_ANY_STAFF.some((p) => under(pathname, p))) return "allow";
  if (role.sections.length === 1 && role.sections[0] === "pavadzimes" && API_WAYBILL_ONLY_DENY.some((p) => under(pathname, p))) {
    return "deny";
  }
  return role.sections.some((s) => API_ALLOW[s].some((p) => under(pathname, p))) ? "allow" : "deny";
}

function expectedPage(role: Role, pathname: string): "allow" | "home" {
  if (PAGE_PUBLIC.some((p) => under(pathname, p))) return "allow";
  if (role.kind === "admin") return "allow";
  if (pathname === "/admin/iriss") return "allow";
  // Partnerim (tikai Pavadzīmes) vienīgā lapa ir IRISS sākums.
  if (role.sections.length === 1 && role.sections[0] === "pavadzimes") return "home";
  return role.sections.some((s) => PAGE_ALLOW[s].some((p) => under(pathname, p))) ? "allow" : "home";
}

async function hitApi(pathname: string, method: string, cookie?: string): Promise<number> {
  const headers: Record<string, string> = { host: "www.provin.lv", origin: SITE };
  if (cookie) headers.cookie = cookie;
  return (await middleware(new NextRequest(new URL(`${SITE}${pathname}`), { method, headers }))).status;
}

describe("admin piekļuves matrica (deny-by-default)", () => {
  beforeEach(() => vi.stubEnv("ADMIN_SECRET", SECRET));
  afterEach(() => vi.unstubAllEnvs());

  it("atrod visus admin API route un lapas", () => {
    expect(API_ROUTES.length).toBeGreaterThan(200);
    expect(PAGES.length).toBeGreaterThan(30);
  });

  describe.each(ROLES)("$name", (role) => {
    const cookie = cookieFor(role);

    it.each(API_ROUTES)("API $method $pathname", async ({ pathname, method }) => {
      const status = await hitApi(pathname, method, cookie);
      if (expectedApi(role, pathname) === "allow") expect(status).toBe(200);
      else expect([401, 403]).toContain(status);
    });

    it.each(PAGES)("lapa %s", async (pathname) => {
      const res = await middleware(new NextRequest(new URL(`${SITE}${pathname}`), { headers: { host: "www.provin.lv", cookie: cookie! } }));
      if (expectedPage(role, pathname) === "allow") {
        expect(res.status).toBe(200);
      } else {
        expect(res.status).toBe(307);
        expect(new URL(res.headers.get("location")!).pathname).toBe("/admin/iriss");
        expect(await res.text()).toBe("");
      }
    });
  });

  it("bez sesijas katrs ne-publisks admin API atbild 401", async () => {
    for (const { pathname, method } of API_ROUTES) {
      if (API_PUBLIC.some((p) => under(pathname, p)) || under(pathname, "/api/admin/logout")) continue;
      expect([pathname, await hitApi(pathname, method)]).toEqual([pathname, 401]);
    }
  });

  it("jauns route, kas nav allowlist, ir aizliegts katram darbiniekam (arī ar punktu ceļā)", async () => {
    for (const role of ROLES) {
      if (role.kind !== "staff") continue;
      const cookie = cookieFor(role);
      expect(await hitApi("/api/admin/jauns-nekartets-route", "GET", cookie)).toBe(403);
      expect(await hitApi("/api/admin/iriss/jauns", "POST", cookie)).toBe(403);
      expect(await hitApi("/api/admin/iriss-pasutijumi-x/fails.pdf", "GET", cookie)).toBe(403);
    }
  });

  it("partneris (tikai Pavadzīmes) nevar sasniegt VPN, pasūtījumus, klientus, statistiku, failus un meklēšanu", async () => {
    const cookie = cookieFor(ROLES[0]!);
    for (const p of [
      "/api/admin/iriss/vpn",
      "/api/admin/iriss-pasutijumi",
      "/api/admin/iriss-pasutijumi/x1/print",
      "/api/admin/iriss-logistics/autoparks/files/x1",
      "/api/admin/iriss/autoparks/accepted-for-trade",
      "/api/admin/badges",
      "/api/admin/push",
      "/api/admin/menu-layout",
      "/api/admin/limits",
      "/api/admin/vin-history",
      "/api/admin/change-history",
      "/api/admin/iriss-pavadzimes/upload",
    ]) {
      expect([p, await hitApi(p, "GET", cookie)]).toEqual([p, 403]);
    }
    expect(await hitApi("/api/admin/iriss/waybill-requests", "POST", cookie)).toBe(200);
    expect(await hitApi("/api/admin/iriss-pavadzimes/x1/pdf", "GET", cookie)).toBe(200);
    expect(await hitApi("/api/admin/iriss-pavadzimes", "GET", cookie)).toBe(200);
  });

  it("Autoparks v2: vēsture un nekartēts v2 ceļš ir tikai administratoram; v2 kategorija nedod v1 Autoparku", async () => {
    const all = cookieFor(ROLES.find((r) => r.name === "visa IRISS bez PRO")!);
    for (const p of ["/api/admin/iriss-autoparks-v2/vesture/x1", "/api/admin/iriss-autoparks-v2/jauns", "/api/admin/iriss-autoparks-v2"]) {
      expect([p, await hitApi(p, "GET", all)]).toEqual([p, 403]);
    }
    const e = cookieFor(ROLES.find((r) => r.name === "Autoparks E - grāmatvede")!);
    expect(await hitApi("/api/admin/iriss-logistics/autoparks", "GET", e)).toBe(403);
    expect(await hitApi("/api/admin/iriss-autoparks-v2/serviss/x1", "GET", e)).toBe(403);
    expect(await hitApi("/api/admin/iriss-autoparks-v2/cenu-lapa/x1", "GET", e)).toBe(403);
    expect(await hitApi("/api/admin/iriss-autoparks-v2/iegade/x1", "GET", e)).toBe(200);
    const s = cookieFor(ROLES.find((r) => r.name === "tikai Summas (bez kategorijas)")!);
    expect(await hitApi("/api/admin/iriss-autoparks-v2/pamatdati", "GET", s)).toBe(403);
  });

  it("PRO paliek atdalīts: VIN vēsture (PRO klienti) ir tikai administratoram, arī visai IRISS", async () => {
    const cookie = cookieFor(ROLES.find((r) => r.name === "visa IRISS bez PRO")!);
    for (const method of ["GET", "POST"]) {
      expect(await hitApi("/api/admin/vin-history", method, cookie)).toBe(403);
    }
    expect(await hitApi("/api/admin/vin-history", "GET", cookieFor({ name: "admin", kind: "admin" }))).toBe(200);
  });
});
