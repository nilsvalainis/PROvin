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
  title: string;
  Icon: LucideIcon;
};

/** Desktop-only hero value grid on `/test-pricing-5` — Lucide icons match product pricing grids. */
export const TP5_DESKTOP_VALUE_BLOCKS: Tp5DesktopValueBlock[] = [
  { title: "VĒSTURES ANALĪZE", Icon: History },
  { title: "OFICIĀLO DĪLERU DATI", Icon: ShieldCheck },
  { title: "SLUDINĀJUMA AUDITS", Icon: ScanSearch },
  { title: "TEHNISKO RISKU ANALĪZE", Icon: AlertTriangle },
  { title: "IETEIKUMI KLĀTIENES APSKATEI", Icon: ListChecks },
  { title: "KONSULTĀCIJAS UN ATBALSTS", Icon: Headphones },
];
