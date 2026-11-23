import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { buildCsddLocalParseFromText } from "@/lib/csdd-pdf-ingest";
import {
  APP_UA_MARKER,
  appRegisterUrl,
  appUidFromSeed,
  appUserAgentOverride,
  buildAppUserAgent,
  classifyPaidPage,
  findComposeSmsCalls,
  findSmsHrefs,
  MOBINT_METHODS,
  MOBINT_STUB_SCRIPT,
  smsHrefsFromMobintCalls,
  formatPaidReportPanels,
  paidReportLooksComplete,
  parsePaidConfirmText,
  parsePaidListRows,
  parseSmsHref,
  PAID_FORBIDDEN_RE,
  PAID_SEND_EMAIL_RE,
  isPaidSendEmailControl,
  PAID_LIST_LINK_RE,
  PAID_MENU_RE,
  PAID_REQUEST_RE,
  pickPaidReport,
  redactPaidText,
  rigaDateTimeToIso,
  smsBodyMatchesPlate,
} from "@/relay/provin-ecsdd/lib/ecsdd-paid.mjs";
import { createJobQueue } from "@/relay/provin-ecsdd/lib/jobs.mjs";
import { createRelayCore } from "@/relay/provin-ecsdd/lib/relay-core.mjs";
import { defaultSessionConfig } from "@/relay/provin-ecsdd/lib/session.mjs";

/**
 * Fiksācijas: lib/__fixtures__/ecsdd-paid/*.html - SINTĒTISKAS lapas pēc Nila ekrānšāviņiem (23.11.2026) un e.csdd
 * maksas PDF struktūras, anonimizētas: numurs -> AB1234, VIN -> WBAFB71080LV00001, ZTI darbinieki -> izdomāti vārdi un
 * tālruņi, polise -> XYZ000000, konta kods SMS -> 99999. Dzīvās lapas HTML no servera vēl nav redzēts.
 * snapshots.json = releja `snapshot()`, `collectPaidControls()`, `collectPaidTableRows()`, `collectPaidPanels()`
 * rezultāts šīm lapām Chromium pārlūkā (paid-report = tadati akordeona struktūra, paid-report-generic = cits akordeons).
 */
const FIX = path.join(__dirname, "__fixtures__", "ecsdd-paid");
type Ctl = { i: number; text: string; href: string; onclick: string; data: string; visible: boolean };
type Snap = {
  host: string;
  text: string;
  buttons: { text: string; visible?: boolean }[];
  links: { text: string; href: string }[];
  controls: Ctl[];
  panels?: { title: string; rows: string[][]; lines: string[] }[];
  rows?: { cells: string[]; href: string; clickable: boolean }[];
};
const SNAPS = JSON.parse(fs.readFileSync(path.join(FIX, "snapshots.json"), "utf8")) as Record<string, Snap>;

function summary(text: string) {
  const f = buildCsddLocalParseFromText(text, "test").fields;
  return {
    makeModel: f.makeModel,
    vin: f.vin,
    reg: f.registrationNumber,
    year: f.modelYear,
    fuel: f.fuelType,
    prevCountry: f.previousRegistrationCountry,
    owners: f.ownerCountLatvia,
    next: f.nextInspectionDate,
    insurance: f.insuranceValidUntil,
    opacity: f.opacityCoefficient,
    gross: f.grossMassKg,
    curb: f.curbMassKg,
    vehicleType: f.vehicleType,
    mileage: f.mileageHistory.map((r) => `${r.date}:${r.odometer}`),
    events: f.ownerRegistrationEvents.length,
    ta: f.technicalInspectionHistory.map((r) => `${r.date}/${r.defects?.length ?? 0}`),
    prevDefects: f.prevInspectionBlock.defects?.map((d) => `${d.code}|${d.rating}`) ?? [],
  };
}

describe("maksas izziņa: fiksācijas", () => {
  it("contain only the made-up phones, SMS account code and polise", () => {
    for (const f of fs.readdirSync(FIX)) {
      const t = fs.readFileSync(path.join(FIX, f), "utf8");
      const phones = t.match(/(?<!\d)[26]\d{7}(?!\d)/g) ?? [];
      expect(phones.filter((p) => p !== "61234567" && p !== "67654321"), f).toEqual([]);
      const codes = [...t.matchAll(/CSDD(?:\s|%20)+(\d+)/g)].map((m) => m[1]);
      expect(codes.filter((c) => c !== "99999"), f).toEqual([]);
      const polises = [...t.matchAll(/Polise\W+([A-Z]{2,4}\d{4,})/g)].map((m) => m[1]);
      expect(polises.filter((p) => p !== "XYZ000000"), f).toEqual([]);
    }
  });
});

