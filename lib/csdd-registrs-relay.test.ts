import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseRegistryFile } from "@/lib/iriss-autoparks-registry";
import { buildRegistryFile, mapHeaders, ownerFromText, summarizeRegistryFile, tableToVehicles } from "@/relay/csdd-registrs/lib/parse-registry.mjs";
import { loginCsdd, ownerLogin, readCredentialFile, readTradeReport } from "@/relay/csdd-registrs/lib/csdd-session.mjs";
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

const CSDD = "https://ows.csdd.gov.lv:7775";

describe("CSDD reģistrs: meklēšanas POST whitelist (rep_lapt_tl)", () => {
  const read = { phase: "read" as const, csddBaseUrl: CSDD };
  const login = { phase: "login" as const, csddBaseUrl: CSDD };

  it("read phase: only the trade report search POST on the CSDD origin", () => {
    expect(isAllowedRequest({ method: "POST", url: `${CSDD}/?main=1&ix=1&v=rep_lapt_tl`, postData: "lra_id=&lapt_veids=1&iskaits=1000" }, read)).toMatchObject({
      allowed: true,
      reason: "csdd_search_post",
    });
    expect(isAllowedRequest({ method: "POST", url: `${CSDD}/?ix=1`, postData: "f=rep_lapt_tl&porcijas_numurs=2" }, read).allowed).toBe(true);
    // Citas CSDD darbības (pavadzīme, pārtraukšana, cits ziņojums) - bloķētas.
    for (const [url, body] of [
      [`${CSDD}/?main=1&ix=1&v=lapv`, "a=3"],
      [`${CSDD}/?main=1&ix=1&v=lapv_par`, "lapv_id=1"],
      [`${CSDD}/?main=1&ix=1&v=rep_lapt_tl_x`, ""],
      [`${CSDD}/?main=1&ix=1&v=rep_lapt`, ""],
      [`${CSDD}/?main=1`, "vards=x"],
    ]) {
      expect(isAllowedRequest({ method: "POST", url, postData: body }, read).allowed).toBe(false);
    }
  });

  it("search POST with a write word or on another origin is refused", () => {
    for (const body of ["v=rep_lapt_tl&btn=Saglabāt", "v=rep_lapt_tl&op=anulet", "v=rep_lapt_tl&x=dz%C4%93st"]) {
      expect(isAllowedRequest({ method: "POST", url: `${CSDD}/`, postData: body }, read)).toMatchObject({ allowed: false, reason: "post_forbidden_action" });
    }
    expect(isAllowedRequest({ method: "POST", url: "https://evil.example/?v=rep_lapt_tl" }, read).allowed).toBe(false);
    expect(isAllowedRequest({ method: "POST", url: `${CSDD}/?v=rep_lapt_tl` }, { phase: "read" }).allowed).toBe(false);
  });

  it("login phase: CSDD login and company choice form posts only; search is not allowed yet", () => {
    expect(isAllowedRequest({ method: "POST", url: `${CSDD}/`, postData: "vards=u&parole=p" }, login)).toMatchObject({ allowed: true, reason: "csdd_login_post" });
    expect(isAllowedRequest({ method: "POST", url: `${CSDD}/?ix=1&v=gli`, postData: "kiest_id=5092" }, login).allowed).toBe(true);
    expect(isAllowedRequest({ method: "POST", url: `${CSDD}/?v=rep_lapt_tl`, postData: "vards=u" }, login).allowed).toBe(false);
    expect(isAllowedRequest({ method: "POST", url: `${CSDD}/`, postData: "lapv_id=1" }, login).allowed).toBe(false);
    expect(isAllowedRequest({ method: "POST", url: `${CSDD}/`, postData: "vards=u" }, read).allowed).toBe(false);
  });

  it("buttons: login/company form button only in login; search form button only in search", () => {
    const loginBtn = { tag: "BUTTON", type: "submit", name: "submit", text: "Ienākt", inLoginForm: true };
    const company = { tag: "BUTTON", type: "submit", name: "submit", text: "Turpināt", inCompanyForm: true };
    const search = { tag: "BUTTON", type: "submit", text: "Atlasīt", onclick: "return ex('rep_lapt_tl',1)", inSearchForm: true };
    expect(isClickAllowed(loginBtn, "login").allowed).toBe(true);
    expect(isClickAllowed(company, "login").allowed).toBe(true);
    expect(isClickAllowed(search, "search").allowed).toBe(true);
    expect(isClickAllowed(loginBtn, "read").allowed).toBe(false);
    expect(isClickAllowed(search, "read").allowed).toBe(false);
    expect(isClickAllowed(search, "login").allowed).toBe(false);
    expect(isClickAllowed({ ...search, inSearchForm: false }, "search").allowed).toBe(false);
    expect(isClickAllowed({ ...search, text: "Dzēst" }, "search").allowed).toBe(false);
    expect(isClickAllowed({ ...loginBtn, text: "Anulēt" }, "login").allowed).toBe(false);
    expect(isClickAllowed({ tag: "A", text: "Atlasīt", href: "#", inSearchForm: true }, "search").allowed).toBe(false);
  });
});

