/**
 * Nils 20.11: IRISS piedāvājumā «Automašīnas komplektācijas kopsavilkums (pēc VIN)».
 * Avots TIKAI PD «Dati pēc VIN» (`auto1.vinData`) + «Aprīkojums» (`auto1.equipment`) - visas pozīcijas.
 * AI (viens izsaukums piedāvājumam) atgriež strukturētu JSON; šeit - tīra loģika (avots, hash, prompts,
 * validācija, teksta formāts redaktoram, lēmums, vai ģenerēt). AI izsaukums - `iriss-pd-equipment-summary-ai.ts`.
 *
 * Rediģējamais teksts (admins labo PD redaktorā, klients redz laboto):
 *   Ievads (1-2 teikumi).
 *
 *   ## Grupas virsraksts
 *   - Punkts
 *   - Sēdekļi: punkts ar apakšvirsrakstu
 */

import type { IrissPdAuto1Blocks } from "@/lib/iriss-piedavajumi-auto1";

export const IRISS_PD_EQ_SUMMARY_TITLE = "Automašīnas komplektācijas kopsavilkums (pēc VIN)";

/** Grupas un to secība (Nila paraugs). */
export const IRISS_PD_EQ_SUMMARY_GROUPS = [
  "Tehniskie parametri un gaitas iekārta",
  "Drošība un vadītāja asistenti",
  "Apgaismojums un redzamība",
  "Salons un komforts",
  "Multimediji un savienojamība",
  "Eksterjers un bagāžas nodalījums",
] as const;

export const IRISS_PD_EQ_SUMMARY_TEXT_MAX = 12_000;
const ITEM_MAX = 400;
const ITEMS_PER_GROUP_MAX = 40;
const GROUPS_MAX = 12;

export type IrissPdEquipmentSummary = {
  /** Kanoniskais (rediģējamais) teksts. */
  text: string;
  generatedAt: string;
  /** Avota datu hash ģenerēšanas brīdī (mainās avots -> jāpārģenerē, ja teksts nav labots). */
  sourceHash: string;
  model: string;
  /** Admins labojis tekstu ar roku - automātiski NEKAD nepārraksta. */
  editedByAdmin: boolean;
  editedAt: string;
  /** Rāda klientam (saitē un PDF). */
  on: boolean;
};

export type IrissPdEqSummaryGroup = { title: string; items: string[] };
export type IrissPdEqSummaryStructured = { intro: string; groups: IrissPdEqSummaryGroup[] };

export type IrissPdEqSummarySource = { title: string; vinData: string[]; equipment: string[] };

const clean = (s: unknown): string => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "");

/** Garās defises -> īsā (Nila likums), lieki atstarpes. */
export function irissPdEqDash(s: string): string {
  return s.replace(/[‒–—―−]/g, "-");
}

/* ---------------- Avots un hash ---------------- */

export function irissPdEqSummarySource(rec: { vehicle: { title: string }; auto1: IrissPdAuto1Blocks | null }): IrissPdEqSummarySource {
  const a = rec.auto1;
  const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))];
  return {
    title: clean(rec.vehicle.title),
    vinData: uniq((a?.vinData ?? []).map(clean)),
    equipment: uniq((a?.equipment ?? []).map((e) => {
      const name = clean(e.name);
      const detail = clean(e.detail);
      return name && detail ? `${name}: ${detail}` : name || detail;
    })),
  };
}

export function irissPdEqSummaryHasSource(src: IrissPdEqSummarySource): boolean {
  return src.vinData.length + src.equipment.length > 0;
}

