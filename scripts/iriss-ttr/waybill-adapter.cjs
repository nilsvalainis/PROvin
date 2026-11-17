/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS: waybill-driver.mjs ielādē ar createRequire */
// CSDD TTR (ows.csdd.gov.lv:7775) adapteris waybill-driver.mjs soļiem: JAUNA standarta pavadzīme, kā Aivara skriptos
// (save-v50-b193-6h.js, save-dza-e350-b192.js): pieslēgšanās (#vards/#parole), DZA firmas izvēle (kiest_id 5092),
// forma ex('lapv',0,'a=3'), der_stundas, lra_id, rn, pārstāvis, marka ex('lapv_kmod') + modelis, adrešu koks setKavSel,
// tuvākā CSDD (ans_kiest_id 24), Saglabāt, numurs no #p1, PDF ?main=1&pdf=lapv&id=<lapv_id>.
//
// Akta plūsma (input.flow "tradeAct", kā Aivara fill-gdz00303.js / save-e350-gdz00303-b762.js): rep_lapt_tl saraksts ->
// rinda ar šo VIN -> ex('lapt',0,'a=11&lapt_id=<id>') (akts "Derīgs") -> ex('lapv',0,'a=0') "Noformēt pavadzīmi" ->
// der_stundas, rn, pārstāvis (+ adrese/CSDD, ja forma prasa), Saglabāt. Marku/modeli CSDD ņem no akta.
// STINGRI: nekādu pārtraukšanas/anulēšanas/beigšanas soļu. Lapā drīkst izsaukt TIKAI ALLOWED_EX / ALLOWED_EX_PATTERNS darbības;
// aizņemts numurs, akts nav atrasts vai jaunai pavadzīmei auto ir aktā -> kļūda (darbs Aivaram), nekas netiek pārtraukts.
// Sargi no waybill-driver.mjs (tīkls, DOM klikšķi, dialogi) paliek spēkā; "Saglabāt" spiež tikai clickSave (save fāze).
// Uzstāda install-waybill-scripts.sh uz /root/iriss-ttr/waybill-adapter.cjs. Testi: lib/iriss-waybill-adapter.test.ts.

const fs = require("node:fs");
const path = require("node:path");

const CSDD_BASE = "https://ows.csdd.gov.lv:7775";

/** Firmas pēc ctx. Vērtības no Aivara skriptiem un README (DZA: kiest_id 5092, lra 2894). */
const COMPANIES = {
  1: {
    name: "ĪRISS",
    plates: ["B193-7", "B762-7"],
    kiestId: "",
    lraId: "2776",
    representative: { id: "1065584", re: /NILS\s+VALAINIS/i },
    credEnv: "CSDD_TTR_ENV_FILE",
    credFiles: [".env", "creds"],
  },
  2: {
    name: "DZINTARZEME AUTO",
    plates: ["B192-7"],
    kiestId: "5092",
    lraId: "2894",
    representative: { id: "", re: /TAIVO\s+BATI[NŅ]S/i },
    credEnv: "CSDD_TTR_ENV_FILE_DZA",
    credFiles: ["creds-autoapkope-dza"],
  },
};

/** Standarta maršruts: Tukums, Rīgas iela 75 -> CSDD Tukums (Vilkājas iela 9A, ans_kiest_id 24). */
const ROUTE = {
  fromRe: /^tukums,?\s*rīgas iela(\s+75)?$/,
  toRe: /^tukuma csdd$/,
  treeRoot: "324393",
  city: /^TUKUMS$/i,
  streetLetter: "R",
  street: /^RĪGAS IELA$/i,
  house: "75",
  csddKiestId: "24",
};

/** Vienīgās CSDD lapas darbības, ko adapteris drīkst izsaukt (ex(...)). Viss cits (piem. lapv_par = pārtraukt) - kļūda. */
const ALLOWED_EX = new Set(["lapv|0|a=3", "lapv_kmod", "rep_lapt_tl", "tl", "rep_lapv", "rep_lapv|1|"]);
/**
 * Akta plūsma: saraksta lapas, akta atvēršana pēc id (tikai skats) un "Noformēt pavadzīmi" (lapv a=0).
 * Pavadzīmju lasīšana (kā Aivara lookup-p02779.js): meklēšana pēc numura lapv a=2 un kartīte lapv a=11&lapv_id (tikai skats).
 */
const ALLOWED_EX_PATTERNS = [
  /^rep_lapt_tl\|1\|(porcijas_numurs=[2-8])?$/,
  /^lapt\|0\|a=11&lapt_id=\d{1,12}$/,
  /^lapv\|0\|a=0$/,
  /^lapv\|0\|a=2$/,
  /^lapv\|0\|a=11&lapv_id=\d{1,12}$/,
];
/**
 * Pārtraukšana (Nila "anulēt"): TIKAI annulWaybill, tikai bruņotā stāvoklī (pārbaudīts numurs, numurzīme, Derīgs) un
 * tikai, ja darbs to atļauj (IRISS_WAYBILL_ANNUL_LIVE=1 un lietotājs apstiprināja tieši šo numuru).
 */
