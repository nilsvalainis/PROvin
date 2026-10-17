import { inferChannel, type AdTouch } from "@/lib/ad-attribution";

const VISIT_DONE_KEY = "provin_ad_visit_done";

/** One consented landing per tab. No personal data. */
export function reportConsentedAdVisit(touch: AdTouch): void {
  if (typeof window === "undefined") return;
  try {
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(VISIT_DONE_KEY)) return;
    sessionStorage?.setItem(VISIT_DONE_KEY, "1");
  } catch {
    return;
  }
  const body = JSON.stringify({
    channel: inferChannel(touch) ?? "direct",
    campaign: touch.cmp ?? "",
    term: touch.term ?? "",
  });
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/ad-visit", blob)) return;
    }
  } catch {
    /* fall through */
  }
  void fetch("/api/ad-visit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}
