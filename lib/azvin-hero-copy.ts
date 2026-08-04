import { TP5_DEALER_BRANDS } from "@/lib/test-pricing-5-mobile";

/** VIP.VIN / Azerbaijan market demo — short English copy (locale-ready later). */

export const AZVIN_DEALER_BRANDS = TP5_DEALER_BRANDS;

export type AzvinHeroCopy = {
  brand: string;
  titlePrefix: string;
  titleAccent: string;
  cardTitle: string;
  cardDescription: string;
  features: readonly string[];
  vinPlaceholder: string;
  vinAria: string;
  ctaLabel: string;
  ctaDemoNote: string;
  turnaround: string;
  footnote: string;
  dealerBrandsTrigger: string;
  dealerBrandsAria: string;
  dealerBrandsYearNote: string;
  dealerBrandsRefundNote: string;
  dealerBrandsClose: string;
  vinInvalid: string;
};

export const AZVIN_HERO_COPY: AzvinHeroCopy = {
  brand: "VIP.VIN",
  titlePrefix: "Vehicle history ",
  titleAccent: "check",
  cardTitle: "VIP.VIN report",
  cardDescription: "History data for imported cars.",
  features: [
    "Korea & USA history",
    "Europe history",
    "Auction portal data",
    "Official dealer data",
  ],
  vinPlaceholder: "Enter VIN code",
  vinAria: "Enter VIN code",
  ctaLabel: "CHECK VIN — DEMO",
  ctaDemoNote: "Demo only — checkout coming soon.",
  turnaround: "Typical delivery: 24–48h",
  footnote: "*if data is available",
  dealerBrandsTrigger: "Supported manufacturers",
  dealerBrandsAria: "Supported manufacturers",
  dealerBrandsYearNote:
    "Official dealer data is usually available for vehicles built 2009–2026.",
  dealerBrandsRefundNote: "If no records exist for this VIN / year — 100% refund.",
  dealerBrandsClose: "Close",
  vinInvalid: "Enter a valid VIN (11–17 characters).",
};
