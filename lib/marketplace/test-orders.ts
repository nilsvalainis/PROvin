/**
 * Nils 31.10: mobile.de / AutoScout24 ielasām tikai klientu pasūtījumiem - testa / demo pasūtījumus izlaižam
 * (nosaukumā vai klienta vārdā TEST, TESTS, FABLE..., DEMO). Pašus pasūtījumus nemaina.
 */
export const MARKETPLACE_TEST_ORDER_SKIP = "testa pasūtījums - mobile.de neielasa";

const TEST_RE = /(?:^|[^\p{L}])tests?(?:[^\p{L}]|$)|fable|demo/iu;

export function marketplaceOrderIsTest(order: {
  brandModel?: string;
  clientFirstName?: string;
  clientLastName?: string;
} | null | undefined): boolean {
  if (!order) return false;
  const text = [order.brandModel, order.clientFirstName, order.clientLastName].filter(Boolean).join(" ");
  return TEST_RE.test(text);
}