describe("maksas izziņa: SMS saite (nolasa, nekad nesūta)", () => {
  it("parses iOS, Android and // forms; rejects links without a number or text", () => {
    expect(parseSmsHref("sms:1800&body=CSDD%2099999%20AB1234")).toEqual({ number: "1800", body: "CSDD 99999 AB1234" });
    expect(parseSmsHref("sms:1800?body=CSDD+99999+AB1234")).toEqual({ number: "1800", body: "CSDD 99999 AB1234" });
    expect(parseSmsHref("sms://1800;?&body=CSDD%2099999%20AB1234")).toEqual({ number: "1800", body: "CSDD 99999 AB1234" });
    expect(parseSmsHref("sms:+371 1800?body=x")).toEqual({ number: "+3711800", body: "x" });
    expect(parseSmsHref("sms:?body=x")).toBeNull();
    expect(parseSmsHref("sms:1800")).toBeNull();
    expect(parseSmsHref("https://e.csdd.lv/")).toBeNull();
  });

  it("the SMS text must be for exactly this plate", () => {
    expect(smsBodyMatchesPlate("CSDD 99999 AB1234", "ab-1234")).toBe(true);
    expect(smsBodyMatchesPlate("CSDD 99999 AB1235", "AB1234")).toBe(false);
    expect(smsBodyMatchesPlate("PAY 99999 AB1234", "AB1234")).toBe(false);
  });

  it("confirm page: reads price, car and plate; the sms: link is found in href / onclick / HTML", () => {
    const snap = SNAPS["paid-confirm"];
    expect(classifyPaidPage(snap)).toBe("paid_confirm");
    expect(parsePaidConfirmText(snap.text)).toEqual({ price: "1,50", vehicle: "MERCEDES BENZ 500", plate: "AB1234" });
    const prep = snap.controls.find((c) => /Sagatavot īsziņu/.test(c.text));
    expect(prep?.href).toBe("sms:1800&body=CSDD%2099999%20AB1234");
    expect(PAID_FORBIDDEN_RE.test(prep?.text ?? "")).toBe(true);
    expect(findSmsHrefs(`<button onclick="location.href='sms:1800&amp;body=CSDD%2099999%20AB1234'">`)).toEqual([
      "sms:1800&body=CSDD%2099999%20AB1234",
    ]);
  });

  it("finds the request button and menu links by text; never the e-mail / SMS / pay controls", () => {
    expect(PAID_REQUEST_RE.test("Pieprasīt maksas izziņu")).toBe(true);
    expect(PAID_LIST_LINK_RE.test("Apmaksātās izziņas")).toBe(true);
    expect(PAID_MENU_RE.test(" Maksas Izziņas ")).toBe(true);
    expect(PAID_MENU_RE.test("Transportlīdzekļu maksas izziņas")).toBe(false);
    for (const t of ["Nosūtīt uz reģistrēto epastu", "Sagatavot īsziņu", "Apmaksāt", "Iziet"]) expect(PAID_FORBIDDEN_RE.test(t), t).toBe(true);
    for (const t of ["Apmaksātās izziņas", "Atjaunot sarakstu", "Pieprasīt maksas izziņu", "Maksas Izziņas"]) expect(PAID_FORBIDDEN_RE.test(t), t).toBe(false);
    expect(classifyPaidPage({ text: "Tehniskie dati", buttons: [{ text: "Pieprasīt maksas izziņu" }], links: [] })).toBe("tadati_with_paid");
  });
});

