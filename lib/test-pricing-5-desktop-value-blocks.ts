import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Globe2,
  ListChecks,
  MessageSquare,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";

export type Tp5DesktopValueBlock = {
  titleLine1: string;
  titleLine2: string;
  Icon: LucideIcon;
  /** Matches PROVIN AUDITS comparison card — red ring for technical risk. */
  riskCard?: boolean;
};

/**
 * Desktop-only hero value grid on `/test-pricing-5`.
 * Icons align with homepage PROVIN AUDITS (`HomeServiceComparisonAudit`) + two extras for 3×2.
 */
export const TP5_DESKTOP_VALUE_BLOCKS: Tp5DesktopValueBlock[] = [
  { titleLine1: "SLUDINĀJUMA", titleLine2: "AUDITS", Icon: ScanSearch },
  { titleLine1: "VĒSTURES", titleLine2: "ANALĪZE", Icon: Globe2 },
  { titleLine1: "OFICIĀLO", titleLine2: "DĪLERU DATI", Icon: ShieldCheck },
  { titleLine1: "TEHNISKO RISKU", titleLine2: "ANALĪZE", Icon: AlertTriangle, riskCard: true },
  { titleLine1: "IETEIKUMI KLĀTIENES", titleLine2: "APSKATEI", Icon: ListChecks },
  { titleLine1: "KONSULTĀCIJAS", titleLine2: "UN ATBALSTS", Icon: MessageSquare },
];
