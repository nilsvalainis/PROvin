/**
 * Admin paneļa ikonas — Lucide „outline”, sinhronizētas ar PDF (`lib/section-icons.ts`).
 */
import type { SourceBlockKey } from "@/lib/admin-source-blocks";
import type { LucideIcon } from "lucide-react";
import {
  Award,
  Battery,
  Camera,
  CarFront,
  ChartColumn,
  CircleUser,
  CreditCard,
  Database,
  Disc,
  Disc2,
  Droplet,
  Factory,
  FileSearch,
  FileText,
  Filter,
  Gauge,
  Globe,
  History,
  Landmark,
  Layers,
  Lightbulb,
  MessageSquare,
  Route,
  ScanSearch,
  ScrollText,
  Search,
  Shield,
  ShieldCheck,
  Snowflake,
  Tag,
  ClipboardPaste,
  GitCompareArrows,
  Wrench,
} from "lucide-react";

export const SOURCE_BLOCK_LUCIDE: Record<SourceBlockKey, LucideIcon> = {
  csdd: ScrollText,
  autodna: Database,
  carvertical: ChartColumn,
  auto_records: ShieldCheck,
  oneauto: Factory,
  cc_vin: Globe,
  tjekbil: Landmark,
  mnt_ee: Landmark,
  lkf_ee: Shield,
  carinfo: Globe,
  ltab: Shield,
  tirgus: History,
  citi_avoti: Layers,
  listing_analysis: Search,
};

export const META_ORDER_LUCIDE = {
  payment: CreditCard,
  vehicle: CarFront,
  client: CircleUser,
  history: History,
  notes: MessageSquare,
} as const satisfies Record<string, LucideIcon>;

export const LISTING_ANALYSIS_CHROME_LUCIDE = {
  mainSection: Search,
  listingHistory: History,
} as const;

export const IRISS_CHROME_LUCIDE = {
  mainSection: ShieldCheck,
  technicalRisks: Wrench,
  summary: FileSearch,
  inspection: CarFront,
  priceFit: Tag,
  internalNote: MessageSquare,
  sourcesComparison: GitCompareArrows,
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
  registryTimeline: History,
  serviceWorks: Wrench,
  ltabCertificate: FileText,
} as const;

/** Servisa darbu ikonas (`lib/service-work-icon.ts` ID sinhronizēti ar `lib/section-icons.ts`). */
export const SERVICE_WORK_LUCIDE = {
  oilDrop: Droplet,
  brakeDisc: Disc,
  tire: Disc2,
  battery: Battery,
  filter: Filter,
  coolant: Snowflake,
  bulb: Lightbulb,
} as const satisfies Record<string, LucideIcon>;

export const LISTING_PEEK_TOPIC_LUCIDE = {
  odometer: Gauge,
  incidents: Shield,
  technical: Wrench,
  seller: CircleUser,
  photos: Camera,
} as const;
