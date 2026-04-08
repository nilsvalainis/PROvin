/**
 * Admin paneļa ikonas — Lucide „outline”, sinhronizētas ar PDF (`lib/section-icons.ts`).
 */
import type { SourceBlockKey } from "@/lib/admin-source-blocks";
import type { LucideIcon } from "lucide-react";
import {
  Award,
  CarFront,
  ChartColumn,
  CircleUser,
  CreditCard,
  Database,
  FileSearch,
  History,
  Layers,
  MessageSquare,
  Route,
  ScanSearch,
  ScrollText,
  Search,
  Shield,
  ShieldCheck,
  Tag,
  ClipboardPaste,
  FileText,
} from "lucide-react";

export const SOURCE_BLOCK_LUCIDE: Record<SourceBlockKey, LucideIcon> = {
  csdd: ScrollText,
  autodna: Database,
  carvertical: ChartColumn,
  auto_records: ShieldCheck,
  ltab: Shield,
  tirgus: History,
  citi_avoti: Layers,
  listing_analysis: Search,
};

export const META_ORDER_LUCIDE = {
  payment: CreditCard,
  vehicle: CarFront,
  client: CircleUser,
  notes: MessageSquare,
} as const satisfies Record<string, LucideIcon>;

export const LISTING_ANALYSIS_CHROME_LUCIDE = {
  mainSection: Search,
  listingHistory: History,
} as const;

export const IRISS_CHROME_LUCIDE = {
  mainSection: ShieldCheck,
  summary: FileSearch,
  inspection: CarFront,
  priceFit: Tag,
} as const;

export const LISTING_ANALYSIS_FIELD_LUCIDE: Record<
  "sellerPortrait" | "photoAnalysis" | "listingPasteRaw" | "listingSalesContext",
  LucideIcon
> = {
  sellerPortrait: Award,
  photoAnalysis: ScanSearch,
  listingPasteRaw: ClipboardPaste,
  listingSalesContext: FileText,
};

export const SUBHEADING_LUCIDE = {
  mileage: Route,
  incidents: Shield,
  listingHistory: History,
} as const;