describe("maksas izziņa: Apmaksātās izziņas", () => {
  it("list rows -> plate, status, Riga time; newest paid report after the request time", () => {
    const snap = SNAPS["paid-list"];
    expect(classifyPaidPage(snap)).toBe("paid_list");
    const list = parsePaidListRows((snap.rows ?? []).map((r) => r.cells));
    expect(list.map((r) => `${r.plate} ${r.status} ${r.paidAt}`)).toEqual([
      "AB1234 Apmaksāts 2026-11-23T13:31:52.000Z",
      "CD5678 Apmaksāts 2026-11-22T10:49:40.000Z",
      "AB1234 Apmaksāts 2026-11-20T17:56:33.000Z",
    ]);
    expect(snap.rows?.[list[0].index]?.href).toBe("/maksizz/?id=3");
    expect(pickPaidReport(list, "AB1234", "2026-11-23T13:30:00.000Z")?.paidAt).toBe("2026-11-23T13:31:52.000Z");
    expect(pickPaidReport(list, "AB1234", "2026-11-23T14:00:00.000Z")).toBeNull();
    expect(pickPaidReport(list, "CD5678")?.dateText).toBe("22.11.2026 12:49:40");
    expect(pickPaidReport(list, "ZZ0000")).toBeNull();
  });

  it("Riga time handles summer (UTC+3) and winter (UTC+2)", () => {
    expect(rigaDateTimeToIso("01.07.2026 12:00:00")).toBe("2026-07-01T09:00:00.000Z");
    expect(rigaDateTimeToIso("01.12.2026 12:00")).toBe("2026-12-01T10:00:00.000Z");
    expect(rigaDateTimeToIso("01.12.2026")).toBe("2026-11-30T22:00:00.000Z");
  });
});

describe("maksas izziņa: izziņas teksts -> esošais CSDD parsers", () => {
  const expected = {
    makeModel: "BMW 530",
    vin: "WBAFB71080LV00001",
    reg: "AB1234",
    year: "2006",
    fuel: "Dīzeļdegviela",
    prevCountry: "ITĀLIJA",
    owners: "4",
    next: "2026-12-02",
    insurance: "2026-11-29",
    // Jaunākā apskate ar dūmainību (22.11.2024); 24.11.2025 avotā tās nav, 0.06 ir 2018. gada.
    opacity: "0.18",
    gross: "2350",
    curb: "1845",
    vehicleType: "Vieglais plašlietojuma",
    events: 4,
  };

  for (const name of ["paid-report", "paid-report-generic"]) {
    it(`${name}: all 10 panels are collected and every field the PDF gives is filled`, () => {
      const snap = SNAPS[name];
      expect(classifyPaidPage(snap)).toBe("paid_report");
      expect(snap.panels?.map((p) => p.title)).toEqual([
        "Aizliegumi",
        "Būtiski bojājumi CSNg",
        "Reģistrācijas dati",
        "Transportlīdzekļa reģistrācija",
        "Transportlīdzekļa ekspluatācijas nodoklis",
        "Uzņēmuma vieglo transportlīdzekļu nodokļa likme",
        "Civiltiesiskā apdrošināšana",
        "Pēdējā tehniskā apskate",
        "Nobraukuma vēsture",
        "Tehnisko apskašu vēsture",
      ]);
      const text = formatPaidReportPanels(snap.panels, "Informācija sagatavota elektroniski 22.11.2026 12:49:40.");
      expect(paidReportLooksComplete(text)).toBe(true);
      expect(text).toContain("Reģistrācijas dati\nReģistrācijas numurs AB1234\n");
      expect(text).toContain("366058- 22.11.2024");
      expect(text).toContain("7.1.6. 1 Drošības sistēmas (SRS) kļūmes (bojājuma) indikators norāda uz kļūmi (bojājumu) tās darbībā.");
      expect(text).not.toMatch(/Bērziņš|Paraudziņa|61234567|67654321/);
      expect(text).toContain("iecirkna ZTI: ***. tel. ***");
      const s = summary(text);
      expect(s).toMatchObject(expected);
      expect(s.mileage).toEqual([
        "24.11.2025:393885",
        "22.11.2024:366058",
        "21.11.2023:355546",
        "22.08.2022:345673",
        "16.08.2021:329281",
        "03.08.2020:318134",
        "18.07.2019:302361",
        "20.06.2018:279090",
        "21.05.2018:277164",
        "13.05.2017:254471",
      ]);
      expect(s.ta).toEqual([
        "24.11.2025/0",
        "22.11.2024/3",
        "21.11.2023/0",
        "22.08.2022/0",
        "16.08.2021/1",
        "03.08.2020/0",
        "18.07.2019/1",
        "20.06.2018/1",
        "21.05.2018/4",
        "13.05.2017/2",
      ]);
      // Bloks = pēdējā apskate 24.11.2025 (saraksta avotā nav); 22.11.2024 defekti ir vēsturē (sk. s.ta «22.11.2024/3»).
      expect(s.prevDefects).toEqual([]);
    });
  }

  it("mileage rows in any web form become the PDF form", () => {
    const t = formatPaidReportPanels([
      { title: "Nobraukuma vēsture", rows: [["Nobraukums, datums"], ["366058", "22.11.2024"], ["355546", "- 21.11.2023"], ["345673 - 22.08.2022"]] },
    ]);
    expect(t).toBe("Nobraukuma vēsture\nNobraukums, datums\n366058- 22.11.2024\n355546- 21.11.2023\n345673- 22.08.2022");
  });

  it("redaction: phones, officer names, owner lines, account code in an SMS text", () => {
    expect(redactPaidText("Liegumu registreja 1. iecirkna ZTI: Jānis Bērziņš. tel. 61234567")).toBe("Liegumu registreja 1. iecirkna ZTI: ***. tel. ***");
    expect(redactPaidText("Zvaniet 29123456 vai +371 61234567")).toBe("Zvaniet *** vai ***");
    expect(redactPaidText("CSDD 99999 AB1234")).toBe("CSDD *** AB1234");
    expect(redactPaidText("Odometra rādījums 393885 VIN WBAFB71080LV00001")).toBe("Odometra rādījums 393885 VIN WBAFB71080LV00001");
    expect(formatPaidReportPanels([{ title: "Reģistrācijas dati", rows: [["Īpašnieks", "JĀNIS BĒRZIŅŠ"]] }])).toBe("Reģistrācijas dati\nĪpašnieks ***");
  });
});

