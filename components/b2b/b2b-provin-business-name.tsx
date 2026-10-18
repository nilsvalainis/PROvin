import type { ReactNode } from "react";
import { renderProvinText } from "@/lib/provin-wordmark";

const BUSINESS_NAME = /(PROVIN Business)/g;

/**
 * Produkta nosaukumā „PROVIN Business” VIN zīmola zilā; PRO manto apkārtējā teksta krāsu.
 * Pārējais teksts (arī citi „PROVIN”) paliek nemainīts.
 */
export function renderB2bProvinBusinessName(text: string): ReactNode {
  if (!text.includes("PROVIN Business")) return text;
  return text.split(BUSINESS_NAME).map((part, i) =>
    part === "PROVIN Business" ? (
      <span key={i}>
        {renderProvinText("PROVIN", { proAndSuffixClassName: "provin-wordmark-pro--rail-inherit" })} Business
      </span>
    ) : (
      part
    ),
  );
}
