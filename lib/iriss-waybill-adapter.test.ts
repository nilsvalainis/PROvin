import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AUTO_WAYBILL_PLATES } from "@/lib/iriss-waybill-auto";
import { scriptInput } from "@/scripts/iriss-ttr/waybill-worker-core.mjs";
import { createLedger, isClickAllowed, parseJobInput, runRefill, runSave } from "@/scripts/iriss-ttr/waybill-scripts-core.mjs";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapterMod: any = require("../scripts/iriss-ttr/waybill-adapter.cjs");

type Opt = { value: string; text: string };
type Phase = "login" | "fill" | "save" | "pdf";

const IRISS_REPS: Opt[] = [
  { value: "", text: "" },
  { value: "1065584", text: "NILS VALAINIS" },
  { value: "77", text: "CITS CILVĒKS" },
];
const DZA_REPS: Opt[] = [
  { value: "", text: "" },
  { value: "505410", text: "TAIVO BATINS" },
  { value: "88", text: "LAINE DABIŅA" },
];
const MAKES: Opt[] = [
  { value: "", text: "" },
  { value: "13644", text: "AUDI" },
  { value: "875", text: "VOLKSWAGEN" },
  { value: "900", text: "MERCEDES-BENZ" },
  { value: "910", text: "BMW" },
];
const MODELS: Record<string, Opt[]> = {
  "875": [
    { value: "45036", text: "T-ROC" },
    { value: "45000", text: "GOLF" },
  ],
  "900": [
    { value: "4955", text: "E350" },
    { value: "4956", text: "E 220" },
  ],
  "910": [
    { value: "5100", text: "330" },
    { value: "5101", text: "330" },
  ],
};
/** Adrešu koks: Tukuma novads (324393) > TUKUMS > R > RĪGAS IELA > 7 > 75. */
const TREE: Record<string, [string, "setKavSel" | "expand", string][]> = {
  "324393": [
    ["1001", "setKavSel", "TUKUMS"],
    ["1002", "setKavSel", "TALSI"],
  ],
  "1001": [
    ["2001", "expand", "R"],
    ["2002", "expand", "S"],
  ],
  "2001": [
    ["3001", "setKavSel", "RĪGAS IELA"],
    ["3002", "setKavSel", "RAIŅA IELA"],
  ],
  "3001": [["4001", "expand", "7"]],
  "4001": [
    ["345777", "setKavSel", "75"],
    ["345778", "setKavSel", "77"],
  ],
};
const treeHtml = (id: string) =>
  (TREE[id] || []).map(([i, fn, t]) => `<a class="lp" id="i01_a${i}" onclick="return ${fn}('i01',${i})" href="#" title="${t}">${t}</a>`).join("\n");

type Company = "iriss" | "dza";

