import "server-only";

/**
 * car.info — starptautisks agregators. Publiski un bez maksas rāda tikai daļu datu,
 * un lapa ir aiz bot aizsardzības. Servera (Vercel) vidē Playwright nav pieejams —
 * operators atver VIN saiti un ielīmē lapas tekstu adminā (parseCarinfoPastedText).
 */
import { CARINFO_HOME_URL } from "@/lib/admin-vin-urls";
import { createVinSourceContext, extractPageData, sleep } from "@/lib/vin-sources/browser";
import { parseCarinfoExtract } from "@/lib/vin-sources/carinfo-parse";
import { emptyVinSourceResult, type VinSourceFetchResult } from "@/lib/vin-sources/types";

const LOCALES = ["en-se", "en-dk", "en-de"] as const;

export async function fetchCarInfo(vin: string): Promise<VinSourceFetchResult> {
  const { context, page } = await createVinSourceContext("carinfo");
  try {
    let loaded: { text: string; tables: { headers: string[]; rows: string[][] }[]; pairs: { label: string; value: string }[] } | null =
      null;
    let usedUrl = "";

    for (const locale of LOCALES) {
      const url = `https://www.car.info/${locale}/vin/${encodeURIComponent(vin)}`;
      const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
      await sleep(2500);
      const status = res?.status() ?? 0;
      if (status >= 400) continue;
      const data = await extractPageData(page);
      if (/vin.{0,20}(not found|no result)|page not found/i.test(data.text)) continue;
      loaded = data;
      usedUrl = url;
      break;
    }

    if (!loaded) {
      const searchUrl = CARINFO_HOME_URL;
      const res = await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
      await sleep(2500);
      if (res && (res.status() ?? 0) < 400) {
        loaded = await extractPageData(page);
        usedUrl = searchUrl;
      }
    }

    if (!loaded) {
      return emptyVinSourceResult("carinfo", vin, "car.info publiski datus par šo VIN neatrāda (lapa nav pieejama)");
    }

    const parsed = parseCarinfoExtract(loaded);
    return {
      source: "carinfo",
      vin,
      found: parsed.found,
      message: parsed.found
        ? `Nolasīts no ${usedUrl} (${parsed.mileage.length} nobraukuma ieraksti)`
        : "car.info lapa atvērta, bet publiski strukturēti dati netika atrasti",
      mileage: parsed.mileage,
      incidents: [],
      timeline: [],
      ownersSummary: parsed.ownersSummary,
      statusRecords: parsed.statusRecords,
      notes: parsed.notes,
      raw: loaded.text,
      fetchedAt: new Date().toISOString(),
    };
  } finally {
    await context.close().catch(() => undefined);
  }
}
