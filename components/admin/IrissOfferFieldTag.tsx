/** Zaļš punkts pirms lauka nosaukuma = importēts (kā CSDD lauki Autoparkā). Ar roku ievadītam - nekas. */
export function IrissOfferFieldTag({ source }: { source: "auto" | "manual" }) {
  if (source !== "auto") return null;
  return (
    <span
      className="mr-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-[#16a34a]"
      title="Importēts automātiski"
      aria-label="Importēts automātiski"
    />
  );
}