/** CSDD TTR imitācija: atceras sesiju, formu, ex() izsaukumus un klikšķus (ar fāzi). */
function fakeCsdd(opts: { company?: Company; freePlates?: string[]; acts?: string[]; kiestChoice?: boolean; lra?: string[]; saveText?: string } = {}) {
  const company = opts.company || "iriss";
  const s = {
    loggedIn: false,
    loginUser: "",
    choosingCompany: false,
    kiest: "",
    view: "login" as "login" | "main" | "lapv" | "acts" | "saved",
    form: {} as Record<string, string>,
    exCalls: [] as string[],
    clicks: [] as { sel: string; why: string; phase: Phase }[],
    phase: "fill" as Phase,
    saves: 0,
    windowName: "",
    gets: [] as string[],
  };
  const free = opts.freePlates || (company === "iriss" ? ["B193-7", "B762-7"] : ["B192-7"]);
  const lra = opts.lra || (company === "iriss" ? ["2776"] : ["2894"]);
  const selectOpts = (sel: string): Opt[] => {
    if (sel === "select[name=kiest_id]") return [{ value: "5092", text: "DZINTARZEME AUTO" }, { value: "5281", text: "AUTOAPKOPE" }];
    if (s.view !== "lapv") return [];
    if (sel === "select[name=rn]") return [{ value: "", text: "" }, ...free.map((p) => ({ value: p, text: p }))];
    if (sel === "select[name=lra_id]") return lra.map((v) => ({ value: v, text: `vieta ${v}` }));
    if (sel === "select[name=gprs_id_kom_parstavis]") return company === "iriss" ? IRISS_REPS : DZA_REPS;
    if (sel === "#kmod_id") return MAKES;
    if (sel === "#kmod_id_mod") return s.form.__kmodLoaded ? MODELS[s.form.kmod_id] || [] : [];
    if (sel === "select[name=ans_kiest_id]") return [{ value: "24", text: "TUKUMS, Vilkājas iela 9A" }, { value: "1", text: "RĪGA" }];
    return [];
  };
  const nameOf = (sel: string) => (/name=(\w+)/.exec(sel) || /#(\w+)/.exec(sel) || [])[1] || sel;
  const h = {
    cfg: { startUrl: "https://ows.csdd.gov.lv:7775/" },
    ttrDir: "",
    log: () => {},
    setPhase: async (p: Phase) => {
      s.phase = p;
    },
    loc: (sel: string) => sel,
    safeClick: async () => {},
  };
  const ops = {
    goto: async () => {
      s.view = s.loggedIn ? "main" : "login";
    },
    waitJx: async () => {},
    callEx: async (action: string, arg?: number | null, params?: string | null) => {
      s.exCalls.push(arg == null ? action : `${action}|${arg}|${params}`);
      if (action === "lapv" && params === "a=3") {
        s.view = "lapv";
        s.form = {};
      } else if (action === "lapv_kmod") s.form.__kmodLoaded = "1";
      else if (action === "rep_lapt_tl") s.view = "acts";
    },
    has: async (sel: string) => {
      if (sel === "#vards") return s.view === "login";
      if (sel === "select[name=kiest_id]") return s.choosingCompany;
      if (sel === "form[name=lapv_form]" || sel === "select[name=rn]") return s.view === "lapv";
      return false;
    },
    fill: async (sel: string, v: string) => {
      if (sel === "#vards") s.loginUser = v;
      else if (sel !== "#parole") s.form[nameOf(sel)] = v;
    },
    select: async (sel: string, v: string) => {
      if (sel === "select[name=kiest_id]") s.kiest = v;
      else s.form[nameOf(sel)] = v;
    },
    options: async (sel: string) => selectOpts(sel),
    formValues: async () => {
      if (s.view !== "lapv") return null;
      const f = s.form;
      const txt = (sel: string, v: string) => selectOpts(sel).find((o) => o.value === v)?.text || "";
      return {
        ...f,
        kmod_id__text: txt("#kmod_id", f.kmod_id),
        kmod_id_mod__text: txt("#kmod_id_mod", f.kmod_id_mod),
        ans_kiest_id__text: txt("select[name=ans_kiest_id]", f.ans_kiest_id),
        __adr: f.i01_kav_id ? "TUKUMA NOV., TUKUMS, RĪGAS IELA" + (f.i01_kav_id === "345777" ? " 75" : "") : "",
      };
    },
    value: async (sel: string) => (sel === "#lapv_id" && s.view === "saved" ? "991122" : ""),
    p1Text: async () => (s.view === "saved" ? opts.saveText ?? "Pavadzīme saglabāta\nPavadzīmes numurs: P02810\nStatuss: Derīgs" : ""),
    p1Rows: async () => (s.view === "acts" ? ["Nr. VIN Marka", ...(opts.acts || [])] : []),
    windowName: async () => s.windowName,
    setWindowName: async (n: string) => {
      s.windowName = n;
    },
    setKavSel: async (id: string | number) => {
      s.form.i01_kav_id = String(id);
    },
    httpGet: async (url: string) => {
      s.gets.push(url);
      const id = /[?&]id=(\w+)/.exec(url)?.[1] || "";
      if (/pdf=lapv/.test(url)) return { status: 200, text: async () => "", body: async () => Buffer.from("%PDF-1.4 test") };
      return { status: 200, text: async () => treeHtml(id), body: async () => Buffer.from("") };
    },
    click: async (sel: string, why: string) => {
      s.clicks.push({ sel, why, phase: s.phase });
      // Tas pats lēmums, ko driver safeClick pieņem pēc elementa nozīmes.
      const el = why === "save" ? { text: "Saglabāt" } : { text: why === "company" ? "Turpināt" : "Ienākt", name: "submit" };
      if (!isClickAllowed(el, s.phase).allowed) throw new Error(`klikšķis aizliegts: ${why}`);
      if (why === "login") {
        s.loggedIn = true;
        if (opts.kiestChoice ?? company === "dza") s.choosingCompany = true;
        s.view = "main";
      } else if (why === "company") {
        s.choosingCompany = false;
      } else if (why === "save") {
        s.saves += 1;
        s.view = "saved";
      }
    },
  };
  return { s, h, ops };
}

const iriss = {
  id: "wbr_abc123",
  vehicle: { plate: "B193-7", brandModel: "VW T-ROC", vin: "WVGZZZA1ZKV000001" },
  auto: { ...AUTO_WAYBILL_PLATES["B193-7"] },
  routeFrom: "Tukums, Rīgas iela",
  routeTo: "Tukuma CSDD",
  validFrom: "2026-10-22T10:00:00.000Z",
  validUntil: "2026-10-24T10:00:00.000Z",
  validHours: 48,
};
const dza = { ...iriss, id: "wbr_dza1", vehicle: { plate: "B192-7", brandModel: "MB E350", vin: "" }, auto: { ...AUTO_WAYBILL_PLATES["B192-7"] } };

let dir: string;
let prevEnv: NodeJS.ProcessEnv;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "wb-adapter-"));
  fs.writeFileSync(path.join(dir, "creds"), "iriss-user\niriss-pass\n");
  fs.writeFileSync(path.join(dir, "dza.env"), "CSDD_USER=dza-user\nCSDD_PASS=dza-pass\n");
  prevEnv = { ...process.env };
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  process.env = prevEnv;
});

