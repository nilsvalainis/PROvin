/**
 * Order Copilot — tīras palīgfunkcijas (bez server-only; der klientam, serverim un testiem).
 * Vēstures darbību kopsavilkums, izslēgto avotu paziņojums, audita konteksta prioritātes,
 * atgriezeniskās saites anonimizācija.
 */
import type { CopilotAction, CopilotSourceKey } from "@/lib/admin-copilot-types";

/** Marķieris, ar kuru vēstures ziņai pievienots darbību kopsavilkums. */
export const COPILOT_HISTORY_ACTIONS_MARKER = "[Copilot darbības:";

const HISTORY_ACTIONS_MAX = 12;
const HISTORY_ACTIONS_MAX_CHARS = 1_500;

function clip(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  const t = v.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** Viena darbība vienā īsā rindā: tips, avots, galvenie lauki (lai var atcelt / dzēst tieši to). */
export function compactCopilotActionForHistory(action: CopilotAction): string {
  const a = action as unknown as Record<string, unknown>;
  const bits: string[] = [String(a.type ?? "?"), String(a.source ?? "?")];
  const date = clip(a.date, 20);
  if (date) bits.push(date);
  const odo = clip(a.odometer, 16);
  if (odo) bits.push(`${odo} km`);
  const loss = clip(a.lossAmount, 30);
  if (loss) bits.push(loss);
  const country = clip(a.country, 30);
  if (country) bits.push(country);
  const location = clip(a.location, 40);
  if (location) bits.push(location);
  const works = clip(a.works, 50);
  if (works) bits.push(works);
  const description = clip(a.description, 50);
  if (description) bits.push(description);
  const field = clip(a.field, 30);
  if (field) bits.push(`lauks ${field}`);
  const text = clip(a.text, 40);
  if (text) bits.push(text);
  if (action.type === "set_dealer_vehicle_info") {
    const keys = Object.keys(action.vehicleInfo ?? {});
    if (keys.length) bits.push(`lauki ${keys.slice(0, 8).join(",")}`);
    if (action.equipment?.length) bits.push(`komplektācija ${action.equipment.length}`);
  }
  return bits.join(" | ");
}

export type CopilotHistoryActionGroups = {
  /** Jau ierakstīts tabulās. */
  applied?: Array<Pick<CopilotAction, "type"> & Partial<CopilotAction>>;
  /** Piedāvāts, gaida operatora apstiprinājumu (vēl nav ierakstīts). */
  proposed?: Array<Pick<CopilotAction, "type"> & Partial<CopilotAction>>;
};

/** Īss darbību bloks, ko pievieno asistenta ziņai vēsturē. Tukšs, ja darbību nav. */
export function formatCopilotActionsForHistory(groups: CopilotHistoryActionGroups): string {
  const sections: string[] = [];
  const render = (label: string, list: CopilotHistoryActionGroups["applied"]) => {
    if (!list?.length) return;
    const lines = list
      .slice(0, HISTORY_ACTIONS_MAX)
      .map((a) => `- ${compactCopilotActionForHistory(a as CopilotAction)}`);
    if (list.length > HISTORY_ACTIONS_MAX) lines.push(`- +${list.length - HISTORY_ACTIONS_MAX} vēl`);
    sections.push(`${label}:\n${lines.join("\n")}`);
  };
  render("ierakstīts", groups.applied);
  render("piedāvāts, nav ierakstīts (gaida apstiprinājumu)", groups.proposed);
  if (sections.length === 0) return "";
  const body = sections.join("\n").slice(0, HISTORY_ACTIONS_MAX_CHARS);
  return `${COPILOT_HISTORY_ACTIONS_MARKER}\n${body}]`;
}

/** Pievieno darbību bloku ziņai (ja tāda vēl nav). */
export function appendCopilotActionsToContent(content: string, groups: CopilotHistoryActionGroups): string {
  if (content.includes(COPILOT_HISTORY_ACTIONS_MARKER)) return content;
  const block = formatCopilotActionsForHistory(groups);
  if (!block) return content;
  return content.trim() ? `${content.trim()}\n\n${block}` : block;
}

/**
 * Vēstures ziņas saīsināšana modelim: garo tekstu nogriež, bet darbību bloku saglabā
 * (citādi «atcel to, ko tikko ieliki» nezina, ko tieši atcelt).
 */
export function truncateCopilotHistoryContent(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;
  const idx = content.lastIndexOf(COPILOT_HISTORY_ACTIONS_MARKER);
  if (idx < 0) return `${content.slice(0, maxChars)}…`;
  const actions = content.slice(idx).slice(0, HISTORY_ACTIONS_MAX_CHARS + 64);
  const room = Math.max(200, maxChars - actions.length - 4);
  const body = content.slice(0, idx).trim();
  return `${body.length > room ? `${body.slice(0, room)}…` : body}\n\n${actions}`;
}

/** Skaidrs LV paziņojums par darbībām, kas atmestas, jo avota ķeksītis izslēgts. */
export function buildSourceDisabledNotice(
  blockedSources: readonly CopilotSourceKey[],
  labelOf: (key: CopilotSourceKey) => string,
): string {
  const unique = [...new Set(blockedSources)];
  if (unique.length === 0) return "";
  const names = unique.map((k) => labelOf(k) || k);
  return names.length === 1
    ? `Avots ${names[0]} izslēgts - ieslēdz ķeksīti un sūti vēlreiz.`
    : `Avoti ${names.join(", ")} izslēgti - ieslēdz ķeksīšus un sūti vēlreiz.`;
}

/* ------------------------------------------------------------------ */
/* Audita konteksta prioritātes                                        */
/* ------------------------------------------------------------------ */

type ContextRule = { re: RegExp; priority: number };

/** Mazāks skaitlis = svarīgāks. Nezināmas sadaļas = 3 (avotu teksts). */
const CONTEXT_RULES: ContextRule[] = [
  { re: /^### (Pasūtījums|Papildus pārdevēja)/, priority: 0 },
  { re: /^### (Apvienotais nobraukums|Visi negadījumu ieraksti|Apvienotie negadījumi|Īpašnieku skaits)/, priority: 1 },
  { re: /deterministisk|CSDD|tehnisk(ās|o) apskat|nobraukuma/i, priority: 1 },
  { re: /^### (Audita piezīmes|.*\(melnraksts\))/, priority: 2 },
  { re: /^### (Vendor raw logs|Gatavo PROVIN audita komentāru stila reference)/, priority: 4 },
  { re: /^### Komentāru garuma budžets/, priority: 5 },
];

function contextChunkPriority(chunk: string): number {
  const head = chunk.split("\n", 1)[0] ?? "";
  for (const rule of CONTEXT_RULES) {
    if (rule.re.test(head)) return rule.priority;
  }
  return 3;
}

/**
 * Sakārto audita kontekstu pēc svarīguma un ievieto griestos. Svarīgākais (pasūtījums,
 * apvienotie nobraukumi/negadījumi, deterministiskie brīfi, melnraksti) iet pirmais, garie
 * RAW žurnāli un stila reference pēdējie. Ja kaut kas neietilpst, beigās īss saraksts.
 */
export function prioritizeCopilotAuditContext(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.length <= maxChars) return trimmed;

  const chunks = trimmed.split(/\n\n(?=### )/);
  const ranked = chunks
    .map((chunk, index) => ({ chunk, index, priority: contextChunkPriority(chunk) }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index);

  const out: string[] = [];
  const omitted: string[] = [];
  let used = 0;
  for (const { chunk } of ranked) {
    const sep = out.length ? 2 : 0;
    if (used + sep + chunk.length <= maxChars) {
      out.push(chunk);
      used += sep + chunk.length;
      continue;
    }
    const room = maxChars - used - sep;
    if (room >= 600) {
      out.push(`${chunk.slice(0, room - 1)}…`);
      used = maxChars;
      continue;
    }
    omitted.push((chunk.split("\n", 1)[0] ?? "").replace(/^### /, "").slice(0, 80));
  }
  if (omitted.length) {
    out.push(`(Neietilpa kontekstā: ${omitted.slice(0, 20).join("; ")}${omitted.length > 20 ? " …" : ""})`);
  }
  return out.join("\n\n");
}

/* ------------------------------------------------------------------ */
/* Atgriezeniskā saite (👍/👎) — bez personas datiem                    */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /\+\d{1,3}(?:[\s-]?\d){6,12}(?!\d)|(?<![\d.,])2\d(?:[\s-]?\d){6}(?!\d|[.,]\d|\s?km)/g;
const PERSON_CODE_RE = /\b\d{6}-\d{5}\b/g;
const UPPER = "A-ZĀČĒĢĪĶĻŅŠŪŽ";
const LOWER = "a-zāčēģīķļņšūž";
/** «Vārds Uzvārds» — divi vai vairāk pēc kārtas ar lielo burtu sākti vārdi. */
const NAME_PAIR_RE = new RegExp(
  `(?<![${UPPER}${LOWER}])[${UPPER}][${LOWER}]+(?:\\s+[${UPPER}][${LOWER}]+)+(?![${UPPER}${LOWER}])`,
  "gu",
);

/** Noņem e-pastus, telefonus, personas kodus un «Vārds Uzvārds» pārus. */
export function redactCopilotFeedbackText(text: string, max = 300): string {
  return text
    .replace(EMAIL_RE, "[e-pasts]")
    .replace(PERSON_CODE_RE, "[personas kods]")
    .replace(PHONE_RE, "[telefons]")
    .replace(NAME_PAIR_RE, "[vārds]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export type CopilotFeedbackRating = "up" | "down";

export type CopilotFeedbackEntry = {
  rating: CopilotFeedbackRating;
  /** Operatora komanda (anonimizēta, īsa). */
  command: string;
  /** Darbību tipi atbildē (piem. upsert_mileage). */
  actionTypes: string[];
  /** Kļūdas teksts, ja atbilde bija kļūda (anonimizēts). */
  error: string;
  /** Pasūtījuma sesijas īss hešs (ne pats ID). */
  sessionHash: string;
  at: string;
};

const ACTION_TYPE_RE = /^[a-z_]{3,48}$/;

export function sanitizeCopilotFeedbackInput(
  raw: unknown,
  opts: { sessionHash: string; now?: Date },
): CopilotFeedbackEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const rating = o.rating === "up" || o.rating === "down" ? o.rating : null;
  if (!rating) return null;
  const actionTypes = Array.isArray(o.actionTypes)
    ? [...new Set(o.actionTypes.filter((t): t is string => typeof t === "string" && ACTION_TYPE_RE.test(t)))].slice(0, 20)
    : [];
  return {
    rating,
    command: typeof o.command === "string" ? redactCopilotFeedbackText(o.command) : "",
    actionTypes,
    error: typeof o.error === "string" ? redactCopilotFeedbackText(o.error, 200) : "",
    sessionHash: opts.sessionHash,
    at: (opts.now ?? new Date()).toISOString(),
  };
}
