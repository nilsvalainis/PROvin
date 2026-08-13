import "server-only";

/**
 * car.info — starptautisks agregators (Skandināvija, DACH u.c.). Publiski un bez maksas
 * rāda tikai daļu datu, un lapa ir aiz bot aizsardzības, tāpēc lasām ar to pašu
 * stealth pārlūku. Ja publiskā lapa datus nerāda, sadaļa paliek manuālai ievadei.
 */
import { createVinSourceContext, extractPageData, sleep } from "@/lib/vin-sources/browser";
import { detectSpecialUseLabels } from "@/lib/vin-sources/translate-lv";
import {
  emptyVinSourceResult,
  type VinSourceFetchResult,
  type VinSourceMileageRow,
} from "@/lib/vin-sources/types";

const LOCALES = ["en-se", "en-dk", "en-de"] as const;

const COUNTRY_BY_CODE: Record<string, string> = {
  se: "Zviedrija",
  sweden: "Zviedrija",
  dk: "Dānija",
  denmark: "Dānija",
  no: "Norvēģija",
  norway: "Norvēģija",
  fi: "Somija",
  finland: "Somija",
  de: "Vācija",
  germany: "Vācija",
  nl: "Nīderlande",
  ee: "Igaunija",
  lt: "Lietuva",
  pl: "Polija",
};

function detectCountry(cells: string[]): string {
  for (const cell of cells) {
    const key = cell.trim().toLowerCase();
    if (COUNTRY_BY_CODE[key]) return COUNTRY_BY_CODE[key]!;
  }
  return "";
}

function normalizeDate(cell: string): string {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(cell);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dot = /(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(cell);
  if (dot) return `${dot[3]}-${dot[2]!.padStart(2, "0")}-${dot[1]!.padStart(2, "0")}`;
  const monthYear = /^(\d{4})-(\d{2})$/.exec(cell.trim());
  if (monthYear) return `${monthYear[1]}-${monthYear[2]}-01`;
  return "";
}

function parseKm(cell: string): string {
  const m = /(\d[\d\s.,]{2,})\s*(?:km|mil)\b/i.exec(cell.replace(/\u00a0/g, " "));
  if (!m) return "";
  const digits = m[1]!.replace(/[^\d]/g, "");
  if (digits.length < 3) return "";
  return String(Number(digits));
}

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
      return emptyVinSourceResult("carinfo", vin, "car.info publiski datus par šo VIN neatrāda (lapa nav pieejama)");
    }

    const mileage: VinSourceMileageRow[] = [];
    for (const table of loaded.tables) {
      for (const cells of table.rows) {
        const date = cells.map(normalizeDate).find(Boolean) ?? "";
        const km = cells.map(parseKm).find(Boolean) ?? "";
        if (!date || !km) continue;
        mileage.push({
          date,
          odometer: km,
          country: detectCountry(cells),
          origin: table.headers.filter(Boolean).join(" ") || "car.info",
        });
      }
    }
    mileage.sort((a, b) => b.date.localeCompare(a.date));

    const ownerLines = loaded.pairs
      .filter((p) => /owner|ägare|besitzer|registration|registered|first reg/i.test(p.label))
      .slice(0, 20)
      .map((p) => `${p.label}: ${p.value}`);

    const specialUse = detectSpecialUseLabels(loaded.text);
    const statusLines = loaded.pairs
      .filter((p) => /status|usage|use|taxi|leasing|inspection/i.test(p.label))
      .slice(0, 20)
      .map((p) => `${p.label}: ${p.value}`);
    if (specialUse.length > 0) statusLines.push(`Īpašie statusi: ${specialUse.join(", ")}`);

    const notes: string[] = [];
    for (const label of specialUse) notes.push(`⚠ Īpašs izmantošanas statuss: ${label}`);
    const asc = [...mileage].sort((a, b) => a.date.localeCompare(b.date));
    let peak = -1;
    for (const row of asc) {
      const km = Number(row.odometer);
      if (peak > 0 && km < peak - 1000) {
        notes.push(`⚠ Odometra pretruna: ${peak.toLocaleString("lv-LV")} km → ${km.toLocaleString("lv-LV")} km (${row.date})`);
      }
      if (km > peak) peak = km;
    }
    const countries = [...new Set(mileage.map((m) => m.country).filter(Boolean))];
    if (countries.length > 1) notes.push(`Dati no vairākām valstīm: ${countries.join(", ")}`);

    const hasData = mileage.length > 0 || ownerLines.length > 0 || statusLines.length > 0;
    return {
      source: "carinfo",
      vin,
      found: hasData,
      message: hasData
        ? `Nolasīts no ${usedUrl} (${mileage.length} nobraukuma ieraksti)`
        : "car.info lapa atvērta, bet publiski strukturēti dati netika atrasti",
      mileage,
      incidents: [],
      ownersSummary: ownerLines.join("\n"),
      statusRecords: statusLines.join("\n"),
      notes,
      raw: loaded.text,
      fetchedAt: new Date().toISOString(),
    };
  } finally {
    await context.close().catch(() => undefined);
  }
}
