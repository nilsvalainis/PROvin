import { routing } from "@/i18n/routing";

export type OrderCopy = {
  validation: {
    vin: string;
    listing: string;
    email: string;
    phone: string;
    required?: string;
    url?: string;
    /** PROVIN SELECT → Stripe, bez VIN */
    provinSelectName: string;
    provinSelectMessage: string;
  };
  errors: {
    withdrawalRequired: string;
    checkoutFailed: string;
    noUrl: string;
    network: string;
    stripeConfig: string;
    badRequest: string;
    sessionFailed: string;
    rateLimited: string;
  };
};

export async function getOrderCopy(locale: string): Promise<OrderCopy> {
  const l = routing.locales.includes(locale as (typeof routing.locales)[number])
    ? locale
    : routing.defaultLocale;
  const mod = (await import(`../messages/${l}/order.json`)).default as { Order: OrderCopy };
  return mod.Order;
}
