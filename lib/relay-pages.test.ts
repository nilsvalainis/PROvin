import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { emptyCsddFields } from "@/lib/admin-source-blocks";
import { applyCsddPasteToForm, parseCsddPaste } from "@/lib/csdd-paste-parse";
import { classifySnapshot as classifyEcsdd, formatTadatiPanels, pickAccountIndex } from "@/relay/provin-ecsdd/lib/ecsdd-page.mjs";
import { classifySnapshot as classifyLtab, extractAccidentCount } from "@/relay/provin-ltab/lib/ltab-page.mjs";

/**
 * Fiksācijas: lib/__fixtures__/relay-pages/*.html - īstās lapas PĒC pieteikšanās (23.11.2026), anonimizētas:
 * vārds -> JĀNIS BĒRZIŅŠ, personas kods -> 010101-12345, numurs -> AB1234, VIN -> WBAFB71080LV00001,
 * uzņēmumi -> PIEMĒRS AUTO / PARAUGS. snapshots.json = releju `snapshot()` (un `collectTadatiPanels()`) rezultāts
 * šīm lapām Chromium pārlūkā.
 */
const FIX = path.join(__dirname, "__fixtures__", "relay-pages");
type Snap = Record<string, unknown> & { host: string; text: string };
type Panels = { panels: { title: string; rows: string[][] }[]; footer: string };
const SNAPS = JSON.parse(fs.readFileSync(path.join(FIX, "snapshots.json"), "utf8")) as Record<string, Snap & { tadati?: Panels }>;

describe("releju lapas pēc pieteikšanās: fiksācijas", () => {
  it("contain no real personal codes and every page has a snapshot", () => {
    const html = fs.readdirSync(FIX).filter((f) => f.endsWith(".html"));
    expect(Object.keys(SNAPS).sort()).toEqual(html.map((f) => f.replace(/\.html$/, "")).sort());
    for (const f of fs.readdirSync(FIX)) {
      const codes = fs.readFileSync(path.join(FIX, f), "utf8").match(/(?<![\d-])\d{6}-?\d{5}(?![\d-])/g) ?? [];
      expect(codes.filter((c) => c !== "010101-12345"), f).toEqual([]);
    }
  });
});

describe("LTAB relejs: ielogota lapa (#regNumber) un rezultāts", () => {
  it("recognises the logged-in search form; the signed-in name never reaches the snapshot", () => {
    const snap = SNAPS["ltab-search-form"];
    expect(snap.host).toBe("services.ltab.lv");
    expect(classifyLtab(snap)).toBe("ltab_search");
    expect(snap.loggedIn).toBe(true);
    expect(snap.text).not.toMatch(/BĒRZIŅŠ|JĀNIS|010101/);
    expect(snap.text).toContain("*** Beigt darbu");
  });

  it("before submit the result page is still 'search'; after submit 'Negadījumu skaits 0' = no claims, with the PDF button", () => {
    const snap = SNAPS["ltab-result-none"];
    expect(classifyLtab(snap)).toBe("ltab_search");
    expect(classifyLtab(snap, { submitted: true })).toBe("ltab_result_none");
    expect(extractAccidentCount(snap.text)).toBe(0);
    expect(snap.hasPrint).toBe(true);
    expect(snap.text).toContain("Valsts numura zīme AB1234");
  });

  it("a non-zero accident count is a result with claims even if the page also says 'nav ...'", () => {
    const base = SNAPS["ltab-result-none"];
    const text = base.text.replace("Negadījumu skaits 0", "Negadījumu skaits 2").replace(/Uz [^©]*?neviens negadījums/, "CSNg 12.03.2024 nav norādīts");
    expect(extractAccidentCount(text)).toBe(2);
    expect(classifyLtab({ ...base, text }, { submitted: true })).toBe("ltab_result_found");
    expect(extractAccidentCount("Negadījumu skaits: 12 Apdrošināšanas")).toBe(12);
    expect(extractAccidentCount("Transportlīdzekļa zaudējumu dati")).toBeNull();
  });

  it("after submit without any result still reports the search form (flow -> page_changed with debug)", () => {
    expect(classifyLtab(SNAPS["ltab-search-form"], { submitted: true })).toBe("ltab_search");
  });
});

