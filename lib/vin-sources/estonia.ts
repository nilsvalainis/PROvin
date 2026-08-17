import "server-only";

/**
 * Igaunijas avoti:
 *  - eteenindus.mnt.ee („Sõiduki taustakontroll”) — Transpordiamet reģistra dati, nobraukums, ierobežojumi;
 *  - lkf.ee („Kahjukontroll”) — Liikluskindlustuse Fond OCTA atlīdzību gadījumi.
 * Abi ir aiz reCAPTCHA, tāpēc darbojas ar redzamu pārlūku (skat. browser.ts).
 */
import {
  createVinSourceContext,
  extractPageData,
  humanMouse,
  humanType,
  sleep,
  type VinSourcePage,
} from "@/lib/vin-sources/browser";
import { formatRegistryDateLv } from "@/lib/vin-registry-client-text";
import { detectSpecialUseLabels, translateTermLv, translateTextLv } from "@/lib/vin-sources/translate-lv";
import {
  emptyVinSourceResult,
  type VinSourceFetchResult,
  type VinSourceIncidentRow,
  type VinSourceMileageRow,
} from "@/lib/vin-sources/types";

const MNT_URL = "https://eteenindus.mnt.ee/public/soidukTaustakontroll.jsf";
const LKF_URL = "https://lkf.ee/et/kahjukontroll";
const COUNTRY_LV = "Igaunija";

const MNT_NOT_FOUND = /Sisestatud andmetega sõidukit registris ei ole/i;
const MNT_CAPTCHA_ERROR = /reCAPTCHA valideerimise viga/i;

type PageTable = { headers: string[]; rows: string[][] };

function normalizeDate(cell: string): string {
  const dot = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(cell);
  if (dot) return `${dot[3]}-${dot[2]!.padStart(2, "0")}-${dot[1]!.padStart(2, "0")}`;
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(cell);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return "";
}

function parseKm(cell: string): string {
  const m = /(\d[\d\s.,]{2,})\s*(?:km|KM)?/.exec(cell.replace(/\u00a0/g, " "));
  if (!m) return "";
  const digits = m[1]!.replace(/[^\d]/g, "");
  if (digits.length < 3) return "";
  return String(Number(digits));
}