describe("maksas izziņa: releja kodols (bez rindas, tikai aktīvā sesijā)", () => {
  function relay() {
    const now = () => new Date("2026-11-23T10:00:00Z");
    const calls: string[] = [];
    const browser = {
      login: async () => {
        calls.push("login");
      },
      ping: async () => "ok",
      lookup: async () => ({ status: "not_found" }),
      logout: async () => undefined,
    };
    const core = createRelayCore({
      queue: createJobQueue({ now }),
      browser,
      notify: async () => undefined,
      cfg: defaultSessionConfig({}),
      now,
      isWorkHours: () => true,
    });
    return { core, calls };
  }

  it("without a session: needs_login, no browser step and no Smart-ID unless login:true (the admin button)", async () => {
    const { core, calls } = relay();
    let ran = 0;
    const out = await core.direct(async () => {
      ran++;
      return { status: "ok" };
    });
    expect(out).toMatchObject({ status: "needs_login", loginStarted: false });
    expect(ran).toBe(0);
    await core.tick();
    expect(calls).toEqual([]);
    expect(await core.direct(async () => ({ status: "ok" }), { login: true })).toMatchObject({ status: "needs_login", loginStarted: true });
    await core.tick();
    expect(calls).toEqual(["login"]);
    const ok = await core.direct(async () => ({ status: "ok", number: "1800", body: "CSDD 99999 AB1234" }));
    expect(ok).toMatchObject({ status: "ok", number: "1800", session: { state: "active" } });
  });

  it("a logged-out page ends the session; browser errors come back as codes", async () => {
    const { core } = relay();
    await core.direct(async () => ({ status: "ok" }), { login: true });
    await core.tick();
    expect(((await core.direct(async () => ({ status: "logged_out" }))) as { status: string }).status).toBe("needs_login");
    expect(core.session().state).not.toBe("active");
    await core.direct(async () => ({ status: "ok" }), { login: true });
    await core.tick();
    const err = await core.direct(async () => {
      throw Object.assign(new Error("x"), { code: "page_changed" });
    });
    expect(err).toEqual({ status: "error", code: "page_changed" });
  });
});

