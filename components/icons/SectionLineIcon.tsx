"use client";

import type { CSSProperties } from "react";
import { PROVIN_SECTION_ICON_HEX, SECTION_ICON_INNER, type SectionIconId } from "@/lib/section-icons";

type Props = {
  id: SectionIconId;
  className?: string;
  /** Noklusējums: fiksēts PROVIN zils (saskaņots ar PDF burbuli). */
  useBrandColor?: boolean;
};

/**
 * Vienota līniju ikona (18×18, stroke 1.75) — Admin sadaļu galvenēm.
 */
export function SectionLineIcon({ id, className = "", useBrandColor = true }: Props) {
  const inner = SECTION_ICON_INNER[id];
  const style: CSSProperties | undefined = useBrandColor
    ? { color: PROVIN_SECTION_ICON_HEX }
    : undefined;
  return (
    <svg
      className={`h-[18px] w-[18px] shrink-0 ${className}`.trim()}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