const ANNUL_EX = "lapv_par";
const TRADE_ACT_PAGES = 8;

function exAllowed(key) {
  return ALLOWED_EX.has(key) || ALLOWED_EX_PATTERNS.some((re) => re.test(key));
}

const MAKE_ALIASES = { MB: "MERCEDES-BENZ", MERCEDES: "MERCEDES-BENZ", VW: "VOLKSWAGEN" };

/** Salīdzināšanai: bez diakritikas, atstarpēm un defisēm ("T-ROC" = "T ROC", "ŠKODA" = "SKODA"). */
const compact = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
const norm = (s) => String(s || "").toLocaleLowerCase("lv").replace(/\s+/g, " ").trim();

function exKey(action, arg, params) {
  return arg == null ? action : `${action}|${arg}|${params || ""}`;
}

/** KEY=VALUE env fails (userVar/passVar) vai Aivara formāts (1. rinda lietotājs, 2. rinda parole). Vērtības netiek logotas. */
function readCredentialFile(file, userVar = "CSDD_USER", passVar = "CSDD_PASS") {
  if (!file || !fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, "utf8");
  const kv = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) kv[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  if (kv[userVar] && kv[passVar]) return { user: kv[userVar], pass: kv[passVar] };
  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (lines.length >= 2 && !lines[0].includes("=")) return { user: lines[0], pass: lines[1] };
  return null;
}

function credentialsFor(company, { env, ttrDir, cfg }) {
  const userVar = cfg.userVar || "CSDD_USER";
  const passVar = cfg.passVar || "CSDD_PASS";
  if (company === COMPANIES[1] && env[userVar] && env[passVar]) return { user: env[userVar], pass: env[passVar] };
  const files = env[company.credEnv] ? [env[company.credEnv]] : company.credFiles.map((f) => path.join(ttrDir, f));
  for (const f of files) {
    const c = readCredentialFile(f, userVar, passVar);
    if (c) return c;
  }
  throw new Error(`nav CSDD piekļuves ${company.name} (${company.credEnv})`);
}