describe("maksas izziņa: CSDD lietotnes identitāte (APK lv.csdd.ecsdd 3.9.9)", () => {
  it("UA kā lietotnes WebView: Android wv + csdd_mob_app_android_v2 uid= verCode=325", () => {
    const ua = buildAppUserAgent({ chromeVersion: "131.0.6778.85", uid: "0123456789abcdefunknown" });
    expect(ua).toMatch(/^Mozilla\/5\.0 \(Linux; Android 14; [^)]*; wv\) AppleWebKit\/537\.36 .*Chrome\/131\.0\.6778\.85 Mobile Safari\/537\.36 /);
    expect(ua.endsWith(" csdd_mob_app_android_v2 uid=0123456789abcdefunknown verCode=325")).toBe(true);
    expect(APP_UA_MARKER).toBe("csdd_mob_app_android_v2");
  });

  it("uid stabils un android_id formā; override ar Android klienta mājieniem", () => {
    expect(appUidFromSeed("x")).toBe(appUidFromSeed("x"));
    expect(appUidFromSeed("x")).toMatch(/^[0-9a-f]{16}unknown$/);
    expect(appUidFromSeed("x")).not.toBe(appUidFromSeed("y"));
    const o = appUserAgentOverride({ chromeVersion: "131.0.6778.85", uid: "u1" });
    expect(o.userAgent).toContain("csdd_mob_app_android_v2 uid=u1 verCode=325");
    expect(o.userAgentMetadata).toMatchObject({ platform: "Android", mobile: true, fullVersion: "131.0.6778.85" });
    expect(buildAppUserAgent({ chromeVersion: "" })).toContain("Chrome/131.0.0.0");
  });

  it("lietotnes starta reģistrācijas URL", () => {
    expect(appRegisterUrl()).toBe("https://e.csdd.lv/?AppVers=325&ApiLevel=34&AppOS=Android");
  });

  it("composesms(...) onclick -> sms: saite (pēdiņas un entītijas)", () => {
    expect(findComposeSmsCalls(`<a href="javascript:;" onclick="mobint.composesms('1800','CSDD 99999 AB1234');">Sagatavot īsziņu</a>`)).toEqual([
      "sms:1800?body=CSDD%2099999%20AB1234",
    ]);
    expect(findSmsHrefs(`<button onclick="mobint.composesms(&quot;1800&quot;, &quot;CSDD 99999 AB1234&quot;)">`)).toEqual([
      "sms:1800?body=CSDD%2099999%20AB1234",
    ]);
    expect(findSmsHrefs(`onclick="window.mobint.composesms(&#39;1800&#39;,&#39;CSDD 99999 AB1234&#39;)"`)).toHaveLength(1);
    const sms = parseSmsHref(findSmsHrefs(`mobint.composesms("1800", "CSDD 99999 AB1234")`)[0]);
    expect(sms).toEqual({ number: "1800", body: "CSDD 99999 AB1234" });
    expect(smsBodyMatchesPlate(sms?.body, "AB1234")).toBe(true);
    expect(findComposeSmsCalls("mobint.callnumber('1800')")).toEqual([]);
  });

  it("mobint aizstājējs tikai pieraksta izsaukumus (nekas netiek sūtīts)", () => {
    const win: Record<string, unknown> = {};
    new Function("window", MOBINT_STUB_SCRIPT)(win);
    const mobint = win.mobint as Record<string, (...a: unknown[]) => unknown>;
    expect(Object.keys(mobint).sort()).toEqual([...MOBINT_METHODS].sort());
    expect(mobint.composesms("1800", "CSDD 99999 AB1234")).toBe("");
    const calls = win.__provinMobintCalls as string[][];
    expect(calls).toEqual([["composesms", "1800", "CSDD 99999 AB1234"]]);
    expect(smsHrefsFromMobintCalls(calls).map((h: string) => parseSmsHref(h))).toEqual([{ number: "1800", body: "CSDD 99999 AB1234" }]);
    expect(smsHrefsFromMobintCalls([["callnumber", "1800"]])).toEqual([]);
  });
});

describe("Nosūtīt uz reģistrēto epastu (tikai šī poga)", () => {
  it("atbilst tikai precīzajai pogai no fiksācijas", () => {
    const html = fs.readFileSync(path.join(__dirname, "__fixtures__/ecsdd-paid/paid-report.html"), "utf8");
    const m = html.match(/<button[^>]*name="sendmail"[^>]*>([^<]+)<\/button>/);
    expect(m?.[1]).toBeTruthy();
    expect(isPaidSendEmailControl({ text: m![1]!, href: "" })).toBe(true);
    expect(PAID_SEND_EMAIL_RE.test("Nosūtīt uz reģistrēto e-pastu")).toBe(true);
  });
  it("nekad: SMS, maksas, citas nosūtīšanas pogas", () => {
    for (const text of ["Sagatavot īsziņu", "Nosūtīt īsziņu", "Nosūtīt uz reģistrēto epastu EUR 1,50", "Nosūtīt", "Pieprasīt maksas izziņu", "Apmaksāt"]) {
      expect(isPaidSendEmailControl({ text, href: "" })).toBe(false);
    }
    expect(isPaidSendEmailControl({ text: "Nosūtīt uz reģistrēto epastu", href: "sms:1800" })).toBe(false);
  });
});
