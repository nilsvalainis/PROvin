/**
 * tjekbil.dk — Dānijas Motorregister (DMR), Færdselsstyrelsen apskates,
 * Motorstyrelsen odometra ieraksti, Bilbogen ķīlas, meklēto TL saraksts.
 * Publisks JSON bez autorizācijas un bez captcha — browsers nav vajadzīgs.
 */
import { formatRegistryDateLv } from "@/lib/vin-registry-client-text";
import { emptyVinSourceResult, type VinSourceFetchResult, type VinSourceIncidentRow, type VinSourceMileageRow } from "@/lib/vin-sources/types";
import { detectSpecialUseLabels, translateTermLv, translateTextLv } from "@/lib/vin-sources/translate-lv";

const BASE = "https://www.tjekbil.dk/api/v3";
const COUNTRY_LV = "Dānija";

const HEADERS: Record<string, string> = {
  accept: "application/json",
  "accept-language": "da-DK,da;q=0.9,en;q=0.8",
  referer: "https://www.tjekbil.dk/",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

const MILEAGE_ORIGIN_LV: Record<number, string> = {
  10: "Færdselsstyrelsen (tehniskā apskate)",
  20: "Motorstyrelsen (nodokļu reģistrs)",
  30: "Pirmā reģistrācija",
};

type DmrResponse = {
  basic?: Record<string, unknown>;
  extended?: {
    carId?: unknown;
    general?: Record<string, unknown>;
    insurance?: { selskab?: unknown; status?: unknown; oprettet?: unknown; historik?: unknown };
  };
  inspectionData?: { rapporter?: unknown };
  debtData?: { laaneDokumenter?: unknown; konkurs?: unknown };
};

type MileageLog = { mileage?: unknown; mileageAt?: unknown; origin?: unknown; isHidden?: unknown };

type InspectionReport = {
  synsdato?: unknown;
  synstype?: unknown;
  kategori?: unknown;
  synsresultat?: unknown;
  kmstand?: unknown;
  firma?: unknown;
  fejl?: unknown;
};

const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** DMR datumi ir ISO bez laika joslas — atgriežam kalendāra datumu bez nobīdes. */
function isoDay(value: unknown): string {
  const s = str(value).trim();
  if (!s) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const dk = /^(\d{2})[-.](\d{2})[-.](\d{4})$/.exec(s);
  if (dk) return `${dk[3]}-${dk[2]}-${dk[1]}`;
  return s;
}

async function getJson<T>(url: string): Promise<{ status: number; data: T | null }> {
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) return { status: res.status, data: null };
  const text = await res.text();
  if (!text.trim()) return { status: res.status, data: null };
  try {
    return { status: res.status, data: JSON.parse(text) as T };
  } catch {
    return { status: res.status, data: null };
  }
}

function buildOwnersSummary(dmr: DmrResponse): string {
  const basic = dmr.basic ?? {};
  const insurance = dmr.extended?.insurance;
  const history = Array.isArray(insurance?.historik) ? (insurance?.historik as Record<string, unknown>[]) : [];

  const lines: string[] = [];
  const firstReg = isoDay(basic.foersteRegistreringDato);
  if (firstReg) lines.push(`Pirmā reģistrācija: ${formatRegistryDateLv(firstReg)}`);

  const statusDate = isoDay(basic.statusDato);
  const status = translateTermLv(str(basic.status), "da");
  if (status) {
    lines.push(`Reģistrācijas statuss: ${status}${statusDate ? ` (${formatRegistryDateLv(statusDate)})` : ""}`);
  }

  // DMR publiskajos datos īpašnieku vārdu nav; polišu maiņas ir tuvākā pieejamā aizvietotājvērtība
  const policyDates = [...new Set(history.map((h) => isoDay(h.oprettet)).filter(Boolean))];
  if (policyDates.length > 0) {
    const owners = policyDates.length;
    lines.push(`${owners} īpašnieki (pēc OCTA polišu maiņām)`);
    for (const h of history) {
      const when = formatRegistryDateLv(isoDay(h.oprettet));
      const parts = [when, str(h.selskab), translateTermLv(str(h.status), "da")].filter(Boolean);
      if (parts.length) lines.push(parts.join(", "));
    }
  }

  const currentInsurer = str(insurance?.selskab);
  if (currentInsurer) {
    lines.push(`Pašreizējā apdrošināšana: ${currentInsurer} (${translateTermLv(str(insurance?.status), "da")})`);
  }
  return lines.join("\n");
}