/** Stabils hash (FNV-1a 53 bit) - strādā gan serverī, gan pārlūkā. */
export function irissPdEqSummaryHash(src: IrissPdEqSummarySource): string {
  const s = JSON.stringify([src.title, src.vinData, src.equipment]);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/* ---------------- Lēmums: ģenerēt / paturēt / prasīt apstiprinājumu ---------------- */

export type IrissPdEqSummaryDecision = "generate" | "keep" | "confirm_required" | "no_source";

/**
 * - bez `force`: ģenerē tikai, ja kopsavilkuma nav vai avots mainījies UN teksts nav labots ar roku;
 * - `force` («Pārģenerēt»): labotu tekstu pārraksta tikai ar `confirm` (apstiprinājums lapā).
 */
export function irissPdEqSummaryDecision(
  existing: IrissPdEquipmentSummary | null,
  src: IrissPdEqSummarySource,
  opts: { force?: boolean; confirm?: boolean } = {},
): IrissPdEqSummaryDecision {
  if (!irissPdEqSummaryHasSource(src)) return "no_source";
  if (!existing) return "generate";
  if (opts.force) return existing.editedByAdmin && !opts.confirm ? "confirm_required" : "generate";
  if (existing.editedByAdmin) return "keep";
  return existing.sourceHash === irissPdEqSummaryHash(src) ? "keep" : "generate";
}

/** Redaktoram: avots mainījies kopš ģenerēšanas. */
export function irissPdEqSummaryStale(existing: IrissPdEquipmentSummary | null, src: IrissPdEqSummarySource): boolean {
  return Boolean(existing && irissPdEqSummaryHasSource(src) && existing.sourceHash !== irissPdEqSummaryHash(src));
}

export const IRISS_PD_EQ_SUMMARY_ERROR_LV: Record<"no_source" | "confirm_required" | "no_ai" | "ai_failed", string> = {
  no_source: "Nav datu - vajag «Dati pēc VIN» vai «Aprīkojums».",
  confirm_required: "Teksts labots ar roku - apstiprini pārrakstīšanu.",
  no_ai: "AI nav pieejams.",
  ai_failed: "Neizdevās sagatavot kopsavilkumu. Mēģini vēlreiz.",
};

/* ---------------- AI prompts un shēma ---------------- */

export const IRISS_PD_EQ_SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    intro: { type: "string" },
    groups: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string", enum: [...IRISS_PD_EQ_SUMMARY_GROUPS] },
          items: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

export const IRISS_PD_EQ_SUMMARY_SYSTEM = [
  "Tu sagatavo automašīnas komplektācijas kopsavilkumu latviešu valodā klienta piedāvājumam (auto tirgotājs).",
  "Avots ir TIKAI dotie dati: «Dati pēc VIN» (rūpnīcas aprīkojuma kodi/apraksti, bieži vāciski vai angliski) un «Aprīkojums» (izsoles aprīkojuma saraksts). Izmanto VISAS pozīcijas - nekas būtisks nedrīkst pazust.",
  "",
  "STRUKTŪRA:",
  "- intro: 1-2 teikumi, piem. «Bagātīgi aprīkots Škoda Superb Combi ar 2.0 TDI dzinēju un DSG kārbu.» Modeli, dzinēju un kārbu min tikai, ja tie skaidri redzami datos vai auto nosaukumā. Nekad neraksti «visticamāk», «iespējams» vai minējumus.",
  `- groups: tikai šīs grupas šādā secībā (tukšās izlaid): ${IRISS_PD_EQ_SUMMARY_GROUPS.map((g) => `«${g}»`).join(", ")}.`,
  "- «Tehniskie parametri un gaitas iekārta»: dzinējs, kārba, piedziņa, stūres iekārta, balstiekārta, virsbūve, ekonomija (Start-Stop, rekuperācija u.tml.).",
  "- Katrs punkts ir viena īsa rinda. Kur tas palīdz, sāc ar apakšvirsrakstu un kolu, piem. «Sēdekļi: ...», «Stūre: ...», «Kondicionieris: ...». Saistītas pozīcijas apvieno vienā punktā.",
  "",
  "VALODA:",
  "- Pareiza latviešu valoda, vienkārši un saprotami klientam. Tikai īsā defise «-» (nekad «—» vai «–»). Nelieto vārdu «eksperts».",
  "- Zīmolu un tehnoloģiju nosaukumus netulko: Keyless Go, Kessy, Lane Assist, Front Assist, Side Assist, ACC, Apple CarPlay, Android Auto, MirrorLink, Virtual Cockpit, Isofix, DSG, TDI, TSI, LED, Matrix LED, DAB+, WLAN-Hotspot, CargoFlex, Canton, Columbus, Bluetooth, Climatronic, Head-up displejs u.c. Pēc tiem drīkst pievienot īsu latvisku skaidrojumu, piem. «Keyless Go: atslēgas bezkontakta piekļuve un iedarbināšana».",
  "- Tulko tikai to, ko droši saproti. Nesaprotamus kodus (piem. «1KD», «0A2») un iekšējus tehniskus ierakstus bez nozīmes klientam izlaid.",
  "",
  "AIZLIEGTS: izdomāt aprīkojumu vai faktus, kas nav datos; cenas; vērtējumi par tehnisko stāvokli; nobraukums; bojājumi.",
].join("\n");

export function irissPdEqSummaryUserPrompt(src: IrissPdEqSummarySource): string {
  const list = (xs: string[]) => (xs.length ? xs.map((x) => `- ${x}`).join("\n") : "(nav)");
  return [
    `Auto nosaukums piedāvājumā: ${src.title || "(nav)"}`,
    "",
    `Dati pēc VIN (${src.vinData.length}):`,
    list(src.vinData),
    "",
    `Aprīkojums (${src.equipment.length}):`,
    list(src.equipment),
  ].join("\n");
}

/* ---------------- Validācija un teksta formāts ---------------- */

const GROUP_ORDER = new Map<string, number>(IRISS_PD_EQ_SUMMARY_GROUPS.map((g, i) => [g.toLowerCase(), i]));
const BANNED_RE = /\b(eksperts?|eksperta|ekspertu|visticamāk)\b/i;

function cleanItem(s: unknown): string {
  return irissPdEqDash(clean(s))
    .replace(/^[-•*·]\s*/, "")
    .slice(0, ITEM_MAX)
    .trim();
}

/** Izmet tukšās grupas/punktus, garās defises -> īsā, dublikātus, aizliegtos vārdus; sakārto grupas. */
export function sanitizeIrissPdEqSummary(raw: unknown): IrissPdEqSummaryStructured | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const intro = irissPdEqDash(clean(o.intro))
    .split(/(?<=[.!?])\s+(?=[A-ZĀČĒĢĪĶĻŅŠŪŽ])/)
    .filter((s) => s && !BANNED_RE.test(s))
    .join(" ")
    .slice(0, 600);
  const byTitle = new Map<string, IrissPdEqSummaryGroup>();
  for (const g of Array.isArray(o.groups) ? o.groups : []) {
    if (!g || typeof g !== "object") continue;
    const gg = g as Record<string, unknown>;
    const title = irissPdEqDash(clean(gg.title)).replace(/:$/, "").slice(0, 80);
    if (!title) continue;
    const key = title.toLowerCase();
    const group = byTitle.get(key) ?? { title, items: [] };
    for (const it of Array.isArray(gg.items) ? gg.items : []) {
      const t = cleanItem(it);
      if (!t || BANNED_RE.test(t) || group.items.some((x) => x.toLowerCase() === t.toLowerCase())) continue;
      if (group.items.length < ITEMS_PER_GROUP_MAX) group.items.push(t);
    }
    byTitle.set(key, group);
  }
  const groups = [...byTitle.values()]
    .filter((g) => g.items.length > 0)
    .sort((a, b) => (GROUP_ORDER.get(a.title.toLowerCase()) ?? 99) - (GROUP_ORDER.get(b.title.toLowerCase()) ?? 99))
    .slice(0, GROUPS_MAX);
  if (!groups.length) return null;
  return { intro, groups };
}

