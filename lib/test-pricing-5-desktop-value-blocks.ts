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
  description: string;
  Icon: LucideIcon;
};

/** Desktop-only hero value grid on `/test-pricing-5` — Lucide icons match product pricing grids. */
export const TP5_DESKTOP_VALUE_BLOCKS: Tp5DesktopValueBlock[] = [
  {
    title: "VĒSTURES ANALĪZE",
    description: "Pilna datu izpilde no lielākajām Eiropas un vietējām datubāzēm.",
    Icon: History,
  },
  {
    title: "OFICIĀLO DĪLERU DATI",
    description: "Piekļuve ražotāju digitālajām servisa grāmatiņām un reģistriem.",
    Icon: ShieldCheck,
  },
  {
    title: "SLUDINĀJUMA AUDITS",
    description: "Mākslīgā intelekta un ekspertu veikta cenu un teksta anomāliju pārbaude.",
    Icon: ScanSearch,
  },
  {
    title: "TEHNISKO RISKU ANALĪZE",
    description: "Konkrētā dzinēja un modeļa tipisko defektu un risku izvērtējums.",
    Icon: AlertTriangle,
  },
  {
    title: "IETEIKUMI KLĀTIENES APSKATEI",
    description: "Precīzs kontrolsaraksts un vadlīnijas, kam pievērst uzmanību pie auto.",
    Icon: ListChecks,
  },
  {
    title: "KONSULTĀCIJAS UN ATBALSTS",
    description: "Mūsu komandas eksperta slēdziens un atbildes uz Taviem jautājumiem.",
    Icon: Headphones,
  },
];
