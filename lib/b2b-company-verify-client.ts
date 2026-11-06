import {
  type CompanyVerifyDecision,
  type CompanyVerifySubjectKind,
  type CompanyVerifyView,
} from "@/lib/b2b-company-verify";

/** Pārlūka griesti: UR/VIES ir 8 s, bet Blob vai Safari fetch var vispār nebeigties. */
export const COMPANY_VERIFY_CLIENT_TIMEOUT_MS = 20_000;

export type CompanyVerifyClientFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type CompanyVerifyClientResult =
  | { ok: true; view: CompanyVerifyView }
  | { ok: false; error: string };

export function isCompanyVerifyAbortError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const name = "name" in e && typeof e.name === "string" ? e.name : "";
  const msg = e instanceof Error ? e.message : "";
  return name === "AbortError" || name === "TimeoutError" || /aborted|timeout|noildza/i.test(msg);
}

export function companyVerifyLoadError(e?: unknown, apiError?: string): string {
  if (e && isCompanyVerifyAbortError(e)) return "Pārbaudes pieprasījums noildza. Mēģini vēlreiz.";
  if (apiError) return `Pārbaudi neizdevās ielādēt (${apiError}).`;
  return "Pārbaudi neizdevās ielādēt.";
}

export function companyVerifyDecisionError(e?: unknown, apiError?: string): string {
  if (e && isCompanyVerifyAbortError(e)) return "Lēmuma pieprasījums noildza. Mēģini vēlreiz.";
  if (apiError) return `Lēmumu neizdevās saglabāt (${apiError}).`;
  return "Lēmumu neizdevās saglabāt.";
}

function abortError(): Error {
  const err = new Error("timeout");
  err.name = "TimeoutError";
  return err;
}

/**
 * Fetch ar termiņu, kas beidzas pat ja AbortSignal tiek ignorēts (Safari / iestrēdzis TCP).
 * Bez šī `busy` paliek true un pogas paliek disabled.
 */
export async function requestCompanyVerify(opts: {
  kind: CompanyVerifySubjectKind;
  id: string;
  refresh?: boolean;
  decision?: CompanyVerifyDecision;
  fetchImpl?: CompanyVerifyClientFetch;
  timeoutMs?: number;
}): Promise<CompanyVerifyClientResult> {
  const timeoutMs = opts.timeoutMs ?? COMPANY_VERIFY_CLIENT_TIMEOUT_MS;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const mode = opts.decision ? "decide" : "load";
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;

  const fail = (e?: unknown, apiError?: string): CompanyVerifyClientResult => ({
    ok: false,
    error: mode === "decide" ? companyVerifyDecisionError(e, apiError) : companyVerifyLoadError(e, apiError),
  });

  const work = (async (): Promise<CompanyVerifyClientResult> => {
    const init: RequestInit = {
      credentials: "include",
      cache: "no-store",
      signal: ctrl.signal,
    };
    let res: Response;
    if (opts.decision || opts.refresh) {
      res = await fetchImpl("/api/admin/company-verify", {
        ...init,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: opts.kind,
          id: opts.id,
          ...(opts.decision ? { decision: opts.decision } : {}),
          ...(opts.refresh ? { refresh: true } : {}),
        }),
      });
    } else {
      res = await fetchImpl(
        `/api/admin/company-verify?kind=${encodeURIComponent(opts.kind)}&id=${encodeURIComponent(opts.id)}`,
        init,
      );
    }
    const data = (await res.json().catch(() => ({}))) as CompanyVerifyView & { error?: string };
    if (!res.ok || !data.report) return fail(undefined, data.error);
    return { ok: true, view: data };
  })();
  void work.catch(() => undefined);

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      try {
        ctrl.abort();
      } catch {
        /* ignore */
      }
      reject(abortError());
    }, timeoutMs);
  });

  try {
    return await Promise.race([work, timeout]);
  } catch (e) {
    try {
      ctrl.abort();
    } catch {
      /* ignore */
    }
    return fail(e);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Iestata busy, izpilda pieprasījumu, vienmēr noņem busy (finally), kļūdu rāda, nevis norij. */
export async function runCompanyVerifyPanelAction(opts: {
  request: () => Promise<CompanyVerifyClientResult>;
  setBusy: (busy: boolean) => void;
  setError: (error: string) => void;
  onView: (view: CompanyVerifyView) => void;
  unexpectedError: (e: unknown) => string;
}): Promise<void> {
  opts.setBusy(true);
  opts.setError("");
  try {
    const result = await opts.request();
    if (!result.ok) {
      opts.setError(result.error);
      return;
    }
    opts.onView(result.view);
  } catch (e) {
    opts.setError(opts.unexpectedError(e));
  } finally {
    opts.setBusy(false);
  }
}
