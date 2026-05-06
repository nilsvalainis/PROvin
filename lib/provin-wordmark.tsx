import type { ReactNode } from "react";

const PROVIN_IN_TEXT = /(PROVIN(?:\.LV)?)/g;

export type RenderProvinTextOptions = {
  /** PRO un „.LV” krāsa (VIN — `vinClassName` vai `.provin-wordmark-logo-vin`). */
  proAndSuffixClassName?: string;
  /** „VIN” burti — noklusējums `.provin-wordmark-logo-vin` (zīmola #0066ff). */
  vinClassName?: string;
  /**
   * Ja `true`, tikai „PROVIN” tieši pirms vārda „SELECT” saņem `vinSelectClassName` (oranžs PROVIN SELECT akcents);
   * pārējie „PROVIN” / „PROVIN.LV” — `vinClassName`.
   */
  vinAmberOnlyBeforeSelect?: boolean;
  /** „VIN” klase, ja `vinAmberOnlyBeforeSelect` un teksts ir „PROVIN SELECT…”. Noklusējums: `.provin-wordmark-logo-vin--select`. */
  vinSelectClassName?: string;
};

/**
 * Atrod „PROVIN” / „PROVIN.LV” tekstā un noformē kā logotipu: PRO + .LV pēc `proAndSuffixClassName`, VIN — pēc opcijām.
 */
const SELECT_AFTER_PROVIN = /^\s+select\b/i;

export function renderProvinText(text: string, options?: RenderProvinTextOptions): ReactNode {
  const proLv = options?.proAndSuffixClassName ?? "provin-wordmark-pro";
  const vinDefault = options?.vinClassName ?? "provin-wordmark-logo-vin";
  const vinSelect = options?.vinSelectClassName ?? "provin-wordmark-logo-vin--select";
  const selective = options?.vinAmberOnlyBeforeSelect === true;

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
    const after = text.slice(m.index + full.length);
    const isSelectBranding =
      selective && full === "PROVIN" && SELECT_AFTER_PROVIN.test(after);
    const vinClass = isSelectBranding ? vinSelect : vinDefault;
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
