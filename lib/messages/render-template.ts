/**
 * Vienots {{mainīgo}} un izvēles bloku renderētājs (bez Blob).
 */

/** `vin`, `maksajuma_saite` un arī `maksājuma_saite` (apstiprinātais atgādinājuma šablons). */
const VAR_KEY = "[\\p{L}0-9_]+";
const PLACEHOLDER_RE = new RegExp(`\\{\\{([#\\/]?)(${VAR_KEY})\\}\\}`, "giu");

export function extractTemplatePlaceholders(template: string): string[] {
  const keys = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(`\\{\\{([#\\/]?)(${VAR_KEY})\\}\\}`, "giu");
  while ((m = re.exec(template)) !== null) {
    const prefix = m[1];
    const key = m[2].toLowerCase();
    if (!prefix) keys.add(key);
  }
  return [...keys].sort();
}

function isNonEmpty(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
}

/** Aizvieto {{x}} un {{#x}}…{{/x}} kad x nav tukšs. */
export function renderTemplateString(template: string, vars: Record<string, string>): string {
  const openRe = new RegExp(`\\{\\{#(${VAR_KEY})\\}\\}`, "giu");
  let out = template.replace(/\r\n/g, "\n");

  out = out.replace(openRe, (_, key: string) => {
    const k = key.toLowerCase();
    return isNonEmpty(vars[k]) ? "" : "\0BLOCK_START\0";
  });
  out = out.replace(new RegExp(`\\{\\{\\/(${VAR_KEY})\\}\\}`, "giu"), (_, key: string) => {
    const k = key.toLowerCase();
    return isNonEmpty(vars[k]) ? "" : "\0BLOCK_END\0";
  });

  // Noņemam neaktīvos blokus (tukšs mainīgais).
  out = out.replace(/\0BLOCK_START\0[\s\S]*?\0BLOCK_END\0/g, "");

  out = out.replace(PLACEHOLDER_RE, (full, prefix, key) => {
    if (prefix === "#" || prefix === "/") return full;
    const k = key.toLowerCase();
    return vars[k] ?? "";
  });

  return out.replace(/\0BLOCK_START\0|\0BLOCK_END\0/g, "").trimEnd();
}

export function renderTemplateSubject(subject: string, vars: Record<string, string>): string {
  return renderTemplateString(subject, vars).trim();
}

export type TemplateValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

export function validateTemplateDraft(args: {
  subject?: string;
  body: string;
  allowedVars: string[];
  requiredVars: string[];
  maxSubjectLength?: number;
}): TemplateValidationResult {
  const errors: string[] = [];
  const allowed = new Set(args.allowedVars.map((k) => k.toLowerCase()));
  const combined = `${args.subject ?? ""}\n${args.body}`;
  const used = extractTemplatePlaceholders(combined);
  for (const u of used) {
    if (!allowed.has(u)) errors.push(`Nezināms mainīgais: {{${u}}}`);
  }
  for (const req of args.requiredVars) {
    const k = req.toLowerCase();
    if (!combined.includes(`{{${k}}}`)) {
      errors.push(`Trūkst obligātais mainīgais: {{${k}}}`);
    }
  }
  if (!args.body.trim()) errors.push("Teksts nedrīkst būt tukšs.");
  if (args.subject != null && args.subject.length > (args.maxSubjectLength ?? 180)) {
    errors.push(`Temats pārāk garš (maks. ${args.maxSubjectLength ?? 180} rakstzīmes).`);
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
