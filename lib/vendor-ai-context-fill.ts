import type { VendorAvotuBlockState } from "@/lib/admin-source-blocks";
import { ADMIN_MILEAGE_PASTE_RAW_MAX_LEN } from "@/lib/admin-raw-field-limits";

/** Pilns atskaites teksts AI kontekstam. Operatora jau ierakstīto tekstu nepārraksta. */
export function fillVendorAiContextIfEmpty(
  block: VendorAvotuBlockState,
  rawText: string,
): VendorAvotuBlockState {
  if ((block.aiContextRaw ?? "").trim()) return block;
  const raw = rawText.trim();
  if (!raw) return block;
  return { ...block, aiContextRaw: raw.slice(0, ADMIN_MILEAGE_PASTE_RAW_MAX_LEN) };
}
