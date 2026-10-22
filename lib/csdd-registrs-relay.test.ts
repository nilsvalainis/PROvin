import { describe, expect, it } from "vitest";
import { parseRegistryFile } from "@/lib/iriss-autoparks-registry";
import { buildRegistryFile, mapHeaders, ownerFromText, summarizeRegistryFile, tableToVehicles } from "@/relay/csdd-registrs/lib/parse-registry.mjs";
import { installReadOnlyGuard, isAllowedRequest, isClickAllowed, safeClick } from "@/relay/csdd-registrs/lib/readonly-guard.mjs";

const LOGIN_RE = /j_security_check/i;

describe("CSDD reģistrs: tikai lasīšana (tīkls)", () => {
  it("allows GET/HEAD, blocks every other method", () => {
    for (const method of ["GET", "HEAD"]) expect(isAllowedRequest({ method, url: "https://ows.csdd.gov.lv:7775/x" }, { phase: "read" }).allowed).toBe(true);
    for (const method of ["PUT", "DELETE", "PATCH"]) expect(isAllowedRequest({ method, url: "https://ows.csdd.gov.lv:7775/x" }, { phase: "login", loginPostRe: LOGIN_RE }).allowed).toBe(false);
  });

  it("POST only to the login URL during login; never in the read phase", () => {
    const login = { method: "POST", url: "https://ows.csdd.gov.lv:7775/j_security_check", postData: "j_username=x" };
    expect(isAllowedRequest(login, { phase: "login", loginPostRe: LOGIN_RE }).allowed).toBe(true);
    expect(isAllowedRequest(login, { phase: "read", loginPostRe: LOGIN_RE }).allowed).toBe(false);
    expect(isAllowedRequest({ method: "POST", url: "https://ows.csdd.gov.lv:7775/akts/save" }, { phase: "login", loginPostRe: LOGIN_RE }).allowed).toBe(false);
  });

  it("allowlisted search POST is still refused when it carries a write action", () => {
    const policy = { phase: "read" as const, readPostRe: /\/meklet/ };
    expect(isAllowedRequest({ method: "POST", url: "https://h/meklet", postData: "vin=&page=2" }, policy).allowed).toBe(true);
    for (const body of ["action=Saglabāt", "btn=Anulēt", "op=atcelt", "cmd=delete", "x=Apstiprin%C4%81t"]) {
      expect(isAllowedRequest({ method: "POST", url: "https://h/meklet", postData: body }, policy).allowed).toBe(false);
    }
  });
});

describe("CSDD reģistrs: tikai lasīšana (pogas)", () => {
  it("never clicks write buttons in any phase", () => {
    for (const text of ["Saglabāt", "Atcelt", "Anulēt", "Dzēst", "Apstiprināt", "Iesniegt", "Noņemt no tirdzniecības", "Save"]) {
      expect(isClickAllowed({ tag: "BUTTON", text }, "read").allowed).toBe(false);
      expect(isClickAllowed({ tag: "BUTTON", text }, "login").allowed).toBe(false);
      expect(isClickAllowed({ tag: "A", text, href: "/x" }, "read").allowed).toBe(false);
    }
    expect(isClickAllowed({ tag: "A", text: "Nākamā", href: "/p?x", onclick: "form.submit()" }, "read").allowed).toBe(false);
  });

  it("read phase: only plain href links; login phase: only the login button", () => {
    expect(isClickAllowed({ tag: "A", text: "Nākamā", href: "/saraksts?lapa=2" }, "read").allowed).toBe(true);
    expect(isClickAllowed({ tag: "A", text: "Nākamā", href: "javascript:go(2)" }, "read").allowed).toBe(false);
    expect(isClickAllowed({ tag: "BUTTON", text: "Meklēt", type: "submit" }, "read").allowed).toBe(false);
    expect(isClickAllowed({ tag: "BUTTON", text: "Pieslēgties", type: "submit" }, "login").allowed).toBe(true);
    expect(isClickAllowed({ tag: "BUTTON", text: "Pieslēgties", type: "submit" }, "read").allowed).toBe(false);
  });

  it("safeClick refuses a forbidden element without clicking it", async () => {
    let clicked = false;
    const locator = {
      evaluate: async () => ({ tag: "BUTTON", text: "Anulēt aktu", type: "button" }),
      click: async () => {
        clicked = true;
      },
    };
    await expect(safeClick(locator as never, "read")).rejects.toThrow(/readonly_guard_click_refused/);
    expect(clicked).toBe(false);
  });

  it("guard aborts non-GET requests and dismisses dialogs on the browser context", async () => {
    type Handler = (route: unknown) => Promise<void>;
    let handler: Handler | null = null;
    const dialogs: string[] = [];
    const ctx = {
      route: async (_p: string, h: Handler) => {
        handler = h;
      },
      on: () => {},
      pages: () => [{ on: (_e: string, cb: (d: unknown) => void) => cb({ type: () => "confirm", dismiss: async () => dialogs.push("dismissed") }) }],
    };
    const guard = await installReadOnlyGuard(ctx as never, { loginPostRe: LOGIN_RE });
    guard.setPhase("read");
    const calls: string[] = [];
    const route = (method: string, url: string) => ({
      request: () => ({ method: () => method, url: () => url, postData: () => null }),
      continue: async () => void calls.push(`continue ${method}`),
      abort: async () => void calls.push(`abort ${method}`),
    });
    await handler!(route("GET", "https://h/saraksts"));
    await handler!(route("POST", "https://h/akts/anulet"));
    await handler!(route("POST", "https://h/j_security_check"));
    expect(calls).toEqual(["continue GET", "abort POST", "abort POST"]);
    expect(guard.blocked).toHaveLength(2);
    expect(dialogs).toEqual(["dismissed"]);
  });
});

