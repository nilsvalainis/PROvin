"use client";

import { irissLvDealerPlateFont } from "@/components/admin/iriss-lv-dealer-plate-font";
import { parseLvTransitPlate } from "@/lib/iriss-pavadzimes-countdown";

const RED = "#C8102E";
const BLUE = "#003399";
const GOLD = "#FFCC00";

const EU_STARS = [
  "35.5,23.8 36.3,26.0 38.5,26.0 36.7,27.4 37.4,29.6 35.5,28.3 33.6,29.6 34.3,27.4 32.5,26.0 34.7,26.0",
  "44.0,26.1 44.8,28.2 47.0,28.3 45.2,29.7 45.9,31.9 44.0,30.6 42.1,31.9 42.8,29.7 41.0,28.3 43.2,28.2",
  "50.2,32.3 51.0,34.5 53.3,34.5 51.4,35.9 52.1,38.1 50.2,36.8 48.3,38.1 49.0,35.9 47.2,34.5 49.5,34.5",
  "52.5,40.8 53.3,43.0 55.5,43.0 53.7,44.4 54.4,46.6 52.5,45.3 50.6,46.6 51.3,44.4 49.5,43.0 51.7,43.0",
  "50.2,49.3 51.0,51.5 53.3,51.5 51.4,52.9 52.1,55.1 50.2,53.8 48.3,55.1 49.0,52.9 47.2,51.5 49.5,51.5",
  "44.0,55.5 44.8,57.7 47.0,57.7 45.2,59.1 45.9,61.3 44.0,60.0 42.1,61.3 42.8,59.1 41.0,57.7 43.2,57.7",
  "35.5,57.8 36.3,60.0 38.5,60.0 36.7,61.4 37.4,63.6 35.5,62.3 33.6,63.6 34.3,61.4 32.5,60.0 34.7,60.0",
  "27.0,55.5 27.8,57.7 30.0,57.7 28.2,59.1 28.9,61.3 27.0,60.0 25.1,61.3 25.8,59.1 24.0,57.7 26.2,57.7",
  "20.8,49.3 21.5,51.5 23.8,51.5 22.0,52.9 22.7,55.1 20.8,53.8 18.9,55.1 19.6,52.9 17.7,51.5 20.0,51.5",
  "18.5,40.8 19.3,43.0 21.5,43.0 19.7,44.4 20.4,46.6 18.5,45.3 16.6,46.6 17.3,44.4 15.5,43.0 17.7,43.0",
  "20.8,32.3 21.5,34.5 23.8,34.5 22.0,35.9 22.7,38.1 20.8,36.8 18.9,38.1 19.6,35.9 17.7,34.5 20.0,34.5",
  "27.0,26.1 27.8,28.2 30.0,28.3 28.2,29.7 28.9,31.9 27.0,30.6 25.1,31.9 25.8,29.7 24.0,28.3 26.2,28.2",
] as const;

export type LvDealerPlateProps = {
  number: string;
  selected: boolean;
  busy: boolean;
  size?: "sm" | "md";
  bottomText: string;
  owner?: string;
  busyUntil?: string;
  onClick?: () => void;
};

function plateAria(number: string, busy: boolean, selected: boolean): string {
  const state = busy ? "aizņemts" : "brīvs";
  return selected
    ? `Tirdzniecības numurs ${number}, ${state}, izvēlēts`
    : `Tirdzniecības numurs ${number}, ${state}`;
}

function PlateSvg({
  number,
  bottomText,
  hideBottom,
}: {
  number: string;
  bottomText: string;
  hideBottom: boolean;
}) {
  const parts = parseLvTransitPlate(number);
  const letter = parts?.letter ?? number.slice(0, 1);
  const digits = parts?.digits ?? number.replace(/\D/g, "").slice(0, 3);
  const last = parts?.last ?? number.slice(-1);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 536 146" aria-hidden="true" className="block h-auto w-full">
      <rect width="520" height="130" rx="10" fill="#FFFFFF" stroke="#1F2937" strokeWidth="1.5" />
      <rect x="5" y="5" width="510" height="120" rx="7" fill="none" stroke={RED} strokeWidth="4" />
      <path d="M9 9H62V121H9Z" fill={BLUE} />
      {EU_STARS.map((points) => (
        <polygon key={points} fill={GOLD} points={points} />
      ))}
      <text
        x="35.5"
        y="98"
        textAnchor="middle"
        fontFamily="Barlow Condensed, Arial Narrow, sans-serif"
        fontWeight="700"
        fontSize="26"
        fill="#fff"
      >
        LV
      </text>
      <text
        x="287"
        y="94"
        textAnchor="middle"
        fontFamily="Barlow Condensed, Arial Narrow, sans-serif"
        fontWeight="600"
        fontSize="88"
        letterSpacing="3"
        fill={RED}
      >
        {letter}
        <tspan dx="26">{digits}</tspan>-{last}
      </text>
      {hideBottom ? null : (
        <text
          x="287"
          y="117"
          textAnchor="middle"
          fontFamily="Barlow Condensed, Arial Narrow, sans-serif"
          fontWeight="500"
          fontSize="14"
          letterSpacing="0.5"
          fill={RED}
        >
          {bottomText}
        </text>
      )}
    </svg>
  );
}

export function LvDealerPlate({
  number,
  selected,
  busy,
  size = "md",
  bottomText,
  owner,
  busyUntil,
  onClick,
}: LvDealerPlateProps) {
  const hideBottom = size === "sm";
  const chipLabel = busy ? (busyUntil ? `Aizņemts · līdz ${busyUntil}` : "Aizņemts") : "Brīvs";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={plateAria(number, busy, selected)}
      className={`flex min-h-11 w-full min-w-0 flex-col items-center text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 ${
        size === "sm" ? "max-w-[132px]" : "max-w-[300px] sm:max-w-none"
      }`}
    >
      {owner ? <span className="mb-1 text-[11px] font-medium text-[#9CA3AF]">{owner}</span> : null}
      <span
        className={`block w-full rounded-[15px] ${
          selected ? "ring-2 ring-[#2563EB] ring-offset-2" : ""
        }`}
      >
        <span className={`${irissLvDealerPlateFont.className} block w-full overflow-hidden rounded-[15px]`}>
          <PlateSvg number={number} bottomText={bottomText} hideBottom={hideBottom} />
        </span>
      </span>
      <span
        className={`mt-1.5 inline-flex items-center gap-[7px] rounded-full px-2.5 py-1 text-[13px] font-medium text-[#374151] ${
          busy ? "bg-[#FFFBEB]" : "bg-[#F0FDF4]"
        }`}
      >
        <i
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: busy ? "#D97706" : "#16A34A" }}
        />
        {chipLabel}
      </span>
    </button>
  );
}
