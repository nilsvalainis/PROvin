import type { IrissListingPlatform } from "@/lib/iriss-listings-types";

export type IrissAuctionLogoKey = IrissListingPlatform | "mobile" | "citi";

export const IRISS_AUCTION_LOGO_SRC: Record<Exclude<IrissAuctionLogoKey, "citi" | "autoscout24">, string> = {
  auto1: "/brand/auction/auto1.svg",
  openline: "/brand/auction/openlane.svg",
  autobid: "/brand/auction/autobid.svg",
  ecarstrade: "/brand/auction/ecarstrade.svg",
  mobile: "/brand/auction/mobile.svg",
  mobilede: "/brand/auction/mobile.svg",
};

export const IRISS_AUCTION_LOGO_LABEL: Record<IrissAuctionLogoKey, string> = {
  auto1: "Auto1",
  openline: "Openlane",
  autobid: "Autobid",
  ecarstrade: "eCarsTrade",
  mobile: "Mobile",
  mobilede: "mobile.de",
  autoscout24: "AutoScout24",
  citi: "Citi",
};

export function irissAuctionLogoSrc(key: IrissAuctionLogoKey): string | null {
  if (key === "citi" || key === "autoscout24") return null;
  return IRISS_AUCTION_LOGO_SRC[key];
}

export function listingChipLogoKey(letter: string): IrissAuctionLogoKey | null {
  if (letter === "A1") return "auto1";
  if (letter === "OL") return "openline";
  if (letter === "AB") return "autobid";
  if (letter === "ET") return "ecarstrade";
  if (letter === "M") return "mobile";
  if (letter === "C") return "citi";
  return null;
}