/** Adapteris + CSDD imitācija -> draiveris core runRefill/runSave (kā waybill-driver.mjs ar adapteri). */
function setup(fake: ReturnType<typeof fakeCsdd>, env: Record<string, string> = {}) {
  fake.h.ttrDir = dir;
  const a = adapterMod.createAdapter(() => fake.ops, { env: { CSDD_TTR_ENV_FILE_DZA: path.join(dir, "dza.env"), ...env } });
  const page = {};
  return {
    open: (i: unknown) => a.open(page, i, fake.h),
    findActiveWaybill: (i: unknown) => a.findActiveWaybill(page, i, fake.h),
    openFromTradeAct: (i: unknown) => a.openFromTradeAct(page, i, fake.h),
    openNewWaybill: (i: unknown) => a.openNewWaybill(page, i, fake.h),
    fillForm: (v: unknown) => a.fillForm(page, v, fake.h),
    readForm: () => a.readForm(page, fake.h),
    formMode: () => a.formMode(page, fake.h),
    clickSave: async () => {
      await fake.h.setPhase("save");
      await a.clickSave(page, fake.h);
      await fake.h.setPhase("pdf");
    },
    readWaybillNo: () => a.readWaybillNo(page, fake.h),
    downloadPdf: (n: string) => a.downloadPdf(page, n, fake.h),
    close: async () => {},
  };
}

