import { listingVinOcrIsCrossChecked } from "@/lib/iriss-listings-vin-from-photos";

export type ListingVinOcrGateInput = {
  platform?: string;
  vin?: string;
  vinSource?: string;
  vinOcrStatus?: string;
  imageUrl?: string;
  imageUrls?: string[];
  documentImageUrls?: string[];
};

/** Auto1 VIN OCR tikai ja nav droša VIN un ir bildes. */
export function shouldRequestListingVinOcr(v: ListingVinOcrGateInput): boolean {
  if (v.platform !== "auto1") return false;
  if (v.vin && v.vinSource !== "ocr_photo") return false;
  if (v.vinOcrStatus === "miss") return false;
  if (v.vin && listingVinOcrIsCrossChecked(v.vinOcrStatus)) return false;
  return Boolean(v.imageUrl || (v.imageUrls && v.imageUrls.length) || (v.documentImageUrls && v.documentImageUrls.length));
}
