/**
 * Failu KB (`data/kb/*.yaml`). Draft = lasāms.
 * EUR joslas NAV ieviestas (Nils 17.10): `PROVIN_KB_EUR_ACTIVE = false`.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type ProvinKbStatus = "draft" | "verified";

export type ProvinKbFault = {
  component: string;
  probability?: string;
  impact?: string;
  note?: string;
  [key: string]: unknown;
};

export type ProvinKbEntry = {
  code: string;
  aliases: string[];
  status: ProvinKbStatus;
  faults: ProvinKbFault[];
  not_typical: string[];
  sourceFile: string;
  raw: Record<string, unknown>;
};

export type ProvinKbCostBand = {
  source?: string | null;
  dated?: string | null;
  min?: number;
  max?: number;
};

/** Nils 17.10: EUR cenas KB vēl nav. Failu KB joslas L3 nelasa. */
export const PROVIN_KB_EUR_ACTIVE = false;

let catalogCache: ProvinKbEntry[] | null = null;

function kbDir(): string {
  return join(process.cwd(), "data", "kb");
}

function parseInlineList(raw: string): unknown[] {
  const inner = raw.slice(1, -1).trim();
  if (!inner) return [];
  const out: unknown[] = [];
  let buf = "";
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i]!;
    if (quote) {
      if (ch === quote) quote = null;
      else buf += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === ",") {
      if (buf.trim()) out.push(parseScalar(buf.trim()));
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(parseScalar(buf.trim()));
  return out;
}

function parseInlineMap(raw: string): Record<string, unknown> {
  const inner = raw.slice(1, -1).trim();
  const out: Record<string, unknown> = {};
  if (!inner) return out;
  let buf = "";
  let quote: '"' | "'" | null = null;
  const parts: string[] = [];
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i]!;
    if (quote) {
      if (ch === quote) quote = null;
      buf += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      buf += ch;
      continue;
    }
    if (ch === ",") {
      if (buf.trim()) parts.push(buf.trim());
      buf = "";
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());
  for (const part of parts) {
    const colon = part.indexOf(":");
    if (colon < 0) continue;
    out[part.slice(0, colon).trim()] = parseScalar(part.slice(colon + 1).trim());
  }
  return out;
}

function parseScalar(raw: string): unknown {
  const t = raw.trim();
  if (!t || t === "~" || t === "null") return null;
  if (t === "true") return true;
  if (t === "false") return false;
  if (
    (t.startsWith('"') && t.endsWith('"') && t.length >= 2) ||
    (t.startsWith("'") && t.endsWith("'") && t.length >= 2)
  ) {
    return t.slice(1, -1);
  }
  if (t.startsWith("[") && t.endsWith("]")) return parseInlineList(t);
  if (t.startsWith("{") && t.endsWith("}")) return parseInlineMap(t);
  if (/^-?\d+$/.test(t)) return Number(t);
  if (/^-?\d+\.\d+$/.test(t)) return Number(t);
  return t;
}

function indentOf(line: string): number {
  const m = line.match(/^ */);
  return m ? m[0].length : 0;
}

type YamlNode = Record<string, unknown> | unknown[];

export function parseProvinKbYaml(text: string): Record<string, unknown> {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\t/g, "  "))
    .filter((l) => l.trim() && !l.trim().startsWith("#"));
  const root: Record<string, unknown> = {};
  const stack: { indent: number; node: YamlNode }[] = [{ indent: -1, node: root }];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const indent = indentOf(line);
    const trimmed = line.trim();
    while (stack.length > 1 && indent <= stack[stack.length - 1]!.indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1]!.node;

    if (trimmed.startsWith("- ")) {
      const itemRaw = trimmed.slice(2);
      if (!Array.isArray(parent)) {
        throw new Error(`yaml: list item under map: ${trimmed}`);
      }
      if (itemRaw.includes(":") && !itemRaw.startsWith("{") && !itemRaw.startsWith("[")) {
        const colon = itemRaw.indexOf(":");
        const key = itemRaw.slice(0, colon).trim();
        const rest = itemRaw.slice(colon + 1).trim();
        const obj: Record<string, unknown> = {};
        if (rest) obj[key] = parseScalar(rest);
        else obj[key] = {};
        parent.push(obj);
        stack.push({ indent, node: obj });
      } else {
        parent.push(parseScalar(itemRaw));
      }
      continue;
    }

    const colon = trimmed.indexOf(":");
    if (colon < 0) continue;
    const key = trimmed.slice(0, colon).trim();
    const rest = trimmed.slice(colon + 1).trim();
    if (Array.isArray(parent)) {
      const last = parent[parent.length - 1];
      if (last && typeof last === "object" && !Array.isArray(last)) {
        const map = last as Record<string, unknown>;
        if (!rest) {
          const peek = lines[i + 1] ?? "";
          const child: YamlNode = peek.trim().startsWith("- ") ? [] : {};
          map[key] = child;
          stack.push({ indent, node: child });
        } else {
          map[key] = parseScalar(rest);
        }
      }
      continue;
    }

    const map = parent as Record<string, unknown>;
    if (!rest) {
      const peek = lines[i + 1] ?? "";
      const child: YamlNode = peek.trim().startsWith("- ") ? [] : {};
      map[key] = child;
      stack.push({ indent, node: child });
    } else {
      map[key] = parseScalar(rest);
    }
  }
  return root;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim());
}

