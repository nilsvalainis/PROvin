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

/** Desktop-only hero value grid on `/test-pricing-5` — 3×2 borderless layout, Lucide product icons. */
export const TP5_DESKTOP_VALUE_BLOCKS: Tp5DesktopValueBlock[] = [
  { title: "SLUDINĀJUMA AUDITS", Icon: ScanSearch },
  { title: "VĒSTURES ANALĪZE", Icon: History },
  { title: "OFICIĀLO DĪLERU DATI", Icon: ShieldCheck },
  { title: "TEHNISKO RISKU ANALĪZE", Icon: AlertTriangle },
  { title: "IETEIKUMI KLĀTIENES APSKATEI", Icon: ListChecks },
  { title: "KONSULTĀCIJAS UN ATBALSTS", Icon: Headphones },
];
