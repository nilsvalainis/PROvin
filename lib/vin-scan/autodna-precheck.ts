/**
 * AutoDNA bezmaksas priekšskatījums (publiskā lapa https://www.autodna.lv/vin/<VIN>).
 * Bez pirkuma lapa rāda «Lieliski! Atrasti N ieraksti» un «Kas ir atrodams atskaitē?» sadaļas
 * ar statusu un ierakstu skaitu. AutoDNA API/pirkums te NETIEK aiztikts - tikai publiskās lapas HTML.
 *
 * Ja VIN AutoDNA vēl nav pārbaudīts, lapa rāda «Meklē pieejamo informāciju...» ar Cloudflare
 * Turnstile. Tad: vai nu operators atver saiti pārlūkā (AutoDNA sagatavo priekšskatījumu,
 * nākamā ielase to jau nolasa), vai (tikai ar `AUTODNA_PRECHECK_TURNSTILE=1`) CapSolver Turnstile.
 *
 * Šis fails ir tīra loģika (bez tīkla): parseris, detail formāts un ielases plūsma ar atkarībām.
 */
import type { VinScanParse } from "@/lib/vin-scan/types";

export const AUTODNA_PRECHECK_ORIGIN = "https://www.autodna.lv";

export function autodnaPrecheckUrl(vin: string): string {
  return `${AUTODNA_PRECHECK_ORIGIN}/vin/${encodeURIComponent(vin.trim().toUpperCase())}`;
}

export type AutodnaPrecheckSection = {
  name: string;
  available: boolean;
  /** Ierakstu skaits; null, ja lapa skaitu nerāda (piem. «VIN koda pārbaude: Pieejams.»). */
  count: number | null;
  /** «14/14 ieraksti» → of = 14. */
  of?: number;
};

export type AutodnaPrecheck = {
  total: number;
  vehicle: string;
  sections: AutodnaPrecheckSection[];
};

export type AutodnaPrecheckPage =
  | { state: "ready"; data: AutodnaPrecheck }
  | { state: "pending"; siteKey: string }
  | { state: "unknown" };

/** Sadaļas, ko Nils grib redzēt izceltas (23.11). */
export const AUTODNA_KEY_SECTIONS = ["Transportlīdzekļa vēsture", "Auto arhīva fotogrāfijas"] as const;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " ", "#x27": "'" };

function cleanText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39|nbsp|#x27);/g, (_, k: string) => ENTITIES[k] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCount(text: string): { count: number | null; of?: number } {
  const m = /(\d+)\s*(?:\/\s*(\d+))?\s*ierakst/i.exec(text) ?? /(\d+)\s*(?:\/\s*(\d+))?/.exec(text);
  if (!m) return { count: null };
  const count = Number(m[1]);
  const of = m[2] ? Number(m[2]) : undefined;
  return of != null ? { count, of } : { count };
}

export function parseAutodnaPrecheckHtml(html: string): AutodnaPrecheckPage {
  const raw = String(html ?? "");
  const sections: AutodnaPrecheckSection[] = [];
  const seen = new Set<string>();
  const re =
    /class="(row-active|row-inactive)[^"]*"[^>]*>(?:(?!class="row-(?:active|inactive))[\s\S]){0,600}?class="td-1"[^>]*>([\s\S]*?)<\/div>\s*<div class="td-3"[^>]*>([\s\S]*?)<\/div>/g;
  for (const m of raw.matchAll(re)) {
    const name = cleanText(m[2] ?? "");
    if (!name || name.length > 80 || seen.has(name)) continue;
    seen.add(name);
    const status = cleanText(m[3] ?? "");
    const available = m[1] === "row-active" && !/^nav pieejams/i.test(status);
    sections.push({ name, available, ...parseCount(status) });
  }
  const totalM = /Atrasti\s*<span[^>]*class="[^"]*blue-count[^"]*"[^>]*>\s*(\d+)/i.exec(raw) ?? /Atrasti\s+(\d+)\s+ierakst/i.exec(cleanText(raw));
  if (sections.length || totalM) {
    const total = totalM ? Number(totalM[1]) : sections.reduce((n, s) => n + (s.available && s.count ? s.count : 0), 0);
    const vehM = /class="make-logo"[\s\S]{0,200}?<strong>([\s\S]*?)<\/strong>/i.exec(raw);
    return { state: "ready", data: { total, vehicle: vehM ? cleanText(vehM[1] ?? "").slice(0, 80) : "", sections } };
  }
  if (/precheck-loading|get_precheck_progress|precheck_captcha_callback/i.test(raw)) {
    const key = /data-visible="([^"]+)"/i.exec(raw)?.[1] ?? /sitekey["']?\s*[:=]\s*["']([0-9a-zA-Z_-]{10,})["']/i.exec(raw)?.[1] ?? "";
    return { state: "pending", siteKey: key };
  }
  return { state: "unknown" };
}

/* ---------------- detail formāts (saglabājas VIN SCAN rindā) ---------------- */

function sectionLine(s: AutodnaPrecheckSection): string {
  const count = s.count == null ? "" : ` · ${s.count}${s.of != null ? `/${s.of}` : ""}`;
  return `${s.name}: ${s.available ? "ir" : "nav"}${count}`;
}

export function formatAutodnaPrecheckDetail(data: AutodnaPrecheck): string {
  return [`Kopā: ${data.total}`, ...(data.vehicle ? [`Auto: ${data.vehicle}`] : []), ...data.sections.map(sectionLine)].join("\n");
}