/** CSDD TTR imitācija reģistram: sesija, firmas izvēle, atskaites forma, lapas. Skaita ex() un klikšķus. */
function fakeRegistry(opts: { kiestChoice?: boolean; pages?: string[][][]; loginOk?: boolean } = {}) {
  const s = { view: "login", user: "", kiest: "", choosing: false, ex: [] as string[], clicks: [] as string[], page: 1, checked: false, iskaits: "" };
  const pages = opts.pages || [[["WAUZZZ8K0FA036715", "AUDI A4"]], [["WBA00000000000002", "BMW 330"]]];
  const ops = {
    goto: async () => {
      s.view = s.user ? "main" : "login";
    },
    waitJx: async () => {},
    has: async (sel: string) =>
      sel === "#vards" ? s.view === "login" : sel === "select[name=kiest_id]" ? s.choosing : ["#lapt_veids", "#iskaits"].includes(sel) && s.view === "report",
    fill: async (sel: string, v: string) => {
      if (sel === "#vards") s.user = v;
      if (sel === "#iskaits") s.iskaits = v;
    },
    select: async (_sel: string, v: string) => {
      s.kiest = v;
    },
    options: async () => ["5092", "5281"],
    check: async () => {
      s.checked = true;
    },
    resetSelect: async () => {},
    callEx: async (a: string, b?: number | null, c?: string | null) => {
      s.ex.push(b == null ? a : `${a}|${b}|${c}`);
      if (a === "rep_lapt_tl") s.view = "report";
      if (c) s.page = Number(c.split("=")[1]);
    },
    click: async (sel: string, phase: string) => {
      s.clicks.push(`${sel}@${phase}`);
      if (sel === "button[name=submit]" && s.choosing) s.choosing = false;
      else if (sel === "button[name=submit]") {
        if (opts.loginOk === false) return;
        s.view = "main";
        s.choosing = Boolean(opts.kiestChoice);
      }
    },
    p1Html: async () => (s.page < pages.length ? `<a onclick="ex('rep_lapt_tl',1,'porcijas_numurs=${s.page + 1}')">` : ""),
    tables: async () => [{ headers: ["VIN", "Marka, modelis"], rows: pages[s.page - 1] || [] }],
  };
  return { s, ops };
}