function buildStatusRecords(dmr: DmrResponse): { text: string; specialUse: string[] } {
  const basic = dmr.basic ?? {};
  const general = dmr.extended?.general ?? {};
  const lines: string[] = [];

  const use = str(basic.koeretoejAnvendelseNavn) || str(general.koeretoejAnvendelse);
  if (use) lines.push(`Izmantošanas veids: ${translateTermLv(use, "da")}`);

  const secondary = str(general.sekundaerStatus);
  if (secondary) lines.push(`Sekundārais statuss: ${translateTermLv(secondary, "da")}`);

  if (basic.bilLeaset === true) {
    const from = isoDay(basic.leasingGyldigFra);
    const to = isoDay(basic.leasingGyldigTil);
    const span = [from, to].filter(Boolean).map(formatRegistryDateLv).join(" - ");
    lines.push(`Līzings: aktīvs${span ? ` (${span})` : ""}`);
  }
  if (general.blockedStatus === true) lines.push("Reģistrā bloķēts");

  const importCondition = str(general.standEfterImport);
  if (importCondition) lines.push(`Stāvoklis pēc importa: ${translateTextLv(importCondition, "da")}`);

  const permissions = Array.isArray(basic.permissions) ? (basic.permissions as Record<string, unknown>[]) : [];
  for (const p of permissions) {
    const parts = [str(p.typeNavn), str(p.kommentar), isoDay(p.datoGyldigFra)].filter(Boolean);
    if (parts.length) lines.push(`Atļauja: ${parts.join(" · ")}`);
  }

  const specialUse = detectSpecialUseLabels([use, secondary, ...permissions.map((p) => str(p.typeNavn))].join(" "));
  if (specialUse.length > 0) lines.push(`Īpašie statusi: ${specialUse.join(", ")}`);

  return { text: lines.join("\n"), specialUse };
}

function buildMileage(logs: MileageLog[], inspections: InspectionReport[]): VinSourceMileageRow[] {
  const rows: VinSourceMileageRow[] = [];
  for (const log of logs) {
    if (log.isHidden === true) continue;
    const km = num(log.mileage);
    const date = isoDay(log.mileageAt);
    if (km == null || !date) continue;
    rows.push({
      date,
      odometer: String(km),
      country: COUNTRY_LV,
      origin: MILEAGE_ORIGIN_LV[num(log.origin) ?? -1] ?? "DMR",
    });
  }
  for (const r of inspections) {
    const km = num(r.kmstand);
    const date = isoDay(r.synsdato);
    if (km == null || !date) continue;
    rows.push({
      date,
      odometer: String(km),
      country: COUNTRY_LV,
      origin: `Apskate — ${translateTermLv(str(r.synsresultat), "da")}`,
    });
  }

  // Viens rādījums bieži nāk no diviem reģistriem ar dažu dienu nobīdi
  const merged: VinSourceMileageRow[] = [];
  for (const row of rows.sort((a, b) => a.date.localeCompare(b.date))) {
    const dup = merged.find(
      (m) =>
        m.odometer === row.odometer &&
        Math.abs(new Date(m.date).getTime() - new Date(row.date).getTime()) <= 3 * 24 * 3600 * 1000,
    );
    if (dup) {
      if (row.origin && !dup.origin?.includes(row.origin)) dup.origin = [dup.origin, row.origin].filter(Boolean).join("; ");
      continue;
    }
    merged.push({ ...row });
  }
  return merged.sort((a, b) => b.date.localeCompare(a.date));
}

