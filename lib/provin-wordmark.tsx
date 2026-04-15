import type { ReactNode } from "react";

const PROVIN_IN_TEXT = /(PROVIN(?:\.LV)?)/g;

/**
 * Atrod „PROVIN” / „PROVIN.LV” tekstā un noformē kā logotipu: PRO balts, VIN zils; „.LV” — balts.
 */
export function renderProvinText(text: string): ReactNode {
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
        <span className="text-white">PRO</span>
        <span className="text-provin-accent">VIN</span>
        {full.endsWith(".LV") ? <span className="text-white">.LV</span> : null}
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
