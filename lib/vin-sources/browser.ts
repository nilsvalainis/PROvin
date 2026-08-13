import "server-only";

import path from "node:path";
import { mkdir } from "node:fs/promises";
import { getChromiumWithStealth } from "@/lib/iriss-playwright-extra-stealth";

type Chromium = ReturnType<typeof getChromiumWithStealth>;
export type VinSourceContext = Awaited<ReturnType<Chromium["launchPersistentContext"]>>;
export type VinSourcePage = Awaited<ReturnType<VinSourceContext["newPage"]>>;

/**
 * mnt.ee un lkf.ee ir aiz reCAPTCHA, kas headless režīmā stabili krīt
 * („reCAPTCHA valideerimise viga”), tāpēc vajadzīgs redzams pārlūks ar pastāvīgu
 * profilu — tas arī saglabā captcha uzticamības sīkdatnes starp pasūtījumiem.
 * Praktiski: šie avoti strādā tikai lokālajā vidē, ne Vercel serverī.
 */
export const VIN_SOURCES_BROWSER_UNAVAILABLE =
  "Automātiskā ielāde darbojas tikai lokālajā vidē — reCAPTCHA dēļ vajadzīgs redzams pārlūks. Servera vidē datus ievada manuāli.";

export function isVinSourcesBrowserAllowed(): boolean {
  const flag = process.env.VIN_SOURCES_BROWSER?.trim();
  if (flag === "off") return false;
  if (flag === "on") return true;
  return !process.env.VERCEL;
}

export async function createVinSourceContext(profile: string): Promise<{
  context: VinSourceContext;
  page: VinSourcePage;
}> {
  const profileDir = path.join(process.cwd(), "tmp", "vin-profiles", profile);
  await mkdir(profileDir, { recursive: true });

  const chromium = getChromiumWithStealth();
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1440, height: 900 },
    locale: "et-EE",
    timezoneId: "Europe/Tallinn",
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = context.pages()[0] ?? (await context.newPage());
  return { context, page };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Cilvēkam līdzīga rakstīšana — invisible reCAPTCHA vērtē mijiedarbības ritmu. */
export async function humanType(page: VinSourcePage, selector: string, value: string): Promise<void> {
  await page.click(selector);
  await page.type(selector, value, { delay: 70 + Math.random() * 80 });
}

export async function humanMouse(page: VinSourcePage): Promise<void> {
  await page.mouse.move(380 + Math.random() * 400, 280 + Math.random() * 240, { steps: 12 });
  await sleep(400 + Math.random() * 600);
}

/** Tabulas un „etiķete: vērtība” pāri no rezultātu lapas. */
export async function extractPageData(page: VinSourcePage): Promise<{
  text: string;
  tables: { headers: string[]; rows: string[][] }[];
  pairs: { label: string; value: string }[];
}> {
  return page.evaluate(() => {
    const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

    const tables = [...document.querySelectorAll("table")]
      .map((table) => {
        const rows = [...table.querySelectorAll("tr")]
          .map((tr) => [...tr.querySelectorAll("th,td")].map((c) => clean(c.textContent)))
          .filter((cells) => cells.some(Boolean));
        if (rows.length === 0) return null;
        const headerRow = table.querySelector("thead tr");
        const headers = headerRow
          ? [...headerRow.querySelectorAll("th,td")].map((c) => clean(c.textContent))
          : (rows[0] ?? []);
        const body = headerRow ? rows : rows.slice(1);
        return { headers, rows: body };
      })
      .filter((t): t is { headers: string[]; rows: string[][] } => t !== null);

    const pairs: { label: string; value: string }[] = [];
    for (const dl of document.querySelectorAll("dl")) {
      const dts = [...dl.querySelectorAll("dt")];
      const dds = [...dl.querySelectorAll("dd")];
      dts.forEach((dt, i) => {
        const label = clean(dt.textContent);
        const value = clean(dds[i]?.textContent);
        if (label && value) pairs.push({ label, value });
      });
    }
    for (const row of document.querySelectorAll("[class*='row'],[class*='field'],li")) {
      const label = clean(row.querySelector("label,strong,b,.label,.title")?.textContent);
      const full = clean(row.textContent);
      if (!label || !full || full === label) continue;
      const value = clean(full.slice(label.length).replace(/^[:\-–]\s*/, ""));
      if (value && value.length < 200) pairs.push({ label, value });
    }

    return {
      text: (document.body.innerText ?? "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 20000),
      tables,
      pairs: pairs.slice(0, 200),
    };
  });
}
