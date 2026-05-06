import type { ReactNode } from "react";

const PROVIN_IN_TEXT = /(PROVIN(?:\.LV)?)/g;

export type RenderProvinTextOptions = {
  /** PRO un „.LV” krāsa (VIN — `vinClassName` vai `.provin-wordmark-logo-vin`). */
  proAndSuffixClassName?: string;
  /** „VIN” burti — noklusējums `.provin-wordmark-logo-vin` (zīmola #0066ff). */
  vinClassName?: string;
};

/**
 * Atrod „PROVIN” / „PROVIN.LV” tekstā un noformē kā logotipu: PRO + .LV pēc `proAndSuffixClassName`, VIN — `provin-wordmark-logo-vin`.
 */
export function renderProvinText(text: string, options?: RenderProvinTextOptions): ReactNode {
  const proLv = options?.proAndSuffixClassName ?? "provin-wordmark-pro";
  const vinClass = options?.vinClassName ?? "provin-wordmark-logo-vin";

  if (!text.includes("PROVI")) {
    return text;
  }

  const parts: ReactNode[] = [];
  let last = 0;
  let mi = 0;
  const re = new RegExp(PROVIN_IN_TEXT.source, "g");
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(text.slice(last, m.index));
    }
    const full = m[1];
    parts.push(
      <span key={`provin-${mi++}`} className="inline">
        <span className={proLv}>PRO</span>
        <span className={vinClass}>VIN</span>
        {full.endsWith(".LV") ? <span className={proLv}>.LV</span> : null}
      </span>,
    );
    last = m.index + full.length;
  }

  if (last < text.length) {
    parts.push(text.slice(last));
  }

  if (parts.length === 0) {
    return text;
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