export function parseIrissPdEqSummaryAiJson(raw: string): IrissPdEqSummaryStructured | null {
  const t = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return sanitizeIrissPdEqSummary(JSON.parse(t));
  } catch {
    return null;
  }
}

export function irissPdEqSummaryToText(s: IrissPdEqSummaryStructured): string {
  const parts: string[] = [];
  if (s.intro) parts.push(s.intro);
  for (const g of s.groups) parts.push([`## ${g.title}`, ...g.items.map((x) => `- ${x}`)].join("\n"));
  return parts.join("\n\n");
}

/** Admina teksts -> struktūra klienta blokam. Teksts pirms pirmās grupas = ievads. */
export function irissPdEqSummaryFromText(text: string): IrissPdEqSummaryStructured | null {
  const intro: string[] = [];
  const groups: IrissPdEqSummaryGroup[] = [];
  for (const rawLine of irissPdEqDash(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const h = /^#{1,6}\s*(.+)$/.exec(line);
    if (h) {
      const title = clean(h[1]).replace(/:$/, "");
      if (title) groups.push({ title, items: [] });
      continue;
    }
    const isItem = /^[-•*·]\s+/.test(line);
    const t = clean(line.replace(/^[-•*·]\s+/, ""));
    if (!t) continue;
    const g = groups[groups.length - 1];
    if (!g) intro.push(t);
    else if (isItem || g.items.length === 0) g.items.push(t);
    else g.items[g.items.length - 1] = `${g.items[g.items.length - 1]} ${t}`;
  }
  const out = { intro: intro.join(" "), groups: groups.filter((g) => g.items.length > 0) };
  return out.intro || out.groups.length ? out : null;
}

/* ---------------- Glabāšana ---------------- */

export function normalizeIrissPdEquipmentSummary(raw: unknown): IrissPdEquipmentSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const text = typeof o.text === "string" ? irissPdEqDash(o.text).replace(/\r\n/g, "\n").slice(0, IRISS_PD_EQ_SUMMARY_TEXT_MAX) : "";
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  return {
    text,
    generatedAt: str(o.generatedAt, 40),
    sourceHash: str(o.sourceHash, 40),
    model: str(o.model, 80),
    editedByAdmin: o.editedByAdmin === true,
    editedAt: str(o.editedAt, 40),
    on: o.on !== false,
  };
}

