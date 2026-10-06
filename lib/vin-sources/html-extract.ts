/**
 * HTML -> teksts / tabulas / etiķete:vērtība pāri, lai reģistru lapas varētu lasīt bez Playwright.
 */
export type ExtractedPage = {
  text: string;
  tables: { headers: string[]; rows: string[][] }[];
  pairs: { label: string; value: string }[];
};

function clean(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

export function stripHtmlToText(html: string): string {
  const without = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h1|h2|h3|td|th)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return clean(without.replace(/\n{3,}/g, "\n\n")).slice(0, 60000);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

function cellText(cellHtml: string): string {
  return clean(decodeEntities(stripHtmlToText(cellHtml)));
}

export function extractTablesFromHtml(html: string): ExtractedPage["tables"] {
  const tables: ExtractedPage["tables"] = [];
  const tableRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRe.exec(html))) {
    const body = tableMatch[1] ?? "";
    const rows: string[][] = [];
    const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch: RegExpExecArray | null;
    while ((trMatch = trRe.exec(body))) {
      const cells = [...(trMatch[1] ?? "").matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map((m) =>
        cellText(m[1] ?? ""),
      );
      if (cells.some(Boolean)) rows.push(cells);
    }
    if (rows.length === 0) continue;
    const headers = rows[0] ?? [];
    tables.push({ headers, rows: rows.slice(1) });
  }
  return tables;
}

export function extractPairsFromHtml(html: string): ExtractedPage["pairs"] {
  const pairs: ExtractedPage["pairs"] = [];
  const dtRe = /<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi;
  let m: RegExpExecArray | null;
  while ((m = dtRe.exec(html))) {
    const label = cellText(m[1] ?? "");
    const value = cellText(m[2] ?? "");
    if (label && value) pairs.push({ label, value });
  }
  return pairs.slice(0, 200);
}

export function extractPageFromHtml(html: string): ExtractedPage {
  return {
    text: stripHtmlToText(html),
    tables: extractTablesFromHtml(html),
    pairs: extractPairsFromHtml(html),
  };
}

/** PrimeFaces AJAX: pirmais CDATA parasti ir atjauninātā forma. */
export function extractPartialUpdateHtml(xml: string): string {
  const chunks = [...xml.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)].map((m) => m[1] ?? "");
  const form = chunks.find((c) => /<form\b/i.test(c));
  return form ?? chunks[0] ?? xml;
}

/** Drupal 10 AJAX (application/vnd.drupal-ajax): insert.com.data HTML. */
export function extractDrupalAjaxHtml(body: string): string {
  const trimmed = body.replace(/^\)\]\}'?,?\s*/, "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("<")) return trimmed;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    const commands = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { commands?: unknown }).commands)
        ? ((parsed as { commands: unknown[] }).commands ?? [])
        : [];
    if (!Array.isArray(commands) || commands.length === 0) return "";
    const preferred: string[] = [];
    const rest: string[] = [];
    for (const cmd of commands) {
      if (!cmd || typeof cmd !== "object") continue;
      const o = cmd as Record<string, unknown>;
      const data = typeof o.data === "string" ? o.data : "";
      const text = typeof o.text === "string" ? o.text : "";
      const selector = String(o.selector ?? "");
      if (/api-query-output/i.test(selector) && data) preferred.push(data);
      else if (data) rest.push(data);
      if (text) rest.push(text);
    }
    return (preferred.length > 0 ? preferred : rest).join("\n").trim();
  } catch {
    return "";
  }
}

export function extractInnerHtmlById(html: string, id: string): string {
  const re = new RegExp(`<([a-z0-9]+)([^>]*\\sid="${escapeRe(id)}"[^>]*)>`, "i");
  const m = re.exec(html);
  if (!m) return "";
  const tag = m[1]!;
  if (/\/>$/.test(m[0])) return "";
  const rest = html.slice(m.index + m[0].length);
  const close = new RegExp(`</${tag}>`, "i").exec(rest);
  if (!close) return rest.trim();
  return rest.slice(0, close.index).trim();
}

export function extractDrupalAjaxPageState(html: string): Record<string, string> {
  const m = /data-drupal-selector="drupal-settings-json">([^<]+)/i.exec(html);
  if (!m?.[1]) return {};
  try {
    const json = JSON.parse(m[1]) as {
      ajaxPageState?: { theme?: string; theme_token?: string | null; libraries?: string };
    };
    const s = json.ajaxPageState ?? {};
    const out: Record<string, string> = {};
    if (s.theme) out["ajax_page_state[theme]"] = s.theme;
    if (s.theme_token) out["ajax_page_state[theme_token]"] = s.theme_token;
    if (s.libraries) out["ajax_page_state[libraries]"] = s.libraries;
    return out;
  } catch {
    return {};
  }
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractInputValue(html: string, name: string): string {
  const n = escapeRe(name);
  const re = new RegExp(`name="${n}"[^>]*value="([^"]*)"`, "i");
  const a = re.exec(html);
  if (a?.[1]) return a[1];
  const re2 = new RegExp(`value="([^"]*)"[^>]*name="${n}"`, "i");
  return re2.exec(html)?.[1] ?? "";
}

export function parseMntAjaxSource(html: string): string {
  const decoded = html.replace(/&quot;/g, '"');
  const otsi = /otsiAction\s*=\s*function\(\)\s*\{[\s\S]{0,400}?PrimeFaces\.ab\(\{s:"([^"]+)"/.exec(decoded);
  if (otsi?.[1]) return otsi[1];
  const loose = /otsiAction[\s\S]{0,400}?s:"(soidukOtsingForm:[^"]+)"/.exec(decoded);
  return loose?.[1] ?? "";
}

export function isCloudflareChallengeHtml(html: string, status = 200): boolean {
  if (/<title>\s*just a moment/i.test(html)) return true;
  if (/cdn-cgi\/challenge|cf-chl-bypass|challenge-platform/i.test(html)) return true;
  if ((status === 403 || status === 503) && /cloudflare|just a moment/i.test(html)) return true;
  return false;
}

export function cookiesRecordToHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

export function mergeCookieHeader(previous: string, incoming: string): string {
  const map = new Map<string, string>();
  const eat = (raw: string) => {
    for (const part of raw.split(";")) {
      const piece = part.trim();
      if (!piece || !piece.includes("=")) continue;
      const eq = piece.indexOf("=");
      const k = piece.slice(0, eq).trim();
      const v = piece.slice(eq + 1).trim();
      if (!k || /^(path|domain|expires|max-age|secure|httponly|samesite)$/i.test(k)) continue;
      map.set(k, v);
    }
  };
  eat(previous);
  eat(incoming);
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

/** Vairāki Set-Cookie (t.sk. `Expires=Tue, 19 Jan` komats) → Cookie header. */
export function cookieHeaderFromSetCookieLines(lines: string[]): string {
  let header = "";
  for (const line of lines) {
    const nameValue = line.split(";")[0]?.trim() ?? "";
    if (!nameValue.includes("=")) continue;
    header = mergeCookieHeader(header, nameValue);
  }
  return header;
}

export function splitCombinedSetCookieHeader(header: string): string[] {
  return header
    .split(/,(?=\s*[A-Za-z0-9_-]+=)/)
    .map((s) => s.trim())
    .filter(Boolean);
}