describe("CSDD reģistrs: divas pieslēgšanās un saraksts (mock)", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "csdd-reg-"));
    fs.writeFileSync(path.join(dir, "iriss"), "iriss-user\niriss-pass\n");
    fs.writeFileSync(path.join(dir, "dza.env"), "CSDD_USER=dza-user\nCSDD_PASS=dza-pass\n");
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));
  const env = () => ({ CSDD_TTR_ENV_FILE: path.join(dir, "iriss"), CSDD_TTR_ENV_FILE_DZA: path.join(dir, "dza.env") });

  it("IRISS: CSDD_TTR_ENV_FILE, bez firmas izvēles; DZA: CSDD_TTR_ENV_FILE_DZA + kiest_id 5092", async () => {
    const a = fakeRegistry();
    await loginCsdd(a.ops, ownerLogin("IRISS", env()), { baseUrl: CSDD });
    expect(a.s.user).toBe("iriss-user");
    expect(a.s.kiest).toBe("");
    const b = fakeRegistry({ kiestChoice: true });
    await loginCsdd(b.ops, ownerLogin("DZA", env()), { baseUrl: CSDD });
    expect(b.s.user).toBe("dza-user");
    expect(b.s.kiest).toBe("5092");
    expect(b.s.clicks).toEqual(["button[name=submit]@login", "button[name=submit]@login"]);
  });

  it("DZA bez firmas izvēles vai ĪRISS ar negaidītu izvēli -> stop (nezinām, kuras firmas saraksts)", async () => {
    await expect(loginCsdd(fakeRegistry().ops, ownerLogin("DZA", env()), { baseUrl: CSDD })).rejects.toThrow("csdd_company_choice_missing_DZA");
    await expect(loginCsdd(fakeRegistry({ kiestChoice: true }).ops, ownerLogin("IRISS", env()), { baseUrl: CSDD })).rejects.toThrow(
      "csdd_unexpected_company_choice_IRISS",
    );
    await expect(loginCsdd(fakeRegistry({ loginOk: false }).ops, ownerLogin("IRISS", env()), { baseUrl: CSDD })).rejects.toThrow("csdd_login_failed_IRISS");
    await expect(loginCsdd(fakeRegistry().ops, ownerLogin("DZA", { CSDD_TTR_ENV_FILE_DZA: path.join(dir, "nav") }), { baseUrl: CSDD })).rejects.toThrow(
      "CSDD_TTR_ENV_FILE_DZA",
    );
  });

  it("saraksts: rep_lapt_tl, #lapt_veids, meklēšana, lapošana līdz pēdējai lapai; tikai atļautās darbības", async () => {
    const f = fakeRegistry({ pages: [[["WAUZZZ8K0FA036715", "AUDI A4"]], [["WBA00000000000002", "BMW 330"]], [["WBA00000000000002", "BMW 330"]]] });
    const pages = await readTradeReport(f.ops, { owner: "DZA" });
    expect(f.s.checked).toBe(true);
    expect(f.s.iskaits).toBe("1000");
    expect(f.s.clicks).toEqual(["#p1 button[type=submit]@search"]);
    expect(f.s.ex).toEqual(["rep_lapt_tl", "rep_lapt_tl|1|porcijas_numurs=2", "rep_lapt_tl|1|porcijas_numurs=3"]);
    const file = buildRegistryFile(pages, { owners: ["DZA"], generatedAt: "2026-10-23" });
    expect(file.vehicles.map((v) => [v.vin, v.owner])).toEqual([
      ["WAUZZZ8K0FA036715", "DZA"],
      ["WBA00000000000002", "DZA"],
    ]);
  });

  it("VPN zaudēts lasīšanas laikā -> pārtrauc", async () => {
    await expect(readTradeReport(fakeRegistry().ops, { owner: "IRISS", isLost: () => true })).rejects.toThrow("vpn_lost");
  });

  it("piekļuves faili: KEY=VALUE un divu rindu formāts", () => {
    expect(readCredentialFile(path.join(dir, "dza.env"))).toEqual({ user: "dza-user", pass: "dza-pass" });
    expect(readCredentialFile(path.join(dir, "iriss"))).toEqual({ user: "iriss-user", pass: "iriss-pass" });
    expect(readCredentialFile(path.join(dir, "nav"))).toBeNull();
  });
});