function buildIncidents(dmr: DmrResponse, inspections: InspectionReport[]): VinSourceIncidentRow[] {
  const rows: VinSourceIncidentRow[] = [];

  // DMR publiskajos datos negadījumu reģistra nav; tuvākie fakti ir neizturētas apskates ar bojājumiem
  for (const r of inspections) {
    const result = str(r.synsresultat);
    if (!result || /godkendt$/i.test(result.trim())) continue;
    const faults = Array.isArray(r.fejl) ? (r.fejl as Record<string, unknown>[]) : [];
    const faultText = faults
      .map((f) => [str(f.title), str(f.description)].filter(Boolean).join(": "))
      .filter(Boolean)
      .join(" | ");
    rows.push({
      date: isoDay(r.synsdato),
      amount: "",
      country: COUNTRY_LV,
      note: `Apskate nav izturēta (${translateTermLv(result, "da")})${faultText ? ` — ${translateTextLv(faultText, "da")}` : ""}`,
    });
  }

  const debts = Array.isArray(dmr.debtData?.laaneDokumenter)
    ? (dmr.debtData?.laaneDokumenter as Record<string, unknown>[])
    : [];
  for (const d of debts) {
    rows.push({
      date: isoDay(d.dato ?? d.date),
      amount: str(d.beloeb ?? d.amount),
      country: COUNTRY_LV,
      note: `Ķīla / parāds (Bilbogen)${str(d.kreditor ?? d.creditor) ? ` — ${str(d.kreditor ?? d.creditor)}` : ""}`,
    });
  }
  return rows;
}

function buildNotes(
  mileage: VinSourceMileageRow[],
  dmr: DmrResponse,
  inspections: InspectionReport[],
  wanted: unknown[],
  specialUse: string[],
): string[] {
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

  if (asc.length >= 2) {
    const first = asc[0]!;
    const last = asc[asc.length - 1]!;
    const years = (new Date(last.date).getTime() - new Date(first.date).getTime()) / (365.25 * 24 * 3600 * 1000);
    const delta = Number(last.odometer) - Number(first.odometer);
    if (years > 0.5) {
      const perYear = Math.round(delta / years);
      notes.push(`Vidējais nobraukums: ap ${perYear.toLocaleString("lv-LV")} km gadā.`);
      if (perYear > 40000) notes.push("Liels gada nobraukums, iespējama komerciāla izmantošana.");
    }
    const staleYears = (Date.now() - new Date(last.date).getTime()) / (365.25 * 24 * 3600 * 1000);
    if (staleYears > 1.5) {
      notes.push(`Jaunākais odometra ieraksts ir ${staleYears.toFixed(1)} gadus vecs.`);
    }
  }

  for (const label of specialUse) notes.push(`Īpašais statuss: ${label}.`);

  const failed = inspections.filter((r) => {
    const result = str(r.synsresultat);
    return result && !/godkendt$/i.test(result.trim());
  });
  if (failed.length > 0) notes.push(`Neizturētas apskates: ${failed.length}.`);

  const debtCount = Array.isArray(dmr.debtData?.laaneDokumenter) ? dmr.debtData.laaneDokumenter.length : 0;
  if (debtCount > 0) notes.push("Reģistrēta ķīla (Bilbogen).");
  if (dmr.debtData?.konkurs) notes.push("Maksātnespējas atzīme.");
  if (Array.isArray(wanted) && wanted.length > 0) notes.push("Ieraksts meklēto transportlīdzekļu vēsturē.");
  if (dmr.extended?.general?.blockedStatus === true) notes.push("Reģistrā bloķēts.");

  return notes;
}