const input = (job: typeof iriss) => parseJobInput(JSON.stringify(scriptInput(job)));
const ledger = () => createLedger(path.join(dir, "state"));
/** Kā runCli: kļūda no draivera -> {ok:false, error}. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const refill = (args: any) =>
  runRefill(args).catch((e: Error) => ({ ok: false as const, error: e.message, fields: undefined }));
const onlyAllowedEx = (calls: string[]) => calls.every((c) => adapterMod.ALLOWED_EX.has(c));

describe("waybill-adapter: ĪRISS jauna standarta pavadzīme", () => {
  it("worker ievade ar ctx 'ctx1'/'ctx2' tiek pieņemta", () => {
    expect(input(iriss).ctx).toBe(1);
    expect(input(dza).ctx).toBe(2);
  });

  it("refill aizpilda kā Aivara skripts un nespiež Saglabāt", async () => {
    const fake = fakeCsdd();
    const out = await refill({ input: input(iriss), ledger: ledger(), driver: setup(fake) });
    expect(out).toMatchObject({ ok: true, fields: { plate: "B1937", validHours: 48 } });
    expect(fake.s.form).toMatchObject({
      der_stundas: "48",
      lra_id: "2776",
      rn: "B193-7",
      gprs_id_kom_parstavis: "1065584",
      kmod_id: "875",
      kmod_id_mod: "45036",
      i01_kav_id: "345777",
      ans_kiest_id: "24",
    });
    expect(fake.s.form.mn_m1).toBeUndefined();
    expect(fake.s.loginUser).toBe("iriss-user");
    expect(fake.s.saves).toBe(0);
    expect(fake.s.clicks.map((c) => `${c.why}:${c.phase}`)).toEqual(["login:login"]);
    expect(onlyAllowedEx(fake.s.exCalls)).toBe(true);
    expect(fake.s.exCalls).toContain("lapv|0|a=3");
  });

  it("save: viens Saglabāt klikšķis, numurs no CSDD un PDF; atkārtots save neko nespiež", async () => {
    const fake = fakeCsdd();
    const l = ledger();
    const driver = setup(fake);
    await refill({ input: input(iriss), ledger: l, driver });
    const saved = await runSave({ input: input(iriss), ledger: l, driver });
    expect(saved).toMatchObject({ ok: true, waybillNo: "P02810", pdfPath: expect.stringMatching(/^pdf\/wbr_abc123-P02810\.pdf$/) });
    expect(fs.readFileSync(path.join(dir, saved.pdfPath)).subarray(0, 4).toString()).toBe("%PDF");
    expect(fake.s.saves).toBe(1);
    expect(fake.s.clicks.filter((c) => c.why === "save").map((c) => c.phase)).toEqual(["save"]);
    const again = await runSave({ input: input(iriss), ledger: l, driver });
    expect(again).toMatchObject({ ok: true, waybillNo: "P02810", repeated: true });
    expect(fake.s.saves).toBe(1);
    expect(onlyAllowedEx(fake.s.exCalls)).toBe(true);
  });

  it("ja mājas 75 kokā nav, izvēlas ielu un ieraksta māju", async () => {
    const saved = TREE["4001"];
    TREE["4001"] = [["345778", "setKavSel", "77"]];
    try {
      const fake = fakeCsdd();
      const out = await refill({ input: input(iriss), ledger: ledger(), driver: setup(fake) });
      expect(out.ok).toBe(true);
      expect(fake.s.form).toMatchObject({ i01_kav_id: "3001", mn_m1: "75" });
    } finally {
      TREE["4001"] = saved;
    }
  });

  it("numurs nav izvēlams (aizņemts) -> kļūda, nekas netiek pārtraukts", async () => {
    const fake = fakeCsdd({ freePlates: ["B762-7"] });
    const out = await refill({ input: input(iriss), ledger: ledger(), driver: setup(fake) });
    expect(out).toMatchObject({ ok: false, error: expect.stringContaining("aktīva pavadzīme") });
    expect(fake.s.saves).toBe(0);
    expect(onlyAllowedEx(fake.s.exCalls)).toBe(true);
  });

  it("VIN tirdzniecības aktā -> Aivaram, pavadzīme netiek veidota", async () => {
    const fake = fakeCsdd({ acts: ["GDZ00310 WVGZZZA1ZKV000001 VOLKSWAGEN T-ROC"] });
    const out = await refill({ input: input(iriss), ledger: ledger(), driver: setup(fake) });
    expect(out).toMatchObject({ ok: false, error: expect.stringContaining("tirdzniecības aktā") });
    expect(fake.s.form.rn).toBeUndefined();
  });

  it("neviennozīmīgs vai nezināms modelis -> kļūda pirms Saglabāt", async () => {
    for (const brandModel of ["BMW 330", "VW PASSAT", "TESLA MODEL 3"]) {
      const fake = fakeCsdd();
      const job = { ...iriss, vehicle: { ...iriss.vehicle, brandModel } };
      const out = await runSave({ input: input(job), ledger: ledger(), driver: setup(fake) });
      expect(out.ok).toBe(false);
      expect(fake.s.saves).toBe(0);
    }
  });

  it("nestandarta maršruts -> kļūda", async () => {
    const fake = fakeCsdd();
    const job = { ...iriss, routeFrom: "Rīga, Brīvības gatve 275" };
    const out = await refill({ input: input(job), ledger: ledger(), driver: setup(fake) });
    expect(out).toMatchObject({ ok: false, error: expect.stringContaining("maršruts") });
  });

  it("numurs, kas nav ĪRISS numurs, ar ctx1 tiek atteikts", async () => {
    const fake = fakeCsdd();
    const job = { ...iriss, vehicle: { ...iriss.vehicle, plate: "B192-7" } };
    const out = await refill({ input: input(job), ledger: ledger(), driver: setup(fake) });
    expect(out).toMatchObject({ ok: false, error: expect.stringContaining("nav ĪRISS") });
  });
});

describe("waybill-adapter: DZA (kiest_id 5092, lra 2894)", () => {
  it("pieslēdzas ar CSDD_TTR_ENV_FILE_DZA, izvēlas firmu 5092 pieslēgšanās fāzē un aizpilda", async () => {
    const fake = fakeCsdd({ company: "dza" });
    const out = await refill({ input: input(dza), ledger: ledger(), driver: setup(fake) });
    expect(out).toMatchObject({ ok: true, fields: { plate: "B1927", validHours: 48 } });
    expect(fake.s.loginUser).toBe("dza-user");
    expect(fake.s.kiest).toBe("5092");
    expect(fake.s.clicks.map((c) => `${c.why}:${c.phase}`)).toEqual(["login:login", "company:login"]);
    expect(fake.s.form).toMatchObject({ lra_id: "2894", rn: "B192-7", gprs_id_kom_parstavis: "505410", kmod_id: "900", kmod_id_mod: "4955" });
    // Bez VIN akti tiek pārbaudīti pēc modeļa (tikai lasīšana).
    expect(fake.s.exCalls[0]).toBe("lapv|0|a=3");
    expect(fake.s.exCalls).toContain("rep_lapt_tl");
  });

  it("DZA sesija ar ĪRISS tirdzniecības vietu (nepareiza firma) -> kļūda", async () => {
    const fake = fakeCsdd({ company: "dza", lra: ["2776"] });
    const out = await runSave({ input: input(dza), ledger: ledger(), driver: setup(fake) });
    expect(out).toMatchObject({ ok: false, error: expect.stringContaining("nepareiza firma") });
    expect(fake.s.saves).toBe(0);
  });

  it("bez DZA piekļuves -> kļūda pirms pieslēgšanās", async () => {
    const fake = fakeCsdd({ company: "dza" });
    const out = await refill({ input: input(dza), ledger: ledger(), driver: setup(fake, { CSDD_TTR_ENV_FILE_DZA: path.join(dir, "nav.env") }) });
    expect(out).toMatchObject({ ok: false, error: expect.stringContaining("CSDD_TTR_ENV_FILE_DZA") });
    expect(fake.s.clicks).toEqual([]);
  });

  it("ĪRISS sesijā negaidīta firmas izvēle -> kļūda", async () => {
    const fake = fakeCsdd({ kiestChoice: true });
    const out = await refill({ input: input(iriss), ledger: ledger(), driver: setup(fake) });
    expect(out).toMatchObject({ ok: false, error: expect.stringContaining("negaidīta firmas izvēle") });
  });
});

describe("waybill-adapter: drošība", () => {
  it("lapā atļautas tikai jaunas pavadzīmes darbības (nav lapv_par, a=2, tl)", () => {
    expect([...adapterMod.ALLOWED_EX].sort()).toEqual(["lapv_kmod", "lapv|0|a=3", "rep_lapt_tl"]);
  });

  it("Saglabāt pēc klikšķa bez numura: lock paliek, otrreiz nespiež", async () => {
    const fake = fakeCsdd({ saveText: "Kļūda" });
    const l = ledger();
    const driver = setup(fake);
    const first = await runSave({ input: input(iriss), ledger: l, driver });
    expect(first).toMatchObject({ ok: false, error: expect.stringContaining("pārbaudi CSDD") });
    const second = await runSave({ input: input(iriss), ledger: l, driver });
    expect(second.ok).toBe(false);
    expect(fake.s.saves).toBe(1);
  });

  it("piekļuves faili: KEY=VALUE un Aivara divu rindu formāts", () => {
    expect(adapterMod.readCredentialFile(path.join(dir, "dza.env"))).toEqual({ user: "dza-user", pass: "dza-pass" });
    expect(adapterMod.readCredentialFile(path.join(dir, "creds"))).toEqual({ user: "iriss-user", pass: "iriss-pass" });
    expect(adapterMod.readCredentialFile(path.join(dir, "nav"))).toBeNull();
  });
});

describe("waybill-adapter: pieņemts auto (akts -> Noformēt pavadzīmi), tikai laiks + pārstāvis", () => {
  const VIN = "WVGZZZA1ZKV000001";
  const act = { ...iriss, tradeAct: true, representative: "Nils Valainis", auto: { ...iriss.auto, flow: "tradeAct" } };

  /** Imitācijai pievieno akta sarakstu, akta skatu un akta pavadzīmes formu (lapt_id + laukus, ko forma rāda). */
  function withActs(fake: ReturnType<typeof fakeCsdd>, actForm: Record<string, string> = {}) {
    let viewAct = "";
    const callEx = fake.ops.callEx;
    fake.ops.callEx = async (action: string, arg?: number | null, params?: string | null) => {
      await callEx(action, arg, params);
      const m = /^a=11&lapt_id=(\d+)$/.exec(params || "");
      if (action === "lapt" && m) viewAct = m[1] ?? "";
      if (action === "lapv" && params === "a=0") {
        fake.s.view = "lapv";
        fake.s.form = { lapt_id: viewAct, ...actForm };
      }
    };
    const p1Text = fake.ops.p1Text;
    Object.assign(fake.ops, {
      actRows: async () => (fake.s.view === "acts" ? [{ oc: "ex('lapt',0,'a=11&lapt_id=555')", t: `GDZ00310 ${VIN} VOLKSWAGEN T-ROC` }] : []),
      p1Text: async () => (viewAct && fake.s.view !== "saved" && fake.s.view !== "lapv" ? "Akta numurs: GDZ00310\nStatuss: Derīgs" : p1Text()),
    });
    return fake;
  }

  for (const validHours of [1, 12, 48, 36, 2160]) {
    it(`${validHours} h: aizpilda tikai laiku, numuru, vietu un pārstāvi; maršrutu neaiztiek; Saglabāt nespiež`, async () => {
      const fake = withActs(fakeCsdd());
      const job = {
        ...act,
        validHours,
        validUntil: new Date(Date.parse(act.validFrom) + validHours * 3_600_000).toISOString(),
      };
      const inp = input(job);
      expect(inp).toMatchObject({ flow: "tradeAct", routeFrom: "", routeTo: "", validHours });
      const out = await refill({ input: inp, ledger: ledger(), driver: setup(fake) });
      expect(out).toMatchObject({ ok: true, fields: { plate: "B1937", validHours } });
      expect(fake.s.form).toMatchObject({ lapt_id: "555", der_stundas: String(validHours), rn: "B193-7", gprs_id_kom_parstavis: "1065584" });
      expect(fake.s.form.i01_kav_id).toBeUndefined();
      expect(fake.s.form.kmod_id).toBeUndefined();
      expect(fake.s.saves).toBe(0);
      // lapv a=3 tikai lasa, vai numurs brīvs; pavadzīme tiek noformēta no akta (lapv a=0).
      expect(fake.s.exCalls).toContain("lapv|0|a=0");
    });
  }

  it("akta forma prasa tukšu adresi -> kļūda pirms Saglabāt (Aivaram), fiksēts maršruts netiek likts", async () => {
    const fake = withActs(fakeCsdd(), { i01_kav_id: "" });
    const out = await runSave({ input: input(act), ledger: ledger(), driver: setup(fake) });
    expect(out).toMatchObject({ ok: false, error: expect.stringContaining("prasa adresi") });
    expect(fake.s.form.i01_kav_id).toBe("");
    expect(fake.s.saves).toBe(0);
  });

  it("akts nav atrasts -> kļūda, jauna pavadzīme akta vietā netiek veidota", async () => {
    const fake = fakeCsdd();
    Object.assign(fake.ops, { actRows: async () => [] });
    const out = await refill({ input: input(act), ledger: ledger(), driver: setup(fake) });
    expect(out).toMatchObject({ ok: false, error: expect.stringContaining("akts") });
    expect(fake.s.form.rn).toBeUndefined();
    expect(fake.s.exCalls).not.toContain("lapv|0|a=0");
    expect(fake.s.saves).toBe(0);
  });
});
