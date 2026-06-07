import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Headphones,
  History,
  ListChecks,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";

export type Tp5DesktopValueBlock = {
  titleLine1: string;
  titleLine2: string;
  Icon: LucideIcon;
};

/** Desktop-only hero value grid on `/test-pricing-5` — 3×2 borderless layout, Lucide product icons. */
export const TP5_DESKTOP_VALUE_BLOCKS: Tp5DesktopValueBlock[] = [
  { titleLine1: "SLUDINĀJUMA", titleLine2: "AUDITS", Icon: ScanSearch },
  { titleLine1: "VĒSTURES", titleLine2: "ANALĪZE", Icon: History },
  { titleLine1: "OFICIĀLO", titleLine2: "DĪLERU DATI", Icon: ShieldCheck },
  { titleLine1: "TEHNISKO RISKU", titleLine2: "ANALĪZE", Icon: AlertTriangle },
  { titleLine1: "IETEIKUMI KLĀTIENES", titleLine2: "APSKATEI", Icon: ListChecks },
  { titleLine1: "KONSULTĀCIJAS", titleLine2: "UN ATBALSTS", Icon: Headphones },
];