/** Pretējais `formatAutodnaPrecheckDetail` - banerim no VIN SCAN rindas. */
export function parseAutodnaPrecheckDetail(detail: string | undefined): AutodnaPrecheck | null {
  const lines = String(detail ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  let total: number | null = null;
  let vehicle = "";
  const sections: AutodnaPrecheckSection[] = [];
  for (const line of lines) {
    const t = /^Kopā: (\d+)$/.exec(line);
    if (t) {
      total = Number(t[1]);
      continue;
    }
    const v = /^Auto: (.+)$/.exec(line);
    if (v) {
      vehicle = v[1]!;
      continue;
    }
    const s = /^(.+?): (ir|nav)(?: · (\d+)(?:\/(\d+))?)?$/.exec(line);
    if (!s) continue;
    sections.push({
      name: s[1]!,
      available: s[2] === "ir",
      count: s[3] != null ? Number(s[3]) : null,
      ...(s[4] != null ? { of: Number(s[4]) } : {}),
    });
  }
  if (total == null && !sections.length) return null;
  return { total: total ?? 0, vehicle, sections };
}

export function autodnaSectionCount(data: AutodnaPrecheck | null, name: string): number | null {
  const s = data?.sections.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!s) return null;
  return s.available ? (s.count ?? 0) : 0;
}

export function autodnaPrecheckParse(data: AutodnaPrecheck, openUrl: string): VinScanParse {
  const history = autodnaSectionCount(data, AUTODNA_KEY_SECTIONS[0]);
  const photos = autodnaSectionCount(data, AUTODNA_KEY_SECTIONS[1]);
  const bits = [
    `${data.total} ieraksti`,
    history != null ? `vēsture ${history}` : "",
    photos != null ? `arhīva foto ${photos}` : "",
  ].filter(Boolean);
  const has = data.total > 0 || data.sections.some((s) => s.available && (s.count ?? 0) > 0);
  return {
    status: has ? "found" : "none",
    summary: has ? `AutoDNA priekšskatījums: ${bits.join(" · ")}` : "AutoDNA priekšskatījumā ierakstu nav",
    detail: formatAutodnaPrecheckDetail(data),
    openUrl,
  };
}

/* ---------------- ielases plūsma (atkarības no ārpuses) ---------------- */

export type AutodnaHttp = { status: number; text: string; cookie?: string };

export type AutodnaPrecheckDeps = {
  get: (url: string, opts: { cookie: string; xhr?: boolean }) => Promise<AutodnaHttp>;
  /** null - Turnstile risināšana izslēgta (noklusējums bez `AUTODNA_PRECHECK_TURNSTILE=1`). */
  solveTurnstile: ((siteKey: string, websiteURL: string) => Promise<{ ok: true; token: string } | { ok: false; reason: string }>) | null;
  isChallenge: (page: AutodnaHttp) => boolean;
  mergeCookie: (a: string, b: string) => string;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  /** Cik ilgi gaidīt AutoDNA priekšskatījuma sagatavošanu pēc Turnstile. */
  pollMs?: number;
  pollEveryMs?: number;
};

export const AUTODNA_PENDING_SUMMARY = "AutoDNA: priekšskatījums vēl nav sagatavots - atver AutoDNA saiti, tad atkārto";

export async function readAutodnaPrecheck(vin: string, deps: AutodnaPrecheckDeps): Promise<VinScanParse> {
  const url = autodnaPrecheckUrl(vin);
  const first = await deps.get(url, { cookie: "" });
  if (deps.isChallenge(first)) return { status: "blocked", summary: "AutoDNA: Cloudflare bloķē serveri", openUrl: url };
  if (first.status >= 400) return { status: "unknown", summary: `AutoDNA: HTTP ${first.status}`, openUrl: url };
  const page = parseAutodnaPrecheckHtml(first.text);
  if (page.state === "ready") return autodnaPrecheckParse(page.data, url);
  if (page.state === "unknown") return { status: "unknown", summary: "AutoDNA: lapu neizdevās nolasīt", openUrl: url };
  if (!deps.solveTurnstile || !page.siteKey) return { status: "unknown", summary: AUTODNA_PENDING_SUMMARY, openUrl: url };

  let cookie = first.cookie ?? "";
  const solved = await deps.solveTurnstile(page.siteKey, url);
  if (!solved.ok) return { status: "unknown", summary: `AutoDNA: Turnstile neizdevās (${solved.reason})`, openUrl: url };
  const started = await deps.get(`${url}?cf-turnstile-response=${encodeURIComponent(solved.token)}`, { cookie });
  cookie = deps.mergeCookie(cookie, started.cookie ?? "");
  if (started.status === 400) return { status: "unknown", summary: "AutoDNA: Turnstile žetons nav pieņemts", openUrl: url };

  const until = deps.now() + (deps.pollMs ?? 36_000);
  const progressUrl = `${AUTODNA_PRECHECK_ORIGIN}/ajax/get_precheck_progress?${new URLSearchParams({
    vin: vin.trim().toUpperCase(),
    registration_number: "",
    registration_number_country_code: "",
  }).toString()}`;
  let completed = false;
  while (deps.now() < until) {
    await deps.sleep(deps.pollEveryMs ?? 3_000);
    const res = await deps.get(`${progressUrl}&time=${deps.now()}`, { cookie, xhr: true });
    cookie = deps.mergeCookie(cookie, res.cookie ?? "");
    try {
      const j = JSON.parse(res.text) as { count_completed?: unknown };
      if (Number(j.count_completed) > 0) {
        completed = true;
        break;
      }
    } catch {
      /* turpinām gaidīt */
    }
  }
  if (!completed) return { status: "unknown", summary: AUTODNA_PENDING_SUMMARY, openUrl: url };
  const again = await deps.get(url, { cookie });
  const ready = parseAutodnaPrecheckHtml(again.text);
  if (ready.state === "ready") return autodnaPrecheckParse(ready.data, url);
  return { status: "unknown", summary: AUTODNA_PENDING_SUMMARY, openUrl: url };
}
