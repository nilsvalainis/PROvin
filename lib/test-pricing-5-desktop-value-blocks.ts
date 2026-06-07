import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Globe2,
  Headphones,
  ListChecks,
  ScanSearch,
  ShieldCheck,
} from "lucide-react";

export type Tp5DesktopValueBlock = {
  title: string;
  Icon: LucideIcon;
};

/** Desktop-only left-column value grid on `/test-pricing-5` — borderless 3×2. */
export const TP5_DESKTOP_VALUE_BLOCKS: Tp5DesktopValueBlock[] = [
  { title: "SLUDINĀJUMA AUDITS", Icon: ScanSearch },
  { title: "VĒSTURES ANALĪZE", Icon: Globe2 },
  { title: "OFICIĀLO DĪLERU DATI", Icon: ShieldCheck },
  { title: "TEHNISKO RISKU ANALĪZE", Icon: AlertTriangle },
  { title: "IETEIKUMI KLĀTIENES APSKATEI", Icon: ListChecks },
  { title: "KONSULTĀCIJAS UN ATBALSTS", Icon: Headphones },
];
