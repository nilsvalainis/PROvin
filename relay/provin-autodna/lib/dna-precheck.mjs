/**
 * AutoDNA bezmaksas priekšpārbaude (/vin/<VIN>) - pirkuma aizsargs relejā (Nila likums 25.11.2026, KATEGORISKS):
 * AutoDNA atskaiti drīkst pirkt TIKAI, ja priekšpārbaude rāda sadaļu «Auto arhīva fotogrāfijas» VAI
 * «Transportlīdzekļa vēsture» ar >0 ierakstiem. Ja neviena - nepērk. Ja priekšpārbaudi nevar nolasīt
 * (Turnstile «Meklē pieejamo informāciju…», kļūda, nezināms formāts) - arī nepērk.
 *
 * Parseris ir `lib/vin-scan/autodna-precheck.ts` (`parseAutodnaPrecheckHtml`) kopija .mjs valodā (relejs tiek
 * izvietots atsevišķi no Next). Sakritību pārbauda tests `lib/autodna-purchase-guard.test.ts` uz tiem pašiem
 * HTML paraugiem - ja maini vienu, maini abus.
 */

/** Sadaļas, no kurām atkarīgs pirkums. Tie paši nosaukumi kā TS `AUTODNA_KEY_SECTIONS`. */
export const DNA_PRECHECK_HISTORY = "Transportlīdzekļa vēsture";
export const DNA_PRECHECK_PHOTOS = "Auto arhīva fotogrāfijas";

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " ", "#x27": "'" };

function cleanText(html) {
  return String(html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(amp|lt|gt|quot|#39|nbsp|#x27);/g, (_, k) => ENTITIES[k] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCount(text) {
  const m = /(\d+)\s*(?:\/\s*(\d+))?\s*ierakst/i.exec(text) ?? /(\d+)\s*(?:\/\s*(\d+))?/.exec(text);
  if (!m) return { count: null };
  const count = Number(m[1]);
  const of = m[2] ? Number(m[2]) : undefined;
  return of != null ? { count, of } : { count };
}

/**
 * Tas pats kā TS `parseAutodnaPrecheckHtml`.
 * @returns {{state:"ready", data:{total:number, vehicle:string, sections:{name:string, available:boolean, count:number|null, of?:number}[]}} | {state:"pending", siteKey:string} | {state:"unknown"}}
 */
export function parsePrecheckHtml(html) {
  const raw = String(html ?? "");
  const sections = [];
  const seen = new Set();
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

/** Tas pats kā TS `autodnaSectionCount`: null - sadaļas lapā nav; nepieejama sadaļa = 0. */
export function precheckSectionCount(data, name) {
  const s = data?.sections?.find((x) => String(x.name).toLowerCase() === name.toLowerCase());
  if (!s) return null;
  return s.available ? (s.count ?? 0) : 0;
}

/**
 * Pirkuma lēmums no priekšpārbaudes lapas.
 * @param {ReturnType<typeof parsePrecheckHtml> | null | undefined} page
 * @returns {{ allowed: boolean, code?: "precheck_no_records"|"precheck_unavailable", photos: number|null, history: number|null }}
 */
export function decidePrecheck(page) {
  if (!page || page.state !== "ready") return { allowed: false, code: "precheck_unavailable", photos: null, history: null };
  const history = precheckSectionCount(page.data, DNA_PRECHECK_HISTORY);
  const photos = precheckSectionCount(page.data, DNA_PRECHECK_PHOTOS);
  // Neviena no abām sadaļām lapā nav atrasta - formāts nav atpazīts.
  if (history == null && photos == null) return { allowed: false, code: "precheck_unavailable", photos, history };
  if ((history ?? 0) > 0 || (photos ?? 0) > 0) return { allowed: true, photos, history };
  return { allowed: false, code: "precheck_no_records", photos, history };
}

export const DNA_PRECHECK_MESSAGE_LV = {
  precheck_no_records: "Pirkt nedrīkst - AutoDNA nav foto un vēstures ierakstu",
  precheck_unavailable: "Priekšpārbaude nav pieejama - nepērku",
};