/** Adrešu koka mezgli (tikai GET, kā Aivara kids()). */
function parseKavTree(html) {
  return [...String(html).matchAll(/<a class="lp" id="i01_a(\w+)" onclick="return (setKavSel|expand)[^>]*title="([^"]*)"/g)].map((m) => ({
    id: m[1],
    sel: m[2] === "setKavSel",
    t: m[3],
  }));
}

/** Playwright operācijas (vienīgais ceļš uz lapu). Testos aizstāj ar CSDD imitāciju. */
function playwrightOps(page, h) {
  const timeout = Number((h.cfg && h.cfg.timeoutMs) || 90000);
  return {
    goto: (url) => page.goto(url, { waitUntil: "networkidle", timeout }),
    waitJx: () => page.waitForFunction(() => window.activejxRequestCount === 0, null, { timeout }),
    callEx: (action, arg, params) =>
      page.evaluate(([a, b, c]) => {
        // Kā Aivara skriptos: ex('rep_lapt_tl', 1) bez trešā argumenta.
        return b == null ? ex(a) : c == null ? ex(a, b) : ex(a, b, c);
      }, [action, arg == null ? null : arg, params == null ? null : params]),
    has: async (sel) => (await page.$(sel)) !== null,
    fill: (sel, v) => page.fill(sel, v),
    select: (sel, v) => page.selectOption(sel, v),
    options: (sel) => page.evaluate((s) => [...document.querySelectorAll(`${s} option`)].map((o) => ({ value: o.value, text: o.text.trim() })), sel),
    formValues: () =>
      page.evaluate(() => {
        const f = document.forms.lapv_form;
        if (!f) return null;
        const o = {};
        for (const e of f.elements) {
          if (!e.name) continue;
          o[e.name] = e.value;
          if (e.tagName === "SELECT" && e.selectedIndex >= 0) o[`${e.name}__text`] = e.options[e.selectedIndex].text.trim();
        }
        const a = document.getElementById("i01_kav_t");
        o.__adr = a ? a.value : "";
        return o;
      }),
    value: (sel) => page.evaluate((s) => (document.querySelector(s) || {}).value || "", sel),
    p1Text: () => page.evaluate(() => (document.getElementById("p1") || document.body).innerText),
    /**
     * Pavadzīmes kartīte: #p1 teksts KOPĀ ar lauku vērtībām (CSDD kartītē numurzīme un daļa datu ir <input>, nevis teksts -
     * 23.10 pārbaude: "Tirdzniecības numurs" B193-7 bija input value). Pagaidu <span> tikai lasīšanai, uzreiz noņemti.
     */
    p1Card: () =>
      page.evaluate(() => {
        const root = document.getElementById("p1") || document.body;
        const added = [];
        for (const el of root.querySelectorAll("input, select, textarea")) {
          const type = String(el.getAttribute("type") || "").toLowerCase();
          if (["hidden", "button", "submit", "reset", "checkbox", "radio", "image"].includes(type)) continue;
          const v = el.tagName === "SELECT" ? (el.options[el.selectedIndex] || {}).text || "" : el.value || "";
          if (!String(v).trim()) continue;
          const span = document.createElement("span");
          span.textContent = ` ${String(v).trim()} `;
          el.after(span);
          added.push(span);
        }
        const text = root.innerText;
        for (const span of added) span.remove();
        return text;
      }),
    p1Rows: () => page.evaluate(() => [...document.querySelectorAll("#p1 tr")].map((r) => r.innerText.replace(/\s+/g, " ").trim())),
    /** #p1 saites ar onclick un rindas tekstu (pavadzīmes kartītes atvēršanai pēc lapv_id). */
    p1Onclicks: () =>
      page.evaluate(() =>
        [...document.querySelectorAll("#p1 [onclick]")].map((e) => ({
          oc: e.getAttribute("onclick") || "",
          t: ((e.closest("tr") || e).innerText || "").replace(/\s+/g, " ").trim(),
        })),
      ),
    /** Tirdzniecības aktu saraksta rindas ar lapt_id (tikai lasa). */
    actRows: () =>
      page.evaluate(() =>
        [...document.querySelectorAll("tr")]
          .map((tr) => {
            const a = tr.querySelector("[onclick*=lapt_id]");
            return a ? { oc: a.getAttribute("onclick") || "", t: tr.innerText.replace(/\s+/g, " ").trim() } : null;
          })
          .filter(Boolean),
      ),
    windowName: () => page.evaluate(() => window.name).catch(() => ""),
    setWindowName: (n) => page.evaluate((v) => {
      window.name = v;
    }, n),
    setKavSel: (id) =>
      page.evaluate((i) => {
        const a = document.createElement("a");
        a.id = `i01_a${i}`;
        a.className = "lp";
        document.body.appendChild(a);
        setKavSel("i01", i);
      }, Number(id)),
    httpGet: async (url) => {
      const r = await page.context().request.get(url, { timeout });
      return { status: r.status(), text: () => r.text(), body: () => r.body() };
    },
    click: (sel, why) => h.safeClick(h.loc(sel), why),
  };
}

/** @param {(page: unknown, h: object) => ReturnType<typeof playwrightOps>} makeOps */
function createAdapter(makeOps = playwrightOps, { env = process.env } = {}) {
  /** Šī procesa darbs (open izsauc pirmo; refill.js un save.js ir atsevišķi procesi). */
  const state = { input: null, company: null, lapvId: "", laptId: "", maxNumber: "", annulArmed: "" };

  function ctxOf(page, h) {
    const ops = makeOps(page, h);
    const base = String((h.cfg && h.cfg.startUrl) || CSDD_BASE).replace(/\/+$/, "");
    const ttrDir = h.ttrDir || env.IRISS_TTR_DIR || "/root/iriss-ttr";
    async function ex(action, arg, params) {
      const key = exKey(action, arg, params);
      const annul = key === ANNUL_EX && Boolean(state.annulArmed);
      if (!annul && !exAllowed(key)) throw new Error(`CSDD darbība nav atļauta: ${key}`);
      await ops.callEx(action, arg, params);
      await ops.waitJx();
    }
    async function kids(id) {
      const r = await ops.httpGet(`${base}/?main=1&ix=1&v=kav&d=0&instance=i01&id=${encodeURIComponent(id)}`);
      return parseKavTree(await r.text());
    }
    async function kidsL(id, letter) {
      const a = await kids(id);
      const f = a.find((x) => !x.sel && x.t === letter);
      return f ? kids(f.id) : a;
    }
    return { ops, base, ttrDir, ex, kids, kidsL };
  }

  function need() {
    if (!state.input || !state.company) throw new Error("adapteris: open nav izsaukts");
    return { input: state.input, company: state.company };
  }

  function pick(arr, re, what) {
    const f = arr.filter((x) => re.test(x.t));
    if (f.length !== 1) throw new Error(`adrešu kokā nav viennozīmīgi: ${what}`);
    return f[0];
  }

  async function resolveRoute(c, input) {
    if (!ROUTE.fromRe.test(norm(input.routeFrom)) || !ROUTE.toRe.test(norm(input.routeTo))) {
      throw new Error("maršruts nav standarta (Tukums, Rīgas iela -> Tukuma CSDD)");
    }
    const tuk = pick(await c.kids(ROUTE.treeRoot), ROUTE.city, "Tukums");
    const iela = pick(await c.kidsL(tuk.id, ROUTE.streetLetter), ROUTE.street, "Rīgas iela");
    const houses = (await c.kidsL(iela.id, ROUTE.house[0])).filter((x) => x.sel && x.t === ROUTE.house);
    if (houses.length === 1) return { target: houses[0].id, house: "" };
    if (!iela.sel) throw new Error("adrešu kokā nav Rīgas iela 75");
    return { target: iela.id, house: ROUTE.house };
  }

  /** Marka pēc garākā prefiksa (ar aizstājvārdiem MB, VW), modelis pēc precīza teksta. Neviennozīmīgi -> kļūda. */
  function resolveMake(makeOptions, brandModel) {
    const tokens = String(brandModel || "").toUpperCase().trim().split(/\s+/).filter(Boolean);
    for (let k = tokens.length - 1; k >= 1; k--) {
      const raw = tokens.slice(0, k).join(" ");
      const want = compact(MAKE_ALIASES[raw] || raw);
      const hits = makeOptions.filter((o) => o.value && compact(o.text) === want);
      if (hits.length === 1) return { make: hits[0], model: tokens.slice(k).join(" ") };
      if (hits.length > 1) throw new Error(`marka neviennozīmīga: ${raw}`);
    }
    throw new Error(`marka nav atrasta CSDD sarakstā: ${String(brandModel).slice(0, 40)}`);
  }

  function resolveModel(modelOptions, model) {
    const hits = modelOptions.filter((o) => o.value && compact(o.text) === compact(model));
    if (hits.length !== 1) throw new Error(`modelis ${hits.length ? "neviennozīmīgs" : "nav atrasts"}: ${String(model).slice(0, 30)}`);
    return hits[0];
  }

  function pickRepresentative(opts, company) {
    const r = company.representative;
    const hits = opts.filter((o) => o.value && (r.id ? o.value === r.id : r.re.test(o.text)));
    if (hits.length !== 1) throw new Error(`pārstāvis nav viennozīmīgs (${company.name})`);
    return hits[0];
  }

  /** Tikai lasa: vai auto ir tirdzniecības aktos (tad pavadzīme no akta - Aivaram). Kā Aivara rep_lapt_tl pārbaude. */
  async function inTradeActs(c, input) {
    await c.ex("rep_lapt_tl");
    const rows = await c.ops.p1Rows();
    if (input.vin) return rows.some((r) => compact(r).includes(compact(input.vin)));
    const words = String(input.brandModel).toUpperCase().split(/\s+/).slice(1).filter((w) => w.length >= 2);
    return words.length > 0 && rows.some((r) => words.every((w) => compact(r).includes(compact(w))));
  }

  /**
   * Akta plūsma: atrod VIENU derīgu tirdzniecības aktu ar šo VIN un atver "Noformēt pavadzīmi".
   * Tikai lasa sarakstu/aktu; ja aktu nav vai tie ir vairāki derīgi -> kļūda (Aivaram).
   */
  async function openTradeActWaybill(c, input) {
    const vin = compact(input.vin);
    if (vin.length !== 17) throw new Error("aktam vajag VIN");
    await c.ex("rep_lapt_tl");
    await c.ex("rep_lapt_tl", 1);
    const seen = new Set();
    const ids = [];
    for (let pg = 1; pg <= TRADE_ACT_PAGES; pg++) {
      if (pg > 1) await c.ex("rep_lapt_tl", 1, `porcijas_numurs=${pg}`);
      const rows = (await c.ops.actRows()) || [];
      const fresh = rows.filter((r) => !seen.has(r.oc));
      if (!fresh.length) break;
      for (const r of fresh) {
        seen.add(r.oc);
        const id = (/lapt_id=(\d{1,12})/.exec(r.oc) || [])[1];
        if (id && compact(r.t).includes(vin) && !ids.includes(id)) ids.push(id);
      }
    }
    if (!ids.length) throw new Error("tirdzniecības akts ar šo VIN nav atrasts (Aivaram)");
    const valid = [];
    for (const id of ids) {
      await c.ex("rep_lapt_tl");
      await c.ex("lapt", 0, `a=11&lapt_id=${id}`);
      const t = String(await c.ops.p1Text());
      if (/Statuss:\s*Derīgs/i.test(t)) valid.push({ id, act: (/Akta numurs:\s*(\S+)/.exec(t) || [])[1] || "" });
    }
    if (valid.length !== 1) {
      throw new Error(valid.length ? "vairāki derīgi akti ar šo VIN (Aivaram)" : "derīgs tirdzniecības akts nav atrasts (Aivaram)");
    }
    if (valid[0].id !== ids[ids.length - 1]) {
      await c.ex("rep_lapt_tl");
      await c.ex("lapt", 0, `a=11&lapt_id=${valid[0].id}`);
    }
    await c.ex("lapv", 0, "a=0");
    if (!(await c.ops.has("form[name=lapv_form]"))) throw new Error("akta pavadzīmes forma neatvērās");
    const v = (await c.ops.formValues()) || {};
    if (v.lapt_id && v.lapt_id !== valid[0].id) throw new Error("forma nav šim aktam");
    state.laptId = valid[0].id;
    return valid[0];
  }

  /** Akta pavadzīmes pārstāvis: tikai firmas pārstāvis (ĪRISS - Nils Valainis, DZA - Taivo Batiņš). */
  function checkActRepresentative(input, company) {
    const want = compact(input.representative);
    const ok = company === COMPANIES[1] ? want === compact("NILS VALAINIS") : want === compact("TAIVO BATINS");
    if (!ok) throw new Error(`pārstāvis nav ${company.name} pārstāvis`);
  }

  function csddCore(h) {
    if (!h.csdd) throw new Error("adapteris: nav csdd-waybills-core (draiveris)");
    return h.csdd;
  }

  /** TIKAI LASA: pavadzīmes kartīte pēc numura (ex('tl') -> #lapv_num -> lapv a=2; rinda -> lapv a=11&lapv_id). */
  async function lookupWaybill(c, h, no) {
    const core = csddCore(h);
    await c.ex("tl");
    if (!(await c.ops.has("#lapv_num"))) throw new Error("CSDD: nav pavadzīmes meklēšanas lauka (#lapv_num)");
    await c.ops.fill("#lapv_num", no);
    await c.ex("lapv", 0, "a=2");
    let d = core.parseWaybillDetail(await c.ops.p1Card(), no);
    let lapvId = d ? String((await c.ops.value("#lapv_id")) || "") : "";
    if (!d) {
      const row = ((await c.ops.p1Onclicks()) || []).find((r) => r.t.toUpperCase().includes(no) && /lapv_id=\d{1,12}/.test(r.oc));
      const id = row ? (/lapv_id=(\d{1,12})/.exec(row.oc) || [])[1] : "";
      if (id) {
        await c.ex("lapv", 0, `a=11&lapv_id=${id}`);
        d = core.parseWaybillDetail(await c.ops.p1Card(), no);
        lapvId = id;
      }
    }
    return d ? { ...d, lapvId: /^\d+$/.test(lapvId) ? lapvId : "" } : null;
  }

  /** TIKAI LASA: saraksti (rep_lapv atskaite + tl), no kuriem ņem P-numurus. Kļūda sarakstā netraucē (paliek probe). */
  async function listRows(c, h) {
    const rows = [];
    for (const step of [["rep_lapv"], ["rep_lapv", 1, ""], ["tl"]]) {
      try {
        await c.ex(...step);
        rows.push(...(((await c.ops.p1Rows()) || []).filter(Boolean)));
      } catch (err) {
        if (h.log) h.log("csdd_list_failed", { step: step[0], err: err instanceof Error ? err.message.slice(0, 80) : "error" });
      }
    }
    return rows;
  }

  /** TIKAI LASA: aktīvās pavadzīmes šīs firmas numuriem (arī ar roku izrakstītās). */
  async function readActive(c, h, plates, known) {
    const core = csddCore(h);
    const res = await core.collectActiveWaybills({
      plates,
      listRows: await listRows(c, h),
      known: known || [],
      lookup: (no) => lookupWaybill(c, h, no),
      nowMs: Date.now(),
    });
    if (res.ok) state.maxNumber = res.maxNumber;
    return res;
  }

  async function login(c, company, h) {
    if (await c.ops.has("#vards")) {
      const cred = credentialsFor(company, { env, ttrDir: c.ttrDir, cfg: h.cfg || {} });
      await h.setPhase("login");
      await c.ops.fill("#vards", cred.user);
      await c.ops.fill("#parole", cred.pass);
      await c.ops.click("button[name=submit]", "login");
      await c.ops.waitJx();
      if (await c.ops.has("#vards")) throw new Error(`CSDD pieslēgšanās neizdevās (${company.name})`);
    }
    if (await c.ops.has("select[name=kiest_id]")) {
      // Firmu izvēlas vienreiz pēc pieslēgšanās (DZA kopīgais logins: 5092 DZINTARZEME AUTO / 5281 AUTOAPKOPE).
      if (!company.kiestId) throw new Error(`negaidīta firmas izvēle (${company.name})`);
      const opts = await c.ops.options("select[name=kiest_id]");
      if (!opts.some((o) => o.value === company.kiestId)) throw new Error(`firma ${company.kiestId} nav izvēlama`);
      await h.setPhase("login");
      await c.ops.select("select[name=kiest_id]", company.kiestId);
      await c.ops.click("button[name=submit]", "company");
      await c.ops.waitJx();
    }
    await h.setPhase("fill");
  }

  async function expected(c, input, company) {
    const make = resolveMake(await c.ops.options("#kmod_id"), input.brandModel);
    return { make, route: await resolveRoute(c, input), company };
  }

  return {
    async open(page, input, h) {
      const company = COMPANIES[input.ctx];
      if (!company) throw new Error("ctx nederīgs");
      if (!company.plates.some((p) => compact(p) === compact(input.plate))) throw new Error(`numurs ${input.plate} nav ${company.name} numurs`);
      if (input.flow === "tradeAct") checkActRepresentative(input, company);
      state.input = input;
      state.company = company;
      state.lapvId = "";
      state.laptId = "";
      const c = ctxOf(page, h);
      const jobName = `iriss-job-${input.jobId}`;
      // CDP režīmā save.js turpina refill.js cilni (tā pati forma); citādi svaiga pieslēgšanās.
      if ((await c.ops.windowName()) === jobName && (await c.ops.has("form[name=lapv_form]")) && !(await c.ops.has("#vards"))) return;
      await c.ops.goto(`${c.base}/`);
      await c.ops.setWindowName(jobName);
      await login(c, company, h);
    },

    /**
     * TIKAI LASA: vai numurs CSDD ir aizņemts. Divas pārbaudes: (1) CSDD pavadzīmju kartītes (arī ar roku izrakstītās,
     * incidents 23.10: B193-7 bija izvēlams formā, lai gan P02812 bija derīga); (2) numurs nav izvēlams jaunā pavadzīmē.
     * Nevar nolasīt -> kļūda (darbs Aivaram pirms Saglabāt). Nekas netiek pārtraukts.
     */
    async findActiveWaybill(page, input, h) {
      const c = ctxOf(page, h);
      const res = await readActive(c, h, [input.plate].map((p) => csddCore(h).dealerPlate(p) || p), input.knownWaybills);
      if (!res.ok) throw new Error(`CSDD numura statusu nevarēja nolasīt: ${res.error}`);
      const hit = (res.plates[csddCore(h).dealerPlate(input.plate)] || [])[0];
      if (hit) return { waybillNo: hit.waybillNo, validUntil: hit.validUntil, brandModel: hit.brandModel };
      await c.ex("lapv", 0, "a=3");
      const rn = await c.ops.options("select[name=rn]");
      if (!rn.some((o) => compact(o.value) === compact(input.plate))) return { waybillNo: "(numurs CSDD nav brīvs)" };
      return null;
    },

    /** TIKAI LASA: sinhronizācija - aktīvās pavadzīmes visiem šīs firmas numuriem (sync.js). */
    async readActiveWaybills(page, { plates, known }, h) {
      const res = await readActive(ctxOf(page, h), h, plates, known);
      return { ...res, platesChecked: plates };
    },

    /** TIKAI LASA: viena pavadzīme pēc numura (csdd-check.mjs, pārbaude pēc Saglabāt). */
    async lookupWaybill(page, no, h) {
      return lookupWaybill(ctxOf(page, h), h, String(no || "").toUpperCase());
    },

    /** Pēc Saglabāt numurs nav nolasīts: meklē jauno pavadzīmi CSDD pēc numuriem (lielākais pirms saglabāšanas + 1...). */
    async verifySavedWaybill(page, input, h) {
      const c = ctxOf(page, h);
      const message = csddCore(h).csddMessageSnippet(await c.ops.p1Text().catch(() => ""));
      const res = await csddCore(h).findNewWaybillAfterSave({
        input,
        beforeMax: state.maxNumber,
        lookup: (no) => lookupWaybill(c, h, no),
      });
      if (res.found) {
        const d = await lookupWaybill(c, h, res.waybillNo);
        if (d && d.lapvId) state.lapvId = d.lapvId;
      }
      return { ...res, message };
    },

    /**
     * Pārtrauc (CSDD "Pārtraukt!", Nila "anulēt") TIEŠI vienu pavadzīmi, ko lietotājs apstiprināja. Kā Aivara stop-p02806:
     * kartīte pēc numura -> jābūt šim numuram, šai numurzīmei un "Derīgs" -> lapv_par -> forma ar šo numuru -> "Pārtraukt!"
     * -> kartīte vēlreiz: vairs nav Derīgs. Izsauc tikai annul.js (worker: IRISS_WAYBILL_ANNUL_LIVE=1). Testi ar imitāciju.
     */
    async annulWaybill(page, { waybillNo, plate }, h) {
      const c = ctxOf(page, h);
      const no = String(waybillNo || "").toUpperCase();
      if (!/^P\d{5,6}$/.test(no)) throw new Error("anulējamās pavadzīmes numurs nederīgs");
      const before = await lookupWaybill(c, h, no);
      if (!before) throw new Error(`${no} CSDD nav atrasta - neko nepārtraucu`);
      if (compact(before.plate) !== compact(plate)) throw new Error(`${no} nav uz ${plate} - neko nepārtraucu`);
      if (!before.active) return { ok: true, already: true, statusBefore: before.status };
      state.annulArmed = no;
      try {
        await h.setPhase("annul");
        await c.ex(ANNUL_EX);
        const form = String(await c.ops.p1Text());
        if (!form.toUpperCase().includes(no)) throw new Error(`pārtraukšanas forma nav ${no} - neko nepārtraucu`);
        await c.ops.click("#p1 button:has-text('Pārtraukt!'), #p1 input[value='Pārtraukt!']", "annul");
        await c.ops.waitJx();
      } finally {
        state.annulArmed = "";
        await h.setPhase("fill");
      }
      const after = await lookupWaybill(c, h, no);
      if (!after) throw new Error(`${no} pēc pārtraukšanas nav nolasāma - pārbaudi CSDD`);
      if (after.active) throw new Error(`${no} joprojām Derīga - pārbaudi CSDD`);
      return { ok: true, statusBefore: before.status, statusAfter: after.status };
    },

    /**
     * flow "tradeAct": akts pēc VIN -> "Noformēt pavadzīmi" (true). Citādi (jauna pavadzīme): ja VIN ir aktā -> kļūda,
     * jo pieņemtam auto pavadzīme jānoformē no akta; false -> jauna pavadzīme.
     */
    async openFromTradeAct(page, input, h) {
      const c = ctxOf(page, h);
      if (input.flow === "tradeAct") {
        await openTradeActWaybill(c, input);
        return true;
      }
      if (await inTradeActs(c, input)) throw new Error("auto ir tirdzniecības aktā - pavadzīme no akta (Aivaram)");
      return false;
    },

    async openNewWaybill(page, input, h) {
      const c = ctxOf(page, h);
      if (input.flow === "tradeAct") throw new Error("akta pavadzīmi jaunā formā neveido");
      if (await inTradeActs(c, input)) throw new Error("auto ir tirdzniecības aktā - pavadzīme no akta (Aivaram)");
      await c.ex("lapv", 0, "a=3");
      if (!(await c.ops.has("form[name=lapv_form]"))) throw new Error("jaunas pavadzīmes forma neatvērās");
    },

    async fillForm(page, values, h) {
      const { input, company } = need();
      const c = ctxOf(page, h);
      const plate = (await c.ops.options("select[name=rn]")).find((o) => compact(o.value) === compact(input.plate));
      if (!plate) throw new Error(`numurs ${input.plate} nav izvēlams (aizņemts?)`);
      if (state.laptId) {
        // Akta pavadzīme (Nils 23.10): TIKAI laiks + komersanta pārstāvis (+ numurs, tirdzniecības vieta, ja forma prasa).
        // Maršrutu/pilsētu neaiztiek; ja akta forma prasa tukšu adresi - kļūda pirms Saglabāt (Aivaram), nevis fiksēts maršruts.
        const before = (await c.ops.formValues()) || {};
        if ("i01_kav_id" in before && !String(before.i01_kav_id || "").trim()) {
          throw new Error("akta formā prasa adresi - nododu Aivaram");
        }
        const rep = pickRepresentative(await c.ops.options("select[name=gprs_id_kom_parstavis]"), company);
        await c.ops.fill("#der_stundas", String(values.validHours));
        if (await c.ops.has("select[name=lra_id]")) {
          const lra = await c.ops.options("select[name=lra_id]");
          if (!lra.some((o) => o.value === company.lraId)) throw new Error(`tirdzniecības vieta ${company.lraId} nav sarakstā - nepareiza firma?`);
          await c.ops.select("select[name=lra_id]", company.lraId);
        }
        await c.ops.select("select[name=rn]", plate.value);
        await c.ops.select("select[name=gprs_id_kom_parstavis]", rep.value);
        // Numuru salīdzināšana - CSDD Tukuma filiālē (tikai, ja forma šo izvēli rāda un tā vēl nav izvēlēta).
        if ((await c.ops.has("select[name=ans_kiest_id]")) && !String(before.ans_kiest_id || "").trim()) {
          await c.ops.select("select[name=ans_kiest_id]", ROUTE.csddKiestId);
        }
        return;
      }
      const lra = await c.ops.options("select[name=lra_id]");
      if (!lra.some((o) => o.value === company.lraId)) throw new Error(`tirdzniecības vieta ${company.lraId} nav sarakstā - nepareiza firma?`);
      const rep = pickRepresentative(await c.ops.options("select[name=gprs_id_kom_parstavis]"), company);
      const exp = await expected(c, input, company);
      const ans = await c.ops.options("select[name=ans_kiest_id]");
      if (!ans.some((o) => o.value === ROUTE.csddKiestId)) throw new Error("CSDD Tukums nav sarakstā");

      await c.ops.fill("#der_stundas", String(values.validHours));
      await c.ops.select("select[name=lra_id]", company.lraId);
      await c.ops.select("select[name=rn]", plate.value);
      await c.ops.select("select[name=gprs_id_kom_parstavis]", rep.value);
      await c.ops.select("#kmod_id", exp.make.make.value);
      await c.ex("lapv_kmod");
      const model = resolveModel(await c.ops.options("#kmod_id_mod"), exp.make.model);
      await c.ops.select("#kmod_id_mod", model.value);
      await c.ops.setKavSel(exp.route.target);
      await c.ops.waitJx();
      if (exp.route.house) await c.ops.fill("input[name=mn_m1]", exp.route.house);
      await c.ops.select("select[name=ans_kiest_id]", ROUTE.csddKiestId);
    },

    /** Nolasa formu un pārbauda pret šo darbu; sakritības gadījumā atgriež darba vērtības (core compareFields). */
    async readForm(page, h) {
      const { input, company } = need();
      const c = ctxOf(page, h);
      const v = await c.ops.formValues();
      if (!v) return {};
      if (v.lapt_id) {
        // Akta forma: tai jābūt tieši šim aktam (state.laptId), ja tas ir zināms šajā procesā.
        const actOk = input.flow === "tradeAct" && (!state.laptId || v.lapt_id === state.laptId);
        const companyOk = !("lra_id" in v) || v.lra_id === company.lraId;
        const repOk = v.gprs_id_kom_parstavis === pickRepresentative(await c.ops.options("select[name=gprs_id_kom_parstavis]"), company).value;
        // Akta pavadzīmei maršruts nav darba daļa: salīdzina tikai aktu, firmu, pārstāvi, numuru un laiku.
        return {
          plate: actOk && companyOk && repOk ? v.rn : `${v.rn || ""}?akts`,
          validHours: v.der_stundas,
          routeFrom: "",
          routeTo: "",
        };
      }
      if (input.flow === "tradeAct") return { plate: "?akts", validHours: v.der_stundas };
      const exp = await expected(c, input, company);
      const modelOpts = await c.ops.options("#kmod_id_mod");
      const modelOk = v.kmod_id === exp.make.make.value && modelOpts.some((o) => o.value === v.kmod_id_mod && compact(o.text) === compact(exp.make.model));
      const routeOk =
        v.i01_kav_id === String(exp.route.target) && /R[ĪI]GAS/i.test(v.__adr || "") && (!exp.route.house || v.mn_m1 === exp.route.house);
      // Cita firmas tirdzniecības vieta -> numurs neatbilst (core compareFields atteiks).
      const companyOk = v.lra_id === company.lraId;
      return {
        plate: companyOk ? v.rn : `${v.rn || ""}?lra`,
        validHours: v.der_stundas,
        brandModel: modelOk ? input.brandModel : `${v.kmod_id__text || ""} ${v.kmod_id_mod__text || ""}`.trim() || "?",
        routeFrom: routeOk ? input.routeFrom : v.__adr || "?",
        routeTo: v.ans_kiest_id === ROUTE.csddKiestId ? input.routeTo : v.ans_kiest_id__text || "?",
      };
    },

    async formMode(page, h) {
      const c = ctxOf(page, h);
      return (await c.ops.has("form[name=lapv_form]")) && (await c.ops.has("select[name=rn]")) ? "open" : "";
    },

    async clickSave(page, h) {
      const c = ctxOf(page, h);
      await c.ops.click("form[name=lapv_form] button[type=submit]:has-text('Saglabāt')", "save");
      await c.ops.waitJx();
    },

    async readWaybillNo(page, h) {
      const c = ctxOf(page, h);
      state.lapvId = String((await c.ops.value("#lapv_id")) || "");
      const text = String(await c.ops.p1Text());
      if (!state.lapvId) return "";
      const m = /Pavadz[iī]mes\s+(?:numurs|nr\.?):?\s*([A-Z]{1,3}\d{4,7})/i.exec(text);
      if (m) return m[1].toUpperCase();
      // Rezerve: tieši viens P-numurs lapā (piem. "P02806").
      const all = [...new Set(text.toUpperCase().match(/\bP\d{5,6}\b/g) || [])];
      return all.length === 1 ? all[0] : "";
    },

    async downloadPdf(page, name, h) {
      const c = ctxOf(page, h);
      const id = state.lapvId || String((await c.ops.value("#lapv_id")) || "");
      if (!/^\d+$/.test(id)) return "";
      const r = await c.ops.httpGet(`${c.base}/?main=1&pdf=lapv&id=${id}&uid=${Date.now()}`);
      const body = Buffer.from(await r.body());
      if (body.subarray(0, 4).toString() !== "%PDF") throw new Error(`PDF nav atgriezts (${r.status})`);
      const rel = path.join("pdf", `${name}.pdf`);
      fs.mkdirSync(path.join(c.ttrDir, "pdf"), { recursive: true });
      fs.writeFileSync(path.join(c.ttrDir, rel), body, { mode: 0o600 });
      return rel;
    },
  };
}

module.exports = createAdapter();
module.exports.createAdapter = createAdapter;
module.exports.ALLOWED_EX = ALLOWED_EX;
module.exports.ALLOWED_EX_PATTERNS = ALLOWED_EX_PATTERNS;
module.exports.exAllowed = exAllowed;
module.exports.ANNUL_EX = ANNUL_EX;
module.exports.COMPANIES = COMPANIES;
module.exports.readCredentialFile = readCredentialFile;
module.exports.parseKavTree = parseKavTree;
