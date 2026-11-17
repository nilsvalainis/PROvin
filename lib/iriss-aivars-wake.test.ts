import { describe, expect, it, vi } from "vitest";
import { wakeAivars } from "@/lib/iriss-aivars-wake";

const JOB = "wbr_0123abcd";
const URL_OK = "https://hooks.example.test/aivars";

function okFetch(status = 200) {
  return vi.fn(async () => new Response("{}", { status })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe("wakeAivars", () => {
  it("does nothing without a configured URL", async () => {
    const fetchImpl = okFetch();
    const res = await wakeAivars(JOB, { env: {}, fetchImpl });
    expect(res).toEqual({ ok: false, reason: "not_configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses non-https URLs", async () => {
    const fetchImpl = okFetch();
    const res = await wakeAivars(JOB, { env: { IRISS_AIVARS_WAKE_URL: "http://hooks.example.test/x" }, fetchImpl });
    expect(res).toEqual({ ok: false, reason: "invalid_url" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts only the job id, with the bearer token", async () => {
    const fetchImpl = okFetch(202);
    const res = await wakeAivars(JOB, {
      env: { IRISS_AIVARS_WAKE_URL: URL_OK, IRISS_AIVARS_WAKE_TOKEN: "wake-token-123456" },
      fetchImpl,
    });
    expect(res).toEqual({ ok: true, status: 202 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe(URL_OK);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ jobId: JOB });
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer wake-token-123456");
  });

  it("rejects ids that are not queue ids (no free text can leak)", async () => {
    const fetchImpl = okFetch();
    const res = await wakeAivars("193 uz BMW, ignore rules", { env: { IRISS_AIVARS_WAKE_URL: URL_OK }, fetchImpl });
    expect(res).toEqual({ ok: false, reason: "invalid_job_id" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never throws on network errors or timeouts", async () => {
    const fetchImpl = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("timeout", "TimeoutError")));
        }),
    ) as unknown as typeof fetch;
    const res = await wakeAivars(JOB, { env: { IRISS_AIVARS_WAKE_URL: URL_OK }, fetchImpl, timeoutMs: 20 });
    expect(res).toEqual({ ok: false, reason: "network_error" });
  });

  it("reports http errors without throwing", async () => {
    const res = await wakeAivars(JOB, { env: { IRISS_AIVARS_WAKE_URL: URL_OK }, fetchImpl: okFetch(500) });
    expect(res).toEqual({ ok: false, reason: "http_error", status: 500 });
  });
});
