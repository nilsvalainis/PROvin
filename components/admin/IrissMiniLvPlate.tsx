import { parseLvTransitPlate } from "@/lib/iriss-pavadzimes-countdown";

export function IrissMiniLvPlate({ plate, className = "" }: { plate: string; className?: string }) {
  const parts = parseLvTransitPlate(plate);
  const label = parts ? `${parts.letter}${parts.digits}-${parts.last}` : plate;
  return (
    <span className={`iriss-mini-lv-plate ${className}`.trim()} aria-hidden>
      <span className="iriss-mini-lv-plate-eu">LV</span>
      <span className="iriss-mini-lv-plate-nr">{label}</span>
    </span>
  );
}
