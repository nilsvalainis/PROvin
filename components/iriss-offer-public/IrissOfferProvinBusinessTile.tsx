import { buildPublicOrderPasutitUrl } from "@/lib/public-order-vin-prefill";

const tileClass =
  "block rounded-xl border border-[#b9d3ff] bg-white p-2.5 text-left transition-colors hover:border-[#93b8ff] hover:bg-[#fafbff]";

export function IrissOfferProvinBusinessTile({ vin }: { vin: string }) {
  const href = buildPublicOrderPasutitUrl(vin);

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={tileClass}>
      <b className="block text-[10px] font-medium leading-tight text-[#52525b]">
        PRO<span className="text-[#0066ff]">VIN</span>
        {" BUSINESS"}
      </b>
      <span className="mt-1 block text-[13px] font-semibold leading-snug text-[#111827]">Pārbaudīt vēsturi →</span>
    </a>
  );
}
