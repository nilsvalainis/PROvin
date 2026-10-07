import "server-only";

/**
 * eteenindus.mnt.ee caur PROVIN releju (Hetzner, īsts Chrome zem Xvfb).
 *
 * No Vercel mnt.ee reCAPTCHA v3 nepāriet (CapSolver / 2Captcha žetoni tiek noraidīti, AJAX dod 403).
 * Relejs atver lapu īstā pārlūkā, ļauj lapas paša grecaptcha.execute izpildīties, iesniedz VIN un
 * nolasa detaļu lapu `soidukDetailvaadeAvalik.jsf` (veiksmīgs meklējums ir JSF <redirect>, nevis
 * formas partial update). Env: MNT_RELAY_URL (pilns /mnt/lookup URL) + MNT_RELAY_TOKEN (Bearer).
 */

import { formatRegistryDateLv } from "@/lib/vin-registry-client-text";
import { parseMntExtract } from "@/lib/vin-sources/estonia-parse";
import { translateTermLv, translateTextLv } from "@/lib/vin-sources/translate-lv";
import {
  emptyVinSourceResult,
  type VinSourceFetchResult,
  type VinSourceMileageRow,
} from "@/lib/vin-sources/types";

/** Relejs: 90 s pārlūka budžets + 10 s tīklam. */
export const MNT_RELAY_TIMEOUT_MS = 100_000;
const COUNTRY_LV = "Igaunija";

export type MntRelayStatus = "found" | "not_found" | "captcha_rejected" | "blocked" | "error" | "unknown";

type Pair = { label: string; value: string };
type Table = { headers: string[]; rows: string[][] };

export type MntRelayResponse = {
  ok: boolean;
  vin: string;
  status?: MntRelayStatus;
  error?: string;
  tried?: string[];
  cached?: boolean;
  elapsedMs?: number;
  data: null | {
    found: boolean;
    message?: string;
    summary?: Record<string, unknown>;
    header?: { regMark: string; makeModel: string; vin: string };
    pairs?: Pair[];
    inspections?: Record<string, string>[];
    operations?: { date: string; action: string }[];
    mileage?: { date: string; odometerKm: number }[];
    tables?: Table[];
    page?: { text: string; tables: Table[]; pairs: Pair[] } | null;
    sourceUrl?: string;
  };
};

export function isMntRelayConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.MNT_RELAY_URL?.trim() && env.MNT_RELAY_TOKEN?.trim());
}

function isoFromEt(v: string | undefined): string {
  const raw = (v ?? "").trim();
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(raw);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return "";
}

function inspectionVerdict(raw: string): string {
  return raw.replace(/^(OK|FAIL|WARN)\s*-\s*/i, "").trim();
}