function parseAmount(cell: string): string {
  const m = /(\d[\d\s.,]*)\s*(?:€|EUR|eur)/.exec(cell.replace(/\u00a0/g, " "));
  if (!m) return "";
  const normalized = m[1]!.replace(/\s/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return "";
  return `${value.toFixed(2)} €`;
}

/** Rindas ar datumu + km — nobraukuma tabulai (mnt.ee kolonnu nosaukumi mainās). */
function mileageRowsFromTables(tables: PageTable[]): VinSourceMileageRow[] {
  const rows: VinSourceMileageRow[] = [];
  for (const table of tables) {
    const contextLv = translateTextLv(table.headers.join(" "), "et");
    for (const cells of table.rows) {
      const date = cells.map(normalizeDate).find(Boolean) ?? "";
      const km = cells.map(parseKm).find(Boolean) ?? "";
      if (!date || !km) continue;
      rows.push({ date, odometer: km, country: COUNTRY_LV, origin: contextLv || "Transpordiamet" });
    }
  }
  return rows
    .filter((row, i, all) => all.findIndex((r) => r.date === row.date && r.odometer === row.odometer) === i)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function mileageNotes(mileage: VinSourceMileageRow[]): string[] {
  const notes: string[] = [];
  const asc = [...mileage].sort((a, b) => a.date.localeCompare(b.date));
  let peak: VinSourceMileageRow | null = null;
  for (const row of asc) {
    const km = Number(row.odometer);
    const peakKm = peak ? Number(peak.odometer) : -1;
    if (peak && km < peakKm - 1000) {
      notes.push(
        `Odometra pretruna: ${peakKm.toLocaleString("lv-LV")} km (${formatRegistryDateLv(peak.date)}), pēc tam ${km.toLocaleString("lv-LV")} km (${formatRegistryDateLv(row.date)}).`,
      );
    }
    if (!peak || km > peakKm) peak = row;
  }
  return notes;
}

async function submitMntForm(page: VinSourcePage, vin: string, regMark: string): Promise<void> {
  await page.goto(MNT_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await sleep(2500 + Math.random() * 1500);
  await humanMouse(page);
  if (regMark) await humanType(page, "#soidukOtsingForm\\:regMark", regMark);
  await humanType(page, "#soidukOtsingForm\\:vinKood", vin);
  await sleep(800 + Math.random() * 700);
  await page.click("#soidukOtsingForm button:has-text('OTSIN'), #soidukOtsingForm button:has-text('Otsin')");
  await sleep(6000);
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => undefined);
}

export async function fetchMnt(vin: string, regMark = ""): Promise<VinSourceFetchResult> {
  const { context, page } = await createVinSourceContext("mnt");
  try {
    await submitMntForm(page, vin, regMark);
    const data = await extractPageData(page);

    if (MNT_CAPTCHA_ERROR.test(data.text)) {
      return emptyVinSourceResult("mnt_ee", vin, "reCAPTCHA neizdevās — mēģini vēlreiz ar atvērto pārlūku");
    }
    // lapas instrukcijas citē to pašu frāzi, tāpēc vērtējam tikai tekstu zem formas
    const afterForm = data.text.split("VIN-kood").pop() ?? data.text;
    if (MNT_NOT_FOUND.test(afterForm)) {
      return emptyVinSourceResult("mnt_ee", vin, "VIN nav Igaunijas transportlīdzekļu reģistrā");
    }

    const pairs = data.pairs.filter((p) => p.value && p.label.length < 60);
    if (pairs.length === 0 && data.tables.length === 0) {
      return emptyVinSourceResult("mnt_ee", vin, "Rezultātu lapā dati netika atrasti — pārbaudi pārlūka logu");
    }

    const mileage = mileageRowsFromTables(data.tables);
    const notes = mileageNotes(mileage);

    const ownerLines: string[] = [];
    const statusLines: string[] = [];
    for (const { label, value } of pairs) {
      const labelLv = translateTermLv(label.replace(/:$/, ""), "et");
      const valueLv = translateTextLv(value, "et");
      const line = `${labelLv}: ${valueLv}`;
      if (/omanik|kasutaja|registreerimi|īpašnieks|lietotājs|reģistrāc/i.test(label + labelLv)) ownerLines.push(line);
      if (/kasutusotstarve|piirang|arest|pant|takso|õppe|staatus|ierobežo|statuss/i.test(label + labelLv)) {
        statusLines.push(line);
      }
    }

    // izmantošanas vēstures tabula (kasutusajalugu) — reģistrācijas darbību apkopojums
    const historyTable = data.tables.find((t) =>
      /kasutus|omanik|registreeri/i.test([...t.headers, ...(t.rows[0] ?? [])].join(" ")),
    );
    if (historyTable) {
      ownerLines.push(
        `Reģistrācijas ieraksti: ${historyTable.rows.length}`,
        ...historyTable.rows.slice(0, 25).map((cells) => translateTextLv(cells.filter(Boolean).join(", "), "et")),
      );
    }

    const specialUse = detectSpecialUseLabels(data.text);
    if (specialUse.length > 0) {
      statusLines.push(`Īpašie statusi: ${specialUse.join(", ")}`);
      for (const label of specialUse) notes.push(`Īpašais statuss: ${label}.`);
    }
    if (/arestitud|pant\b/i.test(data.text)) notes.push("Reģistrā norādīts arests vai ķīla.");
    if (/registrist kustutatud/i.test(data.text)) notes.push("Izslēgts no Igaunijas reģistra.");

    return {
      source: "mnt_ee",
      vin,
      found: true,
      message: `Atrasts Igaunijas reģistrā (${mileage.length} nobraukuma ieraksti)`,
      mileage,
      incidents: [],
      ownersSummary: ownerLines.join("\n"),
      statusRecords: statusLines.join("\n"),
      notes,
      raw: data.text,
      fetchedAt: new Date().toISOString(),
    };
  } finally {
    await context.close().catch(() => undefined);
  }
}

async function dismissCookieBanner(page: VinSourcePage): Promise<void> {
  const candidates = [
    "button:has-text('Nõustun')",
    "button:has-text('Luba kõik')",
    "#onetrust-accept-btn-handler",
    "button:has-text('Selge')",
  ];
  for (const sel of candidates) {
    const el = page.locator(sel).first();
    if (await el.count().catch(() => 0)) {
      await el.click({ timeout: 2000 }).catch(() => undefined);
      await sleep(500);
      return;
    }
  }
}

async function clickRecaptchaCheckbox(page: VinSourcePage): Promise<boolean> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const frame = page.frames().find((f) => f.url().includes("recaptcha/api2/anchor"));
    if (frame) {
      const box = frame.locator("#recaptcha-anchor");
      if (await box.count().catch(() => 0)) {
        await box.click({ timeout: 5000 }).catch(() => undefined);
        return true;
      }
    }
    await sleep(1000);
  }
  return false;
}

