export function IrissOfferFieldTag({ source }: { source: "auto" | "manual" }) {
  if (source === "auto") {
    return (
      <span className="ml-1.5 inline-flex rounded-full bg-[#eef2ff] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.04em] text-[#3730a3]">
        Auto
      </span>
    );
  }
  return (
    <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-[0.04em] text-[#6e6e73]">Manuāli</span>
  );
}
