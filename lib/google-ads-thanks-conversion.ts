/**
 * /paldies: Google Ads pirkuma konversiju rāda TIKAI apmaksātai Stripe sesijai.
 * Neapmaksāta / nederīga / viltota sesija vai Stripe kļūda (`null`) = nekāda konversija (ne ar value 0).
 */
export type ThanksConversionProps = { transactionId: string; value: number; label: string };

export async function resolveThanksPageConversion(args: {
  sessionId: string | null | undefined;
  label: string | null | undefined;
  getPaidValueEur: (sessionId: string) => Promise<number | null>;
}): Promise<ThanksConversionProps | null> {
  const sid = args.sessionId?.trim();
  const label = args.label?.trim();
  if (!sid || !label) return null;
  const value = await args.getPaidValueEur(sid);
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return { transactionId: sid, value, label };
}
