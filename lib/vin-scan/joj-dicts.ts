/**
 * JoJ /usa/damages un /usa/titles vārdnīcas. Ilgtermiņa kešs (90 dienas), $0.01/zvans.
 * Bez tīkla klienta: HTTP iet caur joj-api getteri (1 req/s).
 */
import "server-only";

import { EMPTY_JOJ_NAME_DICT, type JojNameDict } from "@/lib/vin-scan/joj-labels";
import { jojUsaDamagesUrl, jojUsaTitlesUrl, parseJojDictPage } from "@/lib/vin-scan/parse-joj";
import { readJojDictCache, writeJojDictCache } from "@/lib/vin-scan/store";

const MAX_PAGES = 20;

export type JojDictGetJson = (url: string) => Promise<{ status: number; json: unknown }>;

async function fetchDictKind(
  kind: "damages" | "titles",
  baseUrl: string,
  getJson: JojDictGetJson,
): Promise<Record<string, string>> {
  const entries: Record<string, string> = {};
  let page = 1;
  let url = kind === "damages" ? jojUsaDamagesUrl(baseUrl, page) : jojUsaTitlesUrl(baseUrl, page);
  while (page <= MAX_PAGES && url) {
    const res = await getJson(url);
    if (res.status >= 400) break;
    const parsed = parseJojDictPage(res.json, kind);
    Object.assign(entries, parsed.entries);
    const next = parsed.nextPageUrl;
    if (!next) break;
    url = next.startsWith("http") ? next : `${baseUrl.replace(/\/+$/, "")}${next.startsWith("/") ? "" : "/"}${next}`;
    page += 1;
  }
  return entries;
}

export async function loadJojNameDict(input: {
  baseUrl: string;
  getJson: JojDictGetJson;
  skipCache?: boolean;
}): Promise<JojNameDict> {
  if (!input.skipCache) {
    const cached = await readJojDictCache().catch(() => null);
    if (cached) return cached.dict;
  }
  const damages = await fetchDictKind("damages", input.baseUrl, input.getJson);
  const titles = await fetchDictKind("titles", input.baseUrl, input.getJson);
  const dict: JojNameDict = { damages, titles };
  if (Object.keys(damages).length || Object.keys(titles).length) {
    await writeJojDictCache(dict).catch(() => undefined);
  }
  return dict;
}

export { EMPTY_JOJ_NAME_DICT };
