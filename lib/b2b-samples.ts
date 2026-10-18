import type { B2bWalletProductId, B2bWalletReportLang } from "@/lib/b2b-wallet";

export type B2bWalletSampleConfig = {
  /** null = poga redzama, bet atspējota („Drīzumā”). */
  default: string | null;
  byLang?: Partial<Record<B2bWalletReportLang, string | null>>;
};

/**
 * Paraugu PDF partneru kartēm. Fails jāieliek `public/samples/b2b/` ar tieši šo nosaukumu;
 * lai pogu atspējotu, URL vietā ieraksta null.
 */
export const B2B_WALLET_SAMPLES: Record<B2bWalletProductId, B2bWalletSampleConfig> = {
  business: { default: null },
  dealer_raw: { default: "/samples/b2b/dilera-dati-raw-paraugs.pdf" },
  dealer_pro: {
    default: null,
    byLang: {
      lv: "/samples/b2b/dilera-dati-pro-paraugs-lv.pdf",
      ru: "/samples/b2b/dilera-dati-pro-paraugs-ru.pdf",
      en: "/samples/b2b/dilera-dati-pro-paraugs-en.pdf",
      de: "/samples/b2b/dilera-dati-pro-paraugs-de.pdf",
    },
  },
};

export function resolveB2bWalletSampleUrl(
  product: B2bWalletProductId,
  lang: B2bWalletReportLang,
  samples: Record<B2bWalletProductId, B2bWalletSampleConfig> = B2B_WALLET_SAMPLES,
): string | null {
  const config = samples[product];
  const byLang = config.byLang?.[lang];
  if (byLang !== undefined) return byLang?.trim() || null;
  return config.default?.trim() || null;
}