export function newIrissPdEquipmentSummary(
  s: IrissPdEqSummaryStructured,
  ctx: { at: string; sourceHash: string; model: string; on?: boolean },
): IrissPdEquipmentSummary {
  return {
    text: irissPdEqSummaryToText(s),
    generatedAt: ctx.at,
    sourceHash: ctx.sourceHash,
    model: ctx.model,
    editedByAdmin: false,
    editedAt: "",
    on: ctx.on ?? true,
  };
}

/**
 * Admina labojums (PATCH): maina tikai `text` un `on`. Teksta maiņa -> `editedByAdmin` (vairs netiek pārrakstīts automātiski).
 * Atgriež to pašu objektu, ja nekas nav mainījies.
 */
export function applyIrissPdEquipmentSummaryEdit(
  cur: IrissPdEquipmentSummary | null,
  patch: unknown,
  at: string,
): IrissPdEquipmentSummary | null {
  if (!cur || !patch || typeof patch !== "object") return cur;
  const p = patch as Record<string, unknown>;
  let next = cur;
  if (typeof p.text === "string") {
    const t = normalizeIrissPdEquipmentSummary({ ...cur, text: p.text })!.text;
    if (t !== cur.text) next = { ...next, text: t, editedByAdmin: true, editedAt: at };
  }
  if (typeof p.on === "boolean" && p.on !== cur.on) next = { ...next, on: p.on };
  return next;
}

/** Klientam: tikai ieslēgts un nav tukšs. */
export function buildIrissPdEqSummaryPublic(s: IrissPdEquipmentSummary | null): IrissPdEqSummaryStructured | null {
  if (!s || !s.on || !s.text.trim()) return null;
  const st = irissPdEqSummaryFromText(s.text);
  return st && st.groups.length ? st : null;
}