/** Releja JSON → kopīgais VinSourceFetchResult (tas pats formāts, ko dod parseMntExtract). */
export function mntRelayToResult(vin: string, body: MntRelayResponse): VinSourceFetchResult {
  const d = body.data;
  if (!d || !d.found) return emptyVinSourceResult("mnt_ee", vin, "VIN nav Igaunijas transportlīdzekļu reģistrā");

  const page = d.page ?? { text: "", tables: d.tables ?? [], pairs: d.pairs ?? [] };
  const base = parseMntExtract(vin, page);

  const mileage: VinSourceMileageRow[] = (d.mileage ?? [])
    .filter((m) => m.date && Number.isFinite(m.odometerKm))
    .map((m) => ({
      date: isoFromEt(m.date) || m.date,
      odometer: String(m.odometerKm),
      country: COUNTRY_LV,
      origin: "Transpordiamet (tehniskā apskate)",
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const timeline: VinSourceFetchResult["timeline"] = [];
  for (const op of d.operations ?? []) {
    const date = isoFromEt(op.date);
    if (date) timeline.push({ date, odometer: "", country: COUNTRY_LV, event: translateTextLv(op.action, "et") });
  }
  for (const insp of d.inspections ?? []) {
    const date = isoFromEt(insp["Tegemise kuupäev"]);
    if (!date) continue;
    const km = mileage.find((m) => m.date === date)?.odometer ?? "";
    const verdict = inspectionVerdict(insp["Ülevaatuse otsus"] ?? "");
    const station = insp["Ülevaatuspunkt"] ?? "";
    timeline.push({
      date,
      odometer: km,
      country: COUNTRY_LV,
      event: `Tehniskā apskate${insp["Liik"] ? ` (${translateTermLv(insp["Liik"], "et")})` : ""}: ${translateTextLv(verdict, "et") || "-"}${station ? `, ${station}` : ""}`,
    });
  }
  timeline.sort((a, b) => b.date.localeCompare(a.date));

  const notes = [...base.notes];
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
  const dereg = (d.operations ?? []).find((o) => /kustutamine|registrist kustutatud/i.test(o.action));
  if (dereg) notes.push(`Igaunijas reģistrā: ${translateTextLv(dereg.action, "et")} (${dereg.date}).`);
  const failedInsp = (d.inspections ?? []).filter((i) => /^(FAIL|WARN)/i.test(i["Ülevaatuse otsus"] ?? ""));
  if (failedInsp.length) {
    notes.push(`Tehniskās apskates ar trūkumiem: ${failedInsp.map((i) => i["Tegemise kuupäev"]).join(", ")}.`);
  }

  const lastInsp = d.inspections?.[0];
  const lastInspLine = lastInsp
    ? `Pēdējā tehniskā apskate: ${lastInsp["Tegemise kuupäev"] ?? "-"} (${translateTextLv(inspectionVerdict(lastInsp["Ülevaatuse otsus"] ?? ""), "et") || "-"}), derīga līdz ${lastInsp["Kehtib Kuni"] ?? "-"}`
    : "";
  const statusRecords = [base.statusRecords, lastInspLine].filter(Boolean).join("\n");

  const head = d.header;
  const headerLine = head ? [head.regMark, head.makeModel].filter(Boolean).join(" - ") : "";
  const ownersSummary = [
    headerLine && `Igaunijas reģ. nr. / modelis: ${headerLine}`,
    ...(d.pairs ?? [])
      .filter((p) => /registreerimi/i.test(p.label))
      .map((p) => `${translateTermLv(p.label, "et")}: ${translateTextLv(p.value, "et")}`),
  ]
    .filter(Boolean)
    .join("\n");

  return {
    ...base,
    source: "mnt_ee",
    vin,
    found: true,
    message: `Atrasts Igaunijas reģistrā (${mileage.length} nobraukuma ieraksti${body.cached ? ", no releja keša" : ""})`,
    mileage,
    timeline,
    ownersSummary: ownersSummary || base.ownersSummary,
    statusRecords,
    notes: [...new Set(notes)],
    raw: (page.text || base.raw).slice(0, 60_000),
    fetchedAt: new Date().toISOString(),
  };
}

export type MntRelayOutcome =
  | { kind: "result"; result: VinSourceFetchResult }
  | { kind: "unavailable"; reason: string };

function relayReason(status: number, body: MntRelayResponse | null): string {
  if (status === 401 || status === 403) return "mnt.ee relejs noraidīja tokenu";
  if (status === 503) return "mnt.ee relejs ir aizņemts, mēģini vēlreiz";
  if (status === 400) return "Nederīgs VIN vai reģistrācijas numurs (mnt.ee relejs)";
  const why = body?.status
    ? `${body.status}${body.error ? `: ${body.error}` : ""}`
    : body?.error
      ? body.error
      : `HTTP ${status}`;
  return `mnt.ee relejs: ${why}`.slice(0, 240);
}

/**
 * Atgriež `result` tikai droši klasificētam atbildes veidam (found / not_found / 400).
 * 401/403/502/503, timeout un nav env - `unavailable` (fetchMnt tad neiedarbina 240 s CapSolver ķēdi).
 */
export async function fetchMntRelay(
  vin: string,
  regMark = "",
  opts: { env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
): Promise<MntRelayOutcome> {
  const env = opts.env ?? process.env;
  const url = env.MNT_RELAY_URL?.trim() ?? "";
  const token = env.MNT_RELAY_TOKEN?.trim() ?? "";
  if (!url || !token) return { kind: "unavailable", reason: "mnt.ee relejs nav konfigurēts" };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? MNT_RELAY_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ vin, regMark: regMark || undefined }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    let body: MntRelayResponse | null = null;
    try {
      body = (await res.json()) as MntRelayResponse;
    } catch {
      body = null;
    }
    if (body?.ok && (body.status === "found" || body.status === "not_found")) {
      return { kind: "result", result: mntRelayToResult(vin, body) };
    }
    if (res.status === 400) {
      return { kind: "result", result: emptyVinSourceResult("mnt_ee", vin, relayReason(400, body)) };
    }
    if (!body) return { kind: "unavailable", reason: relayReason(res.status, null) };
    console.warn("[mnt.ee relay]", relayReason(res.status, body), body.tried);
    return { kind: "unavailable", reason: relayReason(res.status, body) };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { kind: "unavailable", reason: aborted ? "mnt.ee relejs noildza" : "Neizdevās sasniegt mnt.ee releju" };
  } finally {
    clearTimeout(timer);
  }
}