describe("CSDD reģistra tabula -> PROVIN JSON", () => {
  const table = {
    headers: ["Nr.", "VIN", "Marka, modelis", "Reģ. nr.", "Akta nr.", "Akta datums", "Odometrs, km", "Statuss", "Tirgotājs", "Īpašnieka vārds"],
    rows: [
      ["1", "WAUZZZ8K0FA036715", "AUDI A4 AVANT", "AB1234", "TA-2026-0042", "01.10.2026", "123 456", "Tirdzniecībā", "SIA ĪRISS", "Jānis Bērziņš"],
      ["2", "WBA00000000000002", "BMW 330", "", "TA-2026-0043", "02.10.2026", "", "Pārdots", "SIA DZINTARZEME AUTO", "Anna"],
      ["3", "", "bez VIN", "", "", "", "", "", "", ""],
    ],
  };

  it("maps Latvian headers; act nr. is not mistaken for plate", () => {
    const m = mapHeaders(table.headers);
    expect(m).toMatchObject({ vin: 1, makeModel: 2, tradeActNo: 4, tradeActDate: 5, odometerKm: 6, status: 7, owner: 8 });
    expect(Object.values(m)).not.toContain(3);
  });

  it("builds the same v1 schema the importer reads, with owner and snapshot, without personal data", () => {
    const file = buildRegistryFile([{ tables: [table] }], { owners: ["IRISS", "DZA"], generatedAt: "2026-10-23" });
    expect(JSON.stringify(file)).not.toMatch(/Jānis|Bērziņš|Anna|AB1234/);
    expect(file.vehicles).toHaveLength(2);
    expect(file.vehicles[0]).toEqual({
      vin: "WAUZZZ8K0FA036715",
      owner: "IRISS",
      makeModel: "AUDI A4 AVANT",
      odometerKm: 123456,
      status: "Tirdzniecībā",
      tradeAct: { number: "TA-2026-0042", date: "01.10.2026" },
    });
    const parsed = parseRegistryFile(file);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.snapshot).toEqual({ complete: true, owners: ["IRISS", "DZA"] });
    expect(parsed.file.vehicles[1]).toMatchObject({ owner: "DZA", values: { tradeActNo: "TA-2026-0043", tradeActDate: "2026-10-02", status: "Pārdots" } });
    expect(summarizeRegistryFile(file)).toEqual({ total: 2, byOwner: { IRISS: 1, DZA: 1 }, byStatus: { Tirdzniecībā: 1, Pārdots: 1 } });
  });

  it("per-owner pages use the page owner; unknown owner text stays unknown", () => {
    const t = { headers: ["VIN", "Marka", "Modelis"], rows: [["WBA00000000000009", "BMW", "X5"]] };
    expect(tableToVehicles(t, "DZA")[0]).toMatchObject({ owner: "DZA", makeModel: "BMW X5" });
    expect(tableToVehicles(t, undefined)[0]!.owner).toBeUndefined();
    expect(ownerFromText("Jānis Bērziņš")).toBeUndefined();
    expect(ownerFromText('SIA "ĪRISS"')).toBe("IRISS");
  });
});
