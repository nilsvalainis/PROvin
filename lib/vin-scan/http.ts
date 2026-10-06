import "server-only";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export type ScanHttpResult = {
  status: number;
  text: string;
  cookie: string;
};

function cookieFrom(res: Response): string {
  const rows = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const parts = rows.map((row) => row.split(";")[0]?.trim() ?? "").filter(Boolean);
  if (parts.length > 0) return parts.join("; ");
  const single = res.headers.get("set-cookie");
  return single ? single.split(";")[0]!.trim() : "";
}

export async function scanFetch(
  url: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    cookie?: string;
    timeoutMs?: number;
  } = {},
): Promise<ScanHttpResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 12_000);
  try {
    const headers: Record<string, string> = {
      accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      "accept-language": "en,da;q=0.8,lv;q=0.7",
      "user-agent": UA,
      ...init.headers,
    };
    if (init.cookie) headers.cookie = init.cookie;
    const res = await fetch(url, {
      method: init.method ?? "GET",
      headers,
      body: init.body,
      redirect: "follow",
      cache: "no-store",
      signal: ctrl.signal,
    });
    const text = await res.text();
    return { status: res.status, text, cookie: cookieFrom(res) };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("timeout");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