describe("e.csdd relejs: konta izvēle un tadati", () => {
  it("recognises 'Izvēlies kontu', the logged-in home (logout hidden in the menu) and the tadati result", () => {
    expect(classifyEcsdd(SNAPS["ecsdd-account-choose"])).toBe("ecsdd_account_choose");
    expect(classifyEcsdd(SNAPS["ecsdd-home-logged-in"])).toBe("ecsdd_logged_in");
    expect(classifyEcsdd(SNAPS["ecsdd-tadati-result"], { submitted: true })).toBe("tadati_result");
  });

  it("picks the private person by default, a company only by an unambiguous name fragment", () => {
    const accounts = SNAPS["ecsdd-account-choose"].accounts as { id: string; name: string }[];
    expect(accounts).toHaveLength(3);
    expect(pickAccountIndex(accounts)).toBe(0);
    expect(pickAccountIndex(accounts, "person")).toBe(0);
    expect(pickAccountIndex(accounts, "paraugs")).toBe(2);
    expect(pickAccountIndex(accounts, "Piemers auto")).toBe(1);
    expect(pickAccountIndex(accounts, "sabiedrība")).toBe(-1);
    expect(pickAccountIndex(accounts, "nav tāda")).toBe(-1);
    // privātpersona nav pirmā un bez id "1"
    expect(pickAccountIndex([{ id: "7", name: 'SIA "X"' }, { id: "9", name: "ANNA OZOLA" }])).toBe(1);
    expect(pickAccountIndex([{ id: "7", name: 'SIA "X"' }])).toBe(-1);
  });

  it("builds the CSDD raw text from ALL accordion panels (also the closed ones), tab separated like a manual paste", () => {
    const { panels, footer } = SNAPS["ecsdd-tadati-result"].tadati as Panels;
    const raw = formatTadatiPanels(panels, footer, ["010101-12345"]);
    expect(raw.startsWith("Tehniskie dati\nPārbaudes veids:\tPamatpārbaude")).toBe(true);
    expect(raw).toContain("Reģistrācijas numurs:\tAB1234");
    expect(raw).toContain("\nDetalizētais vērtējums\nKods\tNovērtējums:\tTrūkumi vai bojājumi\n4.4.3.\t1\t");
    expect(raw).toContain("\nNobraukuma vēsture LV\nDatums:\tOdometrs\tNobraukums\n12.02.2026\t317679\t6705");
    expect(raw).toContain("Būtiski bojājumi CSNg");
    expect(raw).toContain("Informācija sagatavota elektroniski");
    expect(raw).not.toMatch(/svg|fill-rule|BĒRZIŅŠ|JĀNIS/);
    // innerText redz tikai atvērto paneli - tāpēc paneļus lasām no DOM
    expect(SNAPS["ecsdd-tadati-result"].text).not.toContain("310974");
  });

  it("the raw text is understood by the existing CSDD paste parser (inspection + mileage history)", () => {
    const { panels, footer } = SNAPS["ecsdd-tadati-result"].tadati as Panels;
    const raw = formatTadatiPanels(panels, footer);
    const form = applyCsddPasteToForm(emptyCsddFields(), raw, parseCsddPaste(raw));
    const odo = form.mileageHistory.map((r) => r.odometer);
    expect(odo).toContain("317679");
    expect(odo).toContain("291180");
    expect(JSON.stringify(form)).toContain("12.02.2027");
  });

  it("no panels -> empty (flow falls back to the visible text)", () => {
    expect(formatTadatiPanels([], "x")).toBe("");
  });
});
