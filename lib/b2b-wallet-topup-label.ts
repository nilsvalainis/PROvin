/** Stripe produkta nosaukums partnera valodā (rēķina izrakstītājs - IRISS, #309). */
export function b2bWalletTopupProductLabel(locale: string): string {
  if (locale === "en") return "IRISS account top-up";
  if (locale === "de") return "IRISS Kontoaufladung";
  if (locale === "ru") return "Пополнение счёта IRISS";
  return "IRISS konta papildināšana";
}