/**
 * Google apstiprinājums noveco ~2 minūtēs („Kinnitusväljakutse aegus”), tāpēc ķeksi
 * periodiski nospiežam atkārtoti. Ja parādās attēlu uzdevums, to atrisina operators.
 */
async function solveRecaptcha(page: VinSourcePage, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let lastClickAt = 0;

  while (Date.now() < deadline) {
    const state = await page
      .evaluate(() => ({
        len: (document.querySelector("textarea#g-recaptcha-response") as HTMLTextAreaElement | null)?.value?.length ?? 0,
        challenge: [...document.querySelectorAll("iframe[src*='recaptcha/api2/bframe']")].some(
          (f) => f.getBoundingClientRect().height > 100,
        ),
      }))
      .catch(() => ({ len: 0, challenge: false }));

    if (state.len > 20) return true;
    if (state.challenge) {
      await page.bringToFront().catch(() => undefined);
    } else if (Date.now() - lastClickAt > 40000) {
      await clickRecaptchaCheckbox(page);
      lastClickAt = Date.now();
    }
    await sleep(1000);
  }
  return false;
}

export async function fetchLkf(vin: string, captchaTimeoutMs = 240000): Promise<VinSourceFetchResult> {
  const { context, page } = await createVinSourceContext("lkf");
  try {
    await page.goto(LKF_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    await sleep(2000);
    await dismissCookieBanner(page);
    await page.click("#edit-vehicle");
    await page.type("#edit-vehicle", vin, { delay: 80 + Math.random() * 60 });
    await sleep(600);

    if (!(await solveRecaptcha(page, captchaTimeoutMs))) {
      return emptyVinSourceResult("lkf_ee", vin, "reCAPTCHA netika atrisināta — mēģini vēlreiz un nospied ķeksi pārlūkā");
    }

    await page.click("#edit-submit");
    await sleep(4000);
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => undefined);
    const data = await extractPageData(page);

    if (/andmeid ei ole liikluskindlustuse registris/i.test(data.text)) {
      return {
        ...emptyVinSourceResult("lkf_ee", vin, "VIN nav Igaunijas OCTA reģistrā — visticamāk nav bijis reģistrēts Igaunijā"),
        raw: data.text,
      };
    }

    const claimTables = data.tables.filter((t) => t.rows.some((row) => row.some((cell) => normalizeDate(cell))));
    const incidents: VinSourceIncidentRow[] = [];
    for (const table of claimTables) {
      for (const cells of table.rows) {
        const date = cells.map(normalizeDate).find(Boolean);
        if (!date) continue;
        const amount = cells.map(parseAmount).find(Boolean) ?? "";
        const note = translateTextLv(
          cells.filter((c) => c && !normalizeDate(c) && !parseAmount(c)).join(" · "),
          "et",
        );
        incidents.push({ date, amount, country: COUNTRY_LV, note });
      }
    }

    const notes: string[] = [];
    if (incidents.length > 0) notes.push(`Igaunijas OCTA reģistrā ${incidents.length} atlīdzības gadījumi.`);
    if (/hävinud|total|hukkunud/i.test(data.text)) {
      notes.push("Norāde uz pilnīgu bojāeju.");
    }
    const withoutAmount = incidents.filter((i) => !i.amount).length;
    if (incidents.length > 0 && withoutAmount === incidents.length) {
      notes.push("Atlīdzības summas publiski netiek rādītas.");
    }

    const noClaims =
      incidents.length === 0 &&
      /(kahju|juhtum)\w*\s+(ei ole|puuduvad)|ei ole osalenud|puuduvad andmed/i.test(data.text);

    return {
      source: "lkf_ee",
      vin,
      found: incidents.length > 0,
      message:
        incidents.length > 0
          ? `Atrasti ${incidents.length} OCTA atlīdzības gadījumi`
          : noClaims
            ? "OCTA atlīdzības gadījumi nav atrasti"
            : "Atbilde nav automātiski klasificēta — pārbaudi RAW tekstu",
      mileage: [],
      incidents,
      ownersSummary: "",
      statusRecords: "",
      notes,
      raw: data.text,
      fetchedAt: new Date().toISOString(),
    };
  } finally {
    await context.close().catch(() => undefined);
  }
}