function asFaults(value: unknown): ProvinKbFault[] {
  if (!Array.isArray(value)) return [];
  const out: ProvinKbFault[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const component = typeof o.component === "string" ? o.component.trim() : "";
    if (!component) continue;
    out.push({
      ...o,
      component,
      probability: typeof o.probability === "string" ? o.probability : undefined,
      impact: typeof o.impact === "string" ? o.impact : undefined,
      note: typeof o.note === "string" ? o.note : undefined,
    });
  }
  return out;
}

export function entryFromParsed(raw: Record<string, unknown>, sourceFile: string): ProvinKbEntry | null {
  const code = typeof raw.code === "string" ? raw.code.trim() : "";
  if (!code) return null;
  const statusRaw = typeof raw.status === "string" ? raw.status.trim().toLowerCase() : "draft";
  return {
    code,
    aliases: asStringList(raw.aliases),
    status: statusRaw === "verified" ? "verified" : "draft",
    faults: asFaults(raw.faults),
    not_typical: asStringList(raw.not_typical),
    sourceFile,
    raw,
  };
}

export function loadProvinKbCatalog(dir = kbDir()): ProvinKbEntry[] {
  if (catalogCache && dir === kbDir()) return catalogCache;
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();
  const out: ProvinKbEntry[] = [];
  for (const file of files) {
    const text = readFileSync(join(dir, file), "utf8");
    const parsed = parseProvinKbYaml(text);
    const entry = entryFromParsed(parsed, file);
    if (entry) out.push(entry);
  }
  if (dir === kbDir()) catalogCache = out;
  return out;
}

export function resetProvinKbCatalogCache(): void {
  catalogCache = null;
}

export function compactKbCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function collectCodeTokens(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    const t = value.trim();
    if (t && t.length >= 2 && t.length < 48) out.add(t);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectCodeTokens(v, out);
    return;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectCodeTokens(v, out);
  }
}

export function kbEntryCodes(entry: ProvinKbEntry): string[] {
  const out = new Set<string>([entry.code, ...entry.aliases]);
  collectCodeTokens(entry.raw.variants, out);
  collectCodeTokens(entry.raw.generations, out);
  return [...out];
}

export function findProvinKbEntry(
  code: string,
  catalog: ProvinKbEntry[] = loadProvinKbCatalog(),
): ProvinKbEntry | null {
  const q = compactKbCode(code);
  if (!q) return null;
  for (const entry of catalog) {
    const keys = kbEntryCodes(entry).map(compactKbCode).filter(Boolean);
    if (keys.some((k) => k === q || k.startsWith(q) || q.startsWith(k))) return entry;
  }
  return null;
}

export function extractKbSourceCode(source: string): string | null {
  const t = source.trim();
  const m = t.match(/^(?:KB:|kb:)\s*(.+)$/);
  if (m?.[1]) return m[1].trim();
  if (/^KB\b/i.test(t)) return t.replace(/^KB\b/i, "").replace(/^[:\s]+/, "").trim() || null;
  return null;
}

/** Failu KB EUR: izslēgts, kamēr `PROVIN_KB_EUR_ACTIVE` ir false. */
export function isVerifiedFileKbCostBand(
  _band?: ProvinKbCostBand | null,
  _catalog?: ProvinKbEntry[],
): boolean {
  void _band;
  void _catalog;
  return false;
}

export function formatMatchingProvinKbForPrompt(
  codes: string[],
  catalog: ProvinKbEntry[] = loadProvinKbCatalog(),
): string {
  const seen = new Set<string>();
  const hits: ProvinKbEntry[] = [];
  for (const code of codes) {
    const entry = findProvinKbEntry(code, catalog);
    if (!entry || seen.has(entry.sourceFile)) continue;
    seen.add(entry.sourceFile);
    hits.push(entry);
  }
  if (hits.length === 0) {
    return "PROVIN KB: šim kodam draft ieraksta nav. EUR no KB nav ieviests.";
  }
  const payload = hits.map((e) => ({
    code: e.code,
    aliases: e.aliases,
    status: e.status,
    faults: e.faults.map((f) => ({
      component: f.component,
      probability: f.probability,
      impact: f.impact,
      note: f.note,
    })),
    not_typical: e.not_typical,
    next_100k_focus: e.raw.next_100k_focus ?? [],
  }));
  return `PROVIN KB (draft; EUR joslas NAV ieviestas, cost_band_eur = null):\n${JSON.stringify(payload)}`;
}