function buildTimeline(
  dmr: DmrResponse,
  inspections: InspectionReport[],
): { date: string; odometer: string; country: string; event: string }[] {
  const basic = dmr.basic ?? {};
  const rows: { date: string; odometer: string; country: string; event: string }[] = [];
  const push = (date: string, event: string, odometer = "", country = COUNTRY_LV) => {
    if (!date || !event) return;
    rows.push({ date, odometer, country, event });
  };

  const firstReg = isoDay(basic.foersteRegistreringDato);
  if (firstReg) push(firstReg, "Pirmā reģistrācija", "", "");

  for (const r of inspections) {
    const date = isoDay(r.synsdato);
    const result = translateTermLv(str(r.synsresultat), "da") || str(r.synsresultat);
    const kind = translateTermLv(str(r.synstype), "da") || str(r.synstype) || "Apskate";
    const place = str(r.firma);
    const km = num(r.kmstand);
    const detail = [result, place].filter(Boolean).join(" · ");
    push(date, detail ? `Tehniskā apskate: ${detail}` : `Tehniskā apskate (${kind})`, km != null ? String(km) : "");
  }

  if (basic.bilLeaset === true || isoDay(basic.leasingGyldigFra)) {
    const from = isoDay(basic.leasingGyldigFra);
    const to = isoDay(basic.leasingGyldigTil);
    if (from) push(from, "Līzings sākas");
    if (to) push(to, "Līzings beidzas");
  }

  const insurance = dmr.extended?.insurance;
  const history = Array.isArray(insurance?.historik) ? (insurance?.historik as Record<string, unknown>[]) : [];
  for (const h of history) {
    const when = isoDay(h.oprettet);
    const company = str(h.selskab);
    const status = translateTermLv(str(h.status), "da") || str(h.status);
    const parts = [company, status].filter(Boolean).join(", ");
    if (when && parts) push(when, `Apdrošināšana: ${parts}`);
  }

  const statusDate = isoDay(basic.statusDato);
  const status = translateTermLv(str(basic.status), "da");
  if (statusDate && status) push(statusDate, `Reģistrācijas statuss: ${status}`);

  const seen = new Set<string>();
  const out: typeof rows = [];
  for (const row of rows.sort((a, b) => b.date.localeCompare(a.date))) {
    const key = `${row.date}|${row.event}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export async function fetchTjekbil(vin: string): Promise<VinSourceFetchResult> {
  const main = await getJson<DmrResponse>(`${BASE}/dmr/vin/${encodeURIComponent(vin)}`);
  if (!main.data) {
    return emptyVinSourceResult(
      "tjekbil",
      vin,
      main.status === 404 ? "VIN nav Dānijas transportlīdzekļu reģistrā (DMR)" : `tjekbil.dk atbildēja ar HTTP ${main.status}`,
    );
  }

  const dmr = main.data;
  const basic = dmr.basic ?? {};
  const carIdFallback = Number(str(dmr.extended?.carId));
  const kid =
    num(basic.koeretoejId) ??
    num(dmr.extended?.general?.kid) ??
    (Number.isFinite(carIdFallback) && carIdFallback > 0 ? carIdFallback : null);
  const inspections = Array.isArray(dmr.inspectionData?.rapporter)
    ? (dmr.inspectionData?.rapporter as InspectionReport[])
    : [];

  const [mileageRes, wantedRes] = await Promise.all([
    kid ? getJson<MileageLog[]>(`${BASE}/vehicles/mileagelogs?dmrId=${kid}`) : Promise.resolve({ status: 0, data: null }),
    kid
      ? getJson<unknown[]>(`${BASE}/wanted-vehicles/getwantedvehiclehistory?dmrId=${kid}`)
      : Promise.resolve({ status: 0, data: null }),
  ]);

  const mileage = buildMileage(mileageRes.data ?? [], inspections);
  const incidents = buildIncidents(dmr, inspections);
  const { text: statusRecords, specialUse } = buildStatusRecords(dmr);
  const notes = buildNotes(mileage, dmr, inspections, wantedRes.data ?? [], specialUse);

  const vehicle = [str(basic.maerkeTypeNavn), str(basic.modelTypeNavn), str(basic.variantTypeNavn)]
    .filter(Boolean)
    .join(" ");
  const regNr = str(basic.regNr);

  return {
    source: "tjekbil",
    vin,
    found: true,
    message: `Atrasts Dānijas reģistrā: ${vehicle || "transportlīdzeklis"}${regNr ? ` · ${regNr}` : ""}`,
    mileage,
    incidents,
    timeline: buildTimeline(dmr, inspections),
    ownersSummary: buildOwnersSummary(dmr),
    statusRecords,
    notes,
    raw: JSON.stringify({ dmr, mileagelogs: mileageRes.data, wanted: wantedRes.data }, null, 2),
    fetchedAt: new Date().toISOString(),
  };
}
