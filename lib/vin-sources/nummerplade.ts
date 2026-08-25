/**
 * nummerplade.net oficiālais JSON API (VIN vai numurs).
 * Publiskā lapa ir aiz Cloudflare; vajag `NUMMERPLADE_API_KEY` (X-Api-Noegle).
 * Gratis Cache: grunddata + tehnika + OCTA — ne synsrapport/km/īpašnieku skaitu.
 * https://www.nummerplade.net/api
 */
import { formatRegistryDateLv } from "@/lib/vin-registry-client-text";
import { asArray, asRecord, DK_COUNTRY_LV, isoDay, num, pickNum, pickStr } from "@/lib/vin-sources/dk-json";
import { translateTermLv } from "@/lib/vin-sources/translate-lv";
import type { VinSourceFetchResult, VinSourceIncidentRow, VinSourceMileageRow } from "@/lib/vin-sources/types";
import { emptyVinSourceResult } from "@/lib/vin-sources/types";

const BASE = "https://www.nummerplade.net/api/v1";

const HEADERS_BASE: Record<string, string> = {
  accept: "application/json",
  "accept-language": "da-DK,da;q=0.9,en;q=0.8",
  referer: "https://www.nummerplade.net/",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

export function nummerpladeApiKey(): string {
  return process.env.NUMMERPLADE_API_KEY?.trim() ?? "";
}

type TimelineRow = { date: string; odometer: string; country: string; event: string };

function equipmentList(rec: Record<string, unknown>): string[] {
  return asArray(rec.udstyr).map((x) => String(x).trim()).filter(Boolean);
}

function extraSynMileage(rec: Record<string, unknown>): {
  mileage: VinSourceMileageRow[];
  timeline: TimelineRow[];
} {
  const mileage: VinSourceMileageRow[] = [];
  const timeline: TimelineRow[] = [];
  const bags = [...asArray(rec.synsrapporter), ...asArray(rec.syn), ...asArray(rec.kilometerstand)];
  for (const item of bags) {
    const row = asRecord(item);
    const date = isoDay(pickStr(row, ["synsdato", "dato", "date", "km_dato"]));
    const km = pickNum(row, ["kmstand", "km", "kilometerstand", "odometer"]);
    const kmStr = km != null && km >= 100 ? String(km) : "";
    if (date && kmStr) {
      mileage.push({ date, odometer: kmStr, country: DK_COUNTRY_LV, origin: "nummerplade.net" });
    }
    const result = translateTermLv(pickStr(row, ["synsresultat", "resultat"]), "da");
    const kind = translateTermLv(pickStr(row, ["kategori", "synstype"]), "da");
    if (date && (result || kind)) {
      timeline.push({
        date,
        odometer: kmStr,
        country: DK_COUNTRY_LV,
        event: [kind || "Tehniskā apskate", result].filter(Boolean).join(": "),
      });
    }
  }
  return { mileage, timeline };
}

export function mapNummerpladePayload(payload: unknown): Omit<VinSourceFetchResult, "source" | "vin" | "fetchedAt"> {
  const root = asRecord(payload);
  const rec = Object.keys(asRecord(root.koeretoej)).length > 0 ? asRecord(root.koeretoej) : root;

  const firstReg = isoDay(pickStr(rec, ["foerste_registrering", "1_registrering"]));
  const status = translateTermLv(pickStr(rec, ["status"]), "da") || pickStr(rec, ["status"]);
  const statusWord = pickStr(rec, ["registrering_status_ord"]);
  const statusDate = isoDay(pickStr(rec, ["omregistreret", "status_dato"]));
  const omreg = isoDay(rec.omregistreret);
  const plate = pickStr(rec, ["nummerplade", "regNr"]);
  const make = pickStr(rec, ["maerke", "make"]);
  const model = pickStr(rec, ["model"]);
  const ownerCount =
    num(rec.antalEjere) ??
    num(rec.antal_ejere) ??
    num(asRecord(rec.ejere).antal) ??
    pickNum(rec, ["previousOwners", "tidligereEjere"]);

  const extra = extraSynMileage(rec);
  const timeline: TimelineRow[] = [...extra.timeline];
  if (firstReg) timeline.push({ date: firstReg, odometer: "", country: "", event: "Pirmā reģistrācija" });
  if (omreg && omreg !== firstReg) {
    const event = status ? `Reģistrācijas statuss: ${status}` : "Reģistrācijas izmaiņa";
    timeline.push({ date: omreg, odometer: "", country: DK_COUNTRY_LV, event });
  }

  const ownersLines: string[] = [];
  if (ownerCount != null && ownerCount > 0) {
    const prev = Math.max(0, ownerCount - 1);
    ownersLines.push(
      ownerCount === 1
        ? "1 īpašnieks (nummerplade.net)."
        : `${ownerCount} īpašnieki (nummerplade.net)${prev > 0 ? `, ${prev} iepriekšējie` : ""}.`,
    );
  }
  if (firstReg) ownersLines.push(`Pirmā reģistrācija: ${formatRegistryDateLv(firstReg)}`);
  if (status) {
    ownersLines.push(`Reģistrācijas statuss: ${status}${statusDate ? ` (${formatRegistryDateLv(statusDate)})` : ""}`);
  }
  if (statusWord && translateTermLv(statusWord, "da") !== status) {
    ownersLines.push(`Reģistra formulējums: ${translateTermLv(statusWord, "da")}`);
  }

  const statusLines: string[] = [];
  const use = pickStr(rec, ["anvendelse"]);
  if (use) statusLines.push(`Izmantošanas veids: ${translateTermLv(use, "da")}`);
  const fuel = pickStr(rec, ["drivmiddel"]);
  const power = pickStr(rec, ["effekt"]);
  const euro = pickStr(rec, ["euronorm"]);
  const dpf = pickStr(rec, ["partikelfilter"]);
  if (fuel) statusLines.push(`Degviela: ${translateTermLv(fuel, "da")}`);
  if (power) statusLines.push(`Jauda / piedziņa: ${power}`);
  if (euro) statusLines.push(`Euronorma: ${euro}`);
  if (dpf && /ja|yes|1/i.test(dpf)) statusLines.push("DPF: ir");
  const eq = equipmentList(rec);
  if (eq.some((x) => /automatgear|automat gear/i.test(x))) {
    statusLines.push("Ātrumkārba (nummerplade.net): automāts — nav CVT/trinløst.");
  }

  const notes: string[] = [
    "nummerplade.net Gratis Cache: tehnika un OCTA. Apskašu km paliek no tjekbil.dk / Færdselsstyrelsen.",
  ];
  if (eq.some((x) => /automatgear/i.test(x))) {
    notes.push("nummerplade.net uzrāda Automatgear; DMR „trinløst gear” šim auto nav jāņem par CVT.");
  }

  const incidents: VinSourceIncidentRow[] = [];
  const found = Boolean(make || model || plate || firstReg || extra.mileage.length);

  return {
    found,
    message: found
      ? `nummerplade.net: ${[make, model].filter(Boolean).join(" ") || "transportlīdzeklis"}${plate ? ` · ${plate}` : ""}`
      : "nummerplade.net neatgrieza atpazīstamus datus",
    mileage: extra.mileage.sort((a, b) => b.date.localeCompare(a.date)),
    incidents,
    timeline: timeline.sort((a, b) => b.date.localeCompare(a.date)),
    ownersSummary: ownersLines.join("\n"),
    statusRecords: statusLines.join("\n"),
    notes,
    raw: "",
  };
}

async function getJson(url: string, key: string): Promise<{ status: number; data: Record<string, unknown> | null }> {
  const res = await fetch(url, {
    headers: { ...HEADERS_BASE, "X-Api-Noegle": key },
    cache: "no-store",
  });
  const text = await res.text();
  if (!text.trim()) return { status: res.status, data: null };
  try {
    return { status: res.status, data: JSON.parse(text) as Record<string, unknown> };
  } catch {
    return { status: res.status, data: null };
  }
}

function lookupUrls(vin: string, plate: string): string[] {
  const urls = [`${BASE}/koeretoej/${encodeURIComponent(vin)}`];
  const cleanPlate = plate.replace(/\s+/g, "").toUpperCase();
  if (cleanPlate && cleanPlate !== vin.toUpperCase()) {
    urls.push(`${BASE}/koeretoej/${encodeURIComponent(cleanPlate)}`);
  }
  return urls;
}

export async function fetchNummerplade(vin: string, plate = ""): Promise<VinSourceFetchResult | null> {
  const key = nummerpladeApiKey();
  if (!key) return null;

  let lastStatus = 0;
  let lastFejl = "";
  for (const url of lookupUrls(vin, plate)) {
    const res = await getJson(url, key);
    lastStatus = res.status;
    const data = res.data;
    if (!data) continue;
    if (data.ok === false) {
      lastFejl = String(data.fejl ?? "").trim();
      continue;
    }
    const mapped = mapNummerpladePayload(data);
    if (!mapped.found) continue;
    return {
      source: "tjekbil",
      vin,
      fetchedAt: new Date().toISOString(),
      ...mapped,
      raw: JSON.stringify(data, null, 2),
    };
  }

  const quota = lastStatus === 429 ? " (dienas limits 100 opslag)" : "";
  return emptyVinSourceResult(
    "tjekbil",
    vin,
    lastStatus === 401 || lastStatus === 403
      ? "nummerplade.net API atslēga nav derīga"
      : lastFejl
        ? `nummerplade.net: ${lastFejl}`
        : lastStatus === 404
          ? "nummerplade.net šo VIN/numuru neatpazina"
          : `nummerplade.net atbildēja ar HTTP ${lastStatus || "kļūdu"}${quota}`,
  );
}
